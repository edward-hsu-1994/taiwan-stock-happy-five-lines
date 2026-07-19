"""Fetch daily Taiwan stock closes from Yahoo Finance and persist them locally."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import yaml


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = PROJECT_ROOT / "job" / "watchlist.yml"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "job" / "data"
TAIPEI_TZ = ZoneInfo("Asia/Taipei")
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("latest", "backfill"), default="latest")
    parser.add_argument("--start-date", help="Backfill start date in YYYY-MM-DD format")
    parser.add_argument("--end-date", help="Backfill end date in YYYY-MM-DD format")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()
    if args.mode == "backfill" and not args.start_date:
        parser.error("--start-date is required when --mode=backfill")
    if args.mode == "backfill" and not args.end_date:
        parser.error("--end-date is required when --mode=backfill")
    if args.mode == "latest" and (args.start_date or args.end_date):
        parser.error("--start-date and --end-date can only be used with --mode=backfill")
    if args.mode == "backfill":
        try:
            start_date = date.fromisoformat(args.start_date)
            end_date = date.fromisoformat(args.end_date)
        except ValueError as error:
            parser.error(f"Backfill dates must use YYYY-MM-DD format: {error}")
        if start_date > end_date:
            parser.error("--start-date cannot be later than --end-date")
    return args


def load_watchlist(config_path: Path) -> list[dict[str, str]]:
    with config_path.open(encoding="utf-8") as config_file:
        config = yaml.safe_load(config_file) or {}

    stocks = config.get("stocks")
    if not isinstance(stocks, list):
        raise ValueError(f"Expected a 'stocks' list in {config_path}")
    if not stocks:
        raise ValueError("The watchlist cannot be empty")

    validated: list[dict[str, str]] = []
    for stock in stocks:
        if not isinstance(stock, dict):
            raise ValueError("Every watchlist item must be an object")

        market = str(stock.get("market", ""))
        code = str(stock.get("code", ""))
        name = str(stock.get("name", ""))
        if market not in {"TWSE", "TPEx"}:
            raise ValueError(f"Unsupported market '{market}' for {code}")
        if not code.isdigit() or not name:
            raise ValueError(f"Invalid stock entry: {stock}")
        validated.append({"market": market, "code": code, "name": name})
    return validated


def yahoo_symbol(stock: dict[str, str]) -> str:
    suffix = ".TW" if stock["market"] == "TWSE" else ".TWO"
    return f"{stock['code']}{suffix}"


def remove_unwatched_data(watchlist: list[dict[str, str]], output_dir: Path) -> list[Path]:
    watched_codes = {stock["code"] for stock in watchlist}
    removed_paths: list[Path] = []
    if not output_dir.exists():
        return removed_paths

    for data_path in output_dir.glob("*.json"):
        if data_path.stem not in watched_codes:
            data_path.unlink()
            removed_paths.append(data_path)
    return removed_paths


def fetch_chart_rows(symbol: str, query_params: dict[str, str]) -> list[tuple[str, float]]:
    query = urlencode(query_params)
    request = Request(
        f"{YAHOO_CHART_URL}/{symbol}?{query}",
        headers={"User-Agent": "Mozilla/5.0 stock-watchlist-job/1.0"},
    )
    with urlopen(request, timeout=30) as response:
        payload: dict[str, Any] = json.load(response)

    result = (payload.get("chart") or {}).get("result")
    if not result:
        error = (payload.get("chart") or {}).get("error") or {}
        raise RuntimeError(error.get("description") or f"No chart data returned for {symbol}")

    chart = result[0]
    timestamps = chart.get("timestamp") or []
    closes = (((chart.get("indicators") or {}).get("quote") or [{}])[0]).get("close") or []
    rows = [
        (
            datetime.fromtimestamp(timestamp, tz=timezone.utc)
            .astimezone(TAIPEI_TZ)
            .date()
            .isoformat(),
            float(close),
        )
        for timestamp, close in zip(timestamps, closes)
        if close is not None
    ]
    if not rows:
        raise RuntimeError(f"No closing price returned for {symbol}")
    return rows


def fetch_latest_close(symbol: str) -> list[tuple[str, float]]:
    rows = fetch_chart_rows(symbol, {"range": "5d", "interval": "1d", "includePrePost": "false"})
    return rows[-1:]


def fetch_date_range(symbol: str, start_date: str, end_date: str) -> list[tuple[str, float]]:
    start = datetime.combine(date.fromisoformat(start_date), time.min, tzinfo=TAIPEI_TZ)
    end = datetime.combine(date.fromisoformat(end_date) + timedelta(days=1), time.min, tzinfo=TAIPEI_TZ)
    return fetch_chart_rows(
        symbol,
        {
            "period1": str(int(start.timestamp())),
            "period2": str(int(end.timestamp())),
            "interval": "1d",
            "includePrePost": "false",
        },
    )

def write_daily_records(stock: dict[str, str], rows: list[tuple[str, float]], output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{stock['code']}.json"
    records: list[dict[str, Any]] = []
    if output_path.exists():
        with output_path.open(encoding="utf-8") as data_file:
            existing = json.load(data_file)
        if isinstance(existing, list):
            records = existing
        elif isinstance(existing, dict) and isinstance(existing.get("data"), list):
            records = existing["data"]
        else:
            raise ValueError(f"Expected a legacy JSON array or object with a data array in {output_path}")

    retrieved_at = datetime.now(timezone.utc).isoformat()
    for trading_date, close in rows:
        record = {
            "date": trading_date,
            "close": close,
            "retrieved_at": retrieved_at,
        }
        records = [item for item in records if item.get("date") != trading_date]
        records.append(record)
    records.sort(key=lambda item: item.get("date", ""))
    payload = {
        "market": stock["market"],
        "code": stock["code"],
        "name": stock["name"],
        "symbol": yahoo_symbol(stock),
        "currency": "TWD",
        "source": "Yahoo Finance",
        "data": records,
    }
    temporary_path = output_path.with_suffix(".json.tmp")
    with temporary_path.open("w", encoding="utf-8") as data_file:
        json.dump(payload, data_file, ensure_ascii=False, indent=2)
        data_file.write("\n")
    temporary_path.replace(output_path)
    return output_path


def main() -> int:
    args = parse_args()
    try:
        watchlist = load_watchlist(args.config)
        removed_paths = remove_unwatched_data(watchlist, args.output_dir)
        for removed_path in removed_paths:
            print(f"Removed unwatched stock data: {removed_path}")
        errors: list[str] = []
        for stock in watchlist:
            symbol = yahoo_symbol(stock)
            try:
                if args.mode == "latest":
                    rows = fetch_latest_close(symbol)
                else:
                    rows = fetch_date_range(symbol, args.start_date, args.end_date)
                output_path = write_daily_records(stock, rows, args.output_dir)
                if args.mode == "latest":
                    trading_date, close = rows[0]
                    print(f"{symbol}: {trading_date} close={close:g} -> {output_path}")
                else:
                    print(f"{symbol}: {len(rows)} daily closes -> {output_path}")
            except (OSError, RuntimeError) as error:
                errors.append(f"{symbol}: {error}")
        if errors:
            for error in errors:
                print(f"Error: {error}", file=sys.stderr)
            return 1
    except (OSError, ValueError, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
