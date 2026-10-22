"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { contactLabels, type Contacts, type ContactStatus, type Provenance, type Snapshot } from "@/lib/types";
import { createCsv, formatDate, formatPhone, parseContacts } from "@/lib/operator";
import { CoverageMap } from "./coverage-map";
import { EvidenceDrawer } from "./evidence-drawer";

export const Operator = ({ snapshot, provenance }: { snapshot: Snapshot; provenance: Provenance }) => {
  const [selectedId, setSelectedId] = useState(snapshot.facilities[0]?.id ?? "");
  const [contacts, setContacts] = useState<Contacts>({});
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [notice, setNotice] = useState("");
  const [copying, setCopying] = useState(false);
  const [draftStatus, setDraftStatus] = useState<ContactStatus>("reached");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const [clock, setClock] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const isZetaris = snapshot.data_access.data_access_mode === "zetaris";
  const storageKey = `porch-light:contacts:v1:${snapshot.source_snapshot_hash}`;
  const row = snapshot.facilities.find(item => item.id === selectedId);
  const recorded = snapshot.facilities.filter(item => contacts[item.id] && contacts[item.id].status !== "uncontacted").length;

  useEffect(() => {
    try {
      const stored = parseContacts(localStorage.getItem(storageKey), snapshot.facilities);
      setContacts(stored);
      setSelectedId(snapshot.facilities.find(item => !stored[item.id] || stored[item.id].status === "uncontacted")?.id ?? snapshot.facilities[0]?.id ?? "");
    }
    catch { setStorageError("Local contact records couldn't be read. No stored statuses have been assumed; new changes may only last for this session."); }
    setReady(true);
    const updateConnection = () => setOffline(!navigator.onLine);
    updateConnection();
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => { window.clearInterval(timer); window.removeEventListener("online", updateConnection); window.removeEventListener("offline", updateConnection); };
  }, [snapshot.facilities, storageKey]);

  const selectRow = (id: string) => {
    setSelectedId(id);
    setDraftStatus("reached");
    setNotice("");
    if (window.matchMedia("(max-width: 767px)").matches) {
      window.requestAnimationFrame(() => {
        const heading = document.getElementById("next-call-title");
        heading?.focus({ preventScroll: true });
        heading?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
      });
    }
  };
  const recordContact = () => {
    if (!row || !ready) return;
    const now = new Date().toISOString();
    const updated: Contacts = { ...contacts, [row.id]: { status: draftStatus, updatedAt: now } };
    setContacts(updated);
    let saved = true;
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); setStorageError(""); }
    catch { saved = false; setStorageError("Browser storage is unavailable. Changes are session-only. Export CSV before leaving."); }
    const next = snapshot.facilities.find(item => item.id !== row.id && (!updated[item.id] || updated[item.id].status === "uncontacted"));
    if (draftStatus !== "uncontacted" && next) { setSelectedId(next.id); setDraftStatus("reached"); }
    setNotice(`${contactLabels[draftStatus]} recorded for ${row.name}${saved ? " on this device" : " for this session only"}.${draftStatus !== "uncontacted" && next ? ` Next uncontacted: rank ${next.rank}, ${next.name}.` : " Ranking unchanged."}`);
  };
  const copyPhone = async () => {
    if (!row?.phone.value) return;
    setCopying(true);
    try { await navigator.clipboard.writeText(row.phone.value); setNotice(`Copied phone for ${row.name}. No call was placed.`); }
    catch { setNotice("Clipboard unavailable. Select and copy the phone number manually."); }
    finally { setCopying(false); }
  };
  const exportCsv = () => {
    try {
      const url = URL.createObjectURL(new Blob([createCsv(snapshot, contacts)], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `porch-light-manatee-${snapshot.generated_at.slice(0, 10)}.csv`;
      anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`Exported ${snapshot.facilities.length} ranked rows with the current manual contact records.`);
    } catch { setNotice("CSV export failed. Use Print sheet to save the current rows instead."); }
  };
  const ageMinutes = clock === null ? null : Math.max(0, Math.floor((clock - Date.parse(snapshot.generated_at)) / 60000));
  const age = ageMinutes === null ? "Calculating snapshot age…" : ageMinutes < 60 ? `${ageMinutes}m old` :
    ageMinutes < 1440 ? `${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m old` : `${Math.floor(ageMinutes / 1440)}d old`;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#call-ledger">Skip to call ledger</a>
      <header className="masthead">
        <a href="/" className="wordmark" aria-label="Porch Light call sheet">Porch Light<span className="wordmark-period">.</span></a>
        <span className="masthead-descriptor">A call-first field ledger</span>
        <span className="edition">MANATEE / FL <span className="edition-number">01</span></span>
      </header>
      <main>
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-heading">
            <div className="eyebrow"><span className="status-line" />Retrospective · Hurricane Milton / 2024</div>
            <h1 id="page-title">Know who to{" "}<br />call <em>first.</em></h1>
            <p className="intro-description">Manatee County, Florida. A source-backed order of outreach, with the reasoning left in view.</p>
          </div>
          <div className="edition-note">
            <span className="eyebrow">Operator edition / development snapshot</span>
            <p>Not a live warning.<br />Not current facility conditions.</p>
            <div className="snapshot-date"><span className="muted">Snapshot generated</span><time dateTime={snapshot.generated_at}>{formatDate(snapshot.generated_at)}</time><span className="age">{age}</span></div>
            <details className="limits"><summary>Source limits &amp; integration state</summary><ul>{snapshot.limits.map(limit => <li key={limit}>{limit}</li>)}</ul><p>Current published NWS shapes are used; equivalence to the 2024 boundary is unverified. ZIP DME context is not a facility patient count.</p></details>
          </div>
        </section>
        <div className="source-strip"><span><i className="source-dot" /> {isZetaris ? "Zetaris JDBC" : "Development PostGIS"} <span className="muted">/ {isZetaris ? "audit verified" : "Zetaris pending"}</span></span><span>Fixed policy · not clinically validated</span><span>{offline ? "Offline · loaded snapshot only" : "Local snapshot · no live refresh"}</span></div>
        <div className="workspace-heading">
          <div><span className="eyebrow">The call sheet</span><h2>Priority, with a paper trail.</h2></div>
          <div className="export-actions"><button onClick={exportCsv} disabled={!ready || !snapshot.facilities.length}>Export CSV <span aria-hidden="true">↓</span></button><button onClick={() => window.print()} disabled={!snapshot.facilities.length}>Print sheet <span aria-hidden="true">↗</span></button></div>
        </div>
        <div className="sheet-meta"><p><strong>{snapshot.counts.ranked_rows}</strong> ranked <span>/</span> {snapshot.counts.refused_rows} refused <span>/</span> {snapshot.counts.source_rows} source records</p><p>{ready ? `${recorded} / ${snapshot.facilities.length} contact outcomes recorded` : "Loading local contact records…"}</p></div>
        {storageError && <p className="storage-warning" role="alert">{storageError}</p>}
        <div className="workspace">
          <section id="call-ledger" className="ledger" aria-label="Ordered facility call ledger" tabIndex={-1}>
            <div className="ledger-columns" aria-hidden="true"><span>Rank</span><span>Facility / source phone</span><span>Score</span></div>
            {!snapshot.facilities.length ? <div className="empty-state"><h3>No ranked facilities.</h3><p>Nothing is eligible in this snapshot. Review source refusals below; no outreach order has been invented.</p></div> :
              <ol className="facility-list">
                {snapshot.facilities.map(item => {
                  const active = item.id === selectedId;
                  const contact = contacts[item.id];
                  return <li key={item.id} data-selected={active}>
                    <button className="facility-row" onClick={() => selectRow(item.id)} aria-pressed={active}
                      aria-label={`Rank ${item.rank}: ${item.name}, phone ${formatPhone(item.phone.value)}, score ${item.score.total.toFixed(4)}, ${contactLabels[contact?.status ?? "uncontacted"]}`}>
                      <span className="rank mono">{String(item.rank).padStart(2, "0")}</span>
                      <span className="facility-info"><span className="facility-type">{item.type === "dialysis" ? "Dialysis" : "Nursing home"} <span>· CCN {item.ccn}</span></span><span className="facility-name">{item.name}</span><span className="facility-phone">{formatPhone(item.phone.value)}</span><span className={`contact-state ${contact && contact.status !== "uncontacted" ? "recorded" : ""}`}>{!ready ? "Loading contact status…" : contactLabels[contact?.status ?? "uncontacted"]}{active && <span className="selection-label"> · Selected call</span>}</span>{contact && <time className="contact-time" dateTime={contact.updatedAt}>{formatDate(contact.updatedAt)}</time>}</span>
                      <span className="score mono" title={String(item.score.total)}>{item.score.total.toFixed(4)}<span className="score-bar"><i style={{ width: `${item.score.total * 100}%` }} /></span></span>
                    </button>
                  </li>;
                })}
              </ol>}
            <div className="ledger-footnote">Descending fixed score, 0–1. Prototype weights, not a prediction of harm. Manual outcomes do not reorder the list.</div>
          </section>
          <aside className="operator-rail" aria-label="Selected call and source map">
            {row && <section className="next-call" aria-labelledby="next-call-title">
              <div className="focus-header"><span className="eyebrow">Selected / next-call focus</span><span className="mono">{String(row.rank).padStart(2, "0")} / {snapshot.facilities.length}</span></div>
              <motion.div key={row.id} initial={ready && !reducedMotion ? { opacity: 0, y: 5 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <h2 id="next-call-title" tabIndex={-1}>{row.name}</h2>
                <p className="call-address">{row.address} · {row.zip}</p>
                <div className="phone-line"><span className="phone-number">{formatPhone(row.phone.value)}</span><button onClick={copyPhone} disabled={!row.phone.value || copying} aria-label={`Copy phone for ${row.name}`}>{copying ? "Copying…" : "Copy"}</button></div>
                <p className="reason">{row.computed_reason}</p>
              </motion.div>
              <button className="evidence-trigger" onClick={() => setEvidenceOpen(true)}>Why this rank / inspect evidence <span aria-hidden="true">↗</span></button>
              <form className="contact-form" onSubmit={event => { event.preventDefault(); recordContact(); }}>
                <label htmlFor="contact-status">Manually record an outcome</label>
                <p className="fineprint">This device only. No calls or messages are sent. No patient information.</p>
                <select id="contact-status" value={draftStatus} onChange={event => setDraftStatus(event.target.value as ContactStatus)} disabled={!ready}>
                  {Object.entries(contactLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button className="primary-button" type="submit" disabled={!ready}>{ready ? "Record & next uncontacted" : "Loading local records…" }<span aria-hidden="true">→</span></button>
                <p className="fineprint">Recorded now: {ready ? contactLabels[contacts[row.id]?.status ?? "uncontacted"] : "Loading…"}{contacts[row.id] && ` · ${formatDate(contacts[row.id].updatedAt)}`}</p>
              </form>
            </section>}
            <p className={`action-notice ${notice ? "has-notice" : ""}`} role="status" aria-live="polite" aria-atomic="true">{notice}</p>
            <CoverageMap geometry={snapshot.warning_geometry} facilities={snapshot.facilities} selectedId={selectedId} onSelect={selectRow} />
          </aside>
        </div>
        <section className="refusals" aria-labelledby="refusals-title"><div><span className="eyebrow">Withheld, not forgotten</span><h2 id="refusals-title">{snapshot.refused.length} records refused.</h2><p>Missing or disqualifying evidence keeps these records out of the call order.</p></div><ul>{snapshot.refused.map(item => <li key={item.ccn}><span>{item.name}</span><code>CCN {item.ccn} / {item.reason}</code></li>)}</ul></section>
        <div className="print-limits"><h2>Snapshot limits</h2><ul>{snapshot.limits.map(limit => <li key={limit}>{limit}</li>)}</ul></div>
      </main>
      <footer className="site-footer">
        <span className="wordmark">Porch Light.</span>
        <div>
          <p>Public source records. Transparent priorities.<br />A retrospective prototype, not emergency or clinical guidance.</p>
          <details><summary>Technology and sponsor evidence</summary>
            <p>Meterless and NVIDIA Nemotron: {snapshot.model_executions.length > 0 ? "Actual stored model drafts are identified in the row evidence drawer." : "No completed model execution in this snapshot."}</p>
            <p>Zetaris: {isZetaris ? "This snapshot carries real query references confirmed against the vendor audit database." : "Integration and query IDs are pending. This screen uses a direct PostGIS development snapshot."}</p>
            <p>Cursor: required development evidence is pending. No completed usage claim is made.</p>
          </details>
        </div>
        <span className="mono">MANATEE / 12081<br />MILTON · 2024</span>
      </footer>
      {row && <EvidenceDrawer row={row} snapshot={snapshot} provenance={provenance} open={evidenceOpen} onClose={() => setEvidenceOpen(false)} />}
    </div>
  );
};
