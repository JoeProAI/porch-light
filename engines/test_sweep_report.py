import unittest
import tempfile
from pathlib import Path
from shutil import copyfile

from engines.sweep_report import markdown, percentile, verified


class SweepSummaryTests(unittest.TestCase):
    def test_percentiles_use_inclusive_linear_interpolation(self):
        self.assertEqual(percentile([30, 2, 20, 10], .5), 15)
        self.assertAlmostEqual(percentile([30, 2, 20, 10], .95), 28.5)
        self.assertEqual(percentile([7], .95), 7)
        self.assertIsNone(percentile([], .5))

    def test_partial_results_cannot_be_presented_as_a_final_summary(self):
        with self.assertRaisesRegex(ValueError, "incomplete"):
            markdown({"complete": False})

    def test_actual_source_artifact_must_match_its_retained_checksum(self):
        source = Path(__file__).parent / "snapshots/manatee-zetaris-chain.json"
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / source.name
            copyfile(source, target)
            copyfile(source.with_name(source.name + ".provenance.json"),
                     target.with_name(target.name + ".provenance.json"))
            self.assertEqual(len(verified(target)["facilities"]), 18)
            target.write_bytes(target.read_bytes() + b"\n")
            with self.assertRaisesRegex(ValueError, "checksum"):
                verified(target)


if __name__ == "__main__":
    unittest.main()
