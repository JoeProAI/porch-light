# Porch Light

Sourced outreach for dialysis centers and nursing homes, with evidence an operator can inspect.

Evidence cut: Saturday, October 24, 2026, morning ET, against `devin/web-manatee` at `67f8222b777777c8c266abe557be97e2e0c3178d`. External deadline: Tuesday, October 27, 2026, 7:45 PM ET. The video and slide deck are still empty.

## What it does

Porch Light brings public facility contacts, geographic context, and source references into a call sheet. An operator selects a county or a captured official alert, reviews deterministic ranking terms and refusals, inspects a grounded call script when one is available, and records a manual contact outcome. The call sheet supports CSV export and print. Radar provides supporting weather context.

The workflow keeps unknowns in view. A directory entry does not confirm that a facility is open, reachable, or affected by a warning. The operator still has to verify conditions. Porch Light does not place calls or send messages.

The shipped web desk is the national product from pull request #24: any Census county, or a captured official alert, on the night desk that merged with that pull request. Pull request #25 was still open on this morning and is not a second shipped look. `/nationwide` can reopen verified local runs that already exist on that machine (pull request #34). If that machine has none, the screen says so. The CSV includes the NWS alert URL, capture time, and expiry time when the sheet has a selected alert (pull request #31). Those cells are blank when no alert was selected.

## How it works

Zetaris executes audited source statements over CMS facility records, Census geography, CDC Social Vulnerability Index context, and HHS emPOWER aggregate context. These separately projected relations currently share one physical read-only PostGIS datasource. Missing or unsuitable source evidence produces a refusal or gap rather than an invented facility fact.

Ranking is deterministic code with inspectable terms. Meterless routes draft requests to NVIDIA Nemotron. On the live call-script path, Scout Intent (pull request #38) classifies the request, binds the facility CCN, and issues a signed execution contract. The draft executor checks that contract before a provider call. The model selects allowed source clauses and approved verification questions. Validation checks exact identities, source and query references, scope, and output schema. It does not set the ranking. Invalid outputs remain failed. Batch explanation drafts are not contract-gated. Stage 2 local embeddings are not installed.

Contact records stay on the operator's device. The product uses public facility and aggregate context, not patient records. HHS emPOWER context is not a facility patient count.

## Verified results

County coverage, as of this morning: the source sweep planner reports `remaining` 0. That empty queue is not full catalog coverage. About 3,153 of 3,235 unique FIPS have runs, and 2,491 of those runs have facilities. Connecticut and U.S. territories are skipped. The missing counties stay missing. They are not padded back to 3,235.

The [October 23 source report](../engines/reports/national-sweep-2026-10-23.md) is still in the tree. Its closing sentence says all 3,235 counties completed an audited chain at least once, after a separate Robertson County, Texas recovery. That sentence is withdrawn. The report remains the record of the first-pass failure and of the 2,491 counties with ranked rows after that recovery. Ranked rows are not finished model drafts, and a county with no CMS rows is not proof that no care facility exists there.

Model coverage, sweep `20261023T200048Z-78a426ba`, phase `grounded_drafts`: about 649 of 1,545 batches were complete as of about 6:38 AM ET. `known_actual_usd` was 0. `paid_fallback_enabled` was false. Those figures are a snapshot. The sweep is not finished, and this text does not pretend a later `report.json` exists.

One live call script is retained for a single facility, CCN `102853`, in [the Scout Intent receipt](../engines/reports/scout-intent-live-2026-10-23.json). Meterless receipt `rcpt_req_qsa07grv` records `actual_usd` 0. Contract `01M5NZW047TK9BE2HZQBQVB931` was verified before that provider call. No call was placed, and no facility condition is inferred. This is one facility, not a national script rate.

Separate from that receipt, the [scoped October 23 script checks](../engines/reports/national-script-verification-2026-10-23.md) recorded 18 outcomes in Baldwin County, Alabama; Providence County, Rhode Island; and Denver County, Colorado. 16 passed. 2 failed and remain retained. Actual script request cost was $0 across 20 provider attempts, including retries. Those checks are not the national model phase.

## Engines branch, not this checkout

`devin/engines-manatee` at `6f54146111ab0db34bd99d7997aad3297d21033d` is a separate base. It is not merged here. On that tip, pull request #40 resumes model batches by facility CCN, and pull request #30 publishes checkpoints atomically. Pull request #36 records an offline Nightshift probe with status `blocked_preflight`: no offline generation, no measured tokens per second, and no DGX Spark win. Pull request #39 adds OpenRouter backup code on that branch only. The morning sweep snapshot still has `paid_fallback_enabled` false. No OpenRouter spend is claimed.

## STATUS

### Works

An operator can open a county or a captured alert, read source gaps, export a CSV that carries the alert URL and times when an alert was selected, and record a contact outcome locally. Scout Intent gates one live call-script path, with one retained $0 receipt. Scoped script checks show both accepted drafts and retained failures. Verified local runs reopen only jobs that already exist on that machine.

### Broken or unfinished

National model coverage is unfinished: about 649 of 1,545 batches as of about 6:38 AM ET, not a completed rollup. Unique FIPS with source runs are about 3,153 of 3,235, with Connecticut and U.S. territories still skipped. The October 23 pack's 1,290 / 340 / 1,380 model baseline is stale and is not repeated as a live total.

Clinical validation, measured operator time savings, verified facility conditions, confirmed emergency contacts, shared operator coordination, and continuous public hosting are not established. Grounding verifies adherence to source clauses. It is not clinical validation. This package claims no exclusivity and no competition result. The video, rendered slide deck, and external submission remain unfinished.

## What to inspect

Inspect a sourced call sheet, its rank terms, and its query references. Compare the retained CCN `102853` script with a retained failure from the scoped checks. Read the county gap as about 3,153 of 3,235, and read the model phase as unfinished. The next evidence needed is a finished model rollup that still lists its failures, plus measured operator usefulness. Neither is assumed here.
