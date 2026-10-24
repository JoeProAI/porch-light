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

## Real Source Captures

```powershell
python -m data.adapters.us.capture_cms
python -m data.adapters.us.capture_milton
python -m data.adapters.us.capture_census
python -m data.adapters.us.capture_cemp
python -m data.adapters.us.capture_svi
python -m data.adapters.us.capture_empower
python -m data.adapters.us.capture_nws --help
python -m unittest data.adapters.us.test_capture_cms data.adapters.us.test_capture_milton -v
```

`counties.py` registers Manatee only. `--county sarasota` is not a valid choice.

The capture commands fetch public source records. They do not call models.
Every source file keeps its original bytes and a provenance sidecar. A failed
fetch or missing source is an error, never a generated replacement.

The verification suite reads these preserved sources and fails if they are
missing or their hashes change:

- `data/snapshot/raw/cms/20261022T030046Z-a5ce96ba`: official nursing-home and
  dialysis CSVs plus their CMS release metadata. Metadata modified dates are
  September 30 and June 16, 2026, respectively.
- `data/snapshot/raw/iem/20261022T030817Z-ad065921`: the real Milton Hurricane
  Warning issuance `202410072107-KTBW-WTUS82-TCVTBW`, IEM event history and
  current NWS shapes for its Coastal and Inland Manatee sections.

CMS labels 12 nursing homes and eight dialysis listings as Manatee County in
these releases. One dialysis listing, CCN `102538`, has a source name beginning
`zz_closed_`. It is flagged for refusal/review, not assumed to be operating.
These are source county labels, not verified point-in-polygon joins.

Milton is a retrospective scenario. Current facility records and current zone
shapes do not establish conditions or boundaries in October 2024. IEM event
metadata can include a later cancellation; the original warning text is retained.

These are ingestion artifacts, not runtime results. No Zetaris query IDs,
geocodes, scores, explanations or missing phone numbers are invented.

## Cross-Source Preflight

```powershell
python -m data.adapters.us.capture_census --replay data/snapshot/raw/census/20261022T033241Z-b99bf8af
python -m data.adapters.us.preflight_manatee
```

Both commands read existing captures without network access. They currently
exit nonzero because real refusals and operational prerequisites remain.
The preflight is not an application endpoint and must not bypass Zetaris.

- Census provides county/tract geography for all 12 CMS nursing-home points
  and six dialysis address matches. One other dialysis address has no match;
  the closed source listing is not geocoded. Response echoes, CCNs and source
  hashes prevent geography from being attached to another facility.
- A point lookup verifies geography for that supplied point, not the provider's
  current street address. The six address matches have no Exact quality rating
  in the API response. All require operator quality review.
- The 18 rows resolve to 15 Census tracts. Those tracts are in the checked-in
  Manatee subset `data/snapshot/raw/svi/manatee-2022/SVI_2022_12081.csv`:
  93 tract rows, all county FIPS 12081, with a provenance sidecar. The sidecar
  records the national CDC source URL, `input_source_bytes` 61102059, and that
  the file is a county row subset with no percentile recalculation. The national
  gzip bytes are not in the tree. A sidecar for that removed gzip remains at
  `data/snapshot/raw/svi/20261022T034709Z-8417dfb9/SVI_2022_US.csv.gz.provenance.json`.
- All 18 rows have a corresponding HHS ZIP/county aggregate row. The capture
  retains the exact official layer name/id and all 968 Florida features.
  Do not sum repeated ZIP counts across facilities or call them patient counts.
  Values reported as 11 retain a small-count caution; reporting month is unverified.
- The official municipal PDF contains the 2018 county plan and its 2020
  adoption record. Its 93 pages were inspected locally with the already
  installed PDF reader, not through Nemotron Parse. It is not labeled current.

Additional pinned captures are `census/20261022T033241Z-b99bf8af`,
`cemp/20261022T033833Z-30a3bbd5`, `svi/manatee-2022` and
`empower/20261022T034841Z-6bed0765`, under `data/snapshot/raw/`.
The coastal-flood NWS directory `nws/20261022T022303Z-b4222c27` is not in
this branch.

No ranked output is ready. A real Zetaris read/audit trail, verified warning-area
geometry, normalized policy inputs, operator hand check and real model execution
remain separate gates. This is source coverage, not clinical accuracy.

## Frozen Manatee Profile

County profiles are configured in `counties.py`; pinned selections are in
`county_sources.py`. The checked-in profile is Manatee (FIPS 12081) only.
That is a source-backed pilot selection, not a promise that arbitrary counties
or every state are operational.

```powershell
python -m data.adapters.us.preflight_county --county manatee
```

The original `preflight_manatee` command remains compatible.

An earlier pass captured Sarasota as a second pilot (30 nursing-home and 12
dialysis source rows, Census `census/20261022T122355Z-be9e3a8d`, Milton zones
`FLZ160` and `FLZ260` under `iem/20261022T123021Z-0919e9fc`). Those capture
files are not in this branch, and `--county sarasota` is rejected.

`data/snapshot/test_database.py` asserts the Manatee load: 20 source rows,
18 geography rows, 18 points covered by the current published zone union,
18 SVI rows and 18 HHS context rows. CCNs 102538 and 102646 stay without an
invented point. Those checks need the dedicated PostGIS service. They are not
a Zetaris query. See `data/snapshot/README.md`.

## Full Captured-Source Verification

Run from the canonical project root. These tests make no network or model calls.
Missing source artifacts are errors, not an invitation to generate replacements.

```powershell
python -m unittest `
  data.adapters.us.test_capture_cms `
  data.adapters.us.test_capture_milton `
  data.adapters.us.test_capture_census `
  data.adapters.us.test_capture_cemp `
  data.adapters.us.test_capture_svi `
  data.adapters.us.test_capture_empower `
  data.adapters.us.test_preflight_manatee `
  data.provenance.test_git_bytes `
  data.provenance.test_sidecar -q
```

`test_capture_nws` and `test_county_expansion` are not in this branch.
The real-database checks in `data.snapshot.test_database` run separately and
require the actual dedicated service:

```powershell
python -m unittest data.snapshot.test_database -v
```

Raw sources and their sidecars are byte-preserved in Git. They are exempt from
line-ending normalization and whitespace cleanup; source publisher whitespace
must not be rewritten to satisfy a code-style check. The Git regression checks
compare every indexed/committed artifact and sidecar with the original bytes.
