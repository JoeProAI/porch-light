# HANDOFF
Updated: Wed Oct 21 2026 8:20 PM ET   Target submit: Mon Oct 26 6 PM ET   Judging opens: Mon Oct 26 8 PM ET   Hard stop: Tue Oct 27 5 PM ET

How work moves between agents. If an area's primary stalls or runs out of quota, its backup reads that area's section and picks up from "next step". Edit only your own area's section. Never commit secrets; env var names only.

## Gates
| Gate | Due | Status | Note |
|---|---|---|---|
| G1 Contract commit lands | Wed Oct 21, 9 PM ET | open | Cursor cloud agent on `contract/initial` |
| G2 Zetaris local on the 5080 | Thu Oct 22, 10 AM ET | open | |
| G3 Local Nemotron via Meterless | Thu Oct 22, noon ET | open | |
| G4 US golden path green | Sat Oct 24, 1 PM ET | open | |
| G5 Global adapter (stretch) | Sat Oct 24, 10 PM ET | open | |

## Merge log
| Window | PRs merged (data, engines, eval, web, docs) | Wringer verdict | Notes |
|---|---|---|---|

## Review notes (open findings)
| Id | From | Severity | Area | Status |
|---|---|---|---|---|

## Decisions
- 2026-10-21: Repo created private after the window opened; first commit is the compliance kit, contract follows from Cursor.

## Area: Contract
owner now: Joe in Cursor  (primary Joe in Cursor, backup Devin)
state: not started
next step: see your CREW brief
branch: contract/*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Data
owner now: Devin  (primary Devin, backup Cursor cloud agent (data))
state: not started
next step: see your CREW brief
branch: devin/data-*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Engines
owner now: Claude Code  (primary Claude Code, backup Devin)
state: not started
next step: see your CREW brief
branch: claude/engines-*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Eval and CI
owner now: Codex  (primary Codex, backup Claude Code)
state: not started
next step: see your CREW brief
branch: codex/eval-*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Web
owner now: Cursor cloud agents  (primary Cursor cloud agents, backup Codex)
state: not started
next step: see your CREW brief
branch: cursor-web/*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Docs
owner now: Hackathon Desk docs seat  (primary Hackathon Desk docs seat, backup Claude Code)
state: in progress
next step: api-reference and the contract pages (architecture, zetaris-federation, meterless-and-nemotron, ranking, evidence-trail) are built against contract/initial (PR #14) and get re-pointed once #14 merges to main. Mintlify resolves the openapi path inside docs/, so after #14 merges, either copy or sync contract/openapi.yaml to docs/contract/openapi.yaml or set the docs root to the repo root. Fill the remaining stubs after the merge window; add the ranking weights once data/scoring/weights.yaml lands; leave eval numbers until measured results exist.
branch: desk/docs-stubs   open PRs: #13
how to run: cd docs && npx mint dev   (check: npx mint broken-links)
blocked: the API reference pages render only once the spec is reachable at docs/contract/openapi.yaml (see next step)
last update: Wed Oct 21 2026 8:55 PM ET

## Area: Front matter and ops
owner now: Hackathon Desk  (primary Hackathon Desk, backup Devin)
state: not started
next step: see your CREW brief
branch: desk/ops-*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Deck, script, explanation
owner now: Hackathon Desk  (primary Hackathon Desk, backup Claude Code)
state: not started
next step: see your CREW brief
branch: desk/ops-*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

## Area: Integration and review
owner now: Devin (Devin Review)  (primary Devin (Devin Review), backup Codex review)
state: not started
next step: see your CREW brief
branch: n/a   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET
