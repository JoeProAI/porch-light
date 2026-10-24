# Porch Light submission package

Evidence cut: Saturday, October 24, 2026, 9:51 AM ET. This refresh replaces the earlier October 24 morning pack in pull request #41 and the October 23 pack in pull request #27.

Two earlier figures are withdrawn. The #27 pack quoted a reconciliation baseline (1,290 accepted drafts, 340 exhausted failures, 1,380 pause batches). The #41 pack said about 3,153 of 3,235 unique FIPS had source runs and that Connecticut and U.S. territories were skipped. Neither statement matches the private sweep directory. This pass counted that directory. See "County coverage, reconciled" below.

Product and docs evidence is `devin/web-manatee` through `8aeccd6` (pull request #41), the tip this refresh was cut from. Engine fixes that are not in that checkout are listed separately. Every model figure below is a snapshot of a private sweep that was still writing at 9:51 AM ET. This package does not call the sweep finished and does not claim a final `report.json`.

External submission deadline: Tuesday, October 27, 2026, 7:45 PM ET.

Porch Light is a sourced outreach workflow for dialysis centers and nursing homes. An operator selects a county or a captured official alert, inspects a ranked call sheet and its source evidence, reviews a grounded call script when one exists, and records a manual contact outcome. Radar is supporting weather context.

## Claim language

Three claims are allowed. Every other wording in this package stays inside them.

1. Every US county in the Census catalog has been source-audited through Zetaris at least once. That is the source phase only.
2. Grounded Nemotron drafts are in progress on free NVIDIA routes through Meterless. Known actual spend is $0. The draft phase is not finished and not every county has drafts.
3. An operator can open any catalog county today and get ranked facilities when local Zetaris is reachable and the county has rankable CMS rows.

Never claimed: an offline or local DGX Spark run, H-MEM, World Model, Markovian, finished drafts for all counties, clinical validation, exclusivity, or a competition result.

## Materials

| File | Purpose |
|---|---|
| [Written submission](written-submission.md) | Submission text with bounded results and limits |
| [Demo script](demo-script.md) | Presenter narration and evidence checklist for a recording |
| [Verification](verification.md) | Checks for this documentation refresh |

These are source materials. A finished video, a rendered slide deck, and an external submission are not in this package. `metadata.json` still has empty `demo_video` and `slide_deck` fields.

## Shipped on this web tip

Merged into `devin/web-manatee` before this refresh. None of these merges is a finished national model rollup.

| Pull request | What is actually in the checkout |
|---|---|
| [#24](https://github.com/JoeProAI/porch-light/pull/24) | National product: any county or captured alert, call sheets, and the night desk that shipped with that merge. [#25](https://github.com/JoeProAI/porch-light/pull/25) was still open on October 24 and is not an extra merged look. |
| [#38](https://github.com/JoeProAI/porch-light/pull/38) | Scout Intent gates the live call-script path (`engines/scout_intent.py`). Batch explanation drafts are not contract-gated. |
| [#34](https://github.com/JoeProAI/porch-light/pull/34) | `/nationwide` lists verified local county runs already on that machine. Empty state: "No completed local runs yet." The list does not invent counties. |
| [#31](https://github.com/JoeProAI/porch-light/pull/31) | CSV export includes `NWS alert URL`, `Alert captured at UTC`, and `Alert expires at UTC`. Cells are empty when the sheet has no selected alert. |
| [#41](https://github.com/JoeProAI/porch-light/pull/41) | Earlier October 24 pack. Superseded here for county coverage and model progress. |
| [#27](https://github.com/JoeProAI/porch-light/pull/27) | October 23 pack. Superseded for county coverage and model progress. |
| [#37](https://github.com/JoeProAI/porch-light/pull/37) | Mintlify source in `docs/`, night and amber theme, including `docs/images/screenshot-home.jpg`, `screenshot-nationwide.jpg`, and `screenshot-operate.jpg`. A public docs deployment is not claimed. |
| [#33](https://github.com/JoeProAI/porch-light/pull/33) | [Sponsor setup](../SPONSOR-SETUP.md). Edited in this refresh: the Lightning model id is now listed as evidenced, because the retained Scout Intent receipt and most sweep executions report it. |
| [#35](https://github.com/JoeProAI/porch-light/pull/35) | Cursor evidence for merged [#22](https://github.com/JoeProAI/porch-light/pull/22) and [#24](https://github.com/JoeProAI/porch-light/pull/24) only. See [build log](../ops/build-log/cursor/README.md). No token count or spend total is in the repository. |

`metadata.json` is edited in this refresh: the project summary now describes the national product, and `nvidia.models` lists both Nemotron ids that appear in retained receipts.

## Engines tip, separate base

`devin/engines-manatee` at `6f54146111ab0db34bd99d7997aad3297d21033d` (pull request #39) is not an ancestor of this web branch. Do not describe these commits as shipped in the web checkout.

| Pull request | Honest scope |
|---|---|
| [#40](https://github.com/JoeProAI/porch-light/pull/40) | Sweep resume reattaches cached model batches by facility CCN. |
| [#30](https://github.com/JoeProAI/porch-light/pull/30) | Sweep checkpoints publish by atomic replace. |
| [#36](https://github.com/JoeProAI/porch-light/pull/36) | Nightshift offline receipt status `blocked_preflight`. No offline generation ran. Tokens per second are unmeasured. This is not a local DGX Spark result and not an offline Nemotron result. The report file is on the engines branch, not in this checkout. |
| [#39](https://github.com/JoeProAI/porch-light/pull/39) | OpenRouter Nemotron backup code is present on the engines tip and absent from this web checkout. The 9:51 AM sweep snapshot records `paid_fallback_enabled` false and `known_actual_usd` 0. No paid backup call is claimed. |

## County coverage, reconciled

Counted on October 24, 2026 at 9:51 AM ET in the private sweep directory `%USERPROFILE%\.porchlight\national\sweeps\20261023T200048Z-78a426ba`:

| Count | Value | Meaning |
|---|---:|---|
| Catalog counties | 3,235 | Census county and county-equivalent catalog, including Connecticut planning regions and territories |
| County checkpoint files | 3,234 | One `county-<fips>.json` per completed first-pass audited chain |
| Retained first-pass failure | 1 | Robertson County, Texas, `48395`, kept as `failure-48395.json` |
| Separate retry | 1 | `source-retries/county-48395-attempt-2.json`, two ranked rows, one refusal |
| Counties source-audited at least once | 3,235 | 3,234 first pass plus the separate Robertson retry |
| Counties with ranked rows | 2,491 | 2,490 first pass plus Robertson after retry |
| Checkpoints with Connecticut or territory FIPS prefixes | 200 | Prefixes 09, 60, 66, 69, 72, 78 are present, not skipped |

The [October 23 source report](../engines/reports/national-sweep-2026-10-23.md) closing sentence, "all 3,235 counties have completed an audited chain at least once," is consistent with this count and is no longer withdrawn. The earlier "about 3,153" figure did not come from this directory and its origin was not found. Source-audited means a Zetaris chain ran and its refusals were recorded. It does not mean every county has facilities, drafts, or verified conditions. An empty county result does not prove there are no care facilities.

## STATUS

### Works

| Verified result | Evidence and scope |
|---|---|
| Every catalog county source-audited at least once | The reconciled count above. Source phase only. 2,491 counties return ranked rows. 353 returned no matching CMS rows and 391 returned no rankable rows in the first pass. |
| Any county opens today | `/nationwide` runs `engines.national_jobs` for a catalog county or a captured alert when local Zetaris is reachable, and fails closed with an unreachable message when it is not. Local machine receipts, not a hosted service. |
| One live Scout Intent call script, $0 | [Live receipt](../engines/reports/scout-intent-live-2026-10-23.json) for facility CCN `102853`. Meterless receipt `rcpt_req_qsa07grv`, `actual_usd` 0, contract `01M5NZW047TK9BE2HZQBQVB931`, `paid_fallback_enabled` false, reported model `nvidia/nemotron-3.5-lightning-30b-a3b`. One facility. No call was placed. |
| Scoped October 23 script checks: 18 outcomes, 16 pass, 2 retained fails, $0 | [Script verification](../engines/reports/national-script-verification-2026-10-23.md). Baldwin, Providence, and Denver only. 20 provider attempts including retries. Separate from the single Scout Intent receipt and from the national model phase. |
| Operator contact records, CSV, and print | [Local workflow](../web/README.md). Contact outcomes are entered by the operator. The application does not place calls or send messages. |

### Broken or unfinished

| Item | Current limit |
|---|---|
| National model phase | Sweep `20261023T200048Z-78a426ba`, phase `grounded_drafts`, `completed_batches` 1,282 of 1,545 in `progress.json` as of 9:51 AM ET on October 24, 2026. Budget: 1,621 of 2,000 approved attempts reserved, 1,616 completed records, 5 unresolved reservations. `known_actual_usd` 0. `paid_fallback_enabled` false. The directory was still being written at that time. Not finished. No final `report.json` is claimed. |
| Batch checkpoint snapshot | The 1,544 `model-batch-*.json` files at 9:51 AM ET cover 15,438 ranked rows and record 1,386 provider executions: 1,242 `grounding_passed`, 144 `failed`. Reported models: 1,110 `nvidia/nemotron-3.5-lightning-30b-a3b`, 250 `nvidia/nemotron-3.5-super-vl-120b-a12b`, 28 with no reported model. `accepted_facilities` 12,418 and `unresolved_facilities` 3,020. 256 batch files hold no provider request and carry the retained reason "Model calls are blocked by a retained provider/cost policy violation" over 2,570 rows. Whether the running worker reprocesses those batches is not known from this pass. The October 23 report counted 15,440 rows and 1,544 batches; the two-row difference is not explained here. |
| Retained draft failures | Failure reasons in the batch files include 690 rows with provider JSON parse errors, 330 rows where the model changed scope or schema, and 280 rows with HTTP 502. Those rows stay failed. 28 receipts have unknown cost. |
| Known model cost | `known_actual_usd` 0 is the known actual figure in that snapshot across both reported Nemotron ids. It is not a final cost certificate for a finished sweep. |
| Retained script failures | The two scoped Providence failures remain failed. Invalid responses were not repaired into successes. |
| Operator and clinical evidence | No measured operator time saving, clinical validation, verified facility operating conditions, or confirmed phone reachability is established. Directory contacts are not verified emergency contacts. |
| Release and packaging | No public deployment or continuous hosting is established. Shared operator coordination is unfinished. The video, rendered deck, and final external submission are still to be produced. This docs pass did not re-run the production build. The #27 packaging note recorded a generated Next.js route-type failure and that note is not cleared here. |

## Evidence ledger

| Evidence | How to use it |
|---|---|
| [National source report](../engines/reports/national-sweep-2026-10-23.md) | October 23 writeup for sweep `20261023T200048Z-78a426ba`. Use it for first-pass outcomes, the retained Robertson failure, the separate recovery, and the 2,491 ranked-county line. Its closing full-catalog sentence matches the directory count. |
| County coverage, reconciled | The table above. Counted from the private directory on October 24 at 9:51 AM ET. Not a file added in this checkout. |
| [National script report](../engines/reports/national-script-verification-2026-10-23.md) | Scoped checks only: 18 outcomes, 16 pass, 2 retained fails, $0. |
| [Scout Intent live receipt](../engines/reports/scout-intent-live-2026-10-23.json) | One facility, CCN `102853`, receipt `rcpt_req_qsa07grv`, `actual_usd` 0, Lightning model id. Do not invent further receipt ids. |
| Model snapshot, 9:51 AM ET | `progress.json` and the 1,544 batch checkpoints in the private sweep directory. Phase `grounded_drafts`. 1,282 of 1,545 batches. `known_actual_usd` 0. `paid_fallback_enabled` false. Raw checkpoints stay outside git. |
| [Sponsor setup](../SPONSOR-SETUP.md) and [metadata](../metadata.json) | Edited in this refresh for the Lightning model id and the national project summary. |
| [Cursor build log](../ops/build-log/cursor/README.md) | Merged Cursor product evidence is #22 and #24. No spend total. |

Keep these counts apart: catalog size (3,235), counties source-audited at least once (3,235), counties with ranked rows (2,491), ranked rows in the model cohort (15,438 in batch files), model batches (1,282 of 1,545), accepted facility drafts (12,418), unresolved (3,020). Do not add them into one success total.

## Submission boundaries

Grounding checks selected source clauses, approved questions, and query references against the allowed schema. It does not validate clinical priority or present facility conditions. Ranking is deterministic development policy. Nemotron does not set scores. Scores are not a validated comparison of clinical urgency across counties.

Zetaris joins separately projected source relations that currently share one physical read-only PostGIS datasource. Do not describe them as independently live systems. External emergency resources are references. This package makes no exclusivity claim, no outcome guarantee, and no claim of winning.

HHS emPOWER context is not a facility patient count. The operator verifies conditions. Porch Light does not place calls or send messages.

Before recording or submitting, recheck `progress.json` and the batch files. If the counts have moved, update every material together and keep the "as of" time on the new figure. Preserve the retained failures, the blocked batches, and the `blocked_preflight` offline receipt. Keep radar in support of the outreach workflow.
