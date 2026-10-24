# Nemotron offline readiness receipt, October 23, 2026

Status: BLOCKED AT PREFLIGHT. No offline generation was executed. Tokens/sec is unmeasured.

Porch Light, registry entity `porch-light`. Probe observations include `2026-10-24T03:31:37Z`, which is October 23 at 11:31:37 PM EDT. Work stayed on `hackathon/operator-hardening-engines`. The requested delivery copy is `D:\Projects\AI_Projects\_claude\nemotron-offline-proof-2026-10-23.md`.

## Finding

Nightshift is running, but the current installation has no registered local model lanes and no Nemotron weights in its configured model directory. It cannot supply the requested local Nemotron proof in that state. The sweep's working NVIDIA provider routes are hosted.

The host network stayed connected to preserve the active model sweep. No firewall, adapter, provider, app policy, fleet, model download or runtime setting was changed. This is a readiness failure, not evidence of a generation attempted with the network unplugged. It establishes no offline throughput or cold offline application claim.

## Live observations

| Probe | Observed result |
|---|---|
| `GET http://127.0.0.1:8088/health` | HTTP 200, `{"status":"ok","engine":"meterless"}` |
| `GET /admin/status` on the configured Windows control pipe | HTTP 200, Nightshift daemon `1.2.1`, `lanes: []`, active fleet `null` |
| JSON RPC `placement.lanes` on the configured core pipe | `{"lanes":[]}` |
| Configured model directory | `C:\Users\Joseph\AppData\Local\ai.meterless.runtime\models` |
| Weight inventory in that directory | GPT OSS 20B, Llama 3.2 1B, Nomic Embed, Whisper, OuteTTS and WavTokenizer. No Nemotron weight file. |
| Additional checked caches | No Nemotron weights under `%USERPROFILE%\.cache\huggingface\hub` or `%USERPROFILE%\.lmstudio\models` |
| Ollama `GET http://127.0.0.1:11434/api/tags` | Gemma 3 4B, Nomic Embed, two Qwen 27B entries and Qwen embedding. No Nemotron. |
| Ollama `GET /api/ps` | `{"models":[]}` |
| LM Studio `http://127.0.0.1:1234/v1/models` | Connection refused, Windows error 10061 |
| NVIDIA GPU query | NVIDIA GeForce RTX 5080 Laptop GPU, 16,303 MiB total, 5,020 MiB used, 0 percent utilization at observation |
| Persisted Nightshift policy | `local-runtime/nemotron-3.5-lightning-30b-a3b` and its `-mxfp4` variant are disabled. The older local Nemotron 3 Nano entry is also disabled. |
| `GET http://127.0.0.1:8088/v1/models` | HTTP 401 without a bearer token |
| Read-only local route preview | `POST /v1/meterless/route/preview`, body below, HTTP 401 in 0.0044228 seconds. This is an authentication refusal, not a routing verdict or generation latency. |
| Sweep process | Python PID `52756` verified as `engines.national_sweep` through a command-line predicate. No command line or secret value was printed. |

Route preview body, which submits no generation:

```json
{
  "prompt": "Offline Nemotron readiness probe. No generation.",
  "app": "porch-light-offline-proof",
  "mode": "local",
  "width": 1
}
```

The control and core pipes were read with normal user access after the sandbox denied named-pipe access. Only status and placement were requested. No key retrieval operation was used.

## Lightning and Super VL are different models

The hosted Lightning model ID is **`nvidia/nemotron-3.5-lightning-30b-a3b`**. Recent existing sweep receipts already identify that model, provider `nvidia`, route kind `cloud`, and `actual_usd: 0`. Examples observed during this probe:

| Existing request ID | Existing receipt ID |
|---|---|
| `chatcmpl-fc08fd49-8420-45fe-bf17-a2d6880fbb67` | `rcpt_req_40etqxgd` |
| `chatcmpl-90505bf9-ee80-4b6f-8d72-6008595330eb` | `rcpt_req_tnrmwfc4` |
| `chatcmpl-85504512-fa27-4892-bee9-421fbab1e80d` | `rcpt_req_rsua5bk5` |

These pre-existing receipts came from the active application, not this proof attempt. They are not offline receipts or new benchmark samples.

The retained Manatee artifact `engines/snapshots/manatee-zetaris-chain.json` records **`nvidia/nemotron-3.5-super-vl-120b-a12b`**, requested as `meterless/deep`. That is the existing Super VL evidence. A localhost proxy address does not establish local inference. Neither hosted model ID proves downloaded weights.

## Exact blockers and smallest next step

1. **Missing local Nemotron weights and lane.** Stage one compatible local Nemotron GGUF before an offline session, then register and validate a dedicated proof lane when it can be isolated from the sweep. The project handoff names this smaller candidate: `bartowski/nvidia_NVIDIA-Nemotron-Nano-9B-v2-GGUF`, revision `b2daccafb3d123ea94653720a0db1f5db9c698ff`, file `nvidia_NVIDIA-Nemotron-Nano-9B-v2-Q4_K_M.gguf`, stated size 6,525,629,280 bytes. This is a handoff candidate only. It was not downloaded, independently verified, loaded or benchmarked here. Runtime compatibility remains unproved. The handoff's larger Lightning weights are 18.9 GB and 23.2 GB; GPU-only residency exceeds this laptop's VRAM. CPU offload was not tested.
2. **No API token in this process's environment.** `METERLESS_TOKEN` was absent. House rules restrict secret reads to environment variables, so the existing private token file was not read. Supply the existing proxy token through the approved environment mechanism for an authenticated preview and generation. Do not print it or add another provider key.

The smallest immediate action is to stage the pinned candidate weights. After a compatible local lane is ready, use a separate proof app with a local-only privacy floor and a Nemotron lane allowlist. Verify that the read-only preview selects that local lane before submitting anything. The current `porch-light` app is bound to `auto`; it should not be repurposed for the proof. Installed routing code permits an app binding to override a requested mode. The sweep's receipt guard also requires provider `nvidia`, so introducing local routing into its app could stop further sweep calls.

For the actual benchmark, deny external network access for the proof runtime while preserving loopback, or disconnect the host after the sweep is idle. Confirm the restriction is active. Submit exactly one request with `max_tokens: 128`, thinking disabled, no tools, no retries, no race and no paid fallback. Retain the actual reported model, output, completion-token count, elapsed monotonic time, local winning-route receipt and effective privacy mode. Report `completion_tokens / elapsed_seconds` as end-to-end output tok/s. If the local backend supplies a separate decode duration, report decode tok/s separately with its denominator. SSE chunk count and word count are not token counts. Missing token usage means throughput stays unmeasured.

## Proof receipt

```json
{
  "status": "blocked_preflight",
  "nightshift_version": "1.2.1",
  "local_lanes": [],
  "nemotron_weights_found_in_checked_model_roots": false,
  "meterless_token_in_environment": false,
  "network_disconnected": false,
  "offline_generation_executed": false,
  "generation_attempts_by_this_probe": 0,
  "completion_tokens": null,
  "generation_elapsed_seconds": null,
  "tokens_per_second": null,
  "new_inference_spend_usd": 0,
  "openrouter_enabled_by_this_probe": false,
  "sweep_pid": 52756
}
```

## Verification and limits

Read `D:\Projects\AI_Projects\_claude\sponsor-bonus-audit-2026-10-23.md`, project handoff, runtime configuration and installed routing code. Model roots were enumerated by filename and size. Secret files were not opened. Existing receipt fields were allowlisted before printing.

Commands and outcomes:

* `python -m unittest engines.test_grounded_drafts engines.test_sweep_report -v`: 9 tests passed in 0.087 seconds with normal temporary-directory access. The initial sandbox run had 6 passes and 3 temporary-directory permission errors. A workspace-temp retry stalled and only that test session was interrupted before the successful normal-access rerun. No product code was changed to make tests pass.
* `python -m compileall -q engines data`: passed.
* `git diff --check`: passed for tracked files. Dedicated validation of this new report passed: both embedded JSON blocks parse, throughput and token fields remain null, zero probe generation attempts are recorded, and whitespace and prohibited dash checks pass.
* No configured project linter or package build task was found. Compilation is not a substitute for a build or offline generation.

Live database integration tests were not run for this report-only task. No model request, model download, purchase, provider enablement, commit, PR, push, merge or deployment occurred. Visual proof is not applicable. The only intended file changes are this report and its requested delivery copy.

Final sweep check at `2026-10-24T03:33:33Z`: PID `52756` still existed, the shared ledger had advanced from 551 observed attempts to 562, and `ROUTE_STOP.json` was absent. This probe added zero generation attempts. The existing sweep continued during inspection.
