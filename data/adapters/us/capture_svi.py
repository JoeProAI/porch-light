"""Capture the national 2022 SVI release losslessly; never substitute state percentiles."""

import argparse
import csv
import gzip
import hashlib
import io
import json
import re
import shlex
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from data.provenance.sidecar import verify, write_sidecar

URL = "https://svi.cdc.gov/Documents/Data/2022/csv/states/SVI_2022_US.csv"
LICENSE = "CDC/ATSDR Social Vulnerability Index 2022 public data; cite CDC/ATSDR"
REQUIRED = {"FIPS", "ST_ABBR", "COUNTY", "RPL_THEMES"}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ValueError("SVI capture refuses redirects")


def inspect_csv(stream) -> dict:
    reader = csv.DictReader(stream)
    if not REQUIRED.issubset(reader.fieldnames or []):
        raise ValueError("National SVI CSV is missing required fields")
    counts = {}
    seen = set()
    invalid_percentiles = 0
    for row in reader:
        fips = row["FIPS"]
        if not re.fullmatch(r"\d{11}", fips) or fips in seen:
            raise ValueError("National SVI has missing or duplicated tract identifiers")
        seen.add(fips)
        state = row["ST_ABBR"]
        counts[state] = counts.get(state, 0) + 1
        try:
            value = float(row["RPL_THEMES"])
            valid = 0 <= value <= 1
        except (TypeError, ValueError):
            valid = False
        invalid_percentiles += not valid
    if len(counts) < 50 or "FL" not in counts:
        raise ValueError("SVI source is not a national release containing Florida")
    return {
        "tract_rows": len(seen), "florida_rows": counts["FL"],
        "state_or_territory_codes": len(counts),
        "unavailable_percentile_rows": invalid_percentiles,
    }


def open_svi_text(path: Path):
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8-sig", newline="")
    return path.open("r", encoding="utf-8-sig", newline="")


def read_percentiles(path: Path, tract_ids: set[str]) -> dict:
    if not verify(path):
        raise ValueError("Verified SVI source capture is required")
    metadata = json.loads(path.with_name(path.name + ".provenance.json").read_text())
    if metadata.get("source_url") != URL or metadata.get("percentile_scope") != "national":
        raise ValueError("State-relative or unidentified SVI percentiles are not accepted")
    if any(not re.fullmatch(r"\d{11}", value) for value in tract_ids):
        raise ValueError("SVI joins require actual eleven-digit tract identifiers")
    found = {}
    with open_svi_text(path) as stream:
        reader = csv.DictReader(stream)
        if not REQUIRED.issubset(reader.fieldnames or []):
            raise ValueError("SVI capture has missing required fields")
        for row in reader:
            fips = row["FIPS"]
            if fips not in tract_ids:
                continue
            if fips in found:
                raise ValueError("SVI tract join would fan out")
            try:
                value = float(row["RPL_THEMES"])
            except (TypeError, ValueError):
                value = None
            available = value is not None and 0 <= value <= 1
            found[fips] = {
                "status": "available" if available else "unavailable_source_value",
                "raw_rpl_themes": row["RPL_THEMES"],
                "national_percentile": value if available else None,
            }
    return {
        fips: found.get(fips, {"status": "unavailable_tract_not_in_capture"})
        for fips in sorted(tract_ids)
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", type=Path, default=Path("data/snapshot/raw/svi"))
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    directory = args.output_root / f"{stamp}-{uuid4().hex[:8]}"
    directory.mkdir(parents=True, exist_ok=False)
    command = shlex.join([sys.executable, "-m", "data.adapters.us.capture_svi", *sys.argv[1:]])
    try:
        request = Request(URL, headers={"User-Agent": "PorchLight hackathon, joe@joepro.ai"})
        digest = hashlib.sha256()
        size = 0
        with tempfile.TemporaryFile() as compressed:
            with build_opener(NoRedirect()).open(request, timeout=60) as response:
                with gzip.GzipFile(filename="", mode="wb", fileobj=compressed, mtime=0) as output:
                    while block := response.read(256 * 1024):
                        size += len(block)
                        if size > 256 * 1024 * 1024:
                            raise ValueError("SVI source exceeds capture limit")
                        digest.update(block)
                        output.write(block)
            fetched = datetime.now(timezone.utc).isoformat(timespec="seconds")
            compressed.seek(0)
            with gzip.GzipFile(fileobj=compressed, mode="rb") as content:
                with io.TextIOWrapper(content, encoding="utf-8-sig", newline="") as text:
                    summary = inspect_csv(text)
            compressed.seek(0)
            path = directory / "SVI_2022_US.csv.gz"
            with path.open("xb") as output:
                shutil.copyfileobj(compressed, output)
        sidecar = write_sidecar(path, URL, LICENSE, command, fetched)
        metadata = json.loads(sidecar.read_text())
        metadata.update({
            "content_encoding": "gzip",
            "source_content_sha256": digest.hexdigest(),
            "source_content_bytes": size,
            "percentile_scope": "national",
            "release_year": 2022,
        })
        sidecar.write_text(json.dumps(metadata, indent=2) + "\n")
        print(json.dumps({
            "directory": str(directory), "status": "captured",
            "file": path.name, "source_bytes": size, "stored_bytes": path.stat().st_size,
            "encoding": "lossless gzip of untouched source bytes",
            "percentile_scope": "national", **summary,
        }, indent=2))
        return 0
    except Exception as error:
        print(json.dumps({
            "directory": str(directory), "status": "failed", "error": type(error).__name__,
        }))
        return 1


if __name__ == "__main__":
    sys.exit(main())
