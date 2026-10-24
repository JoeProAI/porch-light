# National live smoke results

Run: Thu Oct 23 2026, 10:00 PM to 11:05 PM ET, on Joe's laptop. Branch `claude/national-live` (worktree `pl-national`, web on 127.0.0.1:3111).
Live stack: local licensed Zetaris (JDBC, UI on :3000), `porchlight_postgis` national projections, Meterless/Nightshift on 127.0.0.1:8088 routing to the free NVIDIA Nemotron route.
Every number below is read from retained artifacts: `scripts/smoke-national.py` output, `%USERPROFILE%/.porchlight/national/jobs/<run>/snapshot.json` plus provenance sidecars, and the Meterless receipts attached to each model execution. Nothing was typed from memory, no county fell back to Manatee, and no facility, score, query ID or model reply was invented.

## 1. `scripts/smoke-national.ps1` (source chain only, `engines.national_run`)

Passed on the first live attempt. The fifth target is whatever county the live alert feed maps; tonight that was Los Angeles.

```
CATALOG  3235 counties  19.4s  query 24413  weather available
PASS  12081 Manatee FL  wall 8.3s  runtime 8.188  no county plan captured; geocode not exact; geocode not matched; CMS source marks this listing closed
    query 24417, 24418, 24419, 24420, 24421, 24422, 24423
PASS  48201 Harris TX  wall 8.5s  runtime 8.391  no county plan captured; geocode not exact; geocode not matched; CMS rating is missing; no emPOWER ZIP context for this county
    query 24424, 24425, 24426, 24427, 24428, 24429, 24430
PASS  17031 Cook IL  wall 8.5s  runtime 8.374  no county plan captured; geocode not exact; geocode not matched; tract SVI is missing or suppressed; CMS rating is missing; no emPOWER ZIP context for this county; source point is outside official county geometry
    query 24431, 24432, 24433, 24434, 24435, 24436, 24437
PASS  48301 Loving TX  wall 7.3s  runtime 7.195  no county plan captured; no CMS facilities in this county
    query 24438, 24439, 24440, 24441, 24443, 24444, 24445
PASS  06037 Los Angeles CA  wall 8.4s  runtime 8.298  no county plan captured; geocode not exact; geocode not matched; tract SVI is missing or suppressed; CMS rating is missing; no emPOWER ZIP context for this county
    query 24446, 24447, 24448, 24449, 24451, 24453, 24454
DONE
exit 0
```

## 2. Counties through the web call sheet (`POST /api/national`, `engines.national_jobs`, grounded drafts)

Each row is one run that the `/nationwide?run=<id>&county=<fips>` page reopens without starting a new job. "Call sheet showed" is the verified source result. "Nemotron drafts" is the model phase for the ranked rows; failures are retained per facility, never replaced with text.

| FIPS | County / selection | Run ID | Result | Call sheet showed | Nemotron drafts (Meterless free NVIDIA route) | Zetaris audit / wall | Error text |
|---|---|---|---|---|---|---|---|
| 02020 | Anchorage AK | b99696dfa3264ee4ab188ba1f38d9fbe | PASS | 6 source / 4 ranked / 2 refused (geocode not exact 2) | 4/4 drafts accepted, 1 Meterless requests, 0 retries, $0 | 7 ids (24585..24591) 25.0s |  |
| 15003 | Honolulu HI | aca2ebbdf1664d548732e78dad59583d | PASS | 54 source / 47 ranked / 7 refused (geocode not matched 4; geocode not exact 2; CMS rating missing 1) | 47/47 drafts accepted, 5 Meterless requests, 0 retries, $0 | 7 ids (24592..24604) 226.3s |  |
| 48301 | Loving TX | 9a8073c06a5741ceaee06f3cda1db5c7 | PASS | 0 source / 0 ranked / 0 refused | 0/0 drafts accepted, 0 Meterless requests, 0 retries, $0 | 7 ids (24508..24519) 10.1s |  |
| 06037 | Los Angeles CA | 55a4d39099264655a03cca081ffd3819 | PASS | 582 source / 450 ranked / 132 refused (geocode not exact 104; geocode not matched 19; CMS rating missing 6; tract SVI missing/suppressed 2; no emPOWER ZIP context 1) | 450/450 drafts accepted, 46 Meterless requests, 1 retries, $0; failures: provider_http_502 x10 | 7 ids (24692..24705) 1458.0s |  |
| 36047 | Kings NY | b2c27f90c9254b7f92723a48e7d7ac5c | PASS | 87 source / 77 ranked / 10 refused (CMS rating missing 5; geocode not exact 4; tract SVI missing/suppressed 1) | 67/77 drafts accepted, 9 Meterless requests, 1 retries, $0; failures: Model changed the facility scope or output schema x20 | 7 ids (24607..24613) 311.7s |  |
| 04013 | Maricopa AZ | 105bc6a7d843419c9c05512dbf9bcfa7 | PASS | 148 source / 120 ranked / 28 refused (geocode not exact 16; geocode not matched 7; tract SVI missing/suppressed 2; CMS rating missing 2; no emPOWER ZIP context 1) | 120/120 drafts accepted, 13 Meterless requests, 1 retries, $0; failures: provider_http_502 x10 | 7 ids (24691..24704) 500.9s |  |
| 48201 | Harris TX | 5afaabce1f2c4d87866e1114d22356f1 | PASS | 236 source / 140 ranked / 96 refused (geocode not exact 55; geocode not matched 26; CMS rating missing 10; no emPOWER ZIP context 5) | 130/140 drafts accepted, 13 Meterless requests, 0 retries, $0; failures: Model calls are paused by a retained operator stop marker, not a provider/cost violation:  x10 | 7 ids (24618..24624) 413.4s |  |
| 17031 | Cook IL | 49ee0a9f19de460e8eacefc2f438050d | PASS | 351 source / 212 ranked / 139 refused (geocode not exact 101; geocode not matched 26; CMS rating missing 8; no emPOWER ZIP context 2; point outside county geometry 1; tract SVI missing/suppressed 1) | 212/212 drafts accepted, 23 Meterless requests, 1 retries, $0; failures: Unterminated string starting at: line 4 column 419 (char 813) x10 | 7 ids (24738..24744) 745.2s |  |
| 35013 | Doña Ana NM | 28e5171fce5547a78ec6c4ca94c0cd90 | PASS | 11 source / 7 ranked / 4 refused (geocode not exact 4) | 7/7 drafts accepted, 1 Meterless requests, 0 retries, $0 | 7 ids (24593..24605) 45.2s |  |
| 60030 | Rose Island AS | 30bf6f8b0210432385fad2ea6ef76dd6 | PASS | 0 source / 0 ranked / 0 refused | 0/0 drafts accepted, 0 Meterless requests, 0 retries, $0 | 7 ids (24522..24529) 10.1s |  |
| 35013 | Flash Flood Warning: Dona Ana, NM | e11958038d13455a9e9edcb9dc4ac47b | PASS | 11 source / 0 ranked / 11 refused (outside alert polygon 7; geocode not exact 4) | 0/0 drafts accepted, 0 Meterless requests, 0 retries, $0 | 11 ids (24677..24690) 30.1s |  |
| none mapped | Gale Warning: Waters from Edisto Beach SC to Savannah GA exten | 6ec3a5ac0d35413b944d9d6a45997cfb | PASS (source gap) | gap panel, 0 rows, nothing invented |  | 3 ids (24678..24681) 20.1s |  |

Earlier attempts at the same counties are not deleted. They are listed in section 4 because they are the evidence for the two bugs fixed tonight.

Screenshots (outside Git): `D:\Projects\AI_Projects\_claude\screenshots\county-<fips>.png`, `alertMAPPED.png`, `alertUNMAPPED.png`, `nationwide-home.png`. Playwright reported no console errors beyond Next.js prefetch requests cancelled by navigation.

## 3. What the honest-gap rows mean

- **Loving TX (48301) and Rose Island AS (60030)**: seven closed Zetaris statements, zero CMS rows. The sheet says "No matching CMS nursing-home or dialysis rows were returned. That is not proof the county has no care facilities." No rows were manufactured.
- **Gale Warning, Edisto Beach SC to Savannah GA (marine zone)**: `mapping_status: source_zone_mapping_unavailable`. The alert job returns `porch-light.national-gap.v1` with three audit IDs and the panel "Source gap, no ranking invented." No county was guessed from the area description.
- **Flash Flood Warning, Doña Ana NM**: the county has 11 CMS rows, 7 ranked in county mode. Inside the actual warning polygon, PostGIS point coverage refused all 11 (7 outside the polygon, 4 non-exact geocodes). The alert sheet correctly shows zero ranked facilities rather than reusing the county list.
- **Kings NY, 10 unresolved drafts**: Nemotron dropped CCN 335328 from one ten-facility batch on both the first pass and the sole retry. Grounding refused the batch ("Model changed the facility scope or output schema"); the 9 correct selections in that batch are not used because the contract is one entry per supplied CCN. Retained as a real model failure.
- **Maricopa AZ**: one batch got HTTP 502 from Meterless; its linked retry passed. 120/120 accepted.
- **Refusals** everywhere are the real source reasons: non-exact or unmatched Census geocodes dominate; CMS rating missing, tract SVI suppressed, no emPOWER ZIP context and one point outside county geometry (Cook) are all visible on the sheet.

## 4. Failures found and fixed

| # | Symptom | Root cause | Fix | Evidence |
|---|---|---|---|---|
| 1 | Every county on :3111 returned 403 `Local-origin access required.` | `web/src/app/api/national/route.ts` pinned the Host header to port 3101. | Accept any loopback host and port; POST still requires a matching Origin. | Catalog and runs work on 3111; 3101 unchanged. |
| 2 | First Maricopa run (`e3c5a496…`): 24 Meterless requests, 0/120 drafts, `Extra data: line 1 column 2`. Provider content was a numbered plan ("1. Parse the facilities array…"), not JSON. | Nightshift's phase planner rewrote the structured request. Joe's engines branch fixed this minutes earlier in 418f917. | Ported the request-path hunk: `response_format: json_object` and header `meterless-tier-split: off`. | Anchorage re-run 1 request, 4/4; then 7/7, 47/47, 67/77, 130/140, 120/120, 212/212, 450/450. All receipts `provider: nvidia`, `nemotron-3.5-super-vl-120b-a12b`, `actual_usd: 0`. |
| 3 | First Anchorage run and the first LA/Cook/Harris runs: drafts failed before any provider call with "blocked by a retained provider/cost policy violation". | `ROUTE_STOP.json` was being written by the engines sweep as a *temporary pause* (`provider_or_cost_violation_observed: false`) while its worker drained. `model_budget.reserve` treated any stop file as a violation. | When the retained record says no violation was observed, the failure reason now says it is an operator pause and quotes the recorded reason. The marker itself was never touched; it belongs to the sweep owner. | Later Cook/Harris partial runs show the new text with the sweep owner's actual reason. |
| 4 | Mapped alert job returned 503 with the generic "couldn't start or complete" text. | The route swallowed `startNationalRun`'s own refusal ("Two local runs are already processing"). | Return selection/concurrency refusals as 409 with their text. | `curl` with county+alert now returns 409 `Choose one county or one official alert`. |

Not changed: CSS or tokens, model providers, OpenRouter, the budget cap, Manatee paths, any national dataset.

## 5. Budget and side effects

- Approval ledger `porch-light-national-20261023`: 132 attempts reserved before this session, 438 after. 158 of the 306 new attempts belong to these 23 web runs (including the 24 wasted by the planner bug and the 10 by the 502 retry); the rest were the concurrently running engines sweep, which shares the same ledger.
- Known cost across every receipt: $0. No paid fallback. No direct provider endpoint.
- Job folders, snapshots, call-script caches and screenshots stay outside Git.

## 6. Remaining risks

- The engines sweep worker toggles `ROUTE_STOP.json` while it repairs its reporter. Any web run that overlaps a pause will show the pause text for the remaining facilities. Re-running the county spends budget again; the sweep's own `--resume` logic handles its checkpoints but the web jobs don't resume.
- Nemotron occasionally drops one CCN from a ten-facility batch (Kings). Accepting the nine correct selections and retrying only the missing facility would raise acceptance without inventing anything, but it changes the batch contract and belongs to the engines owner.
- Alert jobs require a capture under fifteen minutes old. The catalog refresh (`action: refresh_alerts`) takes up to three minutes; an operator who picks an alert slowly will see the "no older than fifteen minutes" refusal. That refusal is correct, but the UI could show the capture age next to the button.
- LA takes about 24 minutes of sequential ten-facility batches. The sheet is usable as soon as the source chain closes (10 s); the draft phase streams in behind it.
- Playwright config and three specs still hardcode 3101. They were not run from this worktree.
