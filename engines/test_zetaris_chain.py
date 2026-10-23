"""Integration checks against real source relations and independently closed vendor audits."""

import unittest

from engines.data_access import ZetarisRepository
from engines.rank_manatee import build_snapshot
from engines.zetaris_chain import ZetarisChainRepository


class LiveChainTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repository = ZetarisChainRepository()
        cls.bundle = cls.repository.read_bundle()

    def test_each_statement_has_its_own_successful_audit_and_counted_join(self):
        receipt = self.bundle["read_receipt"]
        steps = receipt["chain_steps"]
        identifiers = receipt["zetaris_query_ids"]
        self.assertEqual(len(identifiers), 7)
        self.assertEqual(len(set(identifiers)), 7)
        for step in steps:
            self.assertEqual(step["query_ids"], [step["audit"]["query_id"]])
            self.assertTrue(step["audit"]["finish_successfully"])
            self.assertTrue(step["audit"]["end_time"])
        for step in steps[1:4]:
            self.assertIn("JOIN", step["audit"]["sql_query"])
            self.assertIn("COUNT", step["audit"]["sql_query"])
            self.assertEqual(step["candidate_count"], 20)
            self.assertGreater(step["matched_count"], 0)
        self.assertEqual(len(self.bundle["join_path"]), 3)
        self.assertEqual(self.bundle["fact_query_ids"]["svi_pct"], identifiers[2])
        self.assertEqual(self.bundle["fact_query_ids"]["empower_dme_count"], identifiers[3])

    def test_separate_source_joins_reproduce_the_prejoined_source_facts(self):
        previous = ZetarisRepository().read_bundle()
        old = {(row["source_kind"], row["ccn"]): row for row in previous["rows"]}
        self.assertEqual(len(old), len(self.bundle["rows"]))
        for row in self.bundle["rows"]:
            before = old[row["source_kind"], row["ccn"]]
            for field in ("facility_name", "source_phone", "geography_status", "warning_covers",
                          "national_svi_percentile", "latitude", "longitude",
                          "reported_zip_dme_count", "reported_zip_medicare_beneficiaries"):
                self.assertEqual(before[field], row[field], (row["ccn"], field))
            self.assertEqual(before["raw_record"], row["raw_record"])

    def test_real_ranking_and_refusals_are_unchanged(self):
        class CapturedRepository:
            def read_bundle(inner):
                return self.bundle

        snapshot = build_snapshot(CapturedRepository())
        self.assertEqual(snapshot["counts"], {"source_rows": 20, "ranked_rows": 18, "refused_rows": 2})
        for row in snapshot["facilities"]:
            self.assertEqual(len(row["evidence"]["join_path"]), 3)
            self.assertTrue(all(fact["query_id"] in row["evidence"]["zetaris_query_ids"]
                                for fact in row["evidence"]["facts"]))
        self.assertEqual(snapshot["facilities"][0]["name"], "DaVita Manatee Bay")
        self.assertAlmostEqual(snapshot["facilities"][0]["score"]["total"], .8011138888888889)


if __name__ == "__main__":
    unittest.main()
