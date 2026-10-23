"""Integration checks use actual official captures and successful live Zetaris execution."""

import json
import unittest
from pathlib import Path

from data.provenance.sidecar import verify
from engines.live_weather import read_live_weather


class LiveWeatherTests(unittest.TestCase):
    def test_real_national_sources_and_successful_row_audit_closure(self):
        weather = read_live_weather()
        ids = weather["data_access"]["zetaris_query_ids"]
        self.assertEqual(weather["data_access"]["data_access_mode"], "zetaris")
        self.assertEqual(len(ids), 1)
        self.assertTrue(ids[0].isdigit())
        self.assertTrue(weather["data_access"]["zetaris_audit"]["finish_successfully"])
        self.assertTrue(all(alert["zetaris_query_ids"] == ids for alert in weather["alerts"]))
        radar = Path(weather["radar"]["file_path"])
        self.assertTrue(verify(radar))
        self.assertIn(radar.read_bytes()[:6], (b"GIF87a", b"GIF89a"))
        alert_file = radar.parent / "nws-active-alerts.geojson"
        self.assertTrue(verify(alert_file))
        raw = json.loads(alert_file.read_bytes())
        self.assertEqual(len(raw["features"]), len(weather["alerts"]))
        self.assertEqual(weather["radar"]["source_url"], "https://radar.weather.gov/ridge/standard/CONUS-LARGE_loop.gif")
        self.assertTrue(all(alert["id"].startswith("https://api.weather.gov/alerts/") for alert in weather["alerts"]))


if __name__ == "__main__":
    unittest.main()
