#!/usr/bin/env python3
"""Unit tests for sidecar.py. Run: python3 -m unittest data/provenance/test_sidecar.py
or python3 data/provenance/test_sidecar.py from the repo root."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sidecar


def _write_sidecar_quiet(path, **kwargs):
    """Call write_sidecar; return the sidecar path or None when it exits."""
    try:
        return sidecar.write_sidecar(path, **kwargs)
    except SystemExit:
        return None


class WriteValidation(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.file = Path(self.dir.name) / "sample.csv"
        self.file.write_text("a,b\n1,2\n")
        self.sidecar_path = Path(str(self.file) + ".provenance.json")

    def tearDown(self):
        self.dir.cleanup()

    def test_write_ok_then_verify(self):
        out = _write_sidecar_quiet(self.file, source_url="https://example.org/x",
                                   license_line="public domain",
                                   fetch_command="curl -O https://example.org/x")
        self.assertEqual(out, self.sidecar_path)
        self.assertTrue(sidecar.verify(self.file))

    def test_whitespace_only_license_refused(self):
        out = _write_sidecar_quiet(self.file, source_url="https://example.org/x",
                                   license_line="   ",
                                   fetch_command="curl -O x")
        self.assertIsNone(out)
        self.assertFalse(self.sidecar_path.exists())

    def test_whitespace_only_fetch_command_refused(self):
        out = _write_sidecar_quiet(self.file, source_url="https://example.org/x",
                                   license_line="public domain",
                                   fetch_command="  \n ")
        self.assertIsNone(out)

    def test_fields_stripped_on_write(self):
        _write_sidecar_quiet(self.file, source_url="  https://example.org/x ",
                             license_line=" public domain ",
                             fetch_command=" curl -O x ")
        meta = json.loads(self.sidecar_path.read_text())
        self.assertEqual(meta["license"], "public domain")
        self.assertEqual(meta["source_url"], "https://example.org/x")

    def test_fetched_at_z_accepted(self):
        _write_sidecar_quiet(self.file, source_url="u", license_line="l",
                             fetch_command="c",
                             fetched_at_utc="2026-10-22T01:00:00Z")
        self.assertTrue(self.sidecar_path.exists())

    def test_fetched_at_zero_offset_accepted(self):
        _write_sidecar_quiet(self.file, source_url="u", license_line="l",
                             fetch_command="c",
                             fetched_at_utc="2026-10-22T01:00:00+00:00")
        self.assertTrue(self.sidecar_path.exists())

    def test_fetched_at_nonzero_offset_refused(self):
        out = _write_sidecar_quiet(self.file, source_url="u", license_line="l",
                                   fetch_command="c",
                                   fetched_at_utc="2026-10-22T01:00:00-05:00")
        self.assertIsNone(out)

    def test_fetched_at_naive_refused(self):
        out = _write_sidecar_quiet(self.file, source_url="u", license_line="l",
                                   fetch_command="c",
                                   fetched_at_utc="2026-10-22T01:00:00")
        self.assertIsNone(out)


class VerifyMeta(unittest.TestCase):
    def test_valid_fetched_at_requires_utc(self):
        self.assertTrue(sidecar._valid_fetched_at("2026-10-22T01:00:00Z"))
        self.assertTrue(sidecar._valid_fetched_at("2026-10-22T01:00:00+00:00"))
        self.assertFalse(sidecar._valid_fetched_at("2026-10-22T01:00:00-05:00"))
        self.assertFalse(sidecar._valid_fetched_at("2026-10-22T01:00:00"))
        self.assertFalse(sidecar._valid_fetched_at(""))
        self.assertFalse(sidecar._valid_fetched_at("not a date"))

    def test_valid_meta_strips_before_empty_check(self):
        meta = {"source_url": "u", "fetched_at_utc": "2026-10-22T01:00:00Z",
                "sha256": "0" * 64, "license": "  ", "fetch_command": "c"}
        self.assertFalse(sidecar._valid_meta(meta))
        meta["license"] = "l"
        meta["fetch_command"] = "\t "
        self.assertFalse(sidecar._valid_meta(meta))


if __name__ == "__main__":
    unittest.main()
