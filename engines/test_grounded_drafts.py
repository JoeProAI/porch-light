"""Deterministic grounding tests use the actual audited Manatee source snapshot."""

import copy
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from engines.generate_drafts import read_verified_snapshot
from engines.grounded_drafts import audit_lock, compose_selection, source_catalog


class GroundingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = read_verified_snapshot(Path(__file__).parent / "snapshots/manatee-zetaris-chain.json")
        cls.row = cls.snapshot["facilities"][0]

    def selection(self):
        return {"ccn": self.row["ccn"], "clause_ids": ["cms_rating", "tract_svi", "zip_context"],
                "question_ids": ["contact", "power", "water"]}

    def test_each_real_facility_can_render_exact_source_clauses(self):
        for row in self.snapshot["facilities"]:
            selection = {**self.selection(), "ccn": row["ccn"]}
            draft = compose_selection(row, selection)
            self.assertTrue(draft["grounding"]["passed"])
            self.assertEqual(len(draft["questions"]), 3)
            self.assertTrue(set(draft["grounding"]["query_ids"]).issubset(row["evidence"]["zetaris_query_ids"]))
            self.assertEqual(len(source_catalog(row)["clauses"]), 3)
            self.assertIn("not facility patient counts", draft["text"])

    def test_free_prose_unknown_claims_and_duplicate_ids_are_rejected(self):
        variants = [
            {**self.selection(), "text": "Facility has lost power"},
            {**self.selection(), "ccn": "000000"},
            {**self.selection(), "clause_ids": ["cms_rating", "cms_rating", "zip_context"]},
            {**self.selection(), "question_ids": ["invented_condition", "power"]},
            {**self.selection(), "question_ids": ["power", "power"]},
        ]
        for selection in variants:
            with self.assertRaises(ValueError):
                compose_selection(self.row, selection)

    def test_broken_source_query_references_fail_closed(self):
        row = copy.deepcopy(self.row)
        row["evidence"]["facts"][0]["query_id"] = "unclosed"
        row["evidence"]["facts"][1]["query_id"] = "unclosed"
        with self.assertRaises(ValueError):
            source_catalog(row)

    def test_windows_lock_contention_retries_without_removing_another_lock(self):
        actual_open = os.open
        attempts = 0

        def contend_once(path, flags):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise PermissionError("Windows sharing violation")
            return actual_open(path, flags)

        with tempfile.TemporaryDirectory() as folder:
            lock = Path(folder) / ".porchlight/model-audit.lock"
            with patch("pathlib.Path.home", return_value=Path(folder)):
                with patch("engines.grounded_drafts.os.open", side_effect=contend_once):
                    with audit_lock():
                        self.assertTrue(lock.exists())
            self.assertEqual(attempts, 2)
            self.assertFalse(lock.exists())

    def test_persistent_lock_permission_failure_still_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch("pathlib.Path.home", return_value=Path(folder)):
                with patch("engines.grounded_drafts.os.open", side_effect=PermissionError("Denied")):
                    with patch("engines.grounded_drafts.time.monotonic", side_effect=[0, 11]):
                        with self.assertRaisesRegex(RuntimeError, "locked"):
                            with audit_lock():
                                self.fail("An inaccessible audit lock must not permit a call")


if __name__ == "__main__":
    unittest.main()
