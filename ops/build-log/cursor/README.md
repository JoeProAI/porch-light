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
| State | Open. Not merged into `devin/web-manatee` |
| Title | National: any county / any alert call sheets |
| Branch | `cursor/national-web` |
| Pull request | https://github.com/JoeProAI/porch-light/pull/24 |
| Cloud agent | https://cursor.com/agents/bc-c6752700-6750-593a-89df-689560350687 |

Opened 2026-10-23. GitHub lists `cursoragent` on the branch commits except `b989bed` (`fix(web): never default contact outcome to reached`), which is `JoeProAI` only. The branch also merges other work, including `devin/web-manatee` and the open redesign in PR #25. The open diff includes the national county map, source-gap UI, and `scripts/smoke-national.*`. That work is not in this checkout until the pull request merges.

## Related open pull request

PR #25 (https://github.com/JoeProAI/porch-light/pull/25), branch `cursor/storm-night-redo-94c3`, is open. Its cloud-agent footer is the same agent as PR #22 (`bc-30a8efa5-b484-5973-97e7-6d25503294c3`). This log does not treat it as a separate usage total.

## What this log does not claim

- No Cursor usage dashboard, invoice, or token export was copied here.
- A rules directory on another branch is not, by itself, evidence of a Cursor build. The evidence is the pull requests above.
- Merged evidence in this checkout is PR #22. PR #24 remains open.
