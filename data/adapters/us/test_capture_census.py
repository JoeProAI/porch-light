"""Validate real Census responses against their original CMS inputs."""

import copy
import json
import tempfile
import unittest
from pathlib import Path

from data.adapters.us.capture_census import (
    BENCHMARK, CMS_CAPTURE, VINTAGE, geography_result, query_url, replay, source_records,
)
from data.provenance.sidecar import sha256_of, verify

CAPTURE = (
    Path(__file__).resolve().parents[3]
    / "data/snapshot/raw/census/20261022T033241Z-b99bf8af"
)


class CapturedCensusTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not verify(CAPTURE / "benchmarks.json") or not verify(CAPTURE / "vintages.json"):
            raise RuntimeError("Real verified Census capture required; no fallback data")
        cls.records = source_records(CMS_CAPTURE)

    def record(self, ccn):
        return next(
            (kind, row, source) for kind, row, source in self.records
            if row["CMS Certification Number (CCN)"] == ccn
        )

    def document(self, kind, ccn):
        path = CAPTURE / f"{kind}-{ccn}.json"
        if not verify(path):
            raise RuntimeError("Real verified Census response required")
        return json.loads(path.read_bytes())

    def test_all_twenty_one_source_artifacts_have_verified_provenance(self):
        files = [
            path for path in CAPTURE.glob("*.json")
            if not path.name.endswith(".provenance.json")
        ]
        self.assertEqual(len(files), 21)
        self.assertTrue(all(verify(path) for path in files))

    def test_selected_benchmark_and_geography_vintage_are_actually_available(self):
        benchmarks = json.loads((CAPTURE / "benchmarks.json").read_bytes())
        vintages = json.loads((CAPTURE / "vintages.json").read_bytes())
        self.assertIn(BENCHMARK, [row["benchmarkName"] for row in benchmarks["benchmarks"]])
        self.assertIn(VINTAGE, [row["vintageName"] for row in vintages["vintages"]])

    def test_cms_input_hash_ccn_and_census_url_are_bound(self):
        for kind, row, source in self.records:
            ccn = row["CMS Certification Number (CCN)"]
            if ccn == "102538":
                continue
            path = CAPTURE / f"{kind}-{ccn}.json.provenance.json"
            metadata = json.loads(path.read_bytes())
            self.assertEqual(metadata["source_url"], query_url(kind, row))
            self.assertEqual(metadata["request_input_source"]["ccn"], ccn)
            self.assertEqual(metadata["request_input_source"]["sha256"], sha256_of(source))

    def test_all_twelve_cms_nursing_home_points_have_manatee_geography(self):
        for kind, row, _ in self.records:
            if kind != "nursing_homes":
                continue
            ccn = row["CMS Certification Number (CCN)"]
            result = geography_result(kind, self.document(kind, ccn), row)
            self.assertEqual(result["status"], "census_geography_returned")
            self.assertEqual(result["county_geoid"], "12081")
            self.assertTrue(result["tract_geoid"].startswith("12081"))
            self.assertEqual(result["lat"], float(row["Latitude"]))
            self.assertEqual(result["lon"], float(row["Longitude"]))
            self.assertEqual(result["coordinate_source"], "cms_provided")
            self.assertTrue(result["address_quality_review_required"])

    def test_real_failed_address_stays_failed_without_coordinates(self):
        kind, row, _ = self.record("102646")
        result = geography_result(kind, self.document(kind, "102646"), row)
        self.assertEqual(result["status"], "refused_no_address_match")
        self.assertEqual(result["match_count"], 0)
        self.assertNotIn("lat", result)
        self.assertNotIn("lon", result)

    def test_six_real_dialysis_matches_do_not_invent_an_exact_match_rating(self):
        for ccn in ("102849", "102853", "682503", "682519", "682713", "682766"):
            kind, row, _ = self.record(ccn)
            result = geography_result(kind, self.document(kind, ccn), row)
            self.assertEqual(result["county_geoid"], "12081")
            self.assertIsNone(result["address_match_quality"])
            self.assertTrue(result["address_quality_review_required"])

    def test_closed_source_listing_never_gets_a_census_request(self):
        kind, row, _ = self.record("102538")
        with self.assertRaises(ValueError):
            query_url(kind, row)
        self.assertFalse((CAPTURE / "dialysis-102538.json").exists())

    def test_missing_request_coordinate_echo_is_refused(self):
        kind, row, _ = self.record("105045")
        document = self.document(kind, "105045")
        document["result"]["input"].pop("location")
        self.assertEqual(
            geography_result(kind, document, row)["status"],
            "refused_request_input_mismatch",
        )

    def test_geography_cannot_be_attached_to_a_different_real_facility(self):
        kind, row, _ = self.record("105159")
        document = self.document(kind, "105045")
        self.assertEqual(
            geography_result(kind, document, row)["status"],
            "refused_request_input_mismatch",
        )

    def test_missing_tract_is_refused_not_filled_from_zip(self):
        kind, row, _ = self.record("105045")
        document = self.document(kind, "105045")
        document["result"]["geographies"].pop("Census Tracts")
        self.assertEqual(
            geography_result(kind, document, row)["status"],
            "refused_missing_or_ambiguous_geography",
        )

    def test_replay_verifies_the_capture_and_preserves_real_refusals(self):
        results = replay(CAPTURE)
        self.assertEqual(len(results), 20)
        counts = {}
        for row in results:
            counts[row["status"]] = counts.get(row["status"], 0) + 1
        self.assertEqual(counts, {
            "census_geography_returned": 18,
            "refused_no_address_match": 1,
            "refused_source_closed_label": 1,
        })

    def test_changed_source_url_is_rejected_even_when_response_hash_still_matches(self):
        source = CAPTURE / "nursing_homes-105045.json"
        metadata_file = source.with_name(source.name + ".provenance.json")
        metadata = copy.deepcopy(json.loads(metadata_file.read_bytes()))
        metadata["source_url"] = metadata["source_url"].replace("x=-82.54", "x=")
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            (directory / source.name).write_bytes(source.read_bytes())
            (directory / metadata_file.name).write_text(json.dumps(metadata))
            result = next(row for row in replay(directory) if row["ccn"] == "105045")
            self.assertEqual(result["status"], "refused_input_provenance_mismatch")


if __name__ == "__main__":
    unittest.main()
