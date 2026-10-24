# Porch Light submission package

Evidence cut: October 23, 2026. Model figures below are the reconciliation baseline at resume, not a live progress counter. The resume is running; national model coverage is unfinished.

Porch Light is a sourced outreach workflow for dialysis centers and nursing homes. An operator selects a county or captured official alert, inspects a ranked call sheet and its source evidence, reviews available grounded call scripts, and records manual contact outcomes. Radar supplies supporting weather context.

## Materials

| File | Purpose |
|---|---|
| [Written submission](written-submission.md) | Submission text with bounded results and limits |
| [Demo script](demo-script.md) | Presenter narration and evidence checklist for a recording |
| [Verification](verification.md) | Checks for this documentation change, separate from product results |

These are source materials. A finished video, rendered slide deck and external submission are not included.

## STATUS

### Works

| Verified result | Evidence and scope |
|---|---|
| All 3,235 counties completed an audited source chain at least once | [Source sweep](../engines/reports/national-sweep-2026-10-23.md), including its separate Robertson County recovery. The original pass completed 3,234 chains and retained one runtime failure. |
| 18 script outcomes: 16 pass, 2 retained fails, $0 actual script request cost | [Script verification](../engines/reports/national-script-verification-2026-10-23.md), including the later Denver section. These scoped checks cover Baldwin, Providence and Denver, not national model coverage. The 18 outcomes used 20 provider attempts including retries. |
| Source evidence and script failures remain inspectable | The script report verifies source/query references, retained attempt IDs, the sole linked retry, cached replay and available route/cost receipts. Invalid responses were not repaired into successes. |
| Operator contact records, CSV and print are implemented | [Local workflow](../web/README.md) and the script report describe the local application. Contact outcomes are entered by the operator; the application does not place calls or send messages. |

### Broken or unfinished

| Item | Current limit |
|---|---|
| National model phase | Resume is running. At resume, reconciliation recorded 1,290 accepted drafts, 340 exhausted retained failures and 1,380 zero-provider pause batches remaining. These are historical checkpoint counts, not current totals or successful coverage claims. |
| Final model rollup | No final `report.json` was present at the reconciled sweep path when preparing this package. Do not call national model coverage complete until that file exists, its provenance is checked and its outcomes are reviewed. A finished run can still contain failures or omissions. |
| Retained failures and source gaps | The two scoped script failures remain failed. Exhausted model failures are not successful drafts. Refusals, missing joins, unsupported alert mappings and empty counties remain visible. An empty result does not prove there are no care facilities. |
| Model cost reconciliation | Reconciliation establishes $0 known recorded spend, with unknown-cost rows and unresolved reservations. It does not establish zero total cost for the ongoing model run. Paid fallback was disabled in the evidence checked. |
| Operator and clinical evidence | No measured operator time saving, clinical validation, verified facility operating conditions or confirmed phone reachability is established. Directory contacts are not verified emergency contacts. |
| Fresh build check | The isolated production build compiled, then failed generated Next.js route-type checks on existing named `Page` and `RootLayout` exports. See [verification](verification.md). No application code was changed in this pass. |
| Release and packaging | No public deployment or continuous hosting is established. Shared operator coordination is unfinished. The video, rendered deck and final submission remain to be produced and checked. |

## Evidence ledger

| Evidence | How to use it |
|---|---|
| [National source report](../engines/reports/national-sweep-2026-10-23.md) | Read the first-pass table together with the separate recovery section. Do not erase the original failure. Source completion is distinct from model completion. |
| [National script report](../engines/reports/national-script-verification-2026-10-23.md) | Use the combined result after Denver: 18 outcomes, 16 pass, 2 retained fails, $0. The earlier 12-outcome table is a subset. |
| Model reconciliation, local private reference | `D:\Projects\AI_Projects\_claude\model-sweep-reconcile-2026-10-23.md`, reconciled at 10:57:17 PM ET. Its stopped-state narrative predates the approved, running resume. Its counts remain the baseline at resume. |
| Model completion artifact, local private reference | `%USERPROFILE%\.porchlight\national\sweeps\20261023T200048Z-78a426ba\report.json`. Raw checkpoints, receipts and credentials stay outside this package. |

The original model cohort contains 15,440 ranked rows in 1,544 batches. The two ranked Robertson retry rows are outside that cohort. Do not silently combine source recovery counts, scoped scripts and model checkpoints into one success total.

## Submission boundaries

Grounding means checking selected source clauses, approved questions and query references against the allowed schema. It does not validate clinical priority or present facility conditions. Ranking is deterministic development policy; Nemotron does not set scores. Scores are not a validated comparison of clinical urgency across counties.

Zetaris joins separately projected source relations that currently share one physical read-only PostGIS datasource. Do not describe them as independently live systems. External emergency resources are references, not partnerships or integrations. This package makes no exclusivity claim, outcome guarantee or promise of winning.

Before recording or submitting, recheck the model artifact and update all materials together if final evidence becomes available. Preserve remaining failures and omissions. Keep radar supporting the outreach workflow.
