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
owner now: Devin  (primary Joe in Cursor, backup Devin; Devin took over as backup while Joe was on other gates)
state: contract/openapi.yaml (11 endpoints incl. GET checkins and export artifact download, 13 schemas plus typed errors and empty states; Devin Review findings addressed in d537834), contract/adapter.md, contract/types (TypeScript and Python dataclasses), contract/fixtures (mock alert, 25 mock facilities with Evidence and ScoreBreakdown, joins with failed joins, trace, export receipt), .cursor/rules (house, paths, sponsors), and contract/validate_fixtures.py all landed on contract/initial. Fixtures validate.
next step: Joe reviews and merges the PR to main; every other agent codes against contract/types and the adapter interface. Then PR #1 (devin/data-scaffold) follow-up: data/scoring/weights.yaml term names should be renamed to match the contract ScoreTerm names (type_weight, svi_pct, empower_density_pct, cms_risk, plan_flag); the PR #1 placeholder weights do not conflict, only the names need to line up.
branch: contract/initial   open PRs: see merge log
how to run: python3 contract/validate_fixtures.py (needs pyyaml and jsonschema; pip install -r contract/requirements.txt)
fix note: validate_fixtures.py now removes its own directory from sys.path so contract/types cannot shadow the stdlib types module on Python 3.12+; it also uses Draft202012Validator with a referencing registry to match OpenAPI 3.1.
blocked: none
last update: Wed Oct 21 2026 8:45 PM ET

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
state: not started
next step: see your CREW brief
branch: desk/docs-*   open PRs: none
how to run: n/a
blocked: none
last update: Wed Oct 21 2026 8:20 PM ET

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
