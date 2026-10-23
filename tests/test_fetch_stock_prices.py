"""Regression tests for merging stock-price history."""

from __future__ import annotations

import unittest

from scripts.fetch_stock_prices import _merge_daily_records


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
            [("2024-01-02", 20.0)],
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
            [("2024-01-03", 12.0)],
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
            [("2024-01-03", 20.0), ("2024-01-03", 21.0)],
            "new",
        )

        self.assertEqual(
            [("2024-01-03", 21.0)],
            [(item["date"], item["close"]) for item in actual],
        )


if __name__ == "__main__":
    unittest.main()
