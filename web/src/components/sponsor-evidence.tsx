import Link from "next/link";
import type { Snapshot } from "@/lib/types";

export const SponsorEvidence = ({ snapshot }: { snapshot: Snapshot }) => {
  const audited = snapshot.data_access.data_access_mode === "zetaris";
  const drafts = snapshot.facilities.filter(row => {
    const value = row.evidence.model_explanation;
    return typeof value === "string" || value !== null && typeof value === "object" &&
      typeof (value as Record<string, unknown>).text === "string";
  });
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
        <article><span className="sponsor-role">03 / Grounded explanation</span><h3>NVIDIA Nemotron</h3><p>New drafts use actual Nemotron selections of source-backed clauses and verification questions. Grounding results distinguish accepted drafts, retained failures and cap omissions. Legacy prose isn't marked as checked by the current validator. Local GPU inference isn't verified.</p><span className="proof-status">{drafts.length} actual stored texts / {snapshot.facilities.length} ranked facilities{snapshot.model_report && `; ${snapshot.model_report.accepted_facilities} grounded, ${snapshot.model_report.unresolved_facilities} unresolved`}</span>{identity && typeof identity.model_id === "string" && <code>{identity.model_id}</code>}<Link href="/operate?evidence=first">Inspect draft status and trace</Link></article>
        <article><span className="sponsor-role">04 / Development evidence</span><h3>Cursor</h3><p>Cursor's cloud agent authored the MapLibre Storm Watch map and shared controls in PR22, with build results and responsive screenshots. Devin integrates the audited national workflow and verifies live warning interaction locally.</p><span className="proof-status">Actual Cursor-authored code and cloud build evidence.</span><a href="https://github.com/JoeProAI/porch-light/pull/22" target="_blank" rel="noreferrer">Inspect Cursor PR22</a></article>
      </div>
      <p className="sponsor-limit">These are implemented roles, not claims that every sponsor service is integrated. Additional AI capabilities, clinical validation and measured operator benefit aren't claimed.</p>
    </section>
  );
};
