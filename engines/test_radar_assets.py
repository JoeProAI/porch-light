"""Input and audit-cardinality regressions for the map's source boundary."""

import unittest
from unittest.mock import patch

from data.adapters.us.capture_radar_assets import capture, source_url
from engines.radar_assets import read


class RadarSourceBoundaryTests(unittest.TestCase):
    def test_rejects_urls_paths_unsupported_layers_and_out_of_world_tiles(self):
        for key in ("https://example.com/file", "../clock", "nexrad-n0q-900913/4/16/0",
                    "nexrad-n0q-900913/4/0/16", "nexrad-n0q-900913/13/0/0",
                    "nexrad-n0q-900913/4/-1/0", "nexrad-n0q-900913-m01m/4/1/1",
                    "nexrad-n0q-900913/4/1/1';SELECT 1", "clock/../clock"):
            with self.subTest(key=key), self.assertRaises(ValueError):
                source_url(key)

    def test_batch_validates_all_inputs_before_any_download(self):
        with patch("data.adapters.us.capture_radar_assets.capture_one") as download:
            for keys in ([], ["clock"] * 41, ["clock", "../clock"], ["clock", None], "clock"):
                with self.subTest(keys=keys), self.assertRaises(ValueError):
                    capture(keys)
            download.assert_not_called()

    def test_duplicate_audited_rows_fail_instead_of_hiding_source_cardinality(self):
        with patch("engines.radar_assets.capture"), patch("engines.radar_assets.audited_query",
                return_value={"rows": [{"source_key": "clock"}, {"source_key": "clock"}]}):
            with self.assertRaisesRegex(RuntimeError, "every requested source"):
                read(["clock"])


if __name__ == "__main__":
    unittest.main()
