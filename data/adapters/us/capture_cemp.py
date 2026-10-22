"""Preserve official archived county-plan records without claiming current applicability."""

import argparse
import json
import shlex
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from data.provenance.sidecar import write_sidecar

DOCUMENTS = {
    "manatee_cemp_2018": (
        "https://records.manateeclerk.com/BoardRecords/Browse/Agendas/"
        "Board-of-County-Commissioners/2018/08/BC20180821DOC048.pdf"
    ),
    "bradenton_adoption_2020": (
        "https://cityofbradenton.com/vertical/sites/"
        "%7B98CFEB92-7265-45CB-AF6F-7115C2CD7C81%7D/uploads/CEMP.pdf"
    ),
}
LICENSE = "Official Florida local-government public record; reuse license not specified by the source"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ValueError("County-plan capture refuses redirects")


def preserve(directory: Path, name: str, command: str) -> dict:
    url = DOCUMENTS[name]
    request = Request(url, headers={"User-Agent": "PorchLight hackathon, joe@joepro.ai"})
    with build_opener(NoRedirect()).open(request, timeout=60) as response:
        raw = response.read(64 * 1024 * 1024 + 1)
        content_type = response.headers.get("Content-Type")
    if len(raw) > 64 * 1024 * 1024:
        raise ValueError("County-plan response exceeds capture limit")
    if not raw.startswith(b"%PDF-"):
        raise ValueError("County-plan source did not return PDF bytes")
    fetched = datetime.now(timezone.utc).isoformat(timespec="seconds")
    path = directory / f"{name}.pdf"
    with path.open("xb") as output:
        output.write(raw)
    write_sidecar(path, url, LICENSE, command, fetched)
    return {
        "document": name, "status": "captured", "file": path.name,
        "source_url": url, "bytes": len(raw), "content_type": content_type,
        "applicability_to_2024_requires_confirmation": True,
        "nemotron_parse_performed": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", type=Path, default=Path("data/snapshot/raw/cemp"))
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    directory = args.output_root / f"{stamp}-{uuid4().hex[:8]}"
    directory.mkdir(parents=True, exist_ok=False)
    command = shlex.join([sys.executable, "-m", "data.adapters.us.capture_cemp", *sys.argv[1:]])
    results = []
    for name in DOCUMENTS:
        try:
            results.append(preserve(directory, name, command))
        except Exception as error:
            row = {"document": name, "status": "failed", "error": type(error).__name__}
            if isinstance(error, HTTPError):
                row["http_status"] = error.code
            results.append(row)
    print(json.dumps({"directory": str(directory), "results": results}, indent=2))
    return 0 if all(row["status"] == "captured" for row in results) else 1


if __name__ == "__main__":
    sys.exit(main())
