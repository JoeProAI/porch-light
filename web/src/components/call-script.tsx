"use client";

import { useState } from "react";

type Reply = {
  status: string; message?: string; error?: string;
  draft?: { text: string; questions: string[]; trace_id: string; model_id: string; grounding: { passed: boolean } };
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
      <ol>{reply.draft.questions.map(question => <li key={question}>{question}</li>)}</ol>
      <p className="fineprint">Nemotron selects and orders exact source clauses and approved verification questions. This isn't clinical validation.</p>
      <details><summary>Actual model identity and trace</summary><code>{reply.draft.model_id}</code><p><code>{reply.draft.trace_id}</code></p></details>
    </div>}
  </section>;
};
