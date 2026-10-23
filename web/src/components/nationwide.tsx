"use client";

import { useEffect, useState } from "react";
import type { Provenance, Snapshot } from "@/lib/types";
import { formatDate } from "@/lib/operator";
import { Operator } from "./operator";

type County = { fips: string; name: string; state: string; geometry_valid?: boolean };
type Alert = { id: string; event: string; areaDesc: string; expires: string; county_fips: string[]; mapping_status: string };
type Catalog = {
  catalog: { counties: County[]; data_access: { zetaris_query_ids: string[] } };
  weather: { status: string; capture_id?: string; captured_at?: string; alerts?: Alert[]; message?: string };
};
type Job = {
  id: string; phase: string; message?: string; completed_counties?: number; total_counties?: number;
  eligible_facilities?: number; snapshot?: Snapshot & { state?: string; reason?: string }; provenance?: Provenance;
};
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const Nationwide = () => {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [state, setState] = useState("");
  const [county, setCounty] = useState("");
  const [alert, setAlert] = useState("");
  const [mode, setMode] = useState<"county" | "alert">("county");
  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetch("/api/national", { cache: "no-store", signal: controller.signal });
        const value: unknown = await response.json();
        if (!response.ok || !object(value) || !object(value.catalog) || !Array.isArray(value.catalog.counties)) {
          throw new Error(object(value) && typeof value.error === "string" ? value.error : "The verified national catalog couldn't be read.");
        }
        setCatalog(value as unknown as Catalog);
        const query = new URLSearchParams(window.location.search);
        const saved = query.get("run");
        if (saved && /^[a-f0-9]{32}$/.test(saved)) setJob({ id: saved, phase: "checking_saved_run" });
        if (query.get("alert")) { setMode("alert"); setAlert(query.get("alert")!); }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "The source service is unavailable.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [refreshKey]);

  const polling = job && !["completed", "failed"].includes(job.phase) ? job.id : null;
  useEffect(() => {
    if (!polling) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/national?job=${polling}`, { cache: "no-store", signal: controller.signal });
        const value: unknown = await response.json();
        if (!response.ok || !object(value) || value.id !== polling || typeof value.phase !== "string") {
          throw new Error("The verified job checkpoint couldn't be read. No substitute result was loaded.");
        }
        if (controller.signal.aborted) return;
        setJob(value as Job);
        setError("");
        if (!["completed", "failed"].includes(value.phase)) timer = setTimeout(() => void poll(), 2000);
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : "Run polling failed.");
          timer = setTimeout(() => void poll(), 5000);
        }
      }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [polling]);

  const start = async () => {
    setSubmitting(true);
    setError("");
    try {
      const selection = mode === "county" ? { county } : { alert, capture: catalog?.weather.capture_id };
      const response = await fetch("/api/national", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selection),
      });
      const value: unknown = await response.json();
      if (!response.ok || !object(value) || typeof value.id !== "string") {
        throw new Error(object(value) && typeof value.error === "string" ? value.error : "The source run couldn't start.");
      }
      setJob({ id: value.id, phase: "starting" });
      const query = new URLSearchParams({ run: value.id });
      window.history.replaceState(null, "", `/nationwide?${query}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The source run is unavailable."); }
    finally { setSubmitting(false); }
  };
  const states = [...new Set(catalog?.catalog.counties.map(row => row.state) ?? [])].sort();
  const counties = catalog?.catalog.counties.filter(row => row.state === state) ?? [];
  const selectedAlert = catalog?.weather.alerts?.find(row => row.id === alert);
  const busy = submitting || !!polling;
  const snapshot = job?.phase === "completed" ? job.snapshot : undefined;
  const Content = snapshot && snapshot.state !== "source_gap" ? "section" : "main";
  useEffect(() => {
    if (job?.phase === "completed" && job.snapshot?.state !== "source_gap") {
      document.getElementById("national-result")?.focus();
    }
  }, [job?.phase, job?.id, job?.snapshot?.state]);

  return <>
    <div className="app-shell national-controls">
      <header className="masthead">
        <a href="/" className="wordmark">Porch Light<span className="wordmark-period">.</span></a>
        <span className="masthead-descriptor">National care-facility outreach</span>
        <nav className="workspace-nav" aria-label="Workspace sections"><a href="/">Project home</a><a href="/watch">Storm Watch</a><a href="/operate">Manatee walkthrough</a></nav>
      </header>
      <Content>
        <section className="intro" aria-labelledby="national-title">
          <div className="intro-heading"><p className="eyebrow">County discovery / Official alert captures</p>
            <h1 id="national-title">Find the next <em>care-facility call.</em></h1>
            <p className="intro-description">Choose a US county or a captured weather alert. Medicare, Census, and power-outage records build a call sheet, or show exactly what is missing.</p>
          </div>
          <div className="edition-note"><p>Directory records, not verified facility conditions. Prototype ranking, not clinical urgency.</p><a href="https://api.weather.gov/alerts/active" target="_blank" rel="noreferrer">Current official weather alerts</a></div>
        </section>
        {loading && <p role="status">Reading the audited national source catalog. No sample counties are loaded.</p>}
        {error && <div className="watch-error" role="alert"><p>{error}</p><button onClick={() => setRefreshKey(key => key + 1)} disabled={loading}>Retry verified source catalog</button></div>}
        {catalog && <>
          <p className="fineprint">{catalog.catalog.counties.length} official Census county entries. Zetaris catalog query {catalog.catalog.data_access.zetaris_query_ids.join(", ")}. Ranking depends on the source joins, not merely being on this list.</p>
          <form className="contact-form" onSubmit={event => { event.preventDefault(); void start(); }}>
            <fieldset disabled={busy}><legend>Choose source scope</legend>
              <label><input type="radio" name="source-mode" checked={mode === "county"} onChange={() => setMode("county")} /> County discovery</label>
              <label><input type="radio" name="source-mode" checked={mode === "alert"} onChange={() => setMode("alert")} /> Captured live alert</label>
            </fieldset>
            {mode === "county" ? <>
              <label htmlFor="national-state">State or territory</label>
              <select id="national-state" value={state} onChange={event => { setState(event.target.value); setCounty(""); }} disabled={busy} required>
                <option value="">Choose a state or territory</option>{states.map(code => <option key={code}>{code}</option>)}
              </select>
              <label htmlFor="national-county">County or county-equivalent</label>
              <select id="national-county" value={county} onChange={event => setCounty(event.target.value)} disabled={!state || busy} required>
                <option value="">Choose an official county record</option>
                {counties.map(row => <option key={row.fips} value={row.fips}>{row.name} / {row.fips}{row.geometry_valid ? "" : " / geometry unavailable"}</option>)}
              </select>
              <p className="fineprint">County discovery doesn't assert an active storm. Missing joins, masked counts, closed-source records and non-exact geocodes remain explicit refusals.</p>
            </> : <>
              {catalog.weather.status !== "available" ? <p className="watch-error" role="alert">{catalog.weather.message} Use the official source links or choose county discovery.</p> :
                <><label htmlFor="national-alert">Official NWS alert</label>
                  <select id="national-alert" value={alert} onChange={event => setAlert(event.target.value)} disabled={busy} required>
                    <option value="">Choose a captured source alert</option>
                    {catalog.weather.alerts?.map(row => <option key={row.id} value={row.id}>{row.event} / {row.areaDesc}</option>)}
                  </select>
                  {catalog.weather.captured_at && <p className="fineprint">Feed captured {formatDate(catalog.weather.captured_at)}. Alerts can expire after capture.</p>}
                  {selectedAlert && <p className="fineprint">{selectedAlert.county_fips.length} source-mapped counties. Mapping: {selectedAlert.mapping_status}. <a href={selectedAlert.id} target="_blank" rel="noreferrer">Inspect the original NWS record</a></p>}
                </>}
            </>}
            <button className="primary-button" type="submit" disabled={busy || loading ||
              (mode === "county" ? !county : !selectedAlert || !selectedAlert.county_fips.length)}>
              {busy ? "Processing verified sources..." : "Build sourced call sheet and grounded drafts"}
            </button>
            <p className="fineprint">Nemotron only, through Meterless. Approved free NVIDIA route only. A failed draft is kept, retried at most once and never replaced with invented text. The shared call cap can leave drafts unattempted.</p>
          </form>
        </>}
        {job && <section className="source-strip" role="status" aria-live="polite">
          <p>Run {job.id}. {job.phase.replaceAll("_", " ")}.
            {job.total_counties !== undefined && <> {job.completed_counties} of {job.total_counties} affected counties read.</>}
            {job.eligible_facilities !== undefined && <> {job.eligible_facilities} source-eligible facilities.</>}</p>
          {job.message && <p role="alert">{job.message} No source or model fallback was fabricated.</p>}
        </section>}
        {snapshot?.state === "source_gap" && <section className="watch-error" role="alert"><h2>Source gap, no ranking invented.</h2>
          <p>{snapshot.county.name}: {snapshot.reason}</p><p>Audited query {snapshot.data_access.zetaris_query_ids.join(", ")}.</p></section>}
      </Content>
    </div>
    {snapshot && snapshot.state !== "source_gap" && job?.provenance &&
      <div id="national-result" tabIndex={-1} role="region" aria-label="Verified care-facility call sheet">
        <Operator key={job.id} snapshot={snapshot} provenance={job.provenance} sourceRunId={job.id} />
      </div>}
  </>;
};
