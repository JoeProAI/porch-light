"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { contactLabels, type Contacts, type ContactStatus, type Provenance, type Snapshot } from "@/lib/types";
import { createCsv, formatDateEt, formatFigure, formatPhone, parseContacts } from "@/lib/operator";
import { CoverageMap } from "./coverage-map";
import { EvidenceDrawer } from "./evidence-drawer";
import { CallScript } from "./call-script";
import { Masthead } from "./masthead";
import { WatchBezel } from "./watch-bezel";

const plainReason = (value: string) => value
  .replaceAll("National tract SVI", "Neighborhood vulnerability")
  .replaceAll("CMS stars", "Medicare star rating")
  .replaceAll("published ZIP DME", "medical-equipment orders in this ZIP")
  .replaceAll("ZIP context is not a facility patient count.", "ZIP totals are not a count of this facility's patients.");

export const Operator = ({ snapshot, provenance, initialEvidenceOpen = false, initialRank, sourceRunId }: {
  snapshot: Snapshot; provenance: Provenance; initialEvidenceOpen?: boolean; initialRank?: number; sourceRunId?: string;
}) => {
  const [selectedId, setSelectedId] = useState(snapshot.facilities[0]?.id ?? "");
  const [contacts, setContacts] = useState<Contacts>({});
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [notice, setNotice] = useState("");
  const [copying, setCopying] = useState(false);
  const [draftStatus, setDraftStatus] = useState<ContactStatus>("uncontacted");
  const [evidenceOpen, setEvidenceOpen] = useState(initialEvidenceOpen);
  const [offline, setOffline] = useState(false);
  const [clock, setClock] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const isZetaris = snapshot.data_access.data_access_mode === "zetaris";
  const national = snapshot.schema_version === "porch-light.national-run.v1";
  const storageKey = `porch-light:contacts:v1:${snapshot.source_snapshot_hash}${national ? ":" + (snapshot.selected_alert?.id ?? snapshot.county.fips) : ""}`;
  const row = snapshot.facilities.find(item => item.id === selectedId);
  const porch = [...snapshot.facilities].sort((a, b) => a.rank - b.rank)
    .find(item => !contacts[item.id] || contacts[item.id].status === "uncontacted");
  const recorded = snapshot.facilities.filter(item => contacts[item.id] && contacts[item.id].status !== "uncontacted").length;
  // Model polling replaces row objects, but shouldn't reset the operator's selected call.
  const facilityScope = snapshot.facilities.map(item => `${item.id}:${item.rank}`).join("|");

  useEffect(() => {
    try {
      const stored = parseContacts(localStorage.getItem(storageKey), snapshot.facilities);
      setContacts(stored);
      const ranked = snapshot.facilities.find(item => item.rank === initialRank);
      setSelectedId(ranked?.id ?? (initialEvidenceOpen ? snapshot.facilities[0]?.id ?? "" :
        snapshot.facilities.find(item => !stored[item.id] || stored[item.id].status === "uncontacted")?.id ?? snapshot.facilities[0]?.id ?? ""));
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
  }, [facilityScope, storageKey, initialEvidenceOpen, initialRank]);

  const selectRow = (id: string) => {
    setSelectedId(id);
    setDraftStatus(contacts[id]?.status ?? "uncontacted");
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
    if (draftStatus !== "uncontacted" && next) { setSelectedId(next.id); setDraftStatus("uncontacted"); }
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
      anchor.href = url; anchor.download = `porch-light-${snapshot.county.fips.replaceAll(",", "_")}-${snapshot.generated_at.slice(0, 10)}.csv`;
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
      <Masthead sourceHref={national ? "#source-map" : "#source-atlas"} ledgerHref="#call-ledger" edition={<>{national ? `${snapshot.county.name.toUpperCase()} / ${snapshot.county.state}` : `RETROSPECTIVE / ${snapshot.county.name.toUpperCase()}`} <span className="edition-number">01</span></>} />
      <main>
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-heading">
            <div className="eyebrow"><span className="status-line" />{national ? snapshot.selected_alert ? "Captured NWS alert / " + snapshot.selected_alert.event : "County source discovery / no warning asserted" : "Retrospective · Hurricane Milton / 2024"}</div>
            <h1 id="page-title">Who to call <em>first.</em></h1>
            <p className="intro-description">{national ? `Dialysis centers and nursing homes. ${snapshot.county.name}, ${snapshot.county.state}. Source gaps stay visible.` : "Dialysis centers and nursing homes in the Manatee warning area."}</p>
            {!national && <p className="fineprint"><a href="/nationwide">Pick any US county</a>. This demonstration stays Manatee County, Florida.</p>}
          </div>
          <div className={`intro-index${row && porch && row.id === porch.id ? " is-porch" : ""}`} aria-label="Selected call index">
            <span className="eyebrow">Selected call</span>
            <strong>{row ? String(row.rank).padStart(2, "0") : "00"}</strong>
            <span>Selected of {snapshot.facilities.length} ranked records</span>
          </div>
          <div className="edition-note">
            <span className="eyebrow">{national ? "Audited source run" : "Retrospective / source snapshot"}</span>
            <p>{national ? "Directory and area context. No verified facility operating conditions." : <>Not a live warning.<br />Not current facility conditions.</>}</p>
            <div className="snapshot-date"><span className="muted">Snapshot generated</span><time dateTime={snapshot.generated_at}>{formatDateEt(snapshot.generated_at)}</time><span className="age">{age}</span></div>
          </div>
        </section>
        <div className="source-strip"><span><i className="source-dot" /> {isZetaris ? "Audited source connection" : "Development database"} <span className="muted">/ {isZetaris ? "verified" : "audit pending"}</span></span><span>Fixed ranking · not clinically validated</span><span>{offline ? "Offline · saved snapshot only" : "Saved snapshot · no live refresh"}</span></div>
        <div className="workspace-heading">
          <div><span className="eyebrow">Care-facility call sheet</span><h2>Contact. Record. Next.</h2></div>
          <div className="export-actions"><button onClick={exportCsv} disabled={!ready || !snapshot.facilities.length}>Export CSV <span aria-hidden="true">↓</span></button><button onClick={() => window.print()} disabled={!snapshot.facilities.length}>Print sheet <span aria-hidden="true">↗</span></button></div>
        </div>
        <div className="sheet-meta"><p><strong>{snapshot.counts.ranked_rows}</strong> ranked <span>/</span> {snapshot.counts.refused_rows} refused <span>/</span> {snapshot.counts.source_rows} source records</p><p>{ready ? `${recorded} / ${snapshot.facilities.length} contact outcomes recorded` : "Loading local contact records…"}</p></div>
        {storageError && <p className="storage-warning" role="alert">{storageError}</p>}
        {snapshot.selected_alert && <p className="watch-error">Official alert captured {formatDateEt(snapshot.selected_alert.captured_at)}. Expires {formatDateEt(snapshot.selected_alert.expires)}. It may expire while processing. <a href={snapshot.selected_alert.id} target="_blank" rel="noreferrer">Use the current NWS record for instructions.</a></p>}
        <div className="workspace">
          <section id="call-ledger" className="ledger" aria-label="Ordered facility call ledger" tabIndex={-1}>
            <div className="pane-heading"><span className="eyebrow">01 / Call order</span><span className="mono">{snapshot.facilities.length} records</span></div>
            <div className="ledger-columns" aria-hidden="true"><span>Rank</span><span>Facility / source phone</span><span>Score</span></div>
            {!snapshot.facilities.length ? <div className="empty-state"><h3>No ranked facilities.</h3><p>Nothing is eligible in this snapshot. Review source refusals below; no outreach order has been invented.</p></div> :
              <ol className="facility-list">
                {snapshot.facilities.map(item => {
                  const active = item.id === selectedId;
                  const contact = contacts[item.id];
                  const status = contact?.status ?? "uncontacted";
                  const lit = porch?.id === item.id;
                  return <li key={item.id} data-selected={active}>
                    <button className="facility-row" onClick={() => selectRow(item.id)} aria-pressed={active}
                      data-porch={lit ? "true" : "false"} data-rank={item.rank}
                      aria-label={`Rank ${item.rank}: ${item.name}, phone ${formatPhone(item.phone.value)}, score ${formatFigure(item.score.total)}, ${contactLabels[status]}`}>
                      <span className="rank mono">{String(item.rank).padStart(2, "0")}</span>
                      <span className="facility-info"><span className="facility-type">{item.type === "dialysis" ? "Dialysis" : "Nursing home"} <span>· Provider no. {item.ccn}</span></span><span className="facility-name">{item.name}</span><span className="facility-phone">{formatPhone(item.phone.value)}</span><span className={`contact-state${status === "reached" ? " is-answered" : ""}${status !== "uncontacted" ? " is-recorded" : ""}`}>{!ready ? "Loading contact status…" : contactLabels[status]}{active && <span className="selection-label"> · Selected call</span>}</span>{contact && <time className="contact-time" dateTime={contact.updatedAt}>{formatDateEt(contact.updatedAt)}</time>}</span>
                      <span className="score mono" title={String(item.score.total)}>{formatFigure(item.score.total)}<span className="score-bar"><i style={{ width: `${item.score.total * 100}%` }} /></span></span>
                    </button>
                  </li>;
                })}
              </ol>}
            <div className="ledger-footnote">Descending fixed score, 0–1, shown to 2 decimals. The evidence drawer keeps the source figure. Prototype weights, not a prediction of harm. Manual outcomes do not reorder the list.</div>
          </section>
          <section className="atlas-column" id="source-atlas" aria-label="Source response atlas">
            <CoverageMap geometry={snapshot.warning_geometry} facilities={snapshot.facilities} selectedId={selectedId} porchId={porch?.id ?? ""} onSelect={selectRow}
              contextLabel={national ? snapshot.scenario.geometry_mode === "official_alert_polygon" ? "Official NWS alert polygon" : snapshot.selected_alert ? "County context, not the warning boundary" : "Official county boundaries, not a warning" : undefined} />
            {row && <div className={`atlas-index-strip${porch && row.id === porch.id ? " is-porch" : ""}`}>
              <span className="index-numeral" aria-hidden="true">{String(row.rank).padStart(2, "0")}</span>
              <div><span className="eyebrow">Selected care facility</span><strong>{row.name}</strong><span className="mono" title={`${row.lat}, ${row.lon}`}>Provider no. {row.ccn} / {formatFigure(row.lat)}, {formatFigure(row.lon)}</span></div>
            </div>}
            {row && <div className="atlas-bezel"><WatchBezel label="Ranked call order" ticks={snapshot.facilities.map(item => ({ id: item.id, label: `Jump to rank ${item.rank}, ${item.name}`, mark: String(item.rank) }))}
              selectedId={row.id} litId={porch?.id ?? ""} onSelect={selectRow} centerLabel={`Focus rank ${row.rank} in the ledger`} centerMark={String(row.rank).padStart(2, "0")}
              onCenter={() => document.querySelector<HTMLElement>(".facility-row[aria-pressed='true']")?.focus()} /></div>}
            <div className="atlas-provenance">
              <span className="eyebrow">{isZetaris ? "Source query, not model confidence" : "Source integration state"}</span>
              <p>{isZetaris ? <>Zetaris audit <code>{snapshot.data_access.zetaris_query_ids.join(", ")}</code> carries this snapshot.</> : "Direct development data. Zetaris audit attribution is not claimed."}</p>
              <p className="fineprint">Published geometry and source points. No imagined roads, patient locations or weather radar.</p>
            </div>
          </section>
          <aside className="operator-rail" aria-label="Selected facility contact desk">
            <div className="pane-heading"><span className="eyebrow">03 / Contact desk</span><span className="mono">Manual action only</span></div>
            {row && <section className={`next-call${porch && row.id === porch.id ? " is-porch" : ""}`} aria-labelledby="next-call-title">
              <div className="focus-header"><span className="eyebrow">Selected / next-call focus</span><span className="mono">{String(row.rank).padStart(2, "0")} / {snapshot.facilities.length}</span></div>
              <motion.div key={row.id} initial={ready && !reducedMotion ? { opacity: 0, y: 5 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <h2 id="next-call-title" tabIndex={-1}>{row.name}</h2>
                <p className="call-address">{row.address} · {row.zip}</p>
                <div className="phone-line"><span className="phone-number">{formatPhone(row.phone.value)}</span><button onClick={copyPhone} disabled={!row.phone.value || copying} aria-label={`Copy phone for ${row.name}`}>{copying ? "Copying…" : "Copy"}</button></div>
                <p className="reason">{plainReason(row.computed_reason)}</p>
              </motion.div>
              <button className="evidence-trigger" onClick={() => setEvidenceOpen(true)}>Why this rank / inspect evidence <span aria-hidden="true">↗</span></button>
              <CallScript key={`${sourceRunId ?? "demo"}:${row.ccn}`} ccn={row.ccn} sourceRunId={sourceRunId} />
              <form className="contact-form" onSubmit={event => { event.preventDefault(); recordContact(); }}>
                <label htmlFor="contact-status">Manually record an outcome</label>
                <p className="fineprint">This device only. No calls or messages are sent. No patient information.</p>
                <select id="contact-status" value={draftStatus} onChange={event => setDraftStatus(event.target.value as ContactStatus)} disabled={!ready}>
                  {Object.entries(contactLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button className="primary-button" type="submit" disabled={!ready}>{ready ? "Record & next uncontacted" : "Loading local records…" }<span aria-hidden="true">→</span></button>
                <p className="fineprint">Recorded now: {ready ? contactLabels[contacts[row.id]?.status ?? "uncontacted"] : "Loading…"}{contacts[row.id] && ` · ${formatDateEt(contacts[row.id].updatedAt)}`}</p>
              </form>
            </section>}
            <p className={`action-notice ${notice ? "has-notice" : ""}`} role="status" aria-live="polite" aria-atomic="true">{notice}</p>
          </aside>
        </div>
        {snapshot.model_report && <details className="limits"><summary>Grounded drafts and retained failures</summary><p>{snapshot.model_report.accepted_facilities} grounded facility drafts. {snapshot.model_report.unresolved_facilities} unresolved. {snapshot.model_report.not_attempted_budget} not attempted because of the approved cap. {snapshot.model_report.provider_requests} Meterless requests. {snapshot.model_report.retry_recoveries} retry recoveries.</p><p>Draft failure reasons</p><pre>{JSON.stringify(snapshot.model_report.failure_reasons, null, 2)}</pre></details>}
        <section className="refusals" aria-labelledby="refusals-title"><div><span className="eyebrow">Withheld, not forgotten</span><h2 id="refusals-title">{snapshot.refused.length} records refused.</h2><p>Missing or disqualifying evidence keeps these records out of the call order.</p></div><ul>{snapshot.refused.map(item => <li key={item.ccn}><span>{item.name}</span><code>Provider no. {item.ccn} / {item.reason}</code></li>)}</ul></section>
        <section className="limits source-limits print-limits" id="source-limits"><h2>Snapshot limits</h2><ul>{snapshot.limits.map(limit => <li key={limit}>{limit}</li>)}</ul><p>{national ? "The national fixed policy omits county plans. No archived Manatee plan or guessed plan value is applied." : "Current published weather-service shapes are used; equivalence to the 2024 boundary is unverified."} Medical-equipment ZIP totals are not a count of this facility's patients.</p></section>
      </main>
      <footer className="site-footer">
        <span className="wordmark">Porch Light.</span>
        <div>
          <p>Public source records. Transparent priorities.<br />{national ? "An additional outreach resource, not emergency or clinical guidance." : "A retrospective prototype, not emergency or clinical guidance."}</p>
          <details><summary>Technology and sponsor evidence</summary>
            <p>Meterless and NVIDIA Nemotron: {snapshot.model_executions.length > 0 ? "Actual stored model drafts are identified in the row evidence drawer." : "No completed model execution in this snapshot."}</p>
            <p>Zetaris: {isZetaris ? "This snapshot carries real query references confirmed against the vendor audit database." : "Integration and query IDs are pending. This screen uses a direct PostGIS development snapshot."}</p>
            <p>Cursor: PR22 supplies the Storm Watch map and shared controls. Devin integrates the audited national workflow.</p>
          </details>
        </div>
        <span className="mono">{snapshot.county.name.toUpperCase()} / {snapshot.county.state}<br />{snapshot.scenario.event}</span>
        <a className="design-credit mono" href="/">About Porch Light</a>
      </footer>
      {row && <EvidenceDrawer row={row} snapshot={snapshot} provenance={provenance} open={evidenceOpen} onClose={() => setEvidenceOpen(false)} />}
    </div>
  );
};
