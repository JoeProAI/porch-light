"""Verify official CMS captures and data-quality refusals, without generated records."""

import json
import unittest
from pathlib import Path

from data.adapters.us.capture_cms import DATASETS, county_quality, csv_rows, validate_url
from data.provenance.sidecar import verify

CAPTURE = (
    Path(__file__).resolve().parents[3]
    / "data/snapshot/raw/cms/20261022T030046Z-a5ce96ba"
)


class CapturedCmsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.captures = {}
        for name in DATASETS:
            path = CAPTURE / f"{name}.csv"
            if not path.is_file() or not verify(path):
                raise RuntimeError("Verified official CMS capture required; no fallback data")
            cls.captures[name] = csv_rows(path.read_bytes())

    def test_all_four_cms_source_artifacts_have_valid_provenance(self):
        for name in DATASETS:
            for suffix in (".csv", ".metadata.json"):
                with self.subTest(dataset=name, suffix=suffix):
                    self.assertTrue(verify(CAPTURE / (name + suffix)))

    def test_csv_source_url_is_the_distribution_in_captured_metadata(self):
        for name, identifier in DATASETS.items():
            metadata = json.loads((CAPTURE / f"{name}.metadata.json").read_bytes())
            sidecar = json.loads((CAPTURE / f"{name}.csv.provenance.json").read_bytes())
            self.assertEqual(metadata["identifier"], identifier)
            self.assertEqual(metadata["accessLevel"], "public")
            urls = [item.get("downloadURL") for item in metadata["distribution"]]
            self.assertIn(sidecar["source_url"], urls)
            validate_url(sidecar["source_url"])

    def test_dataset_vintages_are_not_presented_as_october_2024(self):
        expected = {"nursing_homes": "2026-09-30", "dialysis": "2026-06-16"}
        for name, modified in expected.items():
            metadata = json.loads((CAPTURE / f"{name}.metadata.json").read_bytes())
            self.assertEqual(metadata["modified"], modified)

    def test_national_capture_counts_match_the_preserved_releases(self):
        self.assertEqual(len(self.captures["nursing_homes"][1]), 14690)
        self.assertEqual(len(self.captures["dialysis"][1]), 7490)

    def test_real_manatee_rows_have_source_phones_but_no_assumed_spatial_join(self):
        for name, count in (("nursing_homes", 12), ("dialysis", 8)):
            fields, rows = self.captures[name]
            result = county_quality(fields, rows, "FL", "Manatee")
            self.assertEqual(result["source_rows"], count)
            self.assertEqual(result["missing_phone_ccns"], [])
            self.assertFalse(result["geographic_join_verified"])

    def test_actual_closed_dialysis_listing_is_identified_not_silently_called(self):
        result = county_quality(*self.captures["dialysis"], "FL", "Manatee")
        self.assertEqual(result["closed_name_ccns"], ["102538"])
        result = county_quality(*self.captures["nursing_homes"], "FL", "Manatee")
        self.assertEqual(result["closed_name_ccns"], [])

    def test_sarasota_city_does_not_override_real_manatee_county_label(self):
        fields, rows = self.captures["nursing_homes"]
        source = next(row for row in rows if row["CMS Certification Number (CCN)"] == "106025")
        self.assertEqual(source["City/Town"], "SARASOTA")
        self.assertEqual(source["County/Parish"], "Manatee")
        self.assertEqual(county_quality(fields, [source], "FL", "Manatee")["source_rows"], 1)

    def test_missing_required_source_field_is_refused(self):
        fields, rows = self.captures["dialysis"]
        fields = [field for field in fields if field != "Telephone Number"]
        with self.assertRaises(ValueError):
            county_quality(fields, rows, "FL", "Manatee")

    def test_damaged_csv_header_is_refused(self):
        raw = (CAPTURE / "dialysis.csv").read_bytes()
        first_line = raw.splitlines()[0]
        damaged = first_line + b"," + first_line + b"\n" + raw.split(b"\n", 1)[1]
        with self.assertRaises(ValueError):
            csv_rows(damaged)

    def test_foreign_download_host_is_refused(self):
        sidecar = json.loads((CAPTURE / "dialysis.csv.provenance.json").read_bytes())
        url = sidecar["source_url"]
        with self.assertRaises(ValueError):
            validate_url(url.replace("data.cms.gov", "localhost"))


if __name__ == "__main__":
    unittest.main()
