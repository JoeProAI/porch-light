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
from data.adapters.us.capture_svi import URL, inspect_csv, read_percentiles
from data.provenance.sidecar import verify

SOURCE = ROOT / "data/snapshot/raw/svi/20261022T034709Z-8417dfb9/SVI_2022_US.csv.gz"
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

    def test_compression_preserves_the_exact_downloaded_source_bytes(self):
        metadata = json.loads(SOURCE.with_name(SOURCE.name + ".provenance.json").read_bytes())
        digest = hashlib.sha256()
        size = 0
        with gzip.open(SOURCE, "rb") as stream:
            while block := stream.read(1024 * 1024):
                digest.update(block)
                size += len(block)
        self.assertEqual(digest.hexdigest(), metadata["source_content_sha256"])
        self.assertEqual(size, 61102059)
        self.assertEqual(size, metadata["source_content_bytes"])
        self.assertEqual(metadata["source_url"], URL)
        self.assertEqual(metadata["percentile_scope"], "national")

    def test_the_complete_release_is_national_not_a_florida_only_replacement(self):
        with gzip.open(SOURCE, "rt", encoding="utf-8-sig", newline="") as stream:
            result = inspect_csv(stream)
        self.assertEqual(result["tract_rows"], 84120)
        self.assertEqual(result["florida_rows"], 5122)
        self.assertEqual(result["state_or_territory_codes"], 51)
        self.assertEqual(result["unavailable_percentile_rows"], 778)

    def test_all_fifteen_real_manatee_tracts_have_source_percentiles(self):
        self.assertEqual(len(self.tracts), 15)
        for fips in self.tracts:
            item = self.percentiles[fips]
            self.assertEqual(item["status"], "available")
            self.assertEqual(item["national_percentile"], float(item["raw_rpl_themes"]))
            self.assertTrue(0 <= item["national_percentile"] <= 1)

    def test_actual_unavailable_source_value_is_not_replaced_with_zero(self):
        result = self.percentiles[UNAVAILABLE_TRACT]
        self.assertEqual(result["status"], "unavailable_source_value")
        self.assertEqual(result["raw_rpl_themes"], "-999.0")
        self.assertIsNone(result["national_percentile"])

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
        with gzip.open(SOURCE, "rt", encoding="utf-8-sig", newline="") as stream:
            header, first_row = stream.readline(), stream.readline()
        with self.assertRaises(ValueError):
            inspect_csv(io.StringIO(header + first_row + first_row))


if __name__ == "__main__":
    unittest.main()
