#!/usr/bin/env python3
"""Write a .provenance.json sidecar for a cached data file.

Usage:
    python3 data/provenance/sidecar.py <file> --source-url <url> \
        --license "<license line>" --fetch-command "<exact command>"

Sidecar format (see data/provenance/README.md):
    source_url, fetched_at_utc, sha256, license, fetch_command
"""
import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REQUIRED_KEYS = ["source_url", "fetched_at_utc", "sha256", "license", "fetch_command"]

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _valid_fetched_at(value) -> bool:
    if not isinstance(value, str) or not value:
        return False
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        return False
    return dt.tzinfo is not None


def _valid_meta(meta) -> bool:
    if not isinstance(meta, dict):
        return False
    for key in REQUIRED_KEYS:
        if not isinstance(meta.get(key), str) or not meta[key]:
            return False
    if not _valid_fetched_at(meta["fetched_at_utc"]):
        return False
    return bool(SHA256_RE.match(meta["sha256"]))


def write_sidecar(path: Path, source_url: str, license_line: str, fetch_command: str,
                  fetched_at_utc: str | None = None) -> Path:
    if not path.is_file():
        sys.exit(f"no such file: {path}")
    digest = sha256_of(path)
    out = path.with_name(path.name + ".provenance.json")
    if fetched_at_utc is None and out.is_file():
        try:
            old = json.loads(out.read_text())
        except json.JSONDecodeError:
            old = {}
        if old.get("sha256") == digest and _valid_fetched_at(old.get("fetched_at_utc")):
            fetched_at_utc = old["fetched_at_utc"]
    if fetched_at_utc is None:
        fetched_at_utc = datetime.now(timezone.utc).isoformat(timespec="seconds")
    sidecar = {
        "source_url": source_url,
        "fetched_at_utc": fetched_at_utc,
        "sha256": digest,
        "license": license_line,
        "fetch_command": fetch_command,
    }
    out.write_text(json.dumps(sidecar, indent=2) + "\n")
    return out


def verify(path: Path) -> bool:
    """Check the sidecar exists, has usable metadata, and matches the file."""
    side = path.with_name(path.name + ".provenance.json")
    if not side.is_file():
        return False
    try:
        meta = json.loads(side.read_text())
    except json.JSONDecodeError:
        return False
    if not _valid_meta(meta):
        return False
    return meta["sha256"] == sha256_of(path)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("file", type=Path)
    ap.add_argument("--source-url")
    ap.add_argument("--license", dest="license_line")
    ap.add_argument("--fetch-command")
    ap.add_argument("--fetched-at-utc", default=None)
    ap.add_argument("--verify", action="store_true",
                    help="check sidecar exists and sha256 matches")
    args = ap.parse_args()

    if args.verify:
        sys.exit(0 if verify(args.file) else f"missing or stale sidecar: {args.file}")

    missing = [n for n, v in (("source-url", args.source_url),
                              ("license", args.license_line),
                              ("fetch-command", args.fetch_command)) if not v]
    if missing:
        ap.error("required: " + ", ".join("--" + m for m in missing))
    out = write_sidecar(args.file, args.source_url, args.license_line,
                        args.fetch_command, args.fetched_at_utc)
    print(out)


if __name__ == "__main__":
    main()
