"""Capture official CMS metadata and untouched facility CSVs for ingestion."""

import argparse
import csv
import io
import json
import re
import shlex
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from data.provenance.sidecar import write_sidecar

DATASETS = {"nursing_homes": "4pq5-n9py", "dialysis": "23ew-n7w9"}
USER_AGENT = "PorchLight hackathon, joe@joepro.ai"
MAX_BYTES = 64 * 1024 * 1024


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ValueError("CMS capture refuses redirects")


def validate_url(url: str) -> None:
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or parsed.netloc != "data.cms.gov"
        or not parsed.path.startswith("/provider-data/")
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Refused non-CMS source URL")


def fetch(url: str) -> tuple[bytes, str]:
    validate_url(url)
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with build_opener(NoRedirect()).open(request, timeout=90) as response:
        validate_url(response.geturl())
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("CMS response exceeds capture limit")
    return raw, datetime.now(timezone.utc).isoformat(timespec="seconds")


def preserve(directory: Path, filename: str, raw: bytes, url: str,
             fetched_at: str, license_line: str, command: str) -> Path:
    target = directory / filename
    with target.open("xb") as output:
        output.write(raw)
    write_sidecar(target, url, license_line, command, fetched_at)
    return target


def csv_rows(raw: bytes) -> tuple[list[str], list[dict[str, str]]]:
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig"), newline=""))
    fields = reader.fieldnames
    if not fields or len(fields) != len(set(fields)):
        raise ValueError("CMS CSV has missing or duplicate headers")
    rows = list(reader)
    if not rows or any(None in row or any(v is None for v in row.values()) for row in rows):
        raise ValueError("CMS CSV is empty or has malformed rows")
    return fields, rows


def county_quality(fields: list[str], rows: list[dict[str, str]],
                   state: str, county: str) -> dict:
    normalized = {field.strip().lower(): field for field in fields}
    county_field = normalized.get("county/parish") or normalized.get("county")
    name_field = normalized.get("provider name") or normalized.get("facility name")
    ccn_field = normalized.get("cms certification number (ccn)")
    phone_field = normalized.get("telephone number")
    if not all((county_field, name_field, ccn_field, phone_field, normalized.get("state"))):
        raise ValueError("CMS source is missing county, name, CCN, phone or state fields")
    selected = [
        row for row in rows
        if row[normalized["state"]].strip().upper() == state.upper()
        and row[county_field].strip().casefold() == county.casefold()
    ]
    closed = []
    missing_phone = []
    for row in selected:
        ccn = row[ccn_field].strip()
        if not re.fullmatch(r"\d{6}", ccn):
            raise ValueError("CMS county source contains an invalid CCN")
        if row[name_field].strip().lower().startswith("zz_closed_"):
            closed.append(ccn)
        digits = re.sub(r"\D", "", row[phone_field])
        if not (len(digits) == 10 or (len(digits) == 11 and digits.startswith("1"))):
            missing_phone.append(ccn)
    return {
        "county": county,
        "state": state,
        "source_rows": len(selected),
        "closed_name_ccns": closed,
        "missing_phone_ccns": missing_phone,
        "geographic_join_verified": False,
    }


def capture_dataset(name: str, directory: Path, command: str) -> dict:
    identifier = DATASETS[name]
    url = (
        "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/"
        + identifier
    )
    raw, fetched_at = fetch(url)
    metadata = json.loads(raw)
    if metadata.get("identifier") != identifier:
        raise ValueError("CMS metadata identifier does not match requested dataset")
    license_line = metadata.get("license") or (
        "Not specified in captured CMS metadata; public CMS provider-data release"
    )
    if not isinstance(license_line, str):
        raise ValueError("CMS license metadata is not a string")
    preserve(directory, f"{name}.metadata.json", raw, url, fetched_at, license_line, command)
    distributions = [
        item for item in metadata.get("distribution", [])
        if item.get("mediaType") == "text/csv" and item.get("downloadURL")
    ]
    if len(distributions) != 1:
        raise ValueError("CMS metadata must identify exactly one CSV distribution")
    csv_url = distributions[0]["downloadURL"]
    raw_csv, csv_fetched_at = fetch(csv_url)
    path = preserve(
        directory, f"{name}.csv", raw_csv, csv_url,
        csv_fetched_at, license_line, command,
    )
    fields, rows = csv_rows(raw_csv)
    normalized = {field.strip().lower(): field for field in fields}
    state = normalized.get("state")
    if state is None:
        raise ValueError("CMS CSV is missing the State field")
    florida = [row for row in rows if row[state].strip() == "FL"]
    county = normalized.get("county/parish") or normalized.get("county")
    return {
        "dataset": name,
        "identifier": identifier,
        "status": "captured",
        "file": path.name,
        "source_url": csv_url,
        "metadata_modified": metadata.get("modified"),
        "metadata_issued": metadata.get("issued"),
        "source_rows": len(rows),
        "florida_rows": len(florida),
        "manatee_rows_by_cms_county_label": (
            sum(row[county].strip().lower() == "manatee" for row in florida)
            if county else None
        ),
        "historical_2024_conditions_established": False,
        "manatee_quality": county_quality(fields, rows, "FL", "Manatee"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", choices=tuple(DATASETS), action="append")
    parser.add_argument("--output-root", type=Path, default=Path("data/snapshot/raw/cms"))
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    directory = args.output_root / f"{stamp}-{uuid4().hex[:8]}"
    directory.mkdir(parents=True, exist_ok=False)
    command = shlex.join([
        sys.executable, "-m", "data.adapters.us.capture_cms", *sys.argv[1:],
    ])
    results = []
    for name in dict.fromkeys(args.dataset or DATASETS):
        try:
            results.append(capture_dataset(name, directory, command))
        except Exception as error:
            result = {"dataset": name, "status": "failed", "error": type(error).__name__}
            if isinstance(error, HTTPError):
                result["http_status"] = error.code
            results.append(result)
    print(json.dumps({"directory": str(directory), "results": results}, indent=2))
    return 0 if all(row["status"] == "captured" for row in results) else 1


if __name__ == "__main__":
    sys.exit(main())
