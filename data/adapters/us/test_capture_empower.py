"""Verify the actual HHS layer, aggregate scope and source masking cautions."""

import copy
import json
import unittest
from collections import Counter

from data.adapters.us.capture_census import CMS_CAPTURE, ROOT
from data.adapters.us.capture_cms import csv_rows
from data.adapters.us.capture_empower import LAYER_ID, LAYER_NAME, read_snapshot, validate_identity, zip_context
from data.provenance.sidecar import verify

CAPTURE = ROOT / "data/snapshot/raw/empower/20261022T034841Z-6bed0765"


class CapturedEmpowerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.metadata, cls.rows = read_snapshot(CAPTURE)

    def test_all_three_source_artifacts_have_verified_provenance(self):
        paths = [CAPTURE / name for name in ("layer.json", "florida_count.json", "page-000.json")]
        self.assertTrue(all(verify(path) for path in paths))

    def test_exact_layer_identity_is_retained(self):
        self.assertEqual(self.metadata["id"], LAYER_ID)
        self.assertEqual(self.metadata["name"], LAYER_NAME)
        validate_identity(self.metadata)

    def test_a_missing_layer_identity_is_refused(self):
        damaged = copy.deepcopy(self.metadata)
        damaged.pop("id")
        with self.assertRaises(ValueError):
            validate_identity(damaged)

    def test_the_entire_florida_query_is_retained_without_duplicate_object_ids(self):
        count = json.loads((CAPTURE / "florida_count.json").read_bytes())["count"]
        self.assertEqual(count, 968)
        self.assertEqual(len(self.rows), count)
        self.assertEqual(len({row["OBJECTID"] for row in self.rows}), count)
        self.assertEqual({row["STATE"] for row in self.rows}, {"FL"})

    def test_context_counts_are_the_actual_zip_row_not_a_facility_patient_count(self):
        source = next(
            row for row in self.rows
            if row["Zip_Code_Recode"] == "34208" and row["FIPS_Code"] == "12081"
        )
        result = zip_context(CAPTURE, "34208", "12081")
        self.assertEqual(result["reported_dme_count"], source["Power_Dependent_Devices_DME"])
        self.assertEqual(result["medicare_beneficiaries"], source["Medicare_Benes"])
        self.assertEqual(result["scope"], "ZIP aggregate, not facility patients")
        self.assertFalse(result["zetaris_join_measured"])
        self.assertNotIn("facility_patient_count", result)

    def test_actual_small_count_rows_are_flagged_without_unmasking_them(self):
        frequencies = Counter((row["Zip_Code_Recode"], row["FIPS_Code"]) for row in self.rows)
        small = [row for row in self.rows if row["Power_Dependent_Devices_DME"] == 11]
        self.assertEqual(len(small), 51)
        source = next(
            row for row in small
            if frequencies[(row["Zip_Code_Recode"], row["FIPS_Code"])] == 1
        )
        result = zip_context(CAPTURE, source["Zip_Code_Recode"], source["FIPS_Code"])
        self.assertTrue(result["small_count_caution"])
        self.assertEqual(result["reported_dme_count"], 11)
        self.assertNotIn("unmasked_count", result)

    def test_an_actual_out_of_state_cms_zip_does_not_get_a_manatee_default(self):
        _, rows = csv_rows((CMS_CAPTURE / "nursing_homes.csv").read_bytes())
        source = next(row for row in rows if row["State"] == "AL")
        result = zip_context(CAPTURE, source["ZIP Code"], "12081")
        self.assertEqual(result["status"], "refused_missing_zip")
        self.assertNotIn("reported_dme_count", result)


if __name__ == "__main__":
    unittest.main()
