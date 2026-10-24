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
import math
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
          items_key: str | None = None, directory: Path = FIXTURES) -> list[str]:
    errors = []
    data = json.loads((directory / fixture_file).read_text())
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


def cross_checks(directory: Path = FIXTURES) -> list[str]:
    errs = []
    facilities = json.loads((directory / "facilities_mock.json").read_text())["items"]
    receipt = json.loads((directory / "export_receipt_mock.json").read_text())
    trace = json.loads((directory / "trace_mock.json").read_text())
    joins = json.loads((directory / "joins_mock.json").read_text())
    ledger = json.loads((directory / "ledger_mock.json").read_text())

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
        weights = {
            "type_weight": 0.30, "svi_pct": 0.25, "empower_density_pct": 0.20,
            "cms_risk": 0.15, "plan_flag": 0.10,
        }
        for label, score in (("score", f["score"]), ("evidence.score", f["evidence"]["score"])):
            terms = score["terms"]
            if len(terms) != len(weights) or {t["name"] for t in terms} != set(weights):
                errs.append(f"facilities:{f['id']}:{label}: incomplete or duplicated terms")
            for term in terms:
                if not math.isclose(term["input"] * term["weight"], term["weighted"], abs_tol=0.0001):
                    errs.append(f"facilities:{f['id']}:{label}: incorrect weighted product")
                if term["name"] in weights and not math.isclose(
                    term["weight"], weights[term["name"]], abs_tol=1e-9
                ):
                    errs.append(f"facilities:{f['id']}:{label}: incorrect policy weight")
                if not 0 <= term["input"] <= 1:
                    errs.append(f"facilities:{f['id']}:{label}: input outside normalized range")
            if not math.isclose(score["total"], sum(t["weighted"] for t in terms), abs_tol=0.0001):
                errs.append(f"facilities:{f['id']}:{label}: total does not match terms")
        evidence_score = f["evidence"]["score"]
        if (
            evidence_score["rank"] != f["score"]["rank"]
            or evidence_score["formula_version"] != f["score"]["formula_version"]
            or not math.isclose(evidence_score["total"], f["score"]["total"], abs_tol=0.000100000001)
        ):
            errs.append(f"facilities:{f['id']}: evidence score differs from ranked score")
        row_terms = {t["name"]: t for t in f["score"]["terms"]}
        for term in evidence_score["terms"]:
            original = row_terms.get(term["name"])
            if original is None or any(
                not math.isclose(original[key], term[key], abs_tol=0.0001)
                for key in ("input", "weight", "weighted")
            ):
                errs.append(f"facilities:{f['id']}: evidence term differs from ranked term")
        # (e) county_key 12081 rows sit inside a conservative Manatee box.
        # The Sarasota line runs near lat 27.39 west of about -82.25, so the
        # floor is 27.38. Fixture points were checked with the Census
        # geocoder (coordinates to county 12081).
        if (f.get("county_key", {}).get("value") == "12081"
                and not (27.38 <= f["lat"] <= 27.65 and -82.75 <= f["lon"] <= -82.05)):
            errs.append(
                f"facilities:{f['id']}: county_key 12081 but point "
                f"{f['lat']},{f['lon']} outside the Manatee box")

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
        for fact in ev["facts"]:
            if fact["query_id"] not in query_ids or fact["query_id"] not in ev["zetaris_query_ids"]:
                errs.append(f"facilities:{fid}: fact query_id does not resolve in its evidence")
        for hop in ev["join_path"]:
            if hop.get("query_id") and (
                hop["query_id"] not in query_ids or hop["query_id"] not in ev["zetaris_query_ids"]
            ):
                errs.append(f"facilities:{fid}: join query_id does not resolve in its evidence")
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


def validate(directory: Path = FIXTURES) -> list[str]:
    errors = []
    for name, filename, schema, items in (
        ("alert", "alert_milton_mock.json", "Alert", None),
        ("facilities", "facilities_mock.json", "RankedFacility", "items"),
        ("joins", "joins_mock.json", "JoinReport", None),
        ("trace", "trace_mock.json", "Trace", None),
        ("receipt", "export_receipt_mock.json", "ExportReceipt", None),
        ("ledger", "ledger_mock.json", "Ledger", None),
    ):
        errors.extend(check(name, filename, schema, items, directory))
    if not errors:
        errors.extend(cross_checks(directory))
    return errors


def main() -> int:
    errors = validate()
    if errors:
        print(f"FAIL: {len(errors)} validation error(s)")
        for error in errors:
            print(" ", error)
        return 1
    print("OK: all fixtures validate against contract/openapi.yaml")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
