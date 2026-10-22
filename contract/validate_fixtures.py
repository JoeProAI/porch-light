#!/usr/bin/env python3
"""Validate contract fixtures against contract/openapi.yaml schemas.

One command:

    python3 contract/validate_fixtures.py

Needs pyyaml, jsonschema and referencing (see contract/requirements.txt). Exit 0 when every fixture validates.
"""
import os
import sys

# Drop the script's own directory from sys.path so contract/types does not
# shadow the stdlib types module when run as `python3 contract/validate_fixtures.py`.
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path = [p for p in sys.path if os.path.abspath(p or os.curdir) != _HERE]

import json
from pathlib import Path

import jsonschema
import referencing.jsonschema
import yaml
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"

spec = yaml.safe_load((ROOT / "openapi.yaml").read_text())
schemas = spec["components"]["schemas"]

registry = Registry().with_resource(
    "openapi.yaml", Resource.from_contents(
        spec, default_specification=referencing.jsonschema.DRAFT202012))
root_validator = jsonschema.Draft202012Validator(
    {"$ref": "openapi.yaml"}, registry=registry)


def check(name: str, fixture_file: str, schema_name: str,
          items_key: str | None = None) -> list[str]:
    errors = []
    data = json.loads((FIXTURES / fixture_file).read_text())
    validator = root_validator.evolve(
        schema={"$ref": f"openapi.yaml#/components/schemas/{schema_name}"})
    if items_key is None:
        docs = [(fixture_file, data)]
    else:
        docs = [(f"{fixture_file}:{items_key}[{i}]", d)
                for i, d in enumerate(data[items_key])]
    for label, doc in docs:
        for e in validator.iter_errors(doc):
            errors.append(f"{label}: {e.absolute_path}: {e.message}")
    return errors


errors = []
errors += check("alert", "alert_milton_mock.json", "Alert")
errors += check("facilities", "facilities_mock.json", "RankedFacility", items_key="items")
errors += check("joins", "joins_mock.json", "JoinReport")
errors += check("trace", "trace_mock.json", "Trace")
errors += check("receipt", "export_receipt_mock.json", "ExportReceipt")
errors += check("ledger", "ledger_mock.json", "Ledger")


def cross_checks() -> list[str]:
    errs = []
    facilities = json.loads((FIXTURES / "facilities_mock.json").read_text())["items"]
    receipt = json.loads((FIXTURES / "export_receipt_mock.json").read_text())
    trace = json.loads((FIXTURES / "trace_mock.json").read_text())
    joins = json.loads((FIXTURES / "joins_mock.json").read_text())
    ledger = json.loads((FIXTURES / "ledger_mock.json").read_text())

    by_rank = sorted(facilities, key=lambda f: f["score"]["rank"])
    # (a) ranks are exactly 1..N and totals descend by rank
    if [f["score"]["rank"] for f in by_rank] != list(range(1, len(by_rank) + 1)):
        errs.append("facilities: ranks are not exactly 1..N")
    prev = None
    for f in by_rank:
        total = f["score"]["total"]
        if prev is not None and total > prev:
            errs.append(
                f"facilities:{f['id']}: total {total} outranks "
                f"higher ranked total {prev}")
        prev = total
        # (b) total equals the sum of weighted terms
        expected = sum(t["weighted"] for t in f["score"]["terms"])
        if abs(total - expected) > 1e-6:
            errs.append(
                f"facilities:{f['id']}: score.total {total} != "
                f"sum of weighted terms {expected}")
        # (e) county_key 12081 rows sit inside the Manatee lat band
        if (f.get("county_key", {}).get("value") == "12081"
                and not 27.20 <= f["lat"] <= 27.65):
            errs.append(
                f"facilities:{f['id']}: county_key 12081 but lat "
                f"{f['lat']} outside 27.20..27.65")

    # (c) receipt evidence_ids are the top 10 facilities by rank, in order
    top10 = [f["id"] for f in by_rank[:10]]
    actual = receipt["contract"]["evidence_ids"]
    if actual != top10:
        errs.append(
            f"export_receipt: contract.evidence_ids {actual} != "
            f"top 10 by rank {top10}")

    # (d) every referenced id resolves in the other fixtures
    query_ids = set()
    for s in trace["steps"]:
        query_ids.update(s.get("query_ids", []))
    for p in joins["proposals"] + joins["failed"]:
        if p.get("query_id"):
            query_ids.add(p["query_id"])
    trace_ids = {s["trace_id"] for s in trace["steps"] if "trace_id" in s}
    ledger_ids = {e["id"] for e in ledger["entries"]}
    for f in facilities:
        fid = f["id"]
        ev = f["evidence"]
        for q in ev["zetaris_query_ids"]:
            if q not in query_ids:
                errs.append(f"facilities:{fid}: zetaris_query_id {q} "
                            "not found in trace or joins fixtures")
        tid = ev.get("reason", {}).get("trace_id")
        if tid and tid not in trace_ids:
            errs.append(f"facilities:{fid}: reason.trace_id {tid} "
                        "is not a trace step id")
        for lid in ev.get("ledger_ids", []):
            if lid not in ledger_ids:
                errs.append(f"facilities:{fid}: ledger id {lid} "
                            "not in ledger fixture")
        # nursing home rows: the ssa_to_fips hop query id must be one
        # of the row's own zetaris_query_ids
        if f["type"] == "nursing_home":
            for h in ev["join_path"]:
                if (h["method"] == "ssa_to_fips_crosswalk"
                        and h.get("query_id") not in ev["zetaris_query_ids"]):
                    errs.append(
                        f"facilities:{fid}: ssa_to_fips hop query id "
                        f"{h.get('query_id')} not in zetaris_query_ids")
    return errs


errors += cross_checks()

if errors:
    print(f"FAIL: {len(errors)} validation error(s)")
    for e in errors:
        print(" ", e)
    sys.exit(1)
print("OK: all fixtures validate against contract/openapi.yaml")
