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

### Wringer batch 1 (2026-10-21 ~8:30 PM ET)
Verdicts:
- PR #1 (data scaffold, head c03963d): pass. Fix M1 before Thursday loads: both CMS links in sources.yaml return 410.
- PR #14 (contract, head 30057b0): BLOCKED by H1. contract/types/ shadows the Python stdlib types module, so `python3 contract/validate_fixtures.py` crashes on 3.11 to 3.13. Fix: rename contract/types to contract/schema_types, or run as `python3 -m contract.validate_fixtures`.
- PRs #12 and #13 were not in this batch.

| Id | Sev | Problem (short) | Fix (short) | Owner area |
|---|---|---|---|---|
| H1 | High | contract/types/ shadows stdlib types; validator crashes, "exits 0" proof false | Rename folder or move validator; rerun in clean venv | Contract |
| M1 | Med | Both CMS URLs in sources.yaml return 410 Gone | Switch to provider-data datastore API; record URL in sidecar | Data |
| M2 | Med | NBER SSA to FIPS crosswalk URL returns 404 | Find current URL; license in sidecar | Data |
| M3 | Med | emPOWER layer note unsourced, says "etc" | Exact layer names and ids from data dictionary, cited | Data |
| M4 | Med | Zetaris docker run publishes 8080 on all interfaces | Bind 127.0.0.1 or tailnet IP | Data |
| M5 | Med | PostGIS on loopback unreachable from Zetaris at wsl2-host; G2 likely fails (not run) | Shared Docker network, connect by container name | Data |
| M6 | Med | PR #1 body lacks the required HANDOFF block | Use `### HANDOFF` template, placed last | Data |
| M7 | Med | "~1.5h" time claim does not fit an 8:24 PM ET commit | Correct to real in-window time; declare any pre-window work | Contract |
| M8 | Med | Contract credited to Cursor but Devin wrote it | Real Cursor follow-ups with links, or reword 4 places | Contract, Front matter and ops |
| M9 | Med | 6 "Manatee" mock facilities geocode to Sarasota (12115) but carry 12081 | Move points inside Manatee or flag as test rows | Contract |
| M10 | Med | Every mock reason says "upper band", even rank 25 | Rank-dependent mock reasons citing top terms | Contract |
| M11 | Med | Export receipt evidence_ids are first 10 in file order, not top 10 | Use ranks 1 to 10 or document rule | Contract |
| M12 | Med | Evidence trail dead-ends: query, trace and ledger ids do not resolve | Make fixtures referentially closed; validator checks it | Contract |
| L1 | Low | Failed join says 2 dialysis geocode failures; none marked | Mark 2 rows failed or drop, match count | Contract |
| L2 | Low | ccn -> ccn hop uses point-in-polygon | Use ccn -> nws_zone (or tract_geoid) | Contract |
| L3 | Low | Mock CCNs lack Florida prefix 10 | Use 10xxxx pattern | Contract |
| L4 | Low | Model step metrics not labeled mock | Add "detail": "mock values" | Contract |
| L5 | Low | Invented weights; term names differ from PR #1 weights.yaml | PR #1 renames to ScoreTerm enum; keep weights marked mock | Data, Contract |
| L6 | Low | openapi.yaml defines no auth | Add bearer/tailnet note or security scheme | Contract |
| L7 | Low | Validator uses Draft7Validator and deprecated RefResolver | Draft202012Validator with referencing | Contract |
| L8 | Low | Contract section timestamp 8:45 PM is in the future; PRs not linked | Real commit time; link #14 | Contract |
| L9 | Low | No emPOWER layer field in Fact/ScoreTerm | Optional layer (name plus id) on Fact or SourceRef | Contract |
| L10 | Low | Em dashes in three data READMEs | Replace with colons | Data |
| L11 | Low | sidecar.py accepts bad fetched_at, non-UTC offsets, blank fields; no tests | Validate on write, require UTC, strip, add test | Data |
| L12 | Low | Zetaris refetch claim unsourced; live NWS path undocumented | Cite doc; state live alert path | Data |
| L13 | Low | Zetaris edition and port 8080 are assumptions | Exact image and port, or mark unverified | Data |
| L14 | Low | POSTGRES_PASSWORD on command line lands in shell history | Use --env-file with gitignored .env | Data |
| L15 | Low | Data "open PRs" is a branch, not a PR link | Link #1 | Data |
| L16 | Low | Devin Review flag not visible on GitHub | Joe or Devin reads it before merge | Integration and review |
| L17 | Low | Commits authored as Joseph Gaither with no agent trailer | Optional agent trailer from here on | All |

Full review (outside the repo): /workspace/hackathons/open-agent-2026/porch-light/reviews/wringer-batch-1.md on the shared box.

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
