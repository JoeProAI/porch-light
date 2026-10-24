# Cursor build log

Checked against GitHub on 2026-10-24. This file records pull requests that exist. It does not record token counts, request totals, or spend. No spend figure is stored in this repository.

This note landed in https://github.com/JoeProAI/porch-light/pull/35. That pull request is the evidence file only. It is not a product change and it is not a usage total.

Cursor cloud agents authored the two pull requests below. Devin integrated `devin/web-manatee`. Cursor did not author the data adapters, the engines, or the whole web app.

## PR #22 — Storm Watch

| | |
|---|---|
| State | Merged into `devin/web-manatee` on 2026-10-23 |
| Title | Storm Watch v2: MapLibre night chart and Storm Glass Desk |
| Branch | `cursor/stormwatch-design` |
| Pull request | https://github.com/JoeProAI/porch-light/pull/22 |
| Cloud agent | https://cursor.com/agents/bc-30a8efa5-b484-5973-97e7-6d25503294c3 |

GitHub lists `cursoragent` on both commits: the Storm Glass Desk design note, and the MapLibre Storm Watch chart. The merged diff is under `web/` (Storm Watch, the watch bezel, shared controls, and `web/DESIGN.md`).

## PR #24 — national web

| | |
|---|---|
| State | Merged into `devin/web-manatee` on 2026-10-24 (merge `2912111a809decf68984fb7cb90d370eb37ef4c0`) |
| Title | National: any county / any alert call sheets |
| Branch | `cursor/national-web` |
| Pull request | https://github.com/JoeProAI/porch-light/pull/24 |
| Cloud agent | https://cursor.com/agents/bc-c6752700-6750-593a-89df-689560350687 |

Opened 2026-10-23. GitHub lists `cursoragent` on the pull request commits except `b989bed` (`fix(web): never default contact outcome to reached`), which is `JoeProAI` only. The merged diff includes the national county and alert web, source-gap UI, and `scripts/smoke-national.*`, plus storm-night files that were already on that branch. Commit `f9c82e459` on the branch is titled `merge storm night redesign from PR 25`. [PR #25](https://github.com/JoeProAI/porch-light/pull/25) was still open when this note was updated, so this log does not call PR #25 merged. The merged PR #24 work is in this checkout.

## Related open pull request

PR #25 (https://github.com/JoeProAI/porch-light/pull/25), branch `cursor/storm-night-redo-94c3`, was open on 2026-10-24. Its cloud-agent footer is the same agent as PR #22 (`bc-30a8efa5-b484-5973-97e7-6d25503294c3`). This log does not treat it as a separate usage total and does not treat it as merged.

## What this log does not claim

- No Cursor usage dashboard, invoice, or token export was copied here.
- A rules directory is not, by itself, evidence of a Cursor build. The evidence is the merged pull requests above.
- Merged Cursor evidence recorded here is PR #22 and PR #24. There is no token count or spend total.
- Scout Intent on the live call-script path is Meterless engine work in this checkout. It is not a Cursor usage total. The runtime model path remains Meterless Nightshift routing NVIDIA Nemotron.
