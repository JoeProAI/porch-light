"""Verify the actual IEM Milton archive capture and refuse corrupted copies."""

import copy
import json
import unittest
from datetime import datetime
from pathlib import Path

from data.adapters.us.capture_milton import VALID_AT, manatee_zones, select_event
from data.adapters.us.capture_nws import validate_document
from data.provenance.sidecar import verify

CAPTURE = (
    Path(__file__).resolve().parents[3]
    / "data/snapshot/raw/iem/20261022T030817Z-ad065921"
)


class CapturedMiltonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.events = CAPTURE / "events_status.json"
        cls.issuance = CAPTURE / "milton_issuance.txt"
        if not verify(cls.events) or not verify(cls.issuance):
            raise RuntimeError("The real verified Milton archive capture is required")
        cls.document = json.loads(cls.events.read_bytes())

    def test_source_identifies_the_real_manatee_hurricane_warning(self):
        event = select_event(self.document)
        self.assertEqual(event["ph_sig"], "HU.W")
        self.assertEqual(event["eventid"], 1014)
        self.assertIn("Coastal Manatee [FL]", event["locations"])
        self.assertIn("Inland Manatee [FL]", event["locations"])

    def test_text_identifies_milton_and_matches_the_archived_event(self):
        text = self.issuance.read_text()
        event = select_event(self.document)
        self.assertIn("MILTON", text.upper())
        self.assertIn(f"KTBW.HU.W.{event['eventid']:04d}.", text)
        self.assertIn("Manatee", text)

    def test_text_source_resolves_to_the_actual_issue_product(self):
        event = select_event(self.document)
        meta = json.loads(self.issuance.with_name(
            self.issuance.name + ".provenance.json"
        ).read_bytes())
        self.assertTrue(meta["source_url"].endswith("/nwstext/" + event["issue_product_id"]))
        fetched = datetime.fromisoformat(meta["fetched_at_utc"])
        valid = datetime.fromisoformat(VALID_AT.replace("Z", "+00:00"))
        self.assertGreater(fetched, valid)

    def test_manatee_zone_ids_come_from_the_actual_warning_sections(self):
        self.assertEqual(manatee_zones(self.issuance.read_text()), ["FLZ155", "FLZ255"])

    def test_current_zone_captures_have_real_source_links_and_verified_bytes(self):
        for zone in manatee_zones(self.issuance.read_text()):
            path = CAPTURE / f"nws_zone_{zone}.json"
            self.assertTrue(verify(path))
            validate_document(json.loads(path.read_bytes()), "zone")
            meta = json.loads(path.with_name(path.name + ".provenance.json").read_bytes())
            self.assertEqual(
                meta["source_url"], "https://api.weather.gov/zones/forecast/" + zone
            )
            self.assertGreater(
                datetime.fromisoformat(meta["fetched_at_utc"]),
                datetime.fromisoformat(VALID_AT.replace("Z", "+00:00")),
            )

    def test_missing_actual_zone_section_is_refused(self):
        text = self.issuance.read_text().replace("\nInland Manatee-", "\n")
        with self.assertRaises(ValueError):
            manatee_zones(text)

    def test_later_archive_cancellation_is_not_rewritten_as_current_status(self):
        event = select_event(self.document)
        self.assertEqual(event["status"], "CAN")
        self.assertGreater(
            datetime.fromisoformat(event["updated"].replace("Z", "+00:00")),
            datetime.fromisoformat(VALID_AT.replace("Z", "+00:00")),
        )

    def test_missing_actual_event_is_refused_without_a_replacement(self):
        damaged = copy.deepcopy(self.document)
        event = select_event(damaged)
        damaged["data"].remove(event)
        with self.assertRaises(ValueError):
            select_event(damaged)

    def test_corrupt_event_dates_are_refused(self):
        damaged = copy.deepcopy(self.document)
        event = select_event(damaged)
        event["issue"] = event["expire"]
        with self.assertRaises(ValueError):
            select_event(damaged)


if __name__ == "__main__":
    unittest.main()
