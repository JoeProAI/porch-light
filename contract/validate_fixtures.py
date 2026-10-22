#!/usr/bin/env python3
"""Validate contract fixtures against contract/openapi.yaml schemas.

One command:

    python3 contract/validate_fixtures.py

Needs only pyyaml and jsonschema. Exit 0 when every fixture validates.
"""
import json
import sys
from pathlib import Path

import jsonschema
import yaml

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"

spec = yaml.safe_load((ROOT / "openapi.yaml").read_text())
schemas = spec["components"]["schemas"]

resolver = jsonschema.RefResolver.from_schema(spec)


def check(name: str, fixture_file: str, schema_name: str,
          items_key: str | None = None) -> list[str]:
    errors = []
    data = json.loads((FIXTURES / fixture_file).read_text())
    validator = jsonschema.Draft7Validator(
        schemas[schema_name], resolver=resolver)
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
errors += check("facilities", "facilities_mock.json", "Facility", items_key="items")
errors += check("joins", "joins_mock.json", "JoinReport")
errors += check("trace", "trace_mock.json", "Trace")
errors += check("receipt", "export_receipt_mock.json", "ExportReceipt")

if errors:
    print(f"FAIL: {len(errors)} validation error(s)")
    for e in errors:
        print(" ", e)
    sys.exit(1)
print("OK: all fixtures validate against contract/openapi.yaml")
