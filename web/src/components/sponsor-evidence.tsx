import Link from "next/link";
import type { Snapshot } from "@/lib/types";

export const SponsorEvidence = ({ snapshot }: { snapshot: Snapshot }) => {
  const audited = snapshot.data_access.data_access_mode === "zetaris";
  const drafts = snapshot.facilities.filter(row => row.evidence.model_explanation != null);
  const chain = snapshot.data_access.chain_steps;
  const explanation = drafts[0]?.evidence.model_explanation;
  const identity = explanation && typeof explanation === "object" ?
    explanation as Record<string, unknown> : null;
  return (
    <section className="sponsor-section" aria-labelledby="sponsor-title">
      <div className="sponsor-intro"><p className="eyebrow">Sponsor technology / Inspect the actual work</p><h2 id="sponsor-title">Built with Zetaris,<br />Meterless and Nemotron.</h2><p>One model family. One model gateway. Audited data access. The fixed formula, not an AI response, determines the order.</p></div>
      <div className="sponsor-ledger">
        <article><span className="sponsor-role">01 / Audited data access</span><h3>Zetaris</h3><p>{chain ? "Separate CMS, Census, SVI and emPOWER source relations are joined in Zetaris SQL. Each step has its own audit ID; match rates come from SQL counts. All relations currently share one physical read-only PostGIS datasource. Spatial checks stay in PostGIS." : "Licensed JDBC access reads a pre-joined source bundle through one read-only PostGIS connection. Cross-source joins aren't demonstrated in this snapshot."}</p><span className="proof-status">{chain ? `${chain.length} distinct audited statements` : audited ? `Actual shared bundle query: ${snapshot.data_access.zetaris_query_ids.join(", ")}` : "Development mode. No completed vendor audit claim."}</span><Link href="/operate?evidence=first">Inspect row evidence</Link></article>
        <article><span className="sponsor-role">02 / Model gateway</span><h3>Meterless Runtime</h3><p>The application uses the Meterless Runtime endpoint for Nemotron requests. Actual stored responses include model and response identifiers. No substitute explanation is fabricated on provider failure.</p><span className="proof-status">{snapshot.model_executions.length} stored model execution in this snapshot</span><Link href="/operate?evidence=first">Inspect the stored model trace</Link></article>
        <article><span className="sponsor-role">03 / Grounded explanation</span><h3>NVIDIA Nemotron</h3><p>One stored model call produced drafts for ranks 1 to 3. The audited snapshot reused them after matching source and policy inputs. Other rows have computed reasons, not model drafts. Local GPU inference isn't verified.</p><span className="proof-status">{drafts.length} actual stored drafts / {snapshot.facilities.length} ranked facilities</span>{identity && typeof identity.model_id === "string" && <code>{identity.model_id}</code>}<Link href="/operate?evidence=first">Read a genuine draft</Link></article>
        <article><span className="sponsor-role">04 / Development requirement</span><h3>Cursor</h3><p>This web implementation was authored by Devin. Cursor build evidence isn't attached to this checkout. Rules on a separate contract branch don't establish a completed Cursor build.</p><span className="proof-status">Required build evidence remains missing.</span></article>
      </div>
      <p className="sponsor-limit">These are implemented roles, not claims that every sponsor service is integrated. Additional AI capabilities, clinical validation and measured operator benefit aren't claimed.</p>
    </section>
  );
};
