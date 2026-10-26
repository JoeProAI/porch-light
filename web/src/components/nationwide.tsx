"use client";

import { useEffect, useState } from "react";
import type { Provenance, Snapshot } from "@/lib/types";
import { orderAffectedAlerts } from "@/lib/affected-alerts";
import { toggleShortlist } from "@/lib/shortlist";
import { hasAlertShape } from "@/lib/geo";
import { acceptedLiveWeather } from "@/lib/live-weather";
import { formatDate } from "@/lib/operator";
import { searchCounties, type CountyRecord } from "@/lib/county-search";
import type { LiveWeather } from "@/lib/weather-types";
import { SourceGaps } from "./national/source-gaps";
import { StormDesk } from "./national/storm-desk";
import { Masthead } from "./masthead";
import { Operator } from "./operator";
import { SourceMap } from "./source-map";
import "./national/national.css";

type Alert = { id: string; event: string; areaDesc: string; expires: string; county_fips: string[]; mapping_status: string };
type Catalog = {
  catalog: {
    counties: (CountyRecord & { ranked_rows?: number; outcome?: string })[];
    data_access: {
      zetaris_query_ids: string[];
      publication?: { mode?: string; sweep_run_id?: string; ranked_counties?: number; note?: string };
    };
  };
  weather: { status: string; capture_id?: string; captured_at?: string; alerts?: Alert[]; message?: string };
  publication?: { mode?: string; sweep_run_id?: string };
};
type Job = {
  id: string; phase: string; message?: string; completed_counties?: number; total_counties?: number;
  eligible_facilities?: number; snapshot?: Snapshot & { state?: string; reason?: string }; provenance?: Provenance;
};
type RecentRun = {
  id: string; county_name: string; state: string; fips: string;
  facility_count: number; alert_event: string | null; generated_at: string;
};
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const openPublishedCounty = async (fips: string): Promise<Job> => {
  const response = await fetch(`/api/national?county=${fips}`, { cache: "no-store" });
  const value: unknown = await response.json();
  if (!response.ok || !object(value) || typeof value.id !== "string" || value.phase !== "completed") {
    throw new Error(object(value) && typeof value.error === "string" ? value.error : "The published county snapshot couldn't be read.");
  }
  return value as Job;
};
const catalogIsPublished = (value: Catalog | null): boolean =>
  value?.publication?.mode === "published_static" ||
  value?.catalog.data_access.publication?.mode === "published_static";

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
  const [recentRuns, setRecentRuns] = useState<RecentRun[] | null>(null);
  const [recentError, setRecentError] = useState("");
  const [weather, setWeather] = useState<LiveWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [weatherAttempt, setWeatherAttempt] = useState(0);
  const [liveAlertId, setLiveAlertId] = useState("");
  const [shortlist, setShortlist] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setRecentError("");
    const query = new URLSearchParams(window.location.search);
    const saved = query.get("run");
    // A saved run is read from its own verified checkpoint. Don't make the operator wait on the catalog read to see it.
    if (saved && /^[a-f0-9]{32}$/.test(saved)) setJob(current => current?.id === saved ? current : { id: saved, phase: "starting" });
    void (async () => {
      try {
        const [catalogResponse, recentResponse] = await Promise.all([
          fetch("/api/national", { cache: "no-store", signal: controller.signal }),
          fetch("/api/national?recent=1", { cache: "no-store", signal: controller.signal }),
        ]);
        const value: unknown = await catalogResponse.json();
        if (!catalogResponse.ok || !object(value) || !object(value.catalog) || !Array.isArray(value.catalog.counties)) {
          throw new Error(object(value) && typeof value.error === "string" ? value.error : "The verified national catalog couldn't be read.");
        }
        setCatalog(value as unknown as Catalog);
        try {
          const recentValue: unknown = await recentResponse.json();
          if (!recentResponse.ok || !object(recentValue) || !Array.isArray(recentValue.recent)) {
            throw new Error(object(recentValue) && typeof recentValue.error === "string"
              ? recentValue.error : "Completed local runs couldn't be listed.");
          }
          const rows = recentValue.recent.filter((row): row is RecentRun =>
            object(row) && typeof row.id === "string" && /^[a-f0-9]{32}$/.test(row.id) &&
            typeof row.county_name === "string" && typeof row.state === "string" && typeof row.fips === "string" &&
            typeof row.facility_count === "number" && typeof row.generated_at === "string" &&
            (row.alert_event === null || typeof row.alert_event === "string"));
          setRecentRuns(rows);
        } catch (failure) {
          setRecentRuns([]);
          setRecentError(failure instanceof Error ? failure.message : "Completed local runs couldn't be listed.");
        }
        const query = new URLSearchParams(window.location.search);
        const saved = query.get("run");
        if (saved && /^[a-f0-9]{32}$/.test(saved)) setJob({ id: saved, phase: "checking_saved_run" });
        const alertId = query.get("alert");
        if (alertId && (value as unknown as Catalog).weather.alerts?.some(row => row.id === alertId)) {
          setMode("alert");
          setAlert(alertId);
        }
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
                  const published = catalogIsPublished(value as unknown as Catalog);
                  if (published) {
                    const opened = await openPublishedCounty(fips);
                    if (!controller.signal.aborted) {
                      setJob(opened);
                      window.history.replaceState(null, "", `/nationwide?county=${fips}`);
                    }
                  } else {
                    const id = await requestRun({ county: fips });
                    if (!controller.signal.aborted) {
                      setJob({ id, phase: "starting" });
                      window.history.replaceState(null, "", `/nationwide?run=${id}&county=${fips}`);
                    }
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

  useEffect(() => {
    const controller = new AbortController();
    setWeatherLoading(true);
    void (async () => {
      try {
        const timeout = AbortSignal.timeout(30000);
        const response = await fetch("/api/weather", {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, timeout]),
        });
        const body: unknown = await response.json();
        if (!response.ok || !acceptedLiveWeather(body as LiveWeather)) {
          throw new Error("The live weather feed could not be read.");
        }
        if (controller.signal.aborted) return;
        const next = body as LiveWeather;
        setWeather(next);
        setWeatherError("");
        const fromUrl = new URLSearchParams(window.location.search).get("alert");
        setLiveAlertId(current => {
          if (current && next.alerts.some(alert => alert.id === current)) return current;
          if (fromUrl && next.alerts.some(alert => alert.id === fromUrl)) return fromUrl;
          const ordered = orderAffectedAlerts(next.alerts, new Set());
          return ordered.find(alert => hasAlertShape(alert.geometry))?.id ?? ordered[0]?.id ?? "";
        });
      } catch (failure) {
        if (controller.signal.aborted || (failure instanceof DOMException && failure.name === "AbortError")) return;
        setWeather(null);
        setWeatherError("The live weather feed could not be read. The county catalog is unchanged.");
      } finally {
        if (!controller.signal.aborted) setWeatherLoading(false);
      }
    })();
    return () => controller.abort();
  }, [refreshKey, weatherAttempt]);

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
      if (selection.county && catalogIsPublished(catalog)) {
        const opened = await openPublishedCounty(selection.county);
        setJob(opened);
        window.history.replaceState(null, "", `/nationwide?county=${selection.county}`);
        return;
      }
      if (catalogIsPublished(catalog) && selection.alert) {
        throw new Error("Live alert runs stay on local origin. Choose a published county on this host.");
      }
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

// Operators scan for a mapped warning, not a marine statement. Order the captured feed that way; nothing is dropped.
  const orderedAlerts = [...catalog?.weather.alerts ?? []].sort((a, b) =>
    Number(!!b.county_fips.length) - Number(!!a.county_fips.length) ||
    Number(/warning/i.test(b.event)) - Number(/warning/i.test(a.event)) ||
    a.event.localeCompare(b.event) || a.areaDesc.localeCompare(b.areaDesc));
  const alertUnmapped = !!selectedAlert && !selectedAlert.county_fips.length;
  const busy = submitting || !!polling;
  const start = () => void begin(mode === "county" ? { county } : { alert, capture: catalog?.weather.capture_id });
  const changeShortlist = (fips: string, additive: boolean) => {
    if (!/^\d{5}$/.test(fips)) return;
    const row = catalog?.catalog.counties.find(item => item.fips === fips);
    if (catalog && !row) {
      setError(`${fips} is not in the official Census catalog. No Manatee sheet was substituted.`);
      return;
    }
    setShortlist(current => toggleShortlist(current, fips, additive));
    if (row && !additive) {
      setMode("county");
      setState(row.state);
      setCounty(row.fips);
    }
  };
  const readPublished = async (fips: string): Promise<unknown> => {
    const response = await fetch(`/api/national?county=${encodeURIComponent(fips)}`, { cache: "no-store" });
    const value: unknown = await response.json();
    if (!response.ok) {
      throw new Error(object(value) && typeof value.error === "string" ? value.error : "The published county snapshot couldn't be read.");
    }
    return value;
  };
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
    if (!job?.snapshot || job.snapshot.state === "source_gap") return;
    const frame = window.requestAnimationFrame(() => {
      const atlas = document.getElementById("source-atlas");
      const result = document.getElementById("national-result");
      if (!atlas) {
        result?.focus();
        return;
      }
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      atlas.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
      result?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [job?.id, !!job?.snapshot, job?.snapshot?.state]);

  return <>
    <div className="app-shell national-controls">
      <Masthead
        sourceHref="#source-map"
        ledgerHref={snapshot && snapshot.state !== "source_gap" ? "#call-ledger" : "#county-catalog"}
      />
      <Content>
        <section className="intro" aria-labelledby="national-title">
          <div className="intro-heading"><p className="eyebrow">Active weather / Published county catalog</p>
            <h1 id="national-title">See the warning. <em>Then open the county.</em></h1>
            <p className="intro-description">Warning shapes and the counties they match are on the map when the page opens. Radar sits lightly under the county lines, and a click lands on the county. Check several counties to compare published sheets or export a shortlist. The full county search stays below.</p>
          </div>
          <div className="edition-note"><p>Directory records, not verified facility conditions. Prototype ranking, not clinical urgency.</p><a href="https://api.weather.gov/alerts/active" target="_blank" rel="noreferrer">Current official weather alerts</a></div>
        </section>
        <StormDesk weather={weather} loading={weatherLoading} error={weatherError} onRetry={() => setWeatherAttempt(attempt => attempt + 1)}
          counties={catalog?.catalog.counties ?? []} selectedId={liveAlertId} onSelect={setLiveAlertId}
          onOpenCounty={pickCounty} onShortlist={changeShortlist} shortlist={shortlist} readPublished={readPublished}
          busy={busy} published={catalogIsPublished(catalog)} />
        <SourceMap compact />
        {loading && <p role="status">Reading the audited national source catalog. No sample counties are loaded.</p>}
        {error && <div className="watch-error" role="alert"><p>{error}</p><button onClick={() => setRefreshKey(key => key + 1)} disabled={loading}>Retry verified source catalog</button></div>}
        {recentRuns !== null && <section className="source-strip verified-local-runs" aria-labelledby="verified-runs-title">
          <h2 id="verified-runs-title">{catalogIsPublished(catalog) ? "Published ranked counties" : "Verified runs on this machine"}</h2>
          <p className="fineprint">{catalogIsPublished(catalog)
            ? "Frozen audited sweep snapshots on this host. Highest ranked-facility counts first. Cap 20. No invented counties."
            : "Completed local jobs only. Snapshot present, provenance checked. Newest first. Cap 20. No sample counties."}</p>
          {recentError && <p role="alert">{recentError}</p>}
          {!recentRuns.length && !recentError && <p>No completed local runs yet.</p>}
          {!!recentRuns.length && <ul className="verified-run-list">{recentRuns.map(run => <li key={run.id}>
            <a href={catalogIsPublished(catalog) ? `/nationwide?county=${run.fips}` : `/nationwide?run=${run.id}`}>{run.county_name}, {run.state}</a>
            <span className="fineprint"> / {run.fips} / {run.facility_count} ranked facilities
              {run.alert_event ? ` / ${run.alert_event}` : ""} / {formatDate(run.generated_at)}</span>
          </li>)}</ul>}
        </section>}
        <section className="county-catalog-block" id="county-catalog" aria-labelledby="county-catalog-title">
          <h2 id="county-catalog-title">County catalog</h2>
          <p className="fineprint">Search and the state list stay available after the weather list. Choosing a county opens that county&apos;s audited sheet. It does not, by itself, mean the county is under a warning.</p>
        {mode === "county" && <section className="contact-form" aria-label="Search the audited county catalog">
            <label htmlFor="county-search">Search US counties by name or FIPS</label>
            <input id="county-search" type="search" value={countyQuery} disabled={busy}
              onChange={event => setCountyQuery(event.target.value)} placeholder="Baldwin, Doña Ana, or 01003" />
            {catalog && !!countyQuery.trim() && <>
              <p role="status">{countyMatches.length} matching source counties. Select the state and county you mean.</p>
              <ul>{countyMatches.slice(0, 20).map(item => <li key={item.fips} className="catalog-match">
                <label><input type="checkbox" checked={shortlist.includes(item.fips)} onChange={() => changeShortlist(item.fips, true)} aria-label={`Add ${item.name}, ${item.state} / ${item.fips} to the shortlist`} /></label>
                <button type="button" disabled={busy} onClick={() => {
                  setState(item.state); setCounty(item.fips); setCountyQuery(""); setJob(null);
                }}>{item.name}, {item.state} / {item.fips}</button>
              </li>)}</ul>
              {countyMatches.length > 20 && <p className="fineprint">Showing the first 20 source matches. Add a state abbreviation to narrow the search.</p>}
              {!countyMatches.length && <p>No source county matches this name or FIPS. Try another name or use the state list. No county is guessed.</p>}
            </>}
          </section>}
        {catalog && <>
          <p className="fineprint">{catalog.catalog.counties.length} official Census county entries. Zetaris catalog query {catalog.catalog.data_access.zetaris_query_ids.join(", ")}.
            {catalogIsPublished(catalog) && <> Published sweep {catalog.publication?.sweep_run_id || catalog.catalog.data_access.publication?.sweep_run_id}: {catalog.catalog.data_access.publication?.ranked_counties ?? "?"} counties with ranked facilities. Hosted clicks open frozen audited snapshots; live model POST stays local.</>}
            {" "}Being on this list is not a ranking. A run returns that county&apos;s own rows and gaps.</p>
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
                    {orderedAlerts.map(row => <option key={row.id} value={row.id}>{row.event} / {row.areaDesc} / {row.county_fips.length ? `${row.county_fips.length} source ${row.county_fips.length === 1 ? "county" : "counties"}` : "no source county mapping"}</option>)}
                  </select>
                  {catalog.weather.captured_at && <p className="fineprint">Feed captured {formatDate(catalog.weather.captured_at)}. Alerts can expire after capture.</p>}
                  {selectedAlert && <p className="fineprint">{selectedAlert.county_fips.length} source-mapped counties. Mapping: {selectedAlert.mapping_status}. <a href={selectedAlert.id} target="_blank" rel="noreferrer">Inspect the original NWS record</a></p>}
                  {alertUnmapped && <p className="watch-error" role="alert">No source county maps to this alert, so there is nothing to run. Choose a mapped alert, or run the county you mean through county discovery.</p>}
                </>}
            </>}
            <button className="primary-button" type="submit" disabled={busy || loading ||
              (mode === "county" ? !county : !selectedAlert || alertUnmapped)}>
              {busy ? "Processing verified sources..." :
                catalogIsPublished(catalog) && mode === "county" ? "Open published audited call sheet" :
                "Build sourced call sheet and grounded drafts"}
            </button>
            <p className="fineprint">Nemotron only, through Meterless. Approved free NVIDIA route only. A failed draft is kept, retried at most once and never replaced with invented text. The shared call cap can leave drafts unattempted.</p>
          </form>
        </>}
        </section>
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
