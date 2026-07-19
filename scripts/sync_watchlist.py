"""Sync Taiwan listed and TPEx stocks/ETFs into stocks.json."""

from __future__ import annotations

import html
import json
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WATCHLIST_PATH = PROJECT_ROOT / "public" / "data" / "stocks.json"
SOURCES = (
    ("TWSE", "https://isin.twse.com.tw/isin/C_public.jsp?strMode=2"),
    ("TPEx", "https://isin.twse.com.tw/isin/C_public.jsp?strMode=4"),
)
TAIPEI_TZ = ZoneInfo("Asia/Taipei")


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "tr":
            self._row = []
        elif tag.lower() == "td" and self._row is not None:
            self._cell = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "td" and self._row is not None and self._cell is not None:
            self._row.append(html.unescape("".join(self._cell)))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self.rows.append([" ".join(cell.split()) for cell in self._row])
            self._row = None


def fetch_rows(url: str) -> list[list[str]]:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 stock-watchlist-sync/1.0"})
    with urlopen(request, timeout=30) as response:
        parser = TableParser()
        parser.feed(response.read().decode("big5", errors="replace"))
    return parser.rows


def stock_rows(rows: list[list[str]]) -> list[tuple[str, str]]:
    results: list[tuple[str, str]] = []
    category = ""
    for row in rows:
        if not row:
            continue
        first = row[0].strip()
        if len(row) == 1:
            category = first
            continue
        if not category.startswith(("股票", "ETF")):
            continue
        match = re.match(r"^([0-9A-Z]{4,7})\s+(.+?)\s*$", first)
        if match:
            results.append((match.group(1), match.group(2)))
    return results


def main() -> int:
    stocks: dict[tuple[str, str], dict[str, str]] = {}
    for market, url in SOURCES:
        for code, name in stock_rows(fetch_rows(url)):
            stocks[(market, code)] = {"market": market, "code": code, "name": name}

    if not stocks:
        raise RuntimeError("No stocks were parsed from the official TWSE ISIN pages")

    payload = {
        "last_updated_at": datetime.now(TAIPEI_TZ).isoformat(),
        "stocks": [stocks[key] for key in sorted(stocks, key=lambda item: (item[0], item[1]))]
    }
    with WATCHLIST_PATH.open("w", encoding="utf-8") as output:
        json.dump(payload, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(f"Synced {len(stocks)} stocks to {WATCHLIST_PATH}")
    for market, _ in SOURCES:
        print(f"  {market}: {sum(1 for item in stocks if item[0] == market)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
