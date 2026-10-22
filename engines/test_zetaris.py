"""Integration proof against the actual local licensed JDBC engine and audit store."""

import unittest

from engines.zetaris_client import audited_query


class LiveZetarisTests(unittest.TestCase):
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
