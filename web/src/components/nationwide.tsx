"use client";

import { useEffect, useRef, useState } from "react";
import type { Provenance, Snapshot } from "@/lib/types";
import { looksUnreachable, parseCatalog, UNREACHABLE_MESSAGE, type NationalCatalog } from "@/lib/national-gaps";
import { Operator } from "./operator";
import { AlertEntry } from "./national/alert-entry";
import { CountySearch } from "./national/county-search";
import { CatalogFailure } from "./national/engine-unreachable";
import { JobProgress, type NationalJob } from "./national/job-progress";
import { SourceGaps } from "./national/source-gaps";
import "./national/national.css";

type Job = NationalJob & { snapshot?: Snapshot & { state?: string; reason?: string }; provenance?: Provenance };
type Selection = { county?: string; alert?: string; capture?: string };
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const startedDeepLinks = new Set<string>();
let autoAlertRefreshStarted = false;

export const Nationwide = () => {
  const [catalog, setCatalog] = useState<NationalCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unreachable, setUnreachable] = useState(false);
  const [county, setCounty] = useState("");
  const [alert, setAlert] = useState("");
  const [scope, setScope] = useState("combined");
  const [mode, setMode] = useState<"county" | "alert">("county");
  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [runNote, setRunNote] = useState("");
  const refreshingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setUnreachable(false);
    void (async () => {
      try {
        const response = await fetch("/api/national", { cache: "no-store", signal: controller.signal });
        const value: unknown = await response.json();
        const parsed = parseCatalog(value);
        if (!response.ok || !parsed) {
          const message = object(value) && typeof value.error === "string" ? value.error : "The verified national catalog couldn't be read.";
          if (!controller.signal.aborted) {
            setUnreachable(object(value) && value.unreachable === true || looksUnreachable(message));
            setError(message);
          }
          return;
        }
        if (controller.signal.aborted) return;
        setCatalog(parsed);
        const query = new URLSearchParams(window.location.search);
        const saved = query.get("run");
        const fips = query.get("county");
        if (fips && /^\d{5}$/.test(fips)) setCounty(fips);
        if (saved && /^[a-f0-9]{32}$/.test(saved)) setJob({ id: saved, phase: "checking_saved_run" });
        if (query.get("alert")) { setMode("alert"); setAlert(query.get("alert")!); }
      } catch (failure) {
        if (!controller.signal.aborted) {
          setUnreachable(true);
          setError(failure instanceof Error ? failure.message : UNREACHABLE_MESSAGE);
        }
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
          throw new Error(object(value) && typeof value.error === "string" ? value.error : "The verified job checkpoint couldn't be read. No substitute result was loaded.");
        }
        if (controller.signal.aborted) return;
        setJob(current => ({ ...current, ...(value as Job) }));
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

  const refreshAlerts = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/national", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh_alerts" }),
      });
      const value: unknown = await response.json();
      const parsed = parseCatalog(value);
      if (!response.ok || !parsed) {
        const message = object(value) && typeof value.error === "string" ? value.error : "Active NWS alerts could not be read.";
        setUnreachable(object(value) && value.unreachable === true || looksUnreachable(message));
        setError(message);
        return;
      }
      setUnreachable(false);
      setCatalog(parsed);
      setAlert(current => parsed.weather.alerts.some(row => row.id === current) ? current : "");
    } catch (failure) {
      setUnreachable(true);
      setError(failure instanceof Error ? failure.message : UNREACHABLE_MESSAGE);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (autoAlertRefreshStarted || mode !== "alert" || !catalog || catalog.weather.status === "available") return;
    autoAlertRefreshStarted = true;
    void refreshAlerts();
  }, [mode, catalog]);

  const start = async (selection: Selection, note = "") => {
    setSubmitting(true);
    setError("");
    setRunNote(note);
    try {
      const response = await fetch("/api/national", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selection),
      });
      const value: unknown = await response.json();
      if (!response.ok || !object(value) || typeof value.id !== "string") {
        const message = object(value) && typeof value.error === "string" ? value.error : "The source run couldn't start.";
        setUnreachable(object(value) && value.unreachable === true || looksUnreachable(message));
        throw new Error(message);
      }
      setJob({ id: value.id, phase: "starting" });
      const params = new URLSearchParams({ run: value.id });
      if (selection.county) params.set("county", selection.county);
      if (selection.alert) params.set("alert", selection.alert);
      window.history.replaceState(null, "", `/nationwide?${params}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The source run is unavailable."); }
    finally { setSubmitting(false); }
  };

  useEffect(() => {
    if (!catalog) return;
    const params = new URLSearchParams(window.location.search);
    const fips = params.get("county");
    if (!fips || params.get("run") || startedDeepLinks.has(fips)) return;
    if (!/^\d{5}$/.test(fips) || !catalog.counties.some(row => row.fips === fips)) {
      setError(`${fips} is not in the official Census catalog. No Manatee sheet was substituted.`);
      return;
    }
    startedDeepLinks.add(fips);
    setMode("county");
    setCounty(fips);
    void start({ county: fips });
  }, [catalog]);

  const selectedAlert = catalog?.weather.alerts.find(row => row.id === alert);
  const busy = submitting || !!polling;
  const snapshot = job?.phase === "completed" ? job.snapshot : undefined;
  const sheet = snapshot && snapshot.state !== "source_gap" && snapshot.schema_version !== "porch-light.national-gap.v1";
  const Content = sheet ? "section" : "main";
  const canSubmit = mode === "county" ? /^\d{5}$/.test(county) : !!selectedAlert && selectedAlert.county_fips.length > 0 &&
    (scope === "combined" ? /^[a-f0-9]{64}$/.test(catalog?.weather.capture_id ?? "") : selectedAlert.county_fips.includes(scope));
  useEffect(() => {
    if (sheet) document.getElementById("national-result")?.focus();
  }, [sheet, job?.id]);

  const submit = () => {
    if (!catalog) return;
    if (mode === "county") { void start({ county }); return; }
    if (!selectedAlert) return;
    if (scope === "combined") {
      void start({ alert: selectedAlert.id, capture: catalog.weather.capture_id });
      return;
    }
    void start({ county: scope }, `This run is county discovery for ${scope}. It does not apply the alert polygon. The combined call sheet is the alert-coverage run.`);
  };

  return <>
    <div className="app-shell national-controls">
      <header className="masthead">
        <a href="/" className="wordmark">Porch Light<span className="wordmark-period">.</span></a>
        <span className="masthead-descriptor">National care-facility outreach</span>
        <nav className="workspace-nav" aria-label="Workspace sections"><a href="/">Project home</a><a href="/watch">Storm Watch</a><a href="/operate">Manatee walkthrough</a></nav>
      </header>
      <Content>
        <section className="intro" aria-labelledby="national-title">
          <div className="intro-heading"><p className="eyebrow">County discovery / Active NWS alerts</p>
            <h1 id="national-title">Find the next <em>care-facility call.</em></h1>
            <p className="intro-description">Search any US county, or choose a county mapped from an active NWS alert. The audited chain returns the ranked call sheet, or the exact source gaps.</p>
          </div>
          <div className="edition-note"><p>Directory records, not verified facility conditions. Prototype ranking, not clinical urgency.</p><a href="https://api.weather.gov/alerts/active" target="_blank" rel="noreferrer">Current official NWS alerts</a></div>
        </section>
        {loading && <p role="status">Reading the audited national source catalog. No sample counties are loaded.</p>}
        {!catalog && (error || unreachable) && !loading && <CatalogFailure unreachable={unreachable || looksUnreachable(error)} message={error} onRetry={() => setRefreshKey(key => key + 1)} disabled={loading} />}
        {catalog && error && <div className="watch-error" role="alert"><p>{error} No Manatee data was substituted.</p></div>}
        {catalog && <>
          <p className="fineprint">{catalog.counties.length.toLocaleString("en-US")} official Census county entries. Zetaris catalog query {catalog.queryIds.join(", ")}. Being listed is not a ranking.</p>
          <form className="contact-form" onSubmit={event => { event.preventDefault(); submit(); }}>
            <fieldset disabled={busy}><legend>Choose source scope</legend>
              <label><input type="radio" name="source-mode" checked={mode === "county"} onChange={() => setMode("county")} /> County discovery</label>
              <label><input type="radio" name="source-mode" checked={mode === "alert"} onChange={() => setMode("alert")} /> Active NWS alert</label>
            </fieldset>
            {mode === "county" ? <CountySearch counties={catalog.counties} fips={county} onSelect={setCounty} disabled={busy} /> :
              <AlertEntry weather={catalog.weather} counties={catalog.counties} alertId={alert} onAlert={id => { setAlert(id); setScope("combined"); }}
                scope={scope} onScope={setScope} disabled={busy} refreshing={refreshing} onRefresh={() => void refreshAlerts()} />}
            <button className="primary-button" type="submit" disabled={busy || loading || (mode === "alert" && refreshing) || !canSubmit}>
              {busy ? "Processing verified sources..." : "Build sourced call sheet and grounded drafts"}
            </button>
            <p className="fineprint">Nemotron only, through Meterless, with thinking disabled. A failed draft is kept, retried at most once, and never replaced with invented text. The shared call cap can leave drafts unattempted.</p>
          </form>
        </>}
        {job && <JobProgress job={job} />}
        {runNote && <p className="fineprint">{runNote}</p>}
        {snapshot && !sheet && <SourceGaps value={snapshot} />}
      </Content>
    </div>
    {sheet && job?.provenance && snapshot &&
      <div id="national-result" tabIndex={-1} role="region" aria-label="Verified care-facility call sheet">
        <div className="app-shell"><SourceGaps value={snapshot} /></div>
        <Operator key={job.id} snapshot={snapshot} provenance={job.provenance} sourceRunId={job.id} />
      </div>}
  </>;
};
