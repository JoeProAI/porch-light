# data/adapters/us/

All US code lives here, behind `contract/adapter.md` (lands with the contract
commit). One adapter per source in `sources.yaml`.

An adapter does three things:

1. Fetch raw source data into `data/snapshot/raw/<source_key>/` and write a
   `.provenance.json` sidecar for every file (`data/provenance/sidecar.py`).
2. Load the raw files into the PostGIS snapshot (`data/snapshot/`).
3. Expose the table(s) the USL maps, nothing else. Zetaris SQL does the rest.

Adapter skeleton (to be filled per source, matching contract/adapter.md):

- `fetch(ctx) -> list[path]`: download raw artifacts
- `load(ctx, paths) -> list[str]`: load into PostGIS, return table names
- `provenance(paths)`: write/refresh sidecars via `data/provenance/sidecar.py`

No adapter may read another area's data path, call a model, or bypass Zetaris
at runtime. Fetch is a build-time step; runtime reads are Zetaris SQL only.
