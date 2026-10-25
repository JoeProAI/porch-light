# Porch Light

Sourced outreach for dialysis centers and nursing homes. You can open any Census county and inspect the rank, the refusals, and the draft status.

Evidence cut for the live desk: Sunday, October 25, 2026. `GET https://porchlight.earth/api/national` matched the committed catalog `web/data/national/published/catalog.json` (3,235 counties, sweep `20261023T200048Z-78a426ba`, publication `2026-10-24T16:47:04Z`). Team submit target: Monday, October 26, 2026, 6:00 PM ET. `metadata.json` `demo_url` is `https://porchlight.earth`. `demo_video` and `slide_deck` are still empty. The recording is the remaining human step.

## What it does

The home page leads with **Pick any US county**. A county opens a call sheet of CMS dialysis and nursing-home rows that passed a fixed source screen, plus the rows that did not. Score terms, Zetaris query ids, and directory phones are on the row. A Nemotron draft is on the row when the published snapshot has one. A failed draft stays failed. You record a contact outcome on your own device, export CSV, or print. The app does not place calls or send messages.

The Milton sheet at `/operate` is a short retrospective coda. It is not the product. Hosted Manatee `12081` is a different, smaller national sheet (14 ranked rows).

## How it works

Zetaris ran the audited statements over CMS, Census geography, CDC/ATSDR SVI 2022, and HHS emPOWER ZIP aggregates. Those projections share one read-only PostGIS datasource. The hosted site serves that audit. It does not open JDBC in the browser. Missing evidence is a refusal or a gap.

Ranking is deterministic code. National sheets use `national-source-screen-v1` (`type_weight` 0.35, `svi_pct` 0.30, `empower_density_pct` 0.20, `cms_risk` 0.15). County plans are omitted. Nemotron does not set the score.

Meterless routes drafts to NVIDIA Nemotron on `meterless/deep` with thinking disabled. Reported ids are `nvidia/nemotron-3.5-lightning-30b-a3b` and `nvidia/nemotron-3.5-super-vl-120b-a12b`. `execution_location` on the published receipts is `nvidia_cloud`. `paid_fallback_enabled` is false across the pack. Scout Intent gates the local call-script path only. Batch explanation drafts are not on that gate.

## Verified results

Source phase, `engines/reports/national-sweep-2026-10-23.md`: 3,235 of 3,235 catalog counties have an audited chain at least once, after a retained first-pass failure for Robertson County, Texas (`48395`) and a separate retry. 2,491 counties return ranked rows after that retry. Connecticut planning regions and territory equivalents are in the catalog (100 rows with FIPS prefixes `09`, `60`, `66`, `69`, `72`, and `78`).

Hosted pack, counted from the committed gzip snapshots on October 25 and matched to the live catalog: 3,234 snapshot files, 2,490 counties with ranked rows, 15,440 ranked facility rows, 14,960 passed drafts, 480 failed drafts. 89 counties with ranked rows have only failed drafts. Robertson has no snapshot file. Live `GET /api/national?county=48395` returns 503 and does not substitute another county. The retry's two ranked rows are in the source report only.

Demo counties, live and in the pack:

| County | FIPS | Ranked | Refused | Drafts in the snapshot |
| --- | --- | --- | --- | --- |
| Anchorage, AK | `02020` | 4 | 2 | 4 failed |
| Doña Ana, NM | `35013` | 7 | 4 | 7 passed, Lightning |
| Harris, TX | `48201` | 140 | 96 | 140 passed |

One live call script is retained for CCN `102853`: receipt `rcpt_req_qsa07grv`, contract `01M5NZW047TK9BE2HZQBQVB931`, `actual_usd` 0, Lightning. Scoped script checks in `engines/reports/national-script-verification-2026-10-23.md`: 18 outcomes, 16 passed, 2 Providence failures retained, $0. Those checks are not the national pack.

An earlier private-directory reading at 9:51 AM ET on October 24 (1,282 of 1,545 batches, 12,418 accepted, 3,020 unresolved) was not re-read for this cut. The live desk is the published pack.

## What is unfinished

480 facility drafts in the pack remain failed. Not every county has a passing draft. Clinical validation, measured operator time savings, verified operating conditions, and confirmed emergency contacts are not established. H-MEM, World Model, Markovian, local GPU, and an offline DGX run are not in this submission. The optional OpenRouter module is unset, and no OpenRouter spend is claimed. The video and the slide deck are not in the package yet.

## What to inspect

Open `https://porchlight.earth/nationwide?county=02020` and read the failed draft on rank 1. Open `35013` and read a passed draft. Open `48201` for scale. Compare with the source report's 2,491 line so the hosted 2,490 is not rounded into the retry. The Milton link is optional and short.
