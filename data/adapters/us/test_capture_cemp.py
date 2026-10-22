"""Verify the archived official county-plan PDF without claiming current policy."""

import hashlib
import json
import unittest

from data.adapters.us.capture_census import ROOT
from data.adapters.us.capture_cemp import DOCUMENTS
from data.provenance.sidecar import verify

SOURCE = ROOT / "data/snapshot/raw/cemp/20261022T033833Z-30a3bbd5/bradenton_adoption_2020.pdf"
CONTENT_HASH = "0267286a8b0bf7901b23f549649fc7d22dedea7ae6d7842c8a349db44b7e4d77"


class CapturedPlanTests(unittest.TestCase):
    def test_exact_official_document_inspected_locally_is_preserved(self):
        self.assertTrue(verify(SOURCE))
        self.assertEqual(hashlib.sha256(SOURCE.read_bytes()).hexdigest(), CONTENT_HASH)

    def test_source_is_the_official_city_adoption_record_not_an_html_landing_page(self):
        metadata = json.loads(SOURCE.with_name(SOURCE.name + ".provenance.json").read_bytes())
        self.assertEqual(metadata["source_url"], DOCUMENTS["bradenton_adoption_2020"])
        raw = SOURCE.read_bytes()
        self.assertTrue(raw.startswith(b"%PDF-"))
        self.assertIn(b"%%EOF", raw[-1024:])
        self.assertEqual(len(raw), 6132371)

    def test_failed_clerk_download_is_not_replaced_with_another_document(self):
        self.assertFalse((SOURCE.parent / "manatee_cemp_2018.pdf").exists())
        self.assertNotEqual(
            DOCUMENTS["manatee_cemp_2018"], DOCUMENTS["bradenton_adoption_2020"]
        )


if __name__ == "__main__":
    unittest.main()
