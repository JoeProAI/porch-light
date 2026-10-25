# Porch Light submission package

Evidence cut: Sunday, October 25, 2026, 23:08 UTC. This refresh replaces the October 24, 9:51 AM ET private-directory snapshot as the figure set for the hosted desk. That 9:51 AM `progress.json` (1,282 of 1,545 batches, and the batch totals printed with it) was a mid-sweep cut. This pass did not re-read the private sweep directory. It read the committed published pack and the live desk.

The live desk is https://porchlight.earth. Home is nationwide-first. `metadata.json` `demo_url` is that origin. `demo_video` and `slide_deck` stay empty until the recording and the deck exist.

Team target for the remaining human step: shoot the video before a HackOS submit aimed at Monday, October 26, 2026, 6:00 PM ET (the date in `HANDOFF.md`). `built_window` in `metadata.json` is unchanged: 2026-10-22T00:00Z to 2026-10-27T23:45Z.

## Claim language

Three claims. Every other sentence stays inside them.

1. Every US county in the Census catalog has been source-audited through Zetaris at least once. That is the source phase in `engines/reports/national-sweep-2026-10-23.md` (3,235 of 3,235, including the separate Robertson retry).
2. Stored Nemotron drafts are in the published pack, on free routes through Meterless, thinking disabled. 14,960 of 15,440 ranked rows passed at actual cost 0. 480 failed and stayed failed. Not every county has an accepted draft.
3. An operator can open any of the 2,490 published counties that have ranked facilities, today, at `/nationwide` on the hosted desk.

Not claimed: an offline or local DGX Spark run, H-MEM, World Model, Markovian, accepted drafts for all counties, a call that was not placed, clinical validation, or a competition result. The Milton sheet is a retrospective, not the product.

## Hosted pack

Sweep `20261023T200048Z-78a426ba`. Generated `2026-10-24T16:47:04.394911+00:00`. Files: `web/data/national/published/`.

| Count | Value | Meaning |
| --- | ---: | --- |
| Catalog counties | 3,235 | `catalog.counties`, Zetaris query `833` |
| Published snapshots | 3,234 | `manifest.json` `county_files`. Robertson `48395` is absent |
| Ranked counties on the desk | 2,490 | `publication.ranked_counties` |
| No rankable rows | 391 | Catalog outcome |
| No matching source rows | 353 | Catalog outcome |
| Runtime error, no file | 1 | Robertson County, Texas |
| Ranked rows | 15,440 | Sum of catalog `ranked_rows` |
| Passed drafts | 14,960 | `model_explanation.status` `passed`, `actual_usd` 0 |
| Failed drafts | 480 | Status `failed`, retained |
| Ranked counties with only failed drafts | 89 | Includes Anchorage, Alaska |

Live `GET /api/national?county=48395` on 2026-10-25 at 23:08 UTC returned HTTP 503 and `No published audited snapshot is available for this county. No substitute data was returned.`

The sweep report's post-retry line is 2,491 ranked counties and 15,442 ranked rows. Quote that only for the report. The desk is the first-pass pack.

## Materials

| File | Purpose |
| --- | --- |
| [Written submission](written-submission.md) | Submission text |
| [Demo script](demo-script.md) | What to open, and what to leave unsaid |
| [Verification](verification.md) | Checks for this refresh |

## Shipped product the video uses

| Pull request | What is on main |
| --- | --- |
| [#24](https://github.com/JoeProAI/porch-light/pull/24) | National county and alert desk |
| [#47](https://github.com/JoeProAI/porch-light/pull/47) | Nationwide-first home. One amber action. Milton is a footer link |
| [#22](https://github.com/JoeProAI/porch-light/pull/22) | Storm Watch |
| [#38](https://github.com/JoeProAI/porch-light/pull/38) | Scout Intent on the local call-script path |

The public host serves published GET snapshots. `POST /api/national` returns HTTP 403. Docs under `docs/` are source. No public docs URL is claimed.

## STATUS

### Works

| Result | Scope |
| --- | --- |
| Hosted catalog and three demo counties | Anchorage `02020` (4 ranked, drafts failed), Doña Ana `35013` (7 ranked, rank 1 Lightning pass, cost 0), Harris `48201` (140 ranked, rank 1 Super VL pass, cost 0). Live check 2026-10-25 23:08 UTC |
| Source audit of all 3,235 | `engines/reports/national-sweep-2026-10-23.md` |
| One Scout Intent call script, cost 0 | CCN `102853`, receipt `rcpt_req_qsa07grv`, contract `01M5NZW047TK9BE2HZQBQVB931` |
| Scoped script checks | 18 outcomes, 16 passed, 2 Providence failures retained, $0. `engines/reports/national-script-verification-2026-10-23.md` |

### Unfinished

| Item | Limit |
| --- | --- |
| Accepted drafts for every county | 480 failed rows, 89 ranked counties with no pass, 744 published files with no ranked rows, Robertson unpublished |
| New model call on the public host | HTTP 403. Confirmed 2026-10-25 23:09 UTC. No spend |
| Video and slide deck | Fields empty |
| Clinical use and operator time saved | Not measured. `docs/operator-usefulness.md` is a local note, not a study |
| Offline Nemotron | `blocked_preflight` in `engines/reports/nemotron-offline-proof-2026-10-23.md` |
