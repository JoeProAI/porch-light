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

if errors:
    print(f"FAIL: {len(errors)} validation error(s)")
    for e in errors:
        print(" ", e)
    sys.exit(1)
print("OK: all fixtures validate against contract/openapi.yaml")
