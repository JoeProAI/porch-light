"use client";

import { useEffect, useState } from "react";
import type { Provenance, Snapshot } from "@/lib/types";
import { formatDate } from "@/lib/operator";
import { searchCounties, type CountyRecord } from "@/lib/county-search";
import { CountyMap } from "./national/county-map";
import { SourceGaps } from "./national/source-gaps";
import { Masthead } from "./masthead";
import { Operator } from "./operator";
import "./national/national.css";

type Alert = { id: string; event: string; areaDesc: string; expires: string; county_fips: string[]; mapping_status: string };
type Catalog = {
  catalog: { counties: CountyRecord[]; data_access: { zetaris_query_ids: string[] } };
  weather: { status: string; capture_id?: string; captured_at?: string; alerts?: Alert[]; message?: string };
};
type Job = {
  id: string; phase: string; message?: string; completed_counties?: number; total_counties?: number;
  eligible_facilities?: number; snapshot?: Snapshot & { state?: string; reason?: string }; provenance?: Provenance;
};
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const launched = new Set<string>();
const requestRun = async (selection: { county?: string; alert?: string; capture?: string }): Promise<string> => {
  const response = await fetch("/api/national", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selection),
  });
  const value: unknown = await response.json();
  if (!response.ok || !object(value) || typeof value.id !== "string") {
    throw new Error(object(value) && typeof value.error === "string" ? value.error : "The source run couldn't start.");
  }
  return value.id;
};

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
  const [countyQuery, setCountyQuery] = useState("");

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
        const fips = query.get("county");
        const rows = (value as unknown as Catalog).catalog.counties;
        if (fips && !saved) {
          if (!/^\d{5}$/.test(fips)) setError("County source code must be five digits. No Manatee sheet was substituted.");
          else {
            const row = rows.find(item => item.fips === fips);
            if (!row) setError(`${fips} is not in the official Census catalog. No Manatee sheet was substituted.`);
            else {
              setMode("county");
              setState(row.state);
              setCounty(row.fips);
              setCountyQuery(row.fips);
              if (!launched.has(fips)) {
                launched.add(fips);
                try {
                  const id = await requestRun({ county: fips });
                  if (!controller.signal.aborted) {
                    setJob({ id, phase: "starting" });
                    window.history.replaceState(null, "", `/nationwide?run=${id}&county=${fips}`);
                  }
                } catch (failure) {
                  launched.delete(fips);
                  if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "The source run is unavailable.");
                }
              }
            }
          }
        }
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

  const begin = async (selection: { county?: string; alert?: string; capture?: string }) => {
    setSubmitting(true);
    setError("");
    try {
      const id = await requestRun(selection);
      setJob({ id, phase: "starting" });
      const query = new URLSearchParams({ run: id });
      if (selection.county) query.set("county", selection.county);
      window.history.replaceState(null, "", `/nationwide?${query}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The source run is unavailable."); }
    finally { setSubmitting(false); }
  };
  const states = [...new Set(catalog?.catalog.counties.map(row => row.state) ?? [])].sort();
  const counties = catalog?.catalog.counties.filter(row => row.state === state) ?? [];
  const countyMatches = searchCounties(catalog?.catalog.counties ?? [], countyQuery);
  const selectedAlert = catalog?.weather.alerts?.find(row => row.id === alert);
  const busy = submitting || !!polling;
  const start = () => void begin(mode === "county" ? { county } : { alert, capture: catalog?.weather.capture_id });
  const pickCounty = (fips: string) => {
    if (!/^\d{5}$/.test(fips) || busy) return;
    const row = catalog?.catalog.counties.find(item => item.fips === fips);
    if (catalog && !row) {
      setCountyQuery(fips);
      setError(`${fips} is not in the official Census catalog. No Manatee sheet was substituted.`);
      return;
    }
    setMode("county");
    setCounty(fips);
    setCountyQuery(fips);
    if (row) setState(row.state);
    void begin({ county: fips });
  };
  const snapshot = job?.snapshot;
  const Content = snapshot && snapshot.state !== "source_gap" ? "section" : "main";
  useEffect(() => {
    if (job?.snapshot && job.snapshot.state !== "source_gap") {
      document.getElementById("national-result")?.focus();
    }
  }, [job?.id, !!job?.snapshot, job?.snapshot?.state]);

  return <>
    <div className="app-shell national-controls">
      <Masthead />
      <Content>
        <section className="intro" aria-labelledby="national-title">
          <div className="intro-heading"><p className="eyebrow">County discovery / Official alert captures</p>
            <h1 id="national-title">Find the next <em>care-facility call.</em></h1>
            <p className="intro-description">Click a county or search the catalog. One run returns that county&apos;s audited rows and source gaps. A captured weather alert can run the counties it maps.</p>
          </div>
          <div className="edition-note"><p>Directory records, not verified facility conditions. Prototype ranking, not clinical urgency.</p><a href="https://api.weather.gov/alerts/active" target="_blank" rel="noreferrer">Current official weather alerts</a></div>
        </section>
        {mode === "county" && <CountyMap selected={county} disabled={busy} onPick={pickCounty} />}
        {loading && <p role="status">Reading the audited national source catalog. No sample counties are loaded.</p>}
        {error && <div className="watch-error" role="alert"><p>{error}</p><button onClick={() => setRefreshKey(key => key + 1)} disabled={loading}>Retry verified source catalog</button></div>}
        {mode === "county" && <section className="contact-form" aria-label="Search the audited county catalog">
            <label htmlFor="county-search">Search US counties by name or FIPS</label>
            <input id="county-search" type="search" value={countyQuery} disabled={busy}
              onChange={event => setCountyQuery(event.target.value)} placeholder="Baldwin, Doña Ana, or 01003" />
            {catalog && !!countyQuery.trim() && <>
              <p role="status">{countyMatches.length} matching source counties. Select the state and county you mean.</p>
              <ul>{countyMatches.slice(0, 20).map(item => <li key={item.fips}>
                <button type="button" disabled={busy} onClick={() => {
                  setState(item.state); setCounty(item.fips); setCountyQuery(""); setJob(null);
                }}>{item.name}, {item.state} / {item.fips}</button>
              </li>)}</ul>
              {countyMatches.length > 20 && <p className="fineprint">Showing the first 20 source matches. Add a state abbreviation to narrow the search.</p>}
              {!countyMatches.length && <p>No source county matches this name or FIPS. Try another name or use the state list. No county is guessed.</p>}
            </>}
          </section>}
        {catalog && <>
          <p className="fineprint">{catalog.catalog.counties.length} official Census county entries. Zetaris catalog query {catalog.catalog.data_access.zetaris_query_ids.join(", ")}. Being on this list is not a ranking. A run returns that county&apos;s own rows and gaps.</p>
          <form className="contact-form" onSubmit={event => { event.preventDefault(); void start(); }}>
            <fieldset disabled={busy}><legend>Choose source scope</legend>
              <label><input type="radio" name="source-mode" checked={mode === "county"} onChange={() => { setMode("county"); setJob(null); }} /> County discovery</label>
              <label><input type="radio" name="source-mode" checked={mode === "alert"} onChange={() => { setMode("alert"); setJob(null); }} /> Captured live alert</label>
            </fieldset>
            {mode === "county" ? <>
              <label htmlFor="national-state">State or territory</label>
              <select id="national-state" value={state} onChange={event => { setState(event.target.value); setCounty(""); setJob(null); }} disabled={busy} required>
                <option value="">Choose a state or territory</option>{states.map(code => <option key={code}>{code}</option>)}
              </select>
              <label htmlFor="national-county">County or county-equivalent</label>
              <select id="national-county" value={county} onChange={event => { setCounty(event.target.value); setJob(null); }} disabled={!state || busy} required>
                <option value="">Choose an official county record</option>
                {counties.map(row => <option key={row.fips} value={row.fips}>{row.name} / {row.fips}{row.geometry_valid ? "" : " / geometry unavailable"}</option>)}
              </select>
              <p className="fineprint">County discovery doesn't assert an active storm. Missing joins, masked counts, closed-source records and non-exact geocodes remain explicit refusals.</p>
            </> : <>
              {catalog.weather.status !== "available" ? <p className="watch-error" role="alert">{catalog.weather.message} Use the official source links or choose county discovery.</p> :
                <><label htmlFor="national-alert">Official NWS alert</label>
                  <select id="national-alert" value={alert} onChange={event => { setAlert(event.target.value); setJob(null); }} disabled={busy} required>
                    <option value="">Choose a captured source alert</option>
                    {catalog.weather.alerts?.map(row => <option key={row.id} value={row.id}>{row.event} / {row.areaDesc}</option>)}
                  </select>
                  {catalog.weather.captured_at && <p className="fineprint">Feed captured {formatDate(catalog.weather.captured_at)}. Alerts can expire after capture.</p>}
                  {selectedAlert && <p className="fineprint">{selectedAlert.county_fips.length} source-mapped counties. Mapping: {selectedAlert.mapping_status}. <a href={selectedAlert.id} target="_blank" rel="noreferrer">Inspect the original NWS record</a></p>}
                </>}
            </>}
            <button className="primary-button" type="submit" disabled={busy || loading ||
              (mode === "county" ? !county : !selectedAlert)}>
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
          {job.phase === "grounding_nemotron_drafts" && snapshot && <p>The audited call sheet is ready below. Nemotron drafts are still processing; they don't determine the ranking.</p>}
        </section>}
        {snapshot?.state === "source_gap" && <section className="watch-error" role="alert"><h2>Source gap, no ranking invented.</h2>
          <p>{snapshot.county.name}: {snapshot.reason}</p><p>Audited query {snapshot.data_access.zetaris_query_ids.join(", ")}.</p>
          <SourceGaps value={snapshot} /></section>}
      </Content>
    </div>
    {snapshot && snapshot.state !== "source_gap" && job?.provenance &&
      <div id="national-result" tabIndex={-1} role="region" aria-label="Verified care-facility call sheet">
        <SourceGaps value={snapshot} />
        <Operator key={job.id} snapshot={snapshot} provenance={job.provenance} sourceRunId={job.id} />
      </div>}
  </>;
};
