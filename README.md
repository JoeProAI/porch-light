# Porch Light

emPOWER tells you how many. Porch Light tells you who to call first, and why.

When a storm warning drops, Porch Light federates free public data through Zetaris and gives a county emergency manager a ranked call-first list of dialysis centers and nursing homes inside the warning area. A fixed, transparent formula ranks the list. NVIDIA Nemotron proposes the joins and writes every explanation. Every row carries a full evidence trail, and EOC snapshot mode keeps it working offline on one GPU.

Built for the GenAI.Works Open Agent Hackathon 2026, Track 01 (Solving Fragmented Intelligence), by team Burden of Proof.

> Status: under construction during the build window. Sections marked TODO are filled in as the build lands.

## Sponsor map

| Sponsor | Where it's used | How |
|---|---|---|
| Zetaris | `data/` | The only data path at runtime: federated SQL over a Unified Semantic Layer, with measured joins and DQ rules. TODO: paths |
| Meterless | `engines/` | The only model path: Meterless Runtime routing `meterless/deep`, `fast` and `local`, plus Scout Intent, H-MEM with TrustLedger, and a minimal World Model. TODO: paths |
| NVIDIA Nemotron | `engines/model_client/` | The only model family in the product: join proposals, explanations, call scripts, Content Safety, Parse. TODO: models confirmed |
| Cursor | `.cursor/rules/` | The `.cursor/rules/` files every agent follows to stay inside its area, follow the house rules and keep HANDOFF.md current. Cursor also runs the cloud agents for the web UI seat and the data backup seat. The contract (PR #14) was written by Devin, not Cursor. TODO: run links |

## Feature to engine

TODO: filled from the Engines section of HANDOFF.md.

## Data credits

TODO: every source with its license line, matching the provenance sidecars.

## Privacy

Porch Light uses only public, facility-level and aggregate data. It holds no personal health records.

## License

AGPL-3.0. See LICENSE and NOTICE. Pre-existing components are listed in DECLARED_PREEXISTING.md.
