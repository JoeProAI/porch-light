"""Verify captured NWS records; corrupted copies exercise refusal paths."""

import json
import tempfile
import unittest
from pathlib import Path

from data.adapters.us.capture_nws import (
    NoRedirect, capture, has_polygon_geometry, validate_document, validate_url,
)
from data.provenance.sidecar import verify, write_sidecar

CAPTURE = (
    Path(__file__).resolve().parents[3]
    / "data/snapshot/raw/nws/20261022T022303Z-b4222c27"
)


class CapturedNwsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.alerts = sorted(
            path for path in CAPTURE.glob("alert-*.json")
            if not path.name.endswith(".provenance.json")
        )
        cls.zones = sorted(
            path for path in CAPTURE.glob("zones_*.json")
            if not path.name.endswith(".provenance.json")
        )
        if len(cls.alerts) != 4 or len(cls.zones) != 7:
            raise RuntimeError("The complete real NWS capture is required; no fallback data")

    def test_all_eleven_source_hashes_and_sidecars_verify(self):
        for path in self.alerts + self.zones:
            with self.subTest(path=path.name):
                self.assertTrue(verify(path))

    def test_real_alerts_validate_with_zone_based_geometry(self):
        for path in self.alerts:
            document = json.loads(path.read_bytes())
            self.assertIs(validate_document(document, "alert"), document)
            self.assertIsNone(document["geometry"])
            self.assertEqual(document["properties"]["event"], "Coastal Flood Warning")

    def test_every_affected_zone_resolves_to_a_captured_source(self):
        captured = {
            json.loads(path.with_name(path.name + ".provenance.json").read_text())["source_url"]
            for path in self.zones
        }
        affected = set()
        for path in self.alerts:
            affected.update(json.loads(path.read_bytes())["properties"]["affectedZones"])
        self.assertEqual(affected, captured)

    def test_real_zone_collections_are_supported_without_rewriting(self):
        collections = 0
        for path in self.zones:
            raw = path.read_bytes()
            document = json.loads(raw)
            self.assertIs(validate_document(document, "zone"), document)
            self.assertTrue(has_polygon_geometry(document["geometry"]))
            collections += document["geometry"]["type"] == "GeometryCollection"
            self.assertEqual(path.read_bytes(), raw)
        self.assertEqual(collections, 5)

    def test_missing_geometry_in_a_real_zone_is_refused(self):
        document = json.loads(self.zones[0].read_bytes())
        document["geometry"] = None
        with self.assertRaises(ValueError):
            validate_document(document, "zone")

    def test_empty_collection_in_a_real_zone_is_refused(self):
        document = json.loads(self.zones[0].read_bytes())
        document["geometry"]["geometries"] = []
        with self.assertRaises(ValueError):
            validate_document(document, "zone")

    def test_missing_alert_area_is_refused(self):
        document = json.loads(self.alerts[0].read_bytes())
        document["properties"]["affectedZones"] = []
        with self.assertRaises(ValueError):
            validate_document(document, "alert")

    def test_foreign_zone_reference_is_refused(self):
        document = json.loads(self.alerts[0].read_bytes())
        document["properties"]["affectedZones"][0] = (
            document["properties"]["affectedZones"][0].replace(
                "api.weather.gov", "localhost"
            )
        )
        with self.assertRaises(ValueError):
            validate_document(document, "alert")

    def test_actual_source_url_validates_but_corrupted_urls_do_not(self):
        meta = json.loads(
            self.alerts[0].with_name(self.alerts[0].name + ".provenance.json").read_text()
        )
        url = meta["source_url"]
        validate_url(url, "alert")
        for bad_url in (
            url.replace("https:", "http:"),
            url.replace("api.weather.gov", "localhost"),
            url + "/extra",
            url + "?redirect=1",
        ):
            with self.subTest(url=bad_url), self.assertRaises(ValueError):
                validate_url(bad_url, "alert")

    def test_redirects_are_refused_even_for_an_actual_source_url(self):
        meta = json.loads(
            self.alerts[0].with_name(self.alerts[0].name + ".provenance.json").read_text()
        )
        with self.assertRaises(ValueError):
            NoRedirect().redirect_request(None, None, 302, "", {}, meta["source_url"])

    def test_source_bytes_keep_provenance_and_corruption_breaks_it(self):
        source = self.alerts[0]
        meta = json.loads(source.with_name(source.name + ".provenance.json").read_text())
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / source.name
            target.write_bytes(source.read_bytes())
            write_sidecar(
                target, meta["source_url"], meta["license"],
                meta["fetch_command"], meta["fetched_at_utc"],
            )
            self.assertTrue(verify(target))
            damaged = json.loads(target.read_bytes())
            damaged["properties"].pop("affectedZones")
            target.write_text(json.dumps(damaged))
            self.assertFalse(verify(target))

    def test_no_capture_can_run_without_its_actual_invocation(self):
        with tempfile.TemporaryDirectory() as temp, self.assertRaises(ValueError):
            capture([], Path(temp) / "capture", "")


if __name__ == "__main__":
    unittest.main()
