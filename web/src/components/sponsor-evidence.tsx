import Link from "next/link";
import type { Snapshot } from "@/lib/types";

export const SponsorEvidence = ({ snapshot }: { snapshot: Snapshot }) => {
  const audited = snapshot.data_access.data_access_mode === "zetaris";
  const drafts = snapshot.facilities.filter(row => row.evidence.model_explanation != null);
  const explanation = drafts[0]?.evidence.model_explanation;
  const identity = explanation && typeof explanation === "object" ?
    explanation as Record<string, unknown> : null;
  return (
    <section className="sponsor-section" aria-labelledby="sponsor-title">
      <div className="sponsor-intro"><p className="eyebrow">Sponsor technology / Inspect the actual work</p><h2 id="sponsor-title">Built with Zetaris,<br />Meterless and Nemotron.</h2><p>One model family. One model gateway. Audited data access. The fixed formula, not an AI response, determines the order.</p></div>
      <div className="sponsor-ledger">
        <article><span className="sponsor-role">01 / Data federation</span><h3>Zetaris</h3><p>Licensed JDBC access reads the source bundle through a read-only PostGIS connection. The vendor audit record travels with each ranked row.</p><span className="proof-status">{audited ? `Actual source query: ${snapshot.data_access.zetaris_query_ids.join(", ")}` : "Development mode. No completed vendor audit claim."}</span><Link href="/operate?evidence=first">Inspect row evidence</Link></article>
        <article><span className="sponsor-role">02 / Model gateway</span><h3>Meterless Runtime</h3><p>The application uses the Meterless Runtime endpoint for Nemotron requests. Actual stored responses include model and response identifiers. No substitute explanation is fabricated on provider failure.</p><span className="proof-status">{snapshot.model_executions.length} stored model execution in this snapshot</span><Link href="/operate?evidence=first">Inspect the stored model trace</Link></article>
        <article><span className="sponsor-role">03 / Grounded explanation</span><h3>NVIDIA Nemotron</h3><p>Writes draft reasons from sourced facts for operator review. It doesn't rank facilities or establish clinical urgency.</p><span className="proof-status">{drafts.length} actual stored drafts / {snapshot.facilities.length} ranked facilities</span>{identity && typeof identity.model_id === "string" && <code>{identity.model_id}</code>}<Link href="/operate?evidence=first">Read a genuine draft</Link></article>
        <article><span className="sponsor-role">04 / Development guardrails</span><h3>Cursor rules</h3><p>The shared .cursor/rules constrain agent ownership, source evidence, secrets and sponsor routing. This web implementation was authored by Devin, not a claimed Cursor agent run.</p><span className="proof-status">Rules are used. No fabricated authorship or credits.</span></article>
      </div>
      <p className="sponsor-limit">These are implemented roles, not claims that every sponsor service is integrated. Additional AI capabilities, clinical validation and measured operator benefit aren't claimed.</p>
    </section>
  );
};
