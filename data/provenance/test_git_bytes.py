"""Protect original captured bytes from Git checkout normalization."""

import hashlib
import io
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class CapturedGitBytesTests(unittest.TestCase):
    def test_raw_source_and_sidecar_attributes_disable_conversion_and_whitespace_rewrites(self):
        samples = [
            "data/snapshot/raw/cms/20261022T030046Z-a5ce96ba/nursing_homes.csv",
            "data/snapshot/raw/svi/manatee-2022/SVI_2022_12081.csv.provenance.json",
        ]
        result = subprocess.run(
            ["git", "-C", str(ROOT), "check-attr", "text", "whitespace", "--", *samples],
            capture_output=True, text=True, check=True,
        )
        lines = result.stdout.splitlines()
        self.assertEqual(len(lines), 4)
        self.assertTrue(all(line.endswith(": unset") for line in lines))

    def test_every_staged_or_committed_capture_and_sidecar_matches_original_working_bytes(self):
        tracked = subprocess.check_output(
            ["git", "-C", str(ROOT), "ls-files", "-z", "--", "data/snapshot/raw"]
        ).decode().split("\0")
        files = sorted(ROOT / name for name in tracked if name)
        self.assertTrue(files)
        names = [path.relative_to(ROOT).as_posix() for path in files]
        result = subprocess.run(
            ["git", "-C", str(ROOT), "cat-file", "--batch"],
            input="".join(":" + name + "\n" for name in names).encode(),
            capture_output=True, check=True,
        )
        output = io.BytesIO(result.stdout)
        for path, name in zip(files, names):
            header = output.readline().decode().strip().split()
            with self.subTest(path=name):
                self.assertEqual(len(header), 3, "Capture is missing from Git index")
                self.assertEqual(header[1], "blob")
                blob = output.read(int(header[2]))
                self.assertEqual(output.read(1), b"\n")
                self.assertEqual(
                    hashlib.sha256(blob).digest(), hashlib.sha256(path.read_bytes()).digest(),
                    "Git changed a source artifact or provenance sidecar",
                )


if __name__ == "__main__":
    unittest.main()
