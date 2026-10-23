"""Regression tests for merging stock-price history."""

from __future__ import annotations

import json
import unittest
from datetime import datetime, timezone
from io import BytesIO
from unittest.mock import patch

from scripts.fetch_stock_prices import _merge_daily_records, fetch_chart_rows


class MergeDailyRecordsTests(unittest.TestCase):
    """Verify date replacement rules for historical stock records."""

    def test_replaces_all_existing_rows_for_an_updated_date(self) -> None:
        """A fetched date replaces every matching historical row."""
        existing_records = [
            {"date": "2024-01-02", "close": 10.0, "retrieved_at": "old-a"},
            {"date": "2024-01-02", "close": 11.0, "retrieved_at": "old-b"},
            {"date": "2024-01-03", "close": 12.0, "retrieved_at": "old"},
        ]

        actual = _merge_daily_records(
            existing_records,
            [("2024-01-02", 20.0, 2_000)],
            "new",
        )

        self.assertEqual(
            [("2024-01-02", 20.0), ("2024-01-03", 12.0)],
            [(item["date"], item["close"]) for item in actual],
        )

    def test_preserves_duplicate_rows_for_unfetched_dates(self) -> None:
        """Existing duplicates remain when their trading date is not fetched."""
        existing_records = [
            {"date": "2024-01-02", "close": 10.0, "retrieved_at": "old-a"},
            {"date": "2024-01-02", "close": 11.0, "retrieved_at": "old-b"},
        ]

        actual = _merge_daily_records(
            existing_records,
            [("2024-01-03", 12.0, 1_200)],
            "new",
        )

        self.assertEqual(
            [
                ("2024-01-02", 10.0),
                ("2024-01-02", 11.0),
                ("2024-01-03", 12.0),
            ],
            [(item["date"], item["close"]) for item in actual],
        )

    def test_last_fetched_row_wins_for_a_duplicate_date(self) -> None:
        """The final fetched close replaces older and earlier fetched rows."""
        existing_records = [
            {"date": "2024-01-03", "close": 12.0, "retrieved_at": "old"},
        ]

        actual = _merge_daily_records(
            existing_records,
            [("2024-01-03", 20.0, 2_000), ("2024-01-03", 21.0, 2_100)],
            "new",
        )

        self.assertEqual(
            [("2024-01-03", 21.0)],
            [(item["date"], item["close"]) for item in actual],
        )



class VolumeIngestionTests(unittest.TestCase):
    """Verify daily volume is parsed and preserved with close prices."""

    def test_fetch_chart_rows_returns_close_and_volume(self) -> None:
        """Yahoo quote arrays align close and volume by trading timestamp."""
        timestamp = int(datetime(2026, 10, 20, 1, tzinfo=timezone.utc).timestamp())
        payload = {
            "chart": {
                "result": [{
                    "timestamp": [timestamp, timestamp + 86_400],
                    "indicators": {"quote": [{
                        "close": [100.5, 101.25],
                        "volume": [1_500_000, None],
                    }]},
                }],
            },
        }

        with patch("scripts.fetch_stock_prices.urlopen", return_value=BytesIO(json.dumps(payload).encode("utf-8"))):
            rows = fetch_chart_rows("0050.TW", {"range": "2d", "interval": "1d"})

        self.assertEqual(
            [("2026-10-20", 100.5, 1_500_000), ("2026-10-21", 101.25, None)],
            rows,
        )

    def test_merge_daily_records_stores_volume_and_preserves_known_volume(self) -> None:
        """Fetched volume replaces a date while missing volume keeps old data."""
        existing = [
            {"date": "2026-10-20", "close": 100.0, "volume": 900},
            {"date": "2026-10-21", "close": 101.0, "volume": 1_000},
        ]

        updated = _merge_daily_records(
            existing,
            [("2026-10-20", 100.5, 1_500), ("2026-10-21", 101.25, None)],
            "new",
        )

        self.assertEqual(
            [("2026-10-20", 100.5, 1_500), ("2026-10-21", 101.25, 1_000)],
            [(item["date"], item["close"], item.get("volume")) for item in updated],
        )


if __name__ == "__main__":
    unittest.main()
