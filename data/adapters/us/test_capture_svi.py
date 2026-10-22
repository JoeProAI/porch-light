"""Verify the actual national SVI release, lossless storage and unavailable values."""

import gzip
import hashlib
import io
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from data.adapters.us.capture_census import ROOT, replay
from data.adapters.us.capture_svi import URL, inspect_csv, open_svi_text, read_percentiles
from data.adapters.us.county_sources import SVI
from data.provenance.sidecar import verify

SOURCE = SVI
CENSUS = ROOT / "data/snapshot/raw/census/20261022T033241Z-b99bf8af"
UNAVAILABLE_TRACT = "01015981901"


class CapturedSviTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not verify(SOURCE):
            raise RuntimeError("Verified national SVI capture required")
        cls.tracts = {
            row["tract_geoid"] for row in replay(CENSUS)
            if row["status"] == "census_geography_returned"
        }
        cls.percentiles = read_percentiles(SOURCE, cls.tracts | {UNAVAILABLE_TRACT})

    def test_county_subset_retains_original_national_release_provenance(self):
        metadata = json.loads(SOURCE.with_name(SOURCE.name + ".provenance.json").read_bytes())
        self.assertEqual(metadata["coverage_county_fips"], "12081")
        self.assertEqual(metadata["derivation"]["input_source_bytes"], 61102059)
        self.assertEqual(len(metadata["derivation"]["input_content_sha256"]), 64)
        self.assertEqual(metadata["source_url"], URL)
        self.assertEqual(metadata["percentile_scope"], "national")

    def test_all_fifteen_real_manatee_tracts_have_source_percentiles(self):
        self.assertEqual(len(self.tracts), 15)
        for fips in self.tracts:
            item = self.percentiles[fips]
            self.assertEqual(item["status"], "available")
            self.assertEqual(item["national_percentile"], float(item["raw_rpl_themes"]))
            self.assertTrue(0 <= item["national_percentile"] <= 1)

    def test_out_of_capture_tract_is_not_replaced_with_zero(self):
        result = self.percentiles[UNAVAILABLE_TRACT]
        self.assertEqual(result["status"], "unavailable_tract_not_in_capture")
        self.assertNotIn("national_percentile", result)

    def test_state_relative_metadata_is_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / SOURCE.name
            shutil.copyfile(SOURCE, path)
            metadata = json.loads(SOURCE.with_name(SOURCE.name + ".provenance.json").read_bytes())
            metadata["percentile_scope"] = "state"
            path.with_name(path.name + ".provenance.json").write_text(json.dumps(metadata))
            with self.assertRaises(ValueError):
                read_percentiles(path, self.tracts)

    def test_county_identifier_cannot_be_used_as_a_tract_join(self):
        with self.assertRaises(ValueError):
            read_percentiles(SOURCE, {"12081"})

    def test_duplicate_of_an_actual_source_row_is_refused(self):
        with open_svi_text(SOURCE) as stream:
            header, first_row = stream.readline(), stream.readline()
        with self.assertRaises(ValueError):
            inspect_csv(io.StringIO(header + first_row + first_row))


if __name__ == "__main__":
    unittest.main()
