# Submission documentation verification

This file records the October 25, 2026 refresh. The pass read the committed published pack and the live HTTP API. It did not start a county run, a model draft, or a spend. The refused `POST /api/national` returned before a provider call.

## What changed

`README.md`, `metadata.json`, `DECLARED_PREEXISTING.md`, `SPONSOR-SETUP.md`, `env.example` (model-id comment), `docs/`, and `submission/` now describe the hosted nationwide desk.

Current figures are the published pack generated `2026-10-24T16:47:04Z` and the live responses at 23:08 UTC on October 25.

Marked as an earlier cut, not the desk:

- October 24, 9:51 AM ET `progress.json`: 1,282 of 1,545 batches, and the batch totals printed with that snapshot.
- The withdrawn "about 3,153" county figure and the withdrawn 1,290 / 340 / 1,380 baseline from earlier packs.

`metadata.json` `demo_url` is `https://porchlight.earth`. `demo_video` and `slide_deck` remain empty. `meterless.engines` remains `["Scout Intent"]`.

## Live checks

User-Agent browser header. Times are the HTTP `date` on the response.

| Request | Result |
| --- | --- |
| `GET /api/national` | 200. 3,235 counties. `ranked_counties` 2,490. `county_snapshots` 3,234. Sweep `20261023T200048Z-78a426ba`. Query `833`. Weather `unavailable` |
| `GET /api/national?county=02020` | 200. Anchorage. 4 ranked, 2 refused, 6 source. Rank 1 Polaris Extended Care `025036`. Explanation `failed` |
| `GET /api/national?county=35013` | 200. Doña Ana. 7 / 4 / 11. Rank 1 USRC Las Cruces `322559`. Lightning, `passed`, `actual_usd` 0 |
| `GET /api/national?county=48201` | 200. Harris. 140 / 96 / 236. Rank 1 DaVita North Houston Dialysis Center `452678`. Super VL, `passed`, `actual_usd` 0 |
| `GET /api/national?county=12081` | 200. Manatee national snapshot. 14 / 6 / 20. Not the Milton sheet |
| `GET /api/national?county=48395` | 503. No snapshot. No substitute |
| `GET /api/national?recent=1` | 200. 20 rows. First: Los Angeles `06037`, 450 ranked |
| `POST /api/national` `call_script` | 403. `Same-origin local access is required for model operations.` 23:09 UTC |
| `GET /` | 200. Title `Porch Light | Pick any US county.` Footer link `Hurricane Milton retrospective` |

## Pack recount

Python over `web/data/national/published/counties/*.json.gz` and `catalog.json`:

- Files 3,234. Missing FIPS `48395` only.
- Outcomes: 2,490 with ranked rows, 391 no rankable rows, 353 no matching source rows, 1 runtime error.
- Explanations: 14,960 passed at cost 0, 480 failed.
- Counties: 2,383 all passed, 18 mixed, 89 all failed.
- Executions: 4,098. 3,637 `grounding_passed`, 461 `failed`. Models 3,229 Lightning, 773 Super VL, 96 none. `paid_fallback_enabled` false. `thinking_disabled` true.

`metadata.json` validates against `metadata.schema.json` (Draft 2020-12). Every local path in sponsor `where`, sponsor `evidence`, and `pre_existing.where` exists.

## Documentation checks

Run from the repository root over `README.md`, `DECLARED_PREEXISTING.md`, `SPONSOR-SETUP.md`, `metadata.json`, `env.example`, `submission/*.md`, and `docs/**/*.mdx` before this commit.

| Check | Result |
| --- | --- |
| Dash punctuation | Passed. No U+2013 or U+2014 in those files |
| Forbidden positive claims | Passed. Mentions of offline DGX, H-MEM, World Model, and Markovian are negated, or they quote the sponsor menu and then say those engines are not claimed. No file says all counties are drafted |
| Stale totals as current | Passed. `1,282 of 1,545` and `3,153` appear only on lines that call them an earlier cut, a withdrawn figure, or a check for that wording |
| Stub pages | Passed. No unfinished stub sentence in `docs/*.mdx` |
| Relative links in `submission/*.md` | Passed. `written-submission.md`, `demo-script.md`, and `verification.md` resolve |
| `metadata.json` | Passed. Draft 2020-12 validation. `meterless.engines` is `["Scout Intent"]`. Both Nemotron ids are listed. Local sponsor paths exist |
| `git diff --check` | Passed |

`HANDOFF.md` still contains older review notes. The new section "Hosted desk and docs, Oct 25 at 7:08 PM ET" is the current claim record. The 9:51 AM ET section above it stays as history.
