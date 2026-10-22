"use client";

import { useEffect, useRef } from "react";
import { formatDate } from "@/lib/operator";
import type { Facility, Provenance, Snapshot } from "@/lib/types";

const termLabels: Record<string, string> = {
  type_weight: "Facility type", svi_pct: "National tract SVI", empower_density_pct: "ZIP DME ratio percentile",
  cms_risk: "CMS rating risk", plan_flag: "Archived plan mention",
};
const safeSourceUrl = (url: string): string | undefined => {
  try { const parsed = new URL(url); return ["http:", "https:"].includes(parsed.protocol) ? url : undefined; } catch { return undefined; }
};

export const EvidenceDrawer = ({ row, snapshot, provenance, open, onClose }: {
  row: Facility; snapshot: Snapshot; provenance: Provenance; open: boolean; onClose: () => void;
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  let geography: Record<string, unknown> = {};
  try { geography = JSON.parse(row.evidence.geography) as Record<string, unknown>; } catch { geography = {}; }
  const explanation = row.evidence.model_explanation;
  const modelRecord = explanation && typeof explanation === "object" ? explanation as Record<string, unknown> : null;
  const modelText = typeof explanation === "string" ? explanation :
    modelRecord && typeof modelRecord.text === "string" ? modelRecord.text : null;
  return (
    <dialog ref={ref} className="evidence-drawer" aria-labelledby="evidence-title"
      onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === ref.current) onClose(); }}>
      <div className="drawer-content">
        <header className="drawer-header"><span className="eyebrow">Rank {String(row.rank).padStart(2, "0")} / evidence record</span><button onClick={onClose} aria-label="Close evidence">Close <span aria-hidden="true">×</span></button></header>
        <h2 id="evidence-title">The reason for this rank.</h2>
        <p className="drawer-facility">{row.name}</p>
        <p className="reason">{row.computed_reason}</p>
        <section>
          <h3>Deterministic, not clinical</h3>
          <p className="fineprint">Prototype score on a 0 to 1 scale. No clinical validation. Contact outcomes never change this rank. Tie-break: {row.score.tie_break}.</p>
          <div className="table-scroll">
            <table className="terms-table"><caption className="sr-only">Actual weighted scoring terms</caption>
              <thead><tr><th>Term</th><th>Input</th><th>Weight</th><th>Contribution</th></tr></thead>
              <tbody>{row.score.terms.map(term => <tr key={term.name}><th scope="row">{termLabels[term.name] ?? term.name}</th><td title={String(term.input)}>{term.input.toFixed(6)}</td><td>{term.weight.toFixed(2)}</td><td title={String(term.weighted)}>{term.weighted.toFixed(6)}</td></tr>)}</tbody>
              <tfoot><tr><th colSpan={3}>Total · rank {row.rank}</th><td title={String(row.score.total)}>{row.score.total.toFixed(6)}</td></tr></tfoot>
            </table>
          </div>
          <p className="fineprint">Policy: <code>{row.score.formula_version}</code></p>
          <details><summary>Policy mapping &amp; limits</summary><p>{snapshot.policy.empower_density_pct}</p><p>CMS risk: {snapshot.policy.cms_risk}</p><p>{snapshot.policy.plan_flag}</p><p>Plan year: {snapshot.policy.plan_year}. Current applicability not verified.</p><code>{snapshot.policy.plan_artifact}</code><p className="fineprint">Plan SHA256</p><code>{snapshot.policy.plan_sha256}</code></details>
        </section>
        <section>
          <h3>Model explanation</h3>
          {explanation == null ? <p className="muted">No model explanation in this row. The reason above is computed from the source terms, not a Nemotron reply.</p> :
            <><p className="eyebrow model-draft">Draft / operator review required</p><p className="fineprint">Actual stored model explanation. Review against source terms; it does not set the rank.</p>
              {modelText ? <p className="model-reply">{modelText}</p> : <pre className="model-reply">{JSON.stringify(explanation, null, 2)}</pre>}
              {modelRecord && <dl className="provenance-list">
                {["model_id", "mode", "trace_id"].map(key => typeof modelRecord[key] === "string" ?
                  <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd><code>{modelRecord[key]}</code></dd></div> : null)}
              </dl>}
            </>}
          {explanation != null && <details><summary>Model execution provenance</summary><pre>{JSON.stringify(snapshot.model_executions, null, 2)}</pre></details>}
        </section>
        <section>
          <h3>Source records</h3>
          {row.evidence.sources.map(source => <div key={source.url} className="source-record"><a href={safeSourceUrl(source.url)} target="_blank" rel="noreferrer">{source.name} <span aria-hidden="true">↗</span></a><p className="fineprint">{source.license}</p><code>{source.url}</code></div>)}
          {row.evidence.data_as_of.map(source => <p key={source.source} className="fineprint">{source.source} fetched {formatDate(source.fetched_at)}. Source stale flag: {source.stale ? "stale" : "not flagged"}; this is not a current-conditions guarantee.</p>)}
          <dl className="provenance-list">
            <dt>Source artifact</dt><dd><code>{row.evidence.source_artifact_path}</code></dd>
            <dt>Artifact SHA256</dt><dd><code>{row.evidence.source_sha256}</code></dd>
            <dt>SVI artifact</dt><dd><code>{row.evidence.svi_artifact_path}</code></dd>
            <dt>Geography artifact</dt><dd><code>{row.evidence.geography_artifact_path}</code></dd>
            <dt>Location method</dt><dd>{String(geography.coordinate_source ?? "Not provided")}. Address-match quality: {String(geography.address_match_quality ?? "not provided")}. Operator review required.</dd>
            <dt>Coordinates</dt><dd>{row.lat ?? "unknown"}, {row.lon ?? "unknown"}</dd>
          </dl>
          <ul className="dq-list">{row.evidence.dq_results.map(result => <li key={result.rule}><span>{result.passed ? "Pass" : "Unverified"}</span><code>{result.rule}</code></li>)}</ul>
        </section>
        <section className="integration-state">
          <span className="eyebrow">Zetaris integration pending</span>
          <h3>Development PostGIS read.</h3>
          <p>No completed Zetaris integration or Zetaris query reference is claimed. SQL receipt is a direct development database read.</p>
          <dl className="provenance-list">
            <dt>Executed</dt><dd>{formatDate(snapshot.data_access.executed_at)}</dd>
            <dt>Transaction</dt><dd>{snapshot.data_access.transaction_id}</dd>
            <dt>Statement SHA256</dt><dd><code>{snapshot.data_access.statement_sha256}</code></dd>
            <dt>Source snapshot SHA256</dt><dd><code>{snapshot.source_snapshot_hash}</code></dd>
            <dt>Ranked JSON SHA256 · verified on read</dt><dd><code>{provenance.sha256}</code></dd>
            <dt>Sidecar source</dt><dd><code>{provenance.source_url}</code></dd>
            <dt>Sidecar fetched</dt><dd>{formatDate(provenance.fetched_at_utc)}</dd>
            <dt>Derivation</dt><dd>{provenance.license}</dd>
            <dt>Recorded generation command</dt><dd><code>{provenance.fetch_command}</code></dd>
          </dl>
        </section>
        <button className="full-width" onClick={onClose}>Return to call sheet</button>
      </div>
    </dialog>
  );
};
