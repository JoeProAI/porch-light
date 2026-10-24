"""Verify real cross-source ingestion coverage without manufacturing ranked output."""

import unittest

from data.adapters.us.preflight_manatee import report


class ManateePreflightTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = report()

    def test_actual_coverage_retains_both_real_refusals(self):
        self.assertEqual(self.result["source_facility_rows"], 20)
        self.assertEqual(self.result["geography_status_counts"], {
            "census_geography_returned": 18,
            "refused_source_closed_label": 1,
            "refused_no_address_match": 1,
        })
        self.assertEqual(self.result["unique_census_tracts"], 15)
        self.assertEqual(self.result["svi_status_counts"], {"available": 18})
        self.assertEqual(
            self.result["empower_status_counts"], {"aggregate_source_row_available": 18}
        )

    def test_refused_facilities_do_not_get_substitute_context(self):
        refused = [
            row for row in self.result["facilities"]
            if row["geography"]["status"] != "census_geography_returned"
        ]
        self.assertEqual({row["ccn"] for row in refused}, {"102538", "102646"})
        for row in refused:
            self.assertNotIn("svi", row)
            self.assertNotIn("empower", row)

    def test_ingest_coverage_is_not_mislabeled_as_ranking_or_zetaris_proof(self):
        self.assertEqual(self.result["stage"], "ingestion_preflight_only")
        self.assertFalse(self.result["ranking_ready"])
        self.assertFalse(self.result["zetaris_query_performed"])
        self.assertFalse(self.result["archived_county_plan"]["nemotron_parse_performed"])
        self.assertFalse(
            self.result["archived_county_plan"]["current_or_2024_applicability_verified"]
        )
        for row in self.result["facilities"]:
            self.assertNotIn("score", row)
            self.assertNotIn("rank", row)
            self.assertNotIn("zetaris_query_id", row)
        self.assertTrue(
            self.result["empower_counts_may_repeat_for_shared_zips_do_not_sum_per_facility"]
        )


if __name__ == "__main__":
    unittest.main()
