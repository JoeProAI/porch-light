# Porch Light

Sourced outreach for dialysis centers and nursing homes. You open a county, read a ranked call sheet, and decide whom to call.

Evidence cut: Sunday, October 25, 2026, 23:08 UTC, against https://porchlight.earth and `web/data/national/published/` on main. The video and slide deck are still empty. The remaining human step is that recording, before the HackOS submit aimed at Monday, October 26, 2026, 6:00 PM ET.

## What it does

The live home is nationwide-first. **Pick any US county** opens `/nationwide`. A click reads a frozen audited snapshot from sweep `20261023T200048Z-78a426ba` (generated `2026-10-24T16:47:04Z`): ranked facilities, directory phones, score terms, refusals, and a stored Nemotron draft or a retained failure.

The formula in `data/scoring/weights.yaml` (`national-source-screen-v1`) sets the order. Nemotron, through Meterless `meterless/deep` with thinking disabled, wrote the drafts that are already on the rows. Opening the public page does not call the model. `POST /api/national` on that host returns HTTP 403, `Same-origin local access is required for model operations.`

Contact status stays in the browser and starts at **Not contacted**. The product does not place calls or send messages. A directory phone is not a verified emergency contact. A draft is not clinical validation.

The Hurricane Milton sheet at `/operate` is a retrospective Manatee example: 18 ranked rows, 2 refusals, formula `manatee-development-v1`. The national snapshot for the same FIPS is 14 ranked and 6 refused. Milton is a footer link, not the product.

## How it works

Zetaris ran the source statements over CMS facility records, Census geography, CDC/ATSDR SVI, and HHS emPOWER ZIP aggregates. Those relations share one read-only PostGIS datasource. The catalog statement is query `833`. Each published county sheet carries its own query ids. Missing joins stay refusals.

On the operator machine, Scout Intent gates a new call script: classify, bind the CCN, sign a contract, and refuse a bad contract before the provider call. One retained pass is CCN `102853`, receipt `rcpt_req_qsa07grv`, contract `01M5NZW047TK9BE2HZQBQVB931`, Lightning, `actual_usd` 0. Batch explanation drafts in the sweep are not on that gate.

## Verified results

Hosted pack, recounted from the committed gz files and matched to the live API for the catalog and for FIPS `02020`, `35013`, `48201`, `12081`, and `48395`:

- 3,235 catalog counties. 3,234 snapshots. 2,490 with ranked rows. 15,440 ranked rows.
- 14,960 drafts `passed`, provider `nvidia`, `actual_usd` 0. 480 `failed` and retained.
- 2,383 ranked counties all passed, 18 mixed, 89 all failed. Anchorage is all failed.
- Robertson County, Texas has no snapshot. The live GET returned 503 and no substitute county.
- Reported models on 4,098 explanation executions: 3,229 Lightning, 773 Super VL, 96 unreported. `paid_fallback_enabled` false on all 4,098. `thinking_disabled` true on all 4,098.

Source audit of all 3,235, including the separate Robertson retry (2 ranked rows, bringing the report's ranked-county total to 2,491), is `engines/reports/national-sweep-2026-10-23.md`. That retry is not in the hosted pack.

Scoped script checks (Baldwin, Providence, Denver) are a separate file: 18 outcomes, 16 passed, 2 retained failures, actual cost $0. They are not a national rate.

The October 24, 9:51 AM ET private progress figures are an earlier cut. They are not restated here as the desk.

## STATUS

### Works

You can open a published county on https://porchlight.earth/nationwide and read ranked facilities, gaps, and the stored draft status. Every catalog county has an audited source chain on record in the sweep report. Scout Intent has one retained $0 call-script receipt. The Milton sheet still opens at `/operate` and is labeled retrospective.

### Unfinished

Accepted drafts do not cover every county. Clinical validation, measured operator time savings, verified facility conditions, and shared operator coordination are not established. Offline DGX inference did not run (`blocked_preflight`). H-MEM, World Model, and Markovian are not claimed. The video, the rendered deck, and the external form are still open. This package claims no exclusivity and no competition result.

## What to inspect

Open Doña Ana (`35013`) and read a passed Lightning draft next to its query ids. Open Anchorage (`02020`) and read a failed draft that stayed failed. Open Harris (`48201`) if you want a large county (140 ranked, 96 refused). Read `submission/demo-script.md` before you record.
