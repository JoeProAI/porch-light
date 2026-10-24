# Porch Light

Sourced outreach for dialysis centers and nursing homes, with evidence an operator can inspect.

## What it does

Porch Light brings public facility contacts, geographic context and source references into a call sheet. An operator selects a county or captured official alert, reviews deterministic ranking terms and refusals, inspects available grounded call scripts, and records a manual contact outcome. The call sheet supports CSV export and print. Radar provides supporting weather context.

The workflow keeps unknowns in view. A directory entry does not confirm that a facility is open, reachable or affected by a warning. The operator still has to verify conditions. Porch Light does not place calls or send messages.

## How it works

Zetaris executes audited source statements over CMS facility records, Census geography, CDC Social Vulnerability Index context and HHS emPOWER aggregate context. These separately projected relations currently share one physical read-only PostGIS datasource. Missing or unsuitable source evidence produces a refusal or gap rather than an invented facility fact.

Ranking is deterministic code with inspectable terms. Meterless routes draft requests to NVIDIA Nemotron. The model selects allowed source clauses and approved verification questions; validation checks exact identities, source/query references, scope and output schema. It does not set the ranking. Invalid outputs remain failed, with a sole linked retry where permitted and no third attempt after exhaustion.

Contact records stay on the operator's device. The product uses public facility and aggregate context, not patient records. HHS emPOWER context is not a facility patient count.

## Verified results

The [national source sweep](../engines/reports/national-sweep-2026-10-23.md) completed an audited chain for all 3,235 counties at least once. The original pass completed 3,234 chains with one retained runtime failure. A separately reported Robertson County, Texas recovery completed the remaining chain. This establishes audited source execution, not complete facility data or model coverage.

The [scoped script checks](../engines/reports/national-script-verification-2026-10-23.md) recorded 18 outcomes: 16 passed and 2 failed and remain retained. Actual script request cost was $0. The checks covered Baldwin County, Alabama; Providence County, Rhode Island; and Denver County, Colorado. Their 20 provider attempts include retries. These results are bounded local application checks, not a national model success rate.

## STATUS

### Works

The audited source workflow has run across all 3,235 counties at least once. Scoped local checks demonstrate accepted grounded scripts, visible retained failures, cached replay, manual contact records and export behavior. Source results remain usable when a model draft fails.

### Broken or unfinished

The national model resume is running. At resume, the October 23 reconciliation recorded 1,290 accepted drafts, 340 exhausted retained failures and 1,380 zero-provider pause batches remaining. These are the baseline at resume, not current totals. The final model `report.json` was absent when this package was prepared, so national model coverage is unfinished. Even after it exists, its failures and omissions must be reported.

The model reconciliation records $0 known spend, plus unknown-cost rows and unresolved reservations. It does not prove a zero-cost completed national run. The $0 result above applies to the scoped script checks.

Clinical validation, measured operator time savings, verified facility conditions, confirmed emergency contacts, shared operator coordination and continuous public hosting are not established. Grounding verifies adherence to source clauses, not clinical usefulness. The video, rendered slide deck and external submission remain unfinished.

A fresh isolated production build during packaging compiled, then failed generated Next.js route-type checks on existing named page/layout exports. The [packaging verification](verification.md) records this separately from the earlier product reports. This documentation pass does not repair application code.

## What to inspect

Inspect a sourced call sheet, its rank terms and query references, then compare an accepted draft with a retained failure. The next evidence needed is the final model rollup and measured operator usefulness. Neither is assumed by this submission.
