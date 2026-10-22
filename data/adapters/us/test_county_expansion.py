"""Verify both pilot counties using captured records, including real cross-county refusals."""

import json
import unittest
from collections import Counter

from data.adapters.us.capture_census import geography_result, replay, source_records
from data.adapters.us.capture_empower import read_snapshot
from data.adapters.us.capture_milton import county_zones, select_event
from data.adapters.us.counties import COUNTIES, MANATEE, SARASOTA, county_profile
from data.adapters.us.county_sources import CMS, EMPOWER, selected_sources
from data.adapters.us.preflight_county import report_for_county
from data.provenance.sidecar import verify


class CountyExpansionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sources = selected_sources("sarasota")
        cls.records = source_records(CMS, SARASOTA)
        cls.results = replay(cls.sources.census, SARASOTA)

    def test_profile_fips_and_names_are_in_the_real_official_hhs_source(self):
        _, rows = read_snapshot(EMPOWER)
        for profile in COUNTIES.values():
            self.assertTrue(any(
                row["COUNTY"] == profile.name and row["FIPS_Code"] == profile.fips
                and row["STATE"] == profile.state for row in rows
            ))

    def test_sarasota_is_selected_by_county_not_city_name(self):
        self.assertEqual(len(self.records), 42)
        self.assertEqual(Counter(kind for kind, _, _ in self.records), {
            "nursing_homes": 30, "dialysis": 12,
        })
        self.assertTrue(all(row["County/Parish"] == "Sarasota" for _, row, _ in self.records))
        self.assertEqual(len(source_records(CMS, MANATEE)), 20)

    def test_all_forty_four_real_sarasota_census_artifacts_verify(self):
        paths = [
            path for path in self.sources.census.glob("*.json")
            if not path.name.endswith(".provenance.json")
        ]
        self.assertEqual(len(paths), 44)
        self.assertTrue(all(verify(path) for path in paths))

    def test_actual_sarasota_geo_refusals_are_not_forced_into_the_requested_county(self):
        self.assertEqual(Counter(row["status"] for row in self.results), {
            "census_geography_returned": 40,
            "refused_county_mismatch": 1,
            "refused_no_address_match": 1,
        })
        mismatched = next(row for row in self.results if row["ccn"] == "105452")
        self.assertNotEqual(mismatched["returned_county_geoid"], SARASOTA.fips)
        self.assertNotIn("lat", mismatched)
        unmatched = next(row for row in self.results if row["ccn"] == "682802")
        self.assertEqual(unmatched["match_count"], 0)
        self.assertNotIn("lat", unmatched)

    def test_real_milton_sections_are_county_specific(self):
        sources = self.sources
        events = json.loads((sources.warning / "events_status.json").read_bytes())
        self.assertEqual(select_event(events, SARASOTA)["eventid"], 1014)
        text = (sources.warning / "milton_issuance.txt").read_text()
        self.assertEqual(county_zones(text, SARASOTA), ["FLZ160", "FLZ260"])
        self.assertEqual(county_zones(text, MANATEE), ["FLZ155", "FLZ255"])
        for zone in county_zones(text, SARASOTA):
            self.assertTrue(verify(sources.warning / f"nws_zone_{zone}.json"))

    def test_manatee_observation_is_not_reclassified_as_sarasota(self):
        sources = selected_sources("manatee")
        kind, row, _ = next(
            item for item in source_records(CMS, MANATEE)
            if item[1]["CMS Certification Number (CCN)"] == "105045"
        )
        document = json.loads((sources.census / f"{kind}-105045.json").read_bytes())
        result = geography_result(kind, document, row, SARASOTA)
        self.assertEqual(result["status"], "refused_county_mismatch")
        self.assertEqual(result["returned_county_geoid"], MANATEE.fips)

    def test_sarasota_does_not_borrow_manatees_plan_or_missing_zip_context(self):
        result = report_for_county("sarasota")
        self.assertEqual(result["archived_county_plan"], {
            "status": "unavailable_no_county_plan_capture",
        })
        self.assertEqual(result["svi_status_counts"], {"available": 40})
        self.assertEqual(result["empower_status_counts"], {
            "aggregate_source_row_available": 39, "refused_missing_zip": 1,
        })
        self.assertFalse(result["ranking_ready"])
        self.assertFalse(result["zetaris_query_performed"])

    def test_an_actual_unconfigured_florida_county_is_not_advertised_as_supported(self):
        _, rows = read_snapshot(EMPOWER)
        unsupported = next(row["COUNTY"].lower() for row in rows if row["COUNTY"] not in (
            MANATEE.name, SARASOTA.name
        ))
        with self.assertRaises(ValueError):
            county_profile(unsupported)


if __name__ == "__main__":
    unittest.main()
