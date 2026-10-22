"""Integration proof against the actual local licensed JDBC engine and audit store."""

import unittest

from engines.zetaris_client import audited_query
from engines.data_access import ZetarisRepository


class LiveZetarisTests(unittest.TestCase):
    def test_registered_source_returns_real_rows_with_closed_audit_references(self):
        bundle = ZetarisRepository().read_bundle()
        self.assertEqual(len(bundle["rows"]), 20)
        self.assertEqual(bundle["read_receipt"]["data_access_mode"], "zetaris")
        ids = bundle["read_receipt"]["zetaris_query_ids"]
        self.assertEqual(len(ids), 1)
        self.assertTrue(ids[0].isdigit())
        self.assertTrue(bundle["read_receipt"]["zetaris_audit"]["finish_successfully"])
        self.assertTrue(all(row["zetaris_query_ids"] == ids for row in bundle["rows"]))
        self.assertTrue(all(row["county_fips"] == "12081" for row in bundle["rows"]))

    def test_real_statement_has_exactly_one_successful_vendor_audit_receipt(self):
        result = audited_query("SELECT current_timestamp() AS executed_clock")
        self.assertEqual(len(result["rows"]), 1)
        self.assertTrue(result["rows"][0]["executed_clock"])
        receipt = result["audit"]
        self.assertTrue(receipt["finish_successfully"])
        self.assertTrue(receipt["query_id"].isdigit())
        self.assertTrue(receipt["end_time"])
        self.assertIn(result["correlation_marker"], receipt["sql_query"])
        self.assertNotIn("mock", receipt["query_id"].lower())


if __name__ == "__main__":
    unittest.main()
