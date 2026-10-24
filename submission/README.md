# Porch Light submission package

Evidence cut: Saturday, October 24, 2026, morning ET. This refresh replaces the October 23 pack in pull request #27. That pack quoted a reconciliation baseline (1,290 accepted drafts, 340 exhausted failures, 1,380 pause batches) and closed the source sweep as all 3,235 counties. Both figures are withdrawn. They are not current totals.

Product and docs evidence is `devin/web-manatee` through `67f8222b777777c8c266abe557be97e2e0c3178d` (pull request #35), the tip this refresh was cut from. Engine fixes that are not in that checkout are listed separately. The model fraction below is an operator snapshot of a private progress file as of about 6:38 AM ET. The sweep was still in `grounded_drafts`. This package does not copy later progress and does not call the sweep finished.

External submission deadline: Tuesday, October 27, 2026, 7:45 PM ET.

Porch Light is a sourced outreach workflow for dialysis centers and nursing homes. An operator selects a county or a captured official alert, inspects a ranked call sheet and its source evidence, reviews a grounded call script when one exists, and records a manual contact outcome. Radar is supporting weather context.

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
| [#24](https://github.com/JoeProAI/porch-light/pull/24) | National product: any county or captured alert, call sheets, and the night desk that shipped with that merge. [#25](https://github.com/JoeProAI/porch-light/pull/25) was still open on the morning of October 24 and is not an extra merged look. |
| [#38](https://github.com/JoeProAI/porch-light/pull/38) | Scout Intent gates the live call-script path (`engines/scout_intent.py`). Batch explanation drafts are not contract-gated. |
| [#34](https://github.com/JoeProAI/porch-light/pull/34) | `/nationwide` lists verified local county runs already on that machine. Empty state: "No completed local runs yet." The list does not invent counties. |
| [#31](https://github.com/JoeProAI/porch-light/pull/31) | CSV export includes `NWS alert URL`, `Alert captured at UTC`, and `Alert expires at UTC`. Cells are empty when the sheet has no selected alert. |
| [#27](https://github.com/JoeProAI/porch-light/pull/27) | Prior submission pack. Superseded by this refresh for county coverage and model progress. |
| [#37](https://github.com/JoeProAI/porch-light/pull/37) | Mintlify source in `docs/`, night and amber theme, including `docs/images/screenshot-home.jpg`, `screenshot-nationwide.jpg`, and `screenshot-operate.jpg`. A public docs deployment is not claimed. |
| [#33](https://github.com/JoeProAI/porch-light/pull/33) | [Sponsor setup](../SPONSOR-SETUP.md). Read on this tip and left unchanged. |
| [#35](https://github.com/JoeProAI/porch-light/pull/35) | Cursor evidence for merged [#22](https://github.com/JoeProAI/porch-light/pull/22) and [#24](https://github.com/JoeProAI/porch-light/pull/24) only. See [build log](../ops/build-log/cursor/README.md). No token count or spend total is in the repository. |

`SPONSOR-SETUP.md` and `metadata.json` already match #33 and #35. This refresh does not edit them.

## Engines tip, separate base

`devin/engines-manatee` at `6f54146111ab0db34bd99d7997aad3297d21033d` (pull request #39) is not an ancestor of this web branch. Do not describe these commits as shipped in the web checkout.

| Pull request | Honest scope |
|---|---|
| [#40](https://github.com/JoeProAI/porch-light/pull/40) | Sweep resume reattaches cached model batches by facility CCN. |
| [#30](https://github.com/JoeProAI/porch-light/pull/30) | Sweep checkpoints publish by atomic replace. |
| [#36](https://github.com/JoeProAI/porch-light/pull/36) | Nightshift offline receipt status `blocked_preflight`. No offline generation ran. Tokens per second are unmeasured. This is not a local DGX Spark win and not an offline Nemotron win. The report file is on the engines branch, not in this checkout. |
| [#39](https://github.com/JoeProAI/porch-light/pull/39) | OpenRouter Nemotron backup code is present on the engines tip and absent from this web checkout. The morning sweep snapshot records `paid_fallback_enabled` false and `known_actual_usd` 0. No paid backup call is claimed. |

## STATUS

### Works

| Verified result | Evidence and scope |
|---|---|
| Source sweep planner queue is empty, and county coverage is still short of the catalog | Source sweep planner `remaining` 0. About 3,153 of 3,235 unique FIPS have runs. 2,491 of those runs have facilities. Connecticut and U.S. territories are skipped. The gap stays visible. Do not pad the missing counties up to 3,235. The [source report](../engines/reports/national-sweep-2026-10-23.md) still ends with "all 3,235 counties have completed an audited chain at least once." That closing sentence is the stale #27 claim. The 2,491 facility count matches that report's post-recovery ranked-county line. It is not a count of finished model drafts. |
| One live Scout Intent call script, $0 | [Live receipt](../engines/reports/scout-intent-live-2026-10-23.json) for facility CCN `102853`. Meterless receipt `rcpt_req_qsa07grv`, `actual_usd` 0, contract `01M5NZW047TK9BE2HZQBQVB931`, `paid_fallback_enabled` false. One facility. No call was placed. |
| Scoped October 23 script checks: 18 outcomes, 16 pass, 2 retained fails, $0 | [Script verification](../engines/reports/national-script-verification-2026-10-23.md). Baldwin, Providence, and Denver only. 20 provider attempts including retries. Separate from the single Scout Intent receipt and from the national model phase. |
| Operator contact records, CSV, and print | [Local workflow](../web/README.md). Contact outcomes are entered by the operator. The application does not place calls or send messages. |

### Broken or unfinished

| Item | Current limit |
|---|---|
| National model phase | Sweep `20261023T200048Z-78a426ba`, phase `grounded_drafts`, about 649 of 1,545 `completed_batches` as of about 6:38 AM ET on October 24, 2026. `known_actual_usd` 0. `paid_fallback_enabled` false. Snapshot only. The run is not finished. No final `report.json` is claimed. |
| County gap | Unique FIPS with runs are about 3,153 of 3,235. The remainder stays a gap. Connecticut and U.S. territories stay in the skipped set. Do not pad them into the completed count. An empty county result does not prove there are no care facilities. |
| Known model cost | `known_actual_usd` 0 is the known actual figure in that morning snapshot. It is not a final cost certificate for a finished sweep, and it is not a claim that every historical row has been priced. |
| Retained script failures | The two scoped Providence failures remain failed. Invalid responses were not repaired into successes. |
| Operator and clinical evidence | No measured operator time saving, clinical validation, verified facility operating conditions, or confirmed phone reachability is established. Directory contacts are not verified emergency contacts. |
| Release and packaging | No public deployment or continuous hosting is established. Shared operator coordination is unfinished. The video, rendered deck, and final external submission are still to be produced. This docs pass did not re-run the production build. The #27 packaging note recorded a generated Next.js route-type failure and that note is not cleared here. |

## Evidence ledger

| Evidence | How to use it |
|---|---|
| [National source report](../engines/reports/national-sweep-2026-10-23.md) | October 23 writeup for sweep `20261023T200048Z-78a426ba`. Use it for the retained Robertson County, Texas failure, the separate recovery, and the 2,491 ranked-county line. Do not use its closing "all 3,235" sentence as the morning coverage count. |
| Morning county accounting | Source sweep planner `remaining` 0. About 3,153 of 3,235 unique FIPS with runs. 2,491 with facilities. Connecticut and U.S. territories skipped. Not a file added in this checkout. |
| [National script report](../engines/reports/national-script-verification-2026-10-23.md) | Scoped checks only: 18 outcomes, 16 pass, 2 retained fails, $0. |
| [Scout Intent live receipt](../engines/reports/scout-intent-live-2026-10-23.json) | One facility, CCN `102853`, receipt `rcpt_req_qsa07grv`, `actual_usd` 0. Do not invent further receipt ids. |
| Morning model snapshot | Private sweep directory `%USERPROFILE%\.porchlight\national\sweeps\20261023T200048Z-78a426ba`. Phase `grounded_drafts`. About 649 of 1,545 `completed_batches` as of about 6:38 AM ET. `known_actual_usd` 0. `paid_fallback_enabled` false. Raw checkpoints stay outside git. |
| [Sponsor setup](../SPONSOR-SETUP.md) and [metadata](../metadata.json) | Already aligned to #33 and #35. Unchanged in this refresh. |
| [Cursor build log](../ops/build-log/cursor/README.md) | Merged Cursor product evidence is #22 and #24. No spend total. |

Keep four counts apart: catalog size (3,235), unique FIPS with source runs (about 3,153), runs with facilities (2,491), and model batches (about 649 of 1,545). Do not add them into one success total.

## Submission boundaries

Grounding checks selected source clauses, approved questions, and query references against the allowed schema. It does not validate clinical priority or present facility conditions. Ranking is deterministic development policy. Nemotron does not set scores. Scores are not a validated comparison of clinical urgency across counties.

Zetaris joins separately projected source relations that currently share one physical read-only PostGIS datasource. Do not describe them as independently live systems. External emergency resources are references. This package makes no exclusivity claim, no outcome guarantee, and no claim of winning.

HHS emPOWER context is not a facility patient count. The operator verifies conditions. Porch Light does not place calls or send messages.

Before recording or submitting, recheck the private sweep progress. If the batch count has moved, update every material together and keep the "as of" time on the new figure. Preserve the county gap, retained failures, and the `blocked_preflight` offline receipt. Keep radar in support of the outreach workflow.
