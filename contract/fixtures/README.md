# Contract fixtures: all mock data

Every value in this directory is invented mock data for contract and UI
development. None of it is a real measurement, a real facility, or a real
record.

- `alert_milton_mock.json`: shaped like the archived Hurricane Milton
  Hurricane Warning for Manatee County FL (FIPS 12081) from the Iowa
  Environmental Mesonet archive, but it is a mock, not a captured NWS
  record. The real captured alert lands under `data/snapshot/raw/` with a
  provenance sidecar.
- `facilities_mock.json`: 25 fictional facilities (13 nursing homes, 12
  dialysis centers) with full `Evidence` and `ScoreBreakdown` blocks.
  Names are invented and marked `(mock)`; CCNs, coordinates, SVI
  percentiles, emPOWER counts, star ratings, query ids and ledger ids are
  all invented.
- `joins_mock.json`: join proposals and failed joins in the `JoinReport`
  shape, including a refused proposal and two failed joins.
- `trace_mock.json`: a full run trace in the `Trace` shape.
- `export_receipt_mock.json`: an `ExportReceipt` with a mock signature.

Validate against `contract/openapi.yaml`:

    python3 contract/validate_fixtures.py

Rules: every fixture file keeps `mock: true` where the schema allows it,
and `MOCK` markers in text fields. If a fixture ever holds captured real
data, it moves to `data/snapshot/raw/` with a `.provenance.json` sidecar
and stops being a fixture.
