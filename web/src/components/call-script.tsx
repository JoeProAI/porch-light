"use client";

import { useState } from "react";

type Reply = {
  status: string; message?: string; error?: string;
  draft?: { text: string; questions: string[]; trace_id: string; model_id: string; grounding: { passed: boolean } };
  attempts?: {
    event_id: string; status: string; validation_error?: string; response_id?: string; retry_of?: string;
    reported_model?: string;
    meterless_receipt?: { receipt_id: string; actual_usd: number; winning_route: { provider: string } };
  }[];
};

export const CallScript = ({ ccn, sourceRunId }: { ccn: string; sourceRunId?: string }) => {
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/national", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "call_script", ccn, ...(sourceRunId ? { run: sourceRunId } : {}) }),
      });
      const value = await response.json() as Reply;
      if (!response.ok) throw new Error(value.error ?? "The verified call-script service is unavailable.");
      if (!["passed", "failed", "not_attempted_budget"].includes(value.status)) {
        throw new Error("The response has no verified draft outcome. No substitute script is shown.");
      }
      if (value.status === "passed" && (!value.draft?.grounding.passed ||
        !value.draft.model_id.toLowerCase().includes("nemotron") || !value.draft.trace_id)) {
        throw new Error("The response has no grounded Nemotron trace. No substitute script is shown.");
      }
      setReply(value);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The call-script request failed."); }
    finally { setBusy(false); }
  };
  return <section className="call-script" aria-label="Grounded live call script">
    <button className="evidence-trigger" onClick={() => void generate()} disabled={busy || !!reply}>
      {busy ? "Checking source facts with Nemotron..." : reply ? "Call-script result retained" : "Generate live Nemotron call script"}
    </button>
    <p className="fineprint">A bounded source-grounded request through Meterless, with at most one retry. No call is placed. Verify the contact and conditions; don't request patient information.</p>
    {error && <p className="storage-warning" role="alert">{error}</p>}
    {reply && ["failed", "not_attempted_budget"].includes(reply.status) && <p className="storage-warning" role="alert">{reply.message}</p>}
    {reply?.status === "passed" && reply.draft && <div aria-live="polite">
      <p className="eyebrow">Grounding passed / operator review required</p>
      <p>{reply.draft.text}</p>
      <ol aria-label="Source-grounded verification questions">{reply.draft.questions.map(question => <li key={question}>{question}</li>)}</ol>
      <p className="fineprint">Nemotron selects and orders exact source clauses and approved verification questions. This isn't clinical validation.</p>
      <details><summary>Actual model identity and trace</summary><code>{reply.draft.model_id}</code><p><code>{reply.draft.trace_id}</code></p></details>
    </div>}
    {!!reply?.attempts?.length && <details>
      <summary>Retained request attempts ({reply.attempts.length})</summary>
      <p className="fineprint">A retry doesn't erase the original failure. Provider text that fails grounding isn't displayed as a script.</p>
      <ol aria-label="Retained Nemotron request attempts">{reply.attempts.map((attempt, index) => <li key={attempt.event_id}>
        <p>Attempt {index + 1}: {attempt.status}</p>
        {attempt.validation_error && <p className="storage-warning">Failure reason: {attempt.validation_error}</p>}
        {attempt.status !== "grounding_passed" && !attempt.validation_error && <p>Failure detail wasn't recorded. No reason is inferred.</p>}
        <p className="fineprint">Event <code>{attempt.event_id}</code></p>
        {attempt.response_id && <p className="fineprint">Response <code>{attempt.response_id}</code></p>}
        {attempt.retry_of && <p className="fineprint">Sole retry of <code>{attempt.retry_of}</code></p>}
        {attempt.reported_model && <p className="fineprint">Reported model <code>{attempt.reported_model}</code></p>}
        {attempt.meterless_receipt && <p className="fineprint">Meterless receipt <code>{attempt.meterless_receipt.receipt_id}</code>.
          Provider {attempt.meterless_receipt.winning_route.provider}. Actual cost ${attempt.meterless_receipt.actual_usd}.</p>}
      </li>)}</ol>
    </details>}
  </section>;
};
