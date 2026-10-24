#!/usr/bin/env python3
"""Provenance verification using captured NWS bytes and corrupted metadata copies."""
import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sidecar

SOURCE = (
    Path(__file__).resolve().parents[2]
    / "data/snapshot/raw/iem/20261022T030817Z-ad065921/nws_zone_FLZ155.json"
)
SOURCE_META = json.loads(SOURCE.with_name(SOURCE.name + ".provenance.json").read_text())
FETCHED = datetime.fromisoformat(SOURCE_META["fetched_at_utc"].replace("Z", "+00:00"))


def _write_sidecar_quiet(path, **kwargs):
    """Call write_sidecar; return the sidecar path or None when it exits."""
    try:
        fields = {
            "source_url": SOURCE_META["source_url"],
            "license_line": SOURCE_META["license"],
            "fetch_command": SOURCE_META["fetch_command"],
            "fetched_at_utc": SOURCE_META["fetched_at_utc"],
        }
        fields.update(kwargs)
        return sidecar.write_sidecar(path, **fields)
    except SystemExit:
        return None


class WriteValidation(unittest.TestCase):
    def setUp(self):
        if not sidecar.verify(SOURCE):
            raise RuntimeError("Verified real NWS capture required; no replacement data")
        self.dir = tempfile.TemporaryDirectory()
        self.file = Path(self.dir.name) / SOURCE.name
        self.file.write_bytes(SOURCE.read_bytes())
        self.sidecar_path = Path(str(self.file) + ".provenance.json")

    def tearDown(self):
        self.dir.cleanup()

    def test_write_ok_then_verify(self):
        out = _write_sidecar_quiet(self.file)
        self.assertEqual(out, self.sidecar_path)
        self.assertTrue(sidecar.verify(self.file))

    def test_whitespace_only_license_refused(self):
        out = _write_sidecar_quiet(self.file, license_line="   ")
        self.assertIsNone(out)
        self.assertFalse(self.sidecar_path.exists())

    def test_whitespace_only_fetch_command_refused(self):
        out = _write_sidecar_quiet(self.file, fetch_command="  \n ")
        self.assertIsNone(out)

    def test_fields_stripped_on_write(self):
        _write_sidecar_quiet(self.file, source_url="  " + SOURCE_META["source_url"] + " ",
                             license_line=" " + SOURCE_META["license"] + " ",
                             fetch_command=" " + SOURCE_META["fetch_command"] + " ")
        meta = json.loads(self.sidecar_path.read_text())
        self.assertEqual(meta["license"], SOURCE_META["license"])
        self.assertEqual(meta["source_url"], SOURCE_META["source_url"])

    def test_fetched_at_z_accepted(self):
        _write_sidecar_quiet(self.file, fetched_at_utc=FETCHED.isoformat().replace("+00:00", "Z"))
        self.assertTrue(self.sidecar_path.exists())

    def test_fetched_at_zero_offset_accepted(self):
        _write_sidecar_quiet(self.file, fetched_at_utc=FETCHED.isoformat())
        self.assertTrue(self.sidecar_path.exists())

    def test_fetched_at_nonzero_offset_refused(self):
        out = _write_sidecar_quiet(
            self.file, fetched_at_utc=FETCHED.astimezone(timezone(timedelta(hours=-5))).isoformat()
        )
        self.assertIsNone(out)

    def test_fetched_at_naive_refused(self):
        out = _write_sidecar_quiet(self.file, fetched_at_utc=FETCHED.replace(tzinfo=None).isoformat())
        self.assertIsNone(out)


class VerifyMeta(unittest.TestCase):
    def test_valid_fetched_at_requires_utc(self):
        self.assertTrue(sidecar._valid_fetched_at(FETCHED.isoformat().replace("+00:00", "Z")))
        self.assertTrue(sidecar._valid_fetched_at(FETCHED.isoformat()))
        self.assertFalse(sidecar._valid_fetched_at(
            FETCHED.astimezone(timezone(timedelta(hours=-5))).isoformat()
        ))
        self.assertFalse(sidecar._valid_fetched_at(FETCHED.replace(tzinfo=None).isoformat()))
        self.assertFalse(sidecar._valid_fetched_at(""))
        self.assertFalse(sidecar._valid_fetched_at("not a date"))

    def test_valid_meta_strips_before_empty_check(self):
        meta = {**SOURCE_META, "license": "  "}
        self.assertFalse(sidecar._valid_meta(meta))
        meta["license"] = SOURCE_META["license"]
        meta["fetch_command"] = "\t "
        self.assertFalse(sidecar._valid_meta(meta))


if __name__ == "__main__":
    unittest.main()
