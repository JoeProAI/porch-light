# data/

Everything Porch Light reads flows through this area. Zetaris is the only data
path at runtime: sources are cached into a local PostGIS snapshot (with
provenance sidecars), registered as a Zetaris JDBC datasource, and queried
through the `porch_light_usl` Unified Semantic Layer.

## Layout

- `adapters/us/` — all US source adapters, behind `contract/adapter.md`.
- `adapters/global/` — stretch only (GDACS, Overpass, WorldPop, CAP). Sat afternoon, after G4.
- `scoring/` — the fixed, transparent ranking formula. Weights in `weights.yaml`.
- `snapshot/` — PostGIS snapshot DDL and load scripts; the golden path reads here.
- `provenance/` — sidecar convention and `sidecar.py` helper.

## Rules

- Every cached file commits a `<file>.provenance.json` sidecar (see `provenance/README.md`).
- No invented numbers: every value is measured or carries its source.
- Raw source data never goes on the wire; Zetaris SQL is the read path.
- AGPL-3.0 compatible dependencies only.
