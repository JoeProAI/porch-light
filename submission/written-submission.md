# Porch Light

Sourced outreach for dialysis centers and nursing homes, with evidence an operator can inspect.

Evidence cut: Saturday, October 24, 2026, 9:51 AM ET, against `devin/web-manatee` at `8aeccd6`. External deadline: Tuesday, October 27, 2026, 7:45 PM ET. The video and slide deck are still empty.

## What it does

Porch Light brings public facility contacts, geographic context, and source references into a call sheet. An operator selects a county or a captured official alert, reviews deterministic ranking terms and refusals, inspects a grounded call script when one is available, and records a manual contact outcome. The call sheet supports CSV export and print. Radar provides supporting weather context.

The workflow keeps unknowns in view. A directory entry does not confirm that a facility is open, reachable, or affected by a warning. The operator still has to verify conditions. Porch Light does not place calls or send messages.

The shipped web desk is the national product from pull request #24: any Census county, or a captured official alert, on the night desk that merged with that pull request. Pull request #25 was still open on October 24 and is not a second shipped look. `/nationwide` can reopen verified local runs that already exist on that machine (pull request #34). If that machine has none, the screen says so. The CSV includes the NWS alert URL, capture time, and expiry time when the sheet has a selected alert (pull request #31). Those cells are blank when no alert was selected.

## How it works

Zetaris executes audited source statements over CMS facility records, Census geography, CDC Social Vulnerability Index context, and HHS emPOWER aggregate context. These separately projected relations currently share one physical read-only PostGIS datasource. Missing or unsuitable source evidence produces a refusal or gap rather than an invented facility fact.

Ranking is deterministic code with inspectable terms. Meterless routes draft requests to NVIDIA Nemotron on free routes. On the live call-script path, Scout Intent (pull request #38) classifies the request, binds the facility CCN, and issues a signed execution contract. The draft executor checks that contract before a provider call. The model selects allowed source clauses and approved verification questions. Validation checks exact identities, source and query references, scope, and output schema. It does not set the ranking. Invalid outputs remain failed. Batch explanation drafts are not contract-gated. Stage 2 local embeddings are not installed.

Contact records stay on the operator's device. The product uses public facility and aggregate context, not patient records. HHS emPOWER context is not a facility patient count.

## Verified results

County coverage: every county in the 3,235-entry Census catalog has been source-audited through Zetaris at least once. The private sweep directory for run `20261023T200048Z-78a426ba` holds 3,234 first-pass county checkpoints, the retained first-pass failure for Robertson County, Texas, and a separate audited retry for that county. Connecticut planning regions and U.S. territories are in the checkpoint set. 2,491 counties return ranked rows. The rest returned no matching CMS rows or no rankable rows, and those refusals are recorded. The [October 23 source report](../engines/reports/national-sweep-2026-10-23.md) matches this count. The earlier October 24 pack's statement of about 3,153 counties with runs and skipped Connecticut and territories is withdrawn; it did not come from the sweep directory.

Source-audited is a source-phase statement. It does not mean every county has finished drafts, and a county with no CMS rows is not proof that no care facility exists there.

Model coverage, sweep `20261023T200048Z-78a426ba`, phase `grounded_drafts`, as of 9:51 AM ET: `progress.json` showed 1,282 of 1,545 batches complete, 1,621 of 2,000 approved attempts reserved, `known_actual_usd` 0, and `paid_fallback_enabled` false. The 1,544 batch checkpoints on disk recorded 1,386 provider executions, 1,242 passed grounding and 144 failed, with 12,418 accepted facility drafts and 3,020 unresolved out of 15,438 ranked rows. Reported models were `nvidia/nemotron-3.5-lightning-30b-a3b` for 1,110 executions and `nvidia/nemotron-3.5-super-vl-120b-a12b` for 250. 256 batch files held no provider request and a retained policy-block reason over 2,570 rows. The directory was still being written. The sweep is not finished, and this text does not pretend a later `report.json` exists.

One live call script is retained for a single facility, CCN `102853`, in [the Scout Intent receipt](../engines/reports/scout-intent-live-2026-10-23.json). Meterless receipt `rcpt_req_qsa07grv` records `actual_usd` 0 on the Lightning model id. Contract `01M5NZW047TK9BE2HZQBQVB931` was verified before that provider call. No call was placed, and no facility condition is inferred. This is one facility, not a national script rate.

Separate from that receipt, the [scoped October 23 script checks](../engines/reports/national-script-verification-2026-10-23.md) recorded 18 outcomes in Baldwin County, Alabama; Providence County, Rhode Island; and Denver County, Colorado. 16 passed. 2 failed and remain retained. Actual script request cost was $0 across 20 provider attempts, including retries. Those checks are not the national model phase.

## Engines branch, not this checkout

`devin/engines-manatee` at `6f54146111ab0db34bd99d7997aad3297d21033d` is a separate base. It is not merged here. On that tip, pull request #40 resumes model batches by facility CCN, and pull request #30 publishes checkpoints atomically. Pull request #36 records an offline Nightshift probe with status `blocked_preflight`: no offline generation, no measured tokens per second, and no DGX Spark result. Pull request #39 adds OpenRouter backup code on that branch only. The 9:51 AM sweep snapshot still has `paid_fallback_enabled` false. No OpenRouter spend is claimed.

## STATUS

### Works

An operator can open any catalog county or a captured alert when local Zetaris is reachable, read source gaps, export a CSV that carries the alert URL and times when an alert was selected, and record a contact outcome locally. Every catalog county has one audited source chain on record. Scout Intent gates one live call-script path, with one retained $0 receipt. Scoped script checks show both accepted drafts and retained failures. Verified local runs reopen only jobs that already exist on that machine.

### Broken or unfinished

National draft coverage is unfinished: 1,282 of 1,545 batches as of 9:51 AM ET, 12,418 accepted facility drafts and 3,020 unresolved in the batch files, 256 batches still carrying a policy block. Not a completed rollup. The October 23 pack's 1,290 / 340 / 1,380 model baseline and the earlier October 24 pack's 3,153-county figure are stale and are not repeated as live totals.

Clinical validation, measured operator time savings, verified facility conditions, confirmed emergency contacts, shared operator coordination, and continuous public hosting are not established. Grounding verifies adherence to source clauses. It is not clinical validation. Offline or local DGX Spark inference, H-MEM, World Model, and Markovian are not claimed. This package claims no exclusivity and no competition result. The video, rendered slide deck, and external submission remain unfinished.

## What to inspect

Inspect a sourced call sheet, its rank terms, and its query references. Compare the retained CCN `102853` script with a retained failure from the scoped checks. Read county coverage as source-audited for all 3,235, with 2,491 ranked, and read the draft phase as unfinished. The next evidence needed is a finished model rollup that still lists its failures, plus measured operator usefulness. Neither is assumed here.
