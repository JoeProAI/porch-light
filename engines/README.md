Requires Java 21 and the licensed JDBC jar outside Git; set `PORCHLIGHT_ZETARIS_ENV_FILE` and `PORCHLIGHT_ZETARIS_JDBC_JAR` only when bundle paths differ.
Register the private read-only PostGIS connection in Zetaris as `porchlight_postgis`, reachable by the driver on `porchlight-private`; do not put its password in audited SQL.
Run `python -m engines.rank_manatee --register-zetaris-view` to register the source-native bundle view without copying data.
Run `python -m engines.rank_manatee --data-access zetaris --output engines/snapshots/manatee-zetaris.json --reuse-model-snapshot engines/snapshots/manatee-ranked.json`.
Every exported query ID must match a successful vendor audit row; missing JDBC, source registration, audit evidence or changed reusable facts fails closed, with no development fallback.

Cross-source chain: `python -m engines.rank_manatee --register-zetaris-chain`, then `python -m engines.rank_manatee --data-access zetaris_chain --output engines/snapshots/manatee-zetaris-chain.json --reuse-model-snapshot engines/snapshots/manatee-ranked.json`.
Seven separate audited statements select the snapshot, join CMS/Census/spatial results, join tract SVI, join county-qualified emPOWER ZIP aggregates, and read the reference population, warning union and provenance. SQL COUNT/window aggregates measure matches over all 20 source rows, including refusals. Setup query IDs are not attached to rows.
These are separately projected public-source relations in one physical read-only PostGIS datasource, not multiple independently live systems. Spatial predicates remain in PostGIS; relational joins are declared in Zetaris SQL. Cardinality changes, absent provenance or unaudited statements fail closed.

## National Source Chain

National files live under `%USERPROFILE%\.porchlight\national`, never in Git. Capture with `python -m data.adapters.us.capture_national`; use its explicit resume/geocode/catalog options after an interrupted capture. Load a verified capture with `python -m data.snapshot.national --folder <capture-directory>`. These are ingest operations, not alternate application data paths.

Register the read-only national projections with `python -m engines.national_sources --register` and `python -m engines.national_alerts --register`. The canonical county catalog comes from official Census records, with official NWS or Census geometry. Registration IDs aren't reused as facility-read evidence.

- `python -m engines.national_run --catalog` returns the actual county catalog and its audit.
- `python -m engines.national_run --county 12081` runs seven separately audited source statements.
- `python -m engines.national_jobs --catalog` adds fresh, actually mapped NWS alerts. Stale or unavailable weather doesn't become current by refreshing a page.
- `python -m engines.national_jobs --job <32-hex-run-id> --county <5-digit-fips>` publishes private, checksummed asynchronous status and result artifacts.
- Alert jobs use `--alert <captured-official-alert-id> --weather-capture <64-hex-capture>`. Actual PostGIS point coverage is required; an affected county alone doesn't establish that a facility is inside an alert.

The national profile is declared in `data/scoring/weights.yaml`. Its metadata must agree exactly with `national_weights.json`. It uses four explicit terms and omits county plans, rather than importing Manatee's archived plan or inventing a zero. ZIP ratio percentiles use their county reference cohorts. This prototype isn't clinically validated and cross-county scores aren't a validated urgency comparison.

Unmatched/non-exact addresses, absent or invalid geometry, source-marked closures, missing ratings, suppressed context, ZIP fanout and unavailable provenance remain visible. A zero-row county isn't proof that no care facilities exist there.

## Bounded Nemotron Drafts

Every runtime model path, including the legacy explanation entry point, uses the same durable approval budget. Joe approved 2,000 total Meterless request attempts including caller retries, only on the free NVIDIA Nemotron route. Reservations are atomic across processes. A draft may have one explicitly linked retry, never a third attempt. Failed provider content and validation errors are retained. Cap omissions are marked unattempted, not filled with computed prose.

Nemotron selects and orders exact source-clause IDs and two to four approved verification-question IDs. The constrained renderer adds no model-supplied facts. Grounding checks identity, closed fact/query references, scope, duplicate IDs and the exact output schema. This isn't clinical or operational validation, and it never changes a score.

Requests set JSON-object response format and `meterless-tier-split: off`. Otherwise Meterless's planner can rewrite a structured-output request into a numbered planning task. A real ten-facility single-phase retry passed grounding after that request-path fix. Previously exhausted provider failures remain cached and aren't retried again. Resume can regenerate a checkpoint only when its history proves the temporary output-contract pause prevented every provider call; those older no-provider checkpoints are archived intact.

Meterless credentials come only from its private proxy-token file. Every request disables thinking and records actual response/model IDs, latency, usage, requested/effective mode and the matching Meterless route/cost receipt. Missing attestations fail validation. A non-NVIDIA, non-Nemotron or nonzero-cost attestation blocks further requests. No direct provider endpoint or new provider key exists. Paid OpenRouter backup remains disabled.

`python -m engines.generate_drafts --snapshot engines/snapshots/manatee-zetaris-chain.json --all` processes the verified eighteen-facility snapshot. Existing identical-catalog successes can be reused. Failures that already exhausted the sole retry are retained, never regenerated under a new ID. The current artifact has 15 accepted and three rejected facilities, not eighteen claimed successes.

`python -m engines.national_jobs --call-script <source-ccn> [--source-run <local-run-id>]` requests a source-grounded operator script. Results and failures are cached with provenance. No call or message is placed; conditions remain unknown until verified.

## Measured Sweep

Run `python -u -m engines.national_sweep --all --sample 500 --workers 4 --drafts`. The scope freezes the actual alert capture, records all mapped active-alert counties, selects a seeded sample from the remainder, and optionally executes every remaining canonical county. `--resume <existing-sweep-directory>` verifies completed checkpoints and preserves their actual timings and source IDs.

Results stay under `%USERPROFILE%\.porchlight\national\sweeps`. `report.json`, `county-timings.csv`, per-county snapshots, unassigned source records, model batch results and progress files have provenance sidecars. Reports distinguish completed chains, genuine no-matching-source results, refusals, source gaps and runtime failures. They include model calls, first-pass requests, retries, recoveries, unresolved failures, cap omissions and the global approval ledger. Frozen alerts may expire during a sweep; they aren't relabeled current.

Checks: `python -m unittest engines.test_grounded_drafts engines.test_national engines.test_zetaris -v`. Live tests require the actual licensed local Zetaris installation. They don't fabricate data or provider success.

`python -m engines.sweep_report --folder <existing-private-sweep-folder> --output engines/reports/national-sweep-2026-10-23.md --wait` summarizes the source phase without waiting for model generation. It requires every county in the real catalog, verifies checkpoint checksums and distinct closed statement audits, and refuses to publish a partial result as final. The Markdown contains aggregate outcomes, facility coverage, p50/p95 timings, SQL join counts and honest gaps. Raw checkpoints remain private. Its pass rate measures completed source chains, not successful ranking or clinical usefulness.

## Audited Map Radar

The MapLibre integration uses IEM NEXRAD tiles and a separate scan clock. `python -m engines.radar_assets --register` captures the real clock and registers its read-only source projection once. Runtime asset batches capture up to forty allowlisted source keys, publish immutable hashes/paths, then read them through Zetaris. The app verifies bytes and provenance again before serving local PNGs. No browser reads radar or scan data directly from the upstream provider. Source caches last at most five minutes; missing assets fail visibly without replacement echoes.

Tile capture time isn't observation time. Relative layer offsets aren't verified per-tile scan timestamps. The separate NOAA observation loop retains its own source capture and audit. External OpenFreeMap basemap tiles are cartographic reference, not facility conditions or hazard evidence.

## OpenRouter Nemotron backup (optional, capped)

Meterless Nightshift remains the only primary model path. When `PORCHLIGHT_OPENROUTER_BACKUP=call_script` and `OPENROUTER_API_KEY` are set in a gitignored `.env.local`, a failed Meterless call-script request may retry once through OpenRouter using `nvidia/nemotron-3.5-lightning-30b-a3b`. `explanation_batch` / the national sweep stay on free NVIDIA only. Hard ceiling: `OPENROUTER_MAX_SPEND_USD` (Joe set 5). Spend ledger: `~/.porchlight/openrouter-spend/ledger.jsonl`. Code: `engines/openrouter_backup.py`.

