# Submission documentation verification

The October 24, 2026, 9:51 AM ET checks below still describe that private-directory reading. They were not re-run against the private filestore on October 25.

October 25 addition: `GET https://porchlight.earth/api/national` matched `web/data/national/published/catalog.json` (3,235 rows, 2,490 `complete_with_ranked_rows`, 391 `complete_no_rankable_rows`, 353 `complete_no_matching_source_rows`, 1 `runtime_error`). Live county reads for `02020`, `35013`, `48201`, and `12081` matched the committed gzip counts. `48395` returned 503 with no substitute sheet. Draft totals 14,960 passed and 480 failed were counted from the committed gzip files, not from a new model run. Catalog rows with FIPS prefixes `09`, `60`, `66`, `69`, `72`, and `78` sum to 100. The October 24 note of 200 checkpoints with those prefixes was not reproduced from the published catalog.

This pass did not create new county runs, model drafts, receipts, or spend.

## What changed

`submission/README.md`, `submission/written-submission.md`, `submission/demo-script.md`, and this file replace the county and model figures from pull requests #27 and #41. `SPONSOR-SETUP.md`, `metadata.json`, `docs/sponsors.mdx`, `docs/local-run.mdx`, `docs/limits.mdx`, and `HANDOFF.md` were edited to carry the same claim language and the same numbers.

Withdrawn, and not current totals:

- From #27: the reconciliation baseline of 1,290 accepted drafts, 340 exhausted failures, and 1,380 pause batches.
- From #41: "about 3,153 of 3,235 unique FIPS have runs" and "Connecticut and U.S. territories are skipped." The private sweep directory contains 3,234 county checkpoints plus the retained Robertson failure and its separate retry, and 200 of those checkpoints carry Connecticut planning-region or territory FIPS prefixes. The #41 figure's origin was not found in this pass.
- From #41: the withdrawal of the October 23 report's closing sentence. That sentence, "all 3,235 counties have completed an audited chain at least once," matches the directory count and stands.

Replacement figures, counted in `%USERPROFILE%\.porchlight\national\sweeps\20261023T200048Z-78a426ba` at 9:51 AM ET while the sweep worker was still writing:

- Source phase: 3,234 `county-*.json` checkpoints, `failure-48395.json`, `source-retries/county-48395-attempt-2.json`. 3,235 of 3,235 source-audited at least once. 2,490 first-pass counties with ranked rows, 2,491 after the retry.
- `progress.json`: phase `grounded_drafts`, `completed_batches` 1,282, `total_batches` 1,545, `approved_attempts` 2,000, `reserved_attempts` 1,621, `completed_records` 1,616, `unresolved_reservations` 5, `known_actual_usd` 0, `paid_fallback_enabled` false.
- 1,544 `model-batch-*.json` files: 15,438 facility rows, 1,386 model executions (1,242 `grounding_passed`, 144 `failed`), `accepted_facilities` 12,418, `unresolved_facilities` 3,020, `not_attempted_budget` 0, `unknown_cost_receipts` 28, `known_actual_usd` 0. Reported models: 1,110 `nvidia/nemotron-3.5-lightning-30b-a3b`, 250 `nvidia/nemotron-3.5-super-vl-120b-a12b`, 28 none. 256 batch files have zero provider requests and the retained reason "Model calls are blocked by a retained provider/cost policy violation" over 2,570 rows. Newest batch file and `progress.json` were both written at 9:51 AM ET; the latest execution `started_at` was 13:51 UTC.

The Lightning model id was added to `metadata.json` `nvidia.models` because it is the `reported_model` in `engines/reports/scout-intent-live-2026-10-23.json` and in most sweep executions. No new receipt was created.

The engines commits (#40, #30, #36, #39) remain on `origin/devin/engines-manatee`, which is not an ancestor of this web branch. Web ancestry for #24, #38, #34, #31, #37, #33, #35, and #41 is on `8aeccd6`.

## Documentation checks

Run from the repository root:

| Check | What it must show |
|---|---|
| Relative links in `submission/*.md` | Each `](...)` target that is not an `http` URL exists on disk. |
| Dash punctuation | No U+2013 or U+2014 in the four submission files. |
| Forbidden claims | No file states, in positive form, an offline DGX result, H-MEM, World Model, Markovian, or that all counties are drafted. Negated mentions ("not claimed", "never say") are allowed. |
| Stale figures | `3,153`, `649 of 1,545`, `6:38 AM`, and "territories skipped" appear only on lines that mark them withdrawn, stale, superseded, or as the earlier pack. |
| Required snapshot | `submission/README.md` contains `1,282 of 1,545`, `12,418`, `3,020`, `9:51 AM ET`, `blocked_preflight`, `rcpt_req_qsa07grv`, and the reconciled coverage table. |
| `metadata.json` | Parses as JSON; `nvidia.models` includes both Nemotron ids; `meterless.engines` is exactly `["Scout Intent"]`; every local path in `nvidia.where` and `nvidia.evidence` exists. |
| Boundaries | The files still say grounding is not clinical validation, and they make no exclusivity claim and no prize claim. |
| `git diff --check` | No whitespace errors. |

Recorded on this refresh, before commit, with a Python script run from the repository root over `submission/*.md`, `SPONSOR-SETUP.md`, `README.md`, `docs/limits.mdx`, `docs/sponsors.mdx`, `docs/local-run.mdx`, `docs/nationwide.mdx`, `web/README.md`, `engines/README.md`, and `metadata.json`.

| Check | Result |
|---|---|
| Relative links | Passed. Every relative target exists. |
| Dash punctuation | Passed. No en dash or em dash in the four files. |
| Forbidden claims | Passed. The only regex hits were the negated rules in `demo-script.md` and `SPONSOR-SETUP.md` ("never say" and "do not say"). |
| Stale figures | Passed after this file was rewritten. Remaining mentions are marked withdrawn or as the earlier pack. |
| Required snapshot | Passed. |
| `metadata.json` | Passed. JSON parses, both model ids present, engines list unchanged, all local paths exist. Full validation against `metadata.schema.json` with `jsonschema` Draft 2020-12 passed. |
| Boundaries | Passed. |
| `git diff --check` | Passed. |

## What this pass did not do

No live provider test, source sweep, model request, application restart, deployment, or spend. No radar, map, or look CSS edit. No change to the private sweep directory. No screenshot or browser pass of the web app. The #27 packaging note recorded an isolated production build that compiled and then failed generated Next.js route-type checks on existing `Page` and `RootLayout` exports. That build was not re-run here, so the failure is not cleared and is not newly confirmed. The two-row difference between the October 23 report's 15,440 rows and the 15,438 rows in the batch files was recorded, not explained. Whether the 256 policy-blocked batches get reprocessed by the running worker was not determined.
