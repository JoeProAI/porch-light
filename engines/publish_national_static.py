"""Publish frozen national catalog + county snapshots for hosted GET reads.

Reads ~/.porchlight/national/sweeps/<run> and writes web/data/national/published
(or --output). Geometry coordinates are stripped; audited facility rows remain.
Live Zetaris/model POST stays local-origin only.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import shutil
import tarfile
from datetime import datetime, timezone
from pathlib import Path

RUN_ID = "20261023T200048Z-78a426ba"
ROOT = Path.home() / ".porchlight/national/sweeps" / RUN_ID
OUT = Path.home() / ".porchlight/national/published-20261023T200048Z"
TAR = Path.home() / ".porchlight/national/published-20261023T200048Z.tar.gz"


def write_prov(path: Path, source_url: str, command: str, now: str) -> None:
    side = {
        "source_url": source_url,
        "fetched_at_utc": now,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "license": "Derived public-source evidence; original source licenses retained",
        "fetch_command": command,
    }
    path.with_name(path.name + ".provenance.json").write_text(
        json.dumps(side, indent=2) + "\n", encoding="utf-8"
    )


def outcome_for(document: dict) -> tuple[str, dict]:
    counts = document.get("counts") or {}
    ranked = int(counts.get("ranked_rows") or 0)
    source = int(counts.get("source_rows") or 0)
    refused = int(counts.get("refused_rows") or 0)
    if document.get("state") == "source_gap":
        label = "source_gap"
    elif ranked:
        label = "complete_with_ranked_rows"
    elif source:
        label = "complete_no_rankable_rows"
    else:
        label = "complete_no_matching_source_rows"
    return label, {"ranked_rows": ranked, "source_rows": source, "refused_rows": refused, "outcome": label}


def main() -> int:
    if not ROOT.is_dir():
        raise SystemExit(f"missing sweep folder: {ROOT}")
    if OUT.exists():
        shutil.rmtree(OUT)
    counties_dir = OUT / "counties"
    counties_dir.mkdir(parents=True)
    now = datetime.now(timezone.utc).isoformat()
    scope = json.loads((ROOT / "scope.json").read_text(encoding="utf-8"))
    outcomes: dict[str, dict] = {}
    written = 0
    for path in sorted(ROOT.glob("county-?????.json")):
        document = json.loads(path.read_text(encoding="utf-8"))
        if document.get("warning_geometry"):
            document["warning_geometry"] = {"type": "MultiPolygon", "coordinates": []}
        document["publication"] = {
            "mode": "published_sweep_snapshot",
            "sweep_run_id": RUN_ID,
            "stripped": ["warning_geometry_coordinates"],
            "note": (
                "Frozen audited county snapshot from the national source sweep. "
                "Live Zetaris and model POST remain local-origin only."
            ),
        }
        fips = (document.get("county") or {}).get("fips") or path.stem.split("-")[1]
        label, meta = outcome_for(document)
        outcomes[fips] = meta
        target = counties_dir / f"{fips}.json.gz"
        with gzip.open(target, "wt", encoding="utf-8") as handle:
            json.dump(document, handle, separators=(",", ":"), ensure_ascii=True)
        write_prov(target, path.resolve().as_uri(), "python build_published_national.py", now)
        written += 1
        if written % 500 == 0:
            print(json.dumps({"stage": "counties", "written": written}), flush=True)

    fail = ROOT / "failure-48395.json"
    if fail.exists() and "48395" not in outcomes:
        outcomes["48395"] = {
            "ranked_rows": 0,
            "source_rows": 0,
            "refused_rows": 0,
            "outcome": "runtime_error",
        }

    catalog_counties = []
    for row in scope["catalog"]["counties"]:
        meta = outcomes.get(
            row["fips"],
            {
                "ranked_rows": 0,
                "source_rows": 0,
                "refused_rows": 0,
                "outcome": "missing_published_snapshot",
            },
        )
        catalog_counties.append(
            {
                "fips": row["fips"],
                "name": row["name"],
                "state": row["state"],
                "geometry_valid": row.get("geometry_valid"),
                "capture_id": row.get("capture_id"),
                "ranked_rows": meta["ranked_rows"],
                "source_rows": meta["source_rows"],
                "outcome": meta["outcome"],
            }
        )

    catalog = {
        "catalog": {
            "counties": catalog_counties,
            "data_access": {
                **scope["catalog"]["data_access"],
                "publication": {
                    "mode": "published_static",
                    "sweep_run_id": RUN_ID,
                    "county_snapshots": written,
                    "ranked_counties": sum(1 for row in catalog_counties if row["ranked_rows"] > 0),
                    "note": (
                        "Hosted GET serves this frozen catalog and per-county sweep snapshots. "
                        "Live catalog refresh and model POST stay local-origin only."
                    ),
                },
            },
        },
        "weather": {
            "status": "unavailable",
            "message": "Live alert refresh stays on local origin. County discovery uses the published sweep catalog.",
            "official_url": "https://api.weather.gov/alerts/active",
        },
        "publication": {
            "mode": "published_static",
            "sweep_run_id": RUN_ID,
            "generated_at": now,
            "source_capture_id": scope["catalog"]["counties"][0]["capture_id"],
        },
    }
    cat_path = OUT / "catalog.json"
    cat_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    write_prov(cat_path, (ROOT / "scope.json").resolve().as_uri(), "python build_published_national.py", now)

    manifest = {
        "schema_version": "porch-light.published-national.v1",
        "sweep_run_id": RUN_ID,
        "generated_at": now,
        "county_files": written,
        "catalog_counties": len(catalog_counties),
        "ranked_counties": sum(1 for row in catalog_counties if row["ranked_rows"] > 0),
    }
    man_path = OUT / "manifest.json"
    man_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    write_prov(man_path, ROOT.resolve().as_uri(), "python build_published_national.py", now)

    if TAR.exists():
        TAR.unlink()
    with tarfile.open(TAR, "w:gz") as archive:
        archive.add(OUT, arcname="published")

    print(
        json.dumps(
            {
                "written": written,
                "ranked": manifest["ranked_counties"],
                "out": str(OUT),
                "tar": str(TAR),
                "tar_bytes": TAR.stat().st_size,
                "catalog_bytes": cat_path.stat().st_size,
                "counties_bytes": sum(path.stat().st_size for path in counties_dir.glob("*.json.gz")),
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
