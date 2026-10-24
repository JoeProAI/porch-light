"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate, formatDateEt, parseContacts } from "@/lib/operator";
import { hasAlertShape } from "@/lib/geo";
import { derivedFrameTime, IEM_CLOCK_URL, parseIemClock, radarFrames, type IemClock, type RadarFrame } from "@/lib/radar-frames";
import { weatherFreshness, type LiveWeather, type OfficialAlert } from "@/lib/weather-types";
import type { Provenance, Snapshot } from "@/lib/types";
import { EvidenceDrawer } from "./evidence-drawer";
import { Masthead } from "./masthead";
import { StormMap, type StormMapApi, type StormMapStatus } from "./storm-map";

const severities = ["Extreme", "Severe", "Moderate", "Minor", "Unknown"] as const;

export const StormWatch = ({ snapshot, provenance, sheetError }: {
  snapshot: Snapshot | null; provenance: Provenance | null; sheetError: string;
}) => {
  const facilities = snapshot?.facilities ?? [];
  const mapApi = useRef<StormMapApi>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const [data, setData] = useState<LiveWeather | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(0);
  const [offline, setOffline] = useState(false);
  const [frameIndex, setFrameIndex] = useState(radarFrames.length - 1);
  const [playing, setPlaying] = useState(false);
  const [clock, setClock] = useState<IemClock | null>(null);
  const [clockLoading, setClockLoading] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [radarVisible, setRadarVisible] = useState(true);
  const [radarOpacity, setRadarOpacity] = useState(0.45);
  const [porchId, setPorchId] = useState(facilities[0]?.id ?? "");
  const [flash, setFlash] = useState(false);
  const seenAlerts = useRef<Set<string> | null>(null);
  const [alertsVisible, setAlertsVisible] = useState(true);
  const [basemapStatus, setBasemapStatus] = useState<StormMapStatus>("loading");
  const [radarStatus, setRadarStatus] = useState<StormMapStatus>("loading");
  const [mapGeneration, setMapGeneration] = useState(0);
  const [radarRetry, setRadarRetry] = useState(0);
  const [locateMessage, setLocateMessage] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const timeout = AbortSignal.timeout(30000);
      const response = await fetch("/api/weather", {
        cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!response.ok) throw new Error("Audited weather feed unavailable");
      const next = await response.json() as LiveWeather;
      if (next.schema_version !== "porch-light.live-weather.v1" ||
        !Array.isArray(next.alerts) || !next.data_access?.zetaris_query_ids.length) {
        throw new Error("Weather audit evidence missing");
      }
      setData(next);
      setSelectedId(previous => next.alerts.some(alert => alert.id === previous) ? previous : "");
      setError("");
      setNow(Date.now());
    } catch (failure) {
      if (!(failure instanceof DOMException && failure.name === "AbortError")) {
        setError("The latest weather feed couldn't be read. Anything still on screen keeps its original capture time.");
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => setReduced(motion.matches);
    applyMotion();
    motion.addEventListener("change", applyMotion);
    const connection = () => setOffline(!navigator.onLine);
    connection();
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    void refresh(controller.signal);
    const timer = window.setInterval(() => { void refresh(controller.signal); }, 60000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.clearInterval(clockTimer);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      motion.removeEventListener("change", applyMotion);
    };
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(IEM_CLOCK_URL, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("clock");
        const parsed = parseIemClock(await response.json());
        if (!parsed) throw new Error("clock");
        setClock(parsed);
        setRadarRetry(value => value + 1);
      } catch (failure) {
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        setClock(null);
      } finally { setClockLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setFrameIndex(index => (index + 1) % radarFrames.length), 900);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => { if (radarStatus === "error" || !radarVisible) setPlaying(false); }, [radarStatus, radarVisible]);

  useEffect(() => {
    if (!snapshot) return;
    const key = `porch-light:contacts:v1:${snapshot.source_snapshot_hash}`;
    const read = () => {
      try {
        const stored = parseContacts(localStorage.getItem(key), snapshot.facilities);
        const next = [...snapshot.facilities].sort((a, b) => a.rank - b.rank)
          .find(item => !stored[item.id] || stored[item.id].status === "uncontacted");
        setPorchId(next?.id ?? "");
      } catch { setPorchId(snapshot.facilities[0]?.id ?? ""); }
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [snapshot]);

  useEffect(() => {
    if (!data) return;
    const ids = data.alerts.map(alert => alert.id);
    if (seenAlerts.current === null) {
      seenAlerts.current = new Set(ids);
      return;
    }
    const arrived = data.alerts.some(alert => !seenAlerts.current?.has(alert.id) && (alert.severity === "Severe" || alert.severity === "Extreme"));
    ids.forEach(id => seenAlerts.current?.add(id));
    if (!arrived || reduced) return;
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 480);
    return () => window.clearTimeout(timer);
  }, [data, reduced]);

  const frame = radarFrames[frameIndex] ?? radarFrames[radarFrames.length - 1];
  const derived = clock ? derivedFrameTime(clock.latest, frame.offsetMinutes) : null;
  const frameClock = frameClockLabel(derived);
  const radarStatusLine = clockLoading
    ? `${playing ? "Playing" : "Paused"} · checking radar time`
    : frameClock
      ? `${playing ? "Playing" : "Paused"} · ${frameClock} frame`
      : `${playing ? "Playing" : "Paused"} · radar time unknown`;
  const freshness = data ? weatherFreshness(data.captured_at, now || Date.now()) : "unverified";
  const filtered = data?.alerts.filter(alert => (
    `${alert.event ?? ""} ${alert.areaDesc ?? ""} ${alert.headline ?? ""}`
  ).toLowerCase().includes(search.toLowerCase().trim())) ?? [];
  const shaped = filtered.filter(alert => hasAlertShape(alert.geometry));
  const shapeless = filtered.filter(alert => !hasAlertShape(alert.geometry));
  const selected = data?.alerts.find(alert => alert.id === selectedId);
  const expired = selected?.expires ? Date.parse(selected.expires) <= (now || Date.now()) : false;
  const facility = facilities.find(row => row.id === facilityId);
  const locating = locateMessage === "Asking this browser for a location.";

  const chooseAlert = (id: string) => {
    setSelectedId(id);
    const alert = data?.alerts.find(item => item.id === id);
    if (alert && hasAlertShape(alert.geometry)) mapApi.current?.fitGeometry(alert.geometry);
    window.requestAnimationFrame(() => detailHeading.current?.focus());
  };
  const openEvidence = (id: string) => { setFacilityId(id); setEvidenceOpen(true); };

  return (
    <div className={`watch-shell${flash ? " is-lightning" : ""}`}>
      <a className="skip-link" href="#storm-chart">Skip to chart</a>
      <Masthead edition="US weather" />
      <main>
        <div className="watch-stage">
          <section className="watch-map-pane" aria-labelledby="radar-title">
            <div className="watch-map-bar">
              <div>
                <p className="eyebrow">Official observations / US alert discovery</p>
                <h1>Watch the weather. <em>Keep the source in view.</em></h1>
              </div>
              <div className="watch-status" role="status" aria-live="polite">
                <span className={`weather-state ${freshness}`}>{!data ? (loading ? "Connecting to the weather feed" : "Weather feed unavailable") : freshness === "recent" ? "Recent official capture" : "This capture is out of date"}</span>
                {offline && <span>Offline. No new source updates are available.</span>}
                {data && <><time dateTime={data.captured_at}>{formatDateEt(data.captured_at)}</time><span>Source capture age: {Math.max(0, Math.floor(((now || Date.now()) - Date.parse(data.captured_at)) / 60000))} minutes</span></>}
                <button type="button" onClick={() => void refresh()} disabled={loading} aria-busy={loading}>{loading ? "Reading sources..." : "Refresh weather"}</button>
              </div>
            </div>
            {error && <p className="watch-error" role="alert">{error}</p>}
            {data && freshness !== "recent" && <div className="watch-error" role="alert"><p>This capture isn't recent. Don't treat the displayed weather or alert list as current. Use the official source links.</p><p>The local capture worker may be stopped or an upstream source may be unavailable. Refreshing this page only rereads the stored capture. On this machine, run <code>.\Start-Local.ps1</code> from the repository root to start a bounded worker if none is running.</p><a href="https://www.weather.gov/" target="_blank" rel="noreferrer">Check current weather warnings</a></div>}
            <div className="watch-map-frame" id="storm-chart">
              <h2 id="radar-title" className="radar-title">Observed radar. Real warning shapes.</h2>
              <div className="map-toolbar" role="toolbar" aria-label="Chart controls">
                <button type="button" onClick={() => mapApi.current?.national()} disabled={basemapStatus !== "ready"}>National view</button>
                <button type="button" onClick={() => selected && hasAlertShape(selected.geometry) && mapApi.current?.fitGeometry(selected.geometry)} disabled={!selected || !hasAlertShape(selected?.geometry)}>Fit selected alert</button>
                <button type="button" onClick={() => mapApi.current?.fitFacilities()} disabled={!facilities.length || basemapStatus !== "ready"}>Fit ranked facilities</button>
                <button type="button" onClick={() => mapApi.current?.locate()} disabled={basemapStatus !== "ready" || locating} aria-busy={locating}>{locating ? "Locating…" : "Locate"}</button>
                <button type="button" onClick={() => mapApi.current?.zoomBy(1.6)} disabled={basemapStatus !== "ready"} aria-label="Zoom in">Zoom in</button>
                <button type="button" onClick={() => mapApi.current?.zoomBy(1 / 1.6)} disabled={basemapStatus !== "ready"} aria-label="Zoom out">Zoom out</button>
                <button type="button" aria-pressed={alertsVisible} onClick={() => setAlertsVisible(value => !value)}>Alert shapes: {alertsVisible ? "on" : "off"}</button>
              </div>
              <div className="storm-stage">
                <StormMap key={mapGeneration} ref={mapApi} alerts={data?.alerts ?? []} facilities={facilities}
                  selectedAlertId={selectedId} selectedFacilityId={facilityId} frameId={frame.id}
                  radarVisible={radarVisible} radarOpacity={radarOpacity} playing={playing} porchId={porchId}
                  alertsVisible={alertsVisible} radarRetry={radarRetry} reducedMotion={reduced}
                  onSelectAlert={chooseAlert} onSelectFacility={openEvidence}
                  onBasemapStatus={setBasemapStatus} onRadarStatus={setRadarStatus} onLocateResult={setLocateMessage} />
                {basemapStatus === "loading" && <p className="map-status-note" role="status">Opening the night chart.</p>}
                {basemapStatus === "error" && <div className="map-failure" role="alert"><h3>The base map didn't load.</h3><p>The street map didn't return. No substitute imagery is drawn.</p><button type="button" onClick={() => { setBasemapStatus("loading"); setMapGeneration(value => value + 1); }}>Retry base map</button></div>}
                {basemapStatus === "ready" && radarVisible && radarStatus === "error" && <div className="map-failure radar-failure" role="alert"><h3>Radar tiles didn't load.</h3><p>The national radar service didn't return this frame. No substitute image is drawn.</p><button type="button" onClick={() => setRadarRetry(value => value + 1)}>Retry radar tiles</button></div>}
              </div>
              <div className="radar-controls">
                <button type="button" className="radar-play" aria-pressed={playing} aria-label={playing ? "Pause radar" : "Play radar"}
                  disabled={!radarVisible || radarStatus === "error" || basemapStatus !== "ready"}
                  onClick={() => setPlaying(value => !value)}>{playing ? "Pause" : "Play"}</button>
                <p className="radar-readout" role="status"><span>{radarStatusLine}</span></p>
                <label className="radar-frame">Radar frame
                  <select value={frame.id} onChange={event => {
                    setPlaying(false);
                    const index = radarFrames.findIndex(item => item.id === event.target.value);
                    if (index >= 0) setFrameIndex(index);
                  }}>
                    {radarFrames.map(item => <option key={item.id} value={item.id}>{frameOptionLabel(item, clock?.latest ?? null)}</option>)}
                  </select>
                </label>
                <label className="radar-opacity">Radar opacity
                  <input type="range" min={0} max={100} step={1} value={Math.round(radarOpacity * 100)}
                    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(radarOpacity * 100)}
                    aria-valuetext={`${Math.round(radarOpacity * 100)} percent`}
                    onChange={event => setRadarOpacity(Number(event.target.value) / 100)} />
                  <span>{Math.round(radarOpacity * 100)}%</span>
                </label>
                <button type="button" aria-pressed={radarVisible} onClick={() => setRadarVisible(value => !value)}>Radar layer: {radarVisible ? "on" : "off"}</button>
                <ul className="severity-legend" aria-label="Alert severity colors">{severities.map(severity => <li key={severity}><i data-severity={severity} />{severity}</li>)}</ul>
                <p className="radar-coverage">National radar, contiguous US only. Roads stay visible. Not a forecast or a call ranking.</p>
                {reduced && <p className="radar-note">Reduced motion is on. Press Play to move the radar.</p>}
                {locateMessage && <p className="radar-note">{locateMessage}</p>}
                {sheetError && <p className="radar-note">{sheetError}</p>}
              </div>
            </div>
          </section>
          <aside className="watch-alert-pane" aria-label="Official alerts">
            {!data && loading && <section className="watch-loading" aria-busy="true"><span className="eyebrow">Checking the weather source</span><h2>Checking the saved weather capture.</h2><p>No sample warnings or replacement radar are used.</p></section>}
            {!data && !loading && <section className="watch-loading"><h2>Weather data is unavailable.</h2><p>The weather connection needs attention. No cached example is passed off as live.</p><button type="button" onClick={() => void refresh()}>Retry weather</button></section>}
            {data && <>
              <div className="alert-list-heading"><span className="eyebrow">US National Weather Service feed</span><h2 id="national-alerts-title">{data.alerts.length} source alerts.</h2><p>Warnings, watches and advisories as published at capture time. Alerts may expire between captures. Times below are Eastern. The evidence clock keeps UTC.</p></div>
              <label className="alert-search">Find a place or event<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Try Florida, flood or wind" type="search" /></label>
              <p className="fineprint">{filtered.length} matching source records</p>
              {!filtered.length && <div className="empty-state"><h3>No matching source alerts.</h3><p>{search ? "Try another place or event. No alert has been invented to fill this view." : "The official source returned no active alerts in this capture."}</p>{search && <button type="button" onClick={() => setSearch("")}>Clear search</button>}</div>}
              {!!filtered.length && <>
                <ol className="official-alert-list">{shaped.map(alert => <li key={alert.id}><AlertButton alert={alert} selected={selectedId === alert.id} onChoose={chooseAlert} /></li>)}</ol>
                <section className="shapeless-alerts" aria-label="Alerts with no shape from NWS">
                  <h3>No shape from NWS</h3>
                  {shapeless.length ? <ul>{shapeless.map(alert => <li key={alert.id}><AlertButton alert={alert} selected={selectedId === alert.id} onChoose={chooseAlert} shapeless /></li>)}</ul>
                    : <p>{search ? "No alerts without a shape match this search." : "Every alert in this capture included a shape."}</p>}
                </section>
              </>}
              <div className="official-alert-detail" aria-label="Selected official alert">
                {selected ? <>
                  <span className="eyebrow">Official source, not model advice</span>
                  <h2 ref={detailHeading} tabIndex={-1}>{selected.event ?? "Selected alert"}</h2>
                  <p className="alert-area">{selected.areaDesc ?? "Area description not supplied"}</p>
                  <p>{selected.senderName ?? "Issuing office not supplied"}</p>
                  <dl className="alert-times">
                    <dt>Effective</dt><dd>{selected.effective ? <time dateTime={selected.effective}>{formatDateEt(selected.effective)}</time> : "Not supplied"}</dd>
                    <dt>Expires</dt><dd>{selected.expires ? <time dateTime={selected.expires}>{formatDateEt(selected.expires)}</time> : "Not supplied"}{expired ? " / expired since capture" : ""}</dd>
                  </dl>
                  <details className="evidence-clock"><summary>Evidence clock, UTC</summary>
                    <p>Effective {selected.effective ? formatDate(selected.effective) : "Not supplied"}</p>
                    <p>Expires {selected.expires ? formatDate(selected.expires) : "Not supplied"}</p>
                    <p>Capture {formatDate(data.captured_at)}</p>
                  </details>
                  {selected.headline && <h3>{selected.headline}</h3>}
                  {selected.description && <p className="official-instructions">{selected.description}</p>}
                  <h3>Official instructions</h3>
                  <p className="official-instructions">{selected.instruction ?? "No instructions supplied in this source record. Consult the issuing NWS office."}</p>
                  <h3>Care-facility source chain</h3>
                  <p>Warning coverage and the care-facility sources are checked against the audited data connection. The Manatee pins are a past example, not a match to this alert.</p>
                  {freshness === "recent" && !expired && <Link className="entry-secondary" href={`/nationwide?alert=${encodeURIComponent(selected.id)}`}>Build the sourced care-facility call sheet</Link>}
                  <a href={selected.id} target="_blank" rel="noreferrer" className="entry-secondary">Inspect original NWS record</a>
                  <p className="fineprint">Zetaris query {selected.zetaris_query_ids.join(", ")}</p>
                </> : <><h2 ref={detailHeading} tabIndex={-1}>No alert selected.</h2><p>Select an actual source alert from the list or the chart. No warning text is synthesized.</p></>}
              </div>
            </>}
          </aside>
        </div>
        <section className="watch-evidence">
          <span className="eyebrow">Capture and audit evidence</span>
          {!!facilities.length && <details><summary>Select a retrospective Manatee facility without overlapping pins</summary>
            <label className="alert-search">Retrospective facility<select aria-label="Retrospective facility" value={facilityId} onChange={event => setFacilityId(event.target.value)}>
              <option value="">Choose a source facility</option>
              {facilities.map(item => <option key={item.id} value={item.id}>Rank {item.rank}, {item.name}</option>)}
            </select></label>
            <button type="button" disabled={!facility} onClick={() => facility && openEvidence(facility.id)}>Inspect selected facility evidence</button>
          </details>}
          {data ? <>
            <p>Zetaris query <code>{data.data_access.zetaris_query_ids.join(", ")}</code> / automatic view refresh every minute / source ingestion targets five-minute captures.</p>
            <p>Map radar uses captured national radar images, checked against the audited source. These aren't a separate observation loop. Alert text and shapes keep their own source record.</p>
            <ul>{data.limits.map(limit => <li key={limit}>{limit}</li>)}</ul>
            <p className="fineprint">National weather isn't proof of rankable care-facility coverage. Run the actual source chain for a county or alert. Manatee remains the separate retrospective walkthrough.</p>
          </> : <p>No audited capture is loaded. The street map can stay up. Manatee pins are a past example, not current facility conditions. No alerts are invented.</p>}
        </section>
      </main>
      <footer className="entry-footer"><Link className="wordmark" href="/">Porch Light.</Link><p>Follow official warnings. No patient tracking. No inferred outages or facility conditions.</p><Link href="/#resources">Related official resources</Link></footer>
      {facility && snapshot && provenance && <EvidenceDrawer row={facility} snapshot={snapshot} provenance={provenance} open={evidenceOpen} onClose={() => {
        setEvidenceOpen(false);
        document.querySelector<HTMLElement>(`[data-facility-id="${CSS.escape(facility.id)}"]`)?.focus();
      }} />}
    </div>
  );
};

const frameClockLabel = (iso: string | null): string | null => {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  }).format(parsed) + " ET";
};

const frameOptionLabel = (item: RadarFrame, latest: string | null): string => {
  const time = latest ? frameClockLabel(derivedFrameTime(latest, item.offsetMinutes)) : null;
  if (item.offsetMinutes === 0) return time ? `${time} (latest)` : "Latest";
  return time ? `${time} (${item.offsetMinutes} min ago)` : `${item.offsetMinutes} min ago`;
};

const AlertButton = ({ alert, selected, onChoose, shapeless = false }: {
  alert: OfficialAlert; selected: boolean; onChoose: (id: string) => void; shapeless?: boolean;
}) => (
  <button type="button" aria-pressed={selected} onClick={() => onChoose(alert.id)}>
    <span className="alert-severity" data-severity={alert.severity ?? "Unknown"}>{alert.severity ?? "Severity not supplied"}</span>
    <strong>{alert.event ?? "Event name not supplied"}</strong>
    <span>{alert.areaDesc ?? "Area description not supplied"}{shapeless ? " · no shape from NWS" : ""}</span>
  </button>
);
