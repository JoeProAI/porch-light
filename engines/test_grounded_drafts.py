"""Deterministic grounding tests use the actual audited Manatee source snapshot."""

import copy
import unittest
from pathlib import Path

from engines.generate_drafts import read_verified_snapshot
from engines.grounded_drafts import compose_selection, source_catalog


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


if __name__ == "__main__":
    unittest.main()
