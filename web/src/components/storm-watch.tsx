"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate, formatDateEt, formatPhone } from "@/lib/operator";
import { facilitiesInside, hasAlertShape } from "@/lib/geo";
import { derivedFrameTime, IEM_CLOCK_URL, parseIemClock, radarFrames, type IemClock } from "@/lib/radar-frames";
import { weatherFreshness, type LiveWeather, type OfficialAlert } from "@/lib/weather-types";
import type { Provenance, Snapshot } from "@/lib/types";
import { EvidenceDrawer } from "./evidence-drawer";
import { StormMap, type StormMapApi, type StormMapStatus } from "./storm-map";
import { WatchBezel } from "./watch-bezel";

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
  const [clockError, setClockError] = useState("");
  const [clockLoading, setClockLoading] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [radarVisible, setRadarVisible] = useState(true);
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
        setError("The latest audited feed couldn't be read. Any retained observations below keep their original capture time.");
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
        setClockError("");
      } catch (failure) {
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        setClock(null);
        setClockError("IEM composite time unavailable. The frame label is the layer offset only.");
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

  useEffect(() => { if (radarStatus === "error") setPlaying(false); }, [radarStatus]);

  const frame = radarFrames[frameIndex] ?? radarFrames[radarFrames.length - 1];
  const derived = clock ? derivedFrameTime(clock.latest, frame.offsetMinutes) : null;
  const freshness = data ? weatherFreshness(data.captured_at, now || Date.now()) : "unverified";
  const filtered = data?.alerts.filter(alert => (
    `${alert.event ?? ""} ${alert.areaDesc ?? ""} ${alert.headline ?? ""}`
  ).toLowerCase().includes(search.toLowerCase().trim())) ?? [];
  const shaped = filtered.filter(alert => hasAlertShape(alert.geometry));
  const shapeless = filtered.filter(alert => !hasAlertShape(alert.geometry));
  const selected = data?.alerts.find(alert => alert.id === selectedId);
  const expired = selected?.expires ? Date.parse(selected.expires) <= (now || Date.now()) : false;
  const inside = selected && hasAlertShape(selected.geometry) ? facilitiesInside(facilities, selected.geometry) : [];
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
    <div className="watch-shell">
      <a className="skip-link" href="#storm-chart">Skip to chart</a>
      <header className="entry-header watch-header">
        <Link href="/" className="wordmark">Porch Light<span className="wordmark-period">.</span></Link>
        <span className="entry-category">Storm Watch</span>
        <nav aria-label="Project navigation"><Link href="/">About the project</Link><Link href="/operate">Manatee call sheet</Link></nav>
      </header>
      <main>
        <div className="watch-stage">
          <section className="watch-map-pane" aria-labelledby="radar-title">
            <div className="watch-map-bar">
              <div>
                <p className="eyebrow">Official observations / US alert discovery</p>
                <h1>Watch the weather. <em>Keep the source in view.</em></h1>
              </div>
              <div className="watch-status" role="status" aria-live="polite">
                <span className={`weather-state ${freshness}`}>{!data ? (loading ? "Connecting to audited feed" : "Audited feed unavailable") : freshness === "recent" ? "Recent official capture" : "Stale or unverified capture"}</span>
                {offline && <span>Offline. No new source updates are available.</span>}
                {data && <><time dateTime={data.captured_at}>{formatDateEt(data.captured_at)}</time><span>Source capture age: {Math.max(0, Math.floor(((now || Date.now()) - Date.parse(data.captured_at)) / 60000))} minutes</span></>}
                <button type="button" onClick={() => void refresh()} disabled={loading} aria-busy={loading}>{loading ? "Reading sources..." : "Refresh displayed feed"}</button>
              </div>
            </div>
            {error && <p className="watch-error" role="alert">{error}</p>}
            {data && freshness !== "recent" && <div className="watch-error" role="alert"><p>This capture isn't recent. Don't treat the displayed weather or alert list as current. Use the official source links.</p><p>The local capture worker may be stopped or an upstream source may be unavailable. Refreshing this page only rereads the stored capture. On this machine, run <code>.\Start-Local.ps1</code> from the repository root to start a bounded worker if none is running.</p><a href="https://www.weather.gov/" target="_blank" rel="noreferrer">Check current NWS warnings</a></div>}
            <div className="watch-map-frame" id="storm-chart">
              <h2 id="radar-title" className="radar-title">Observed radar. Real warning shapes.</h2>
              <p className="radar-coverage">Iowa Environmental Mesonet NEXRAD composite, contiguous US only. County lines, cities, and roads stay visible. Not a forecast, and not a care-facility ranking.</p>
              <StormMap key={mapGeneration} ref={mapApi} alerts={data?.alerts ?? []} facilities={facilities}
                selectedAlertId={selectedId} selectedFacilityId={facilityId} frameId={frame.id}
                radarVisible={radarVisible} alertsVisible={alertsVisible} radarRetry={radarRetry} reducedMotion={reduced}
                onSelectAlert={chooseAlert} onSelectFacility={openEvidence}
                onBasemapStatus={setBasemapStatus} onRadarStatus={setRadarStatus} onLocateResult={setLocateMessage} />
              <div className="map-toolbar" role="toolbar" aria-label="Chart controls">
                <button type="button" onClick={() => mapApi.current?.national()} disabled={basemapStatus !== "ready"}>National view</button>
                <button type="button" onClick={() => selected && hasAlertShape(selected.geometry) && mapApi.current?.fitGeometry(selected.geometry)} disabled={!selected || !hasAlertShape(selected?.geometry)}>Fit selected alert</button>
                <button type="button" onClick={() => mapApi.current?.fitFacilities()} disabled={!facilities.length || basemapStatus !== "ready"}>Fit ranked facilities</button>
                <button type="button" onClick={() => mapApi.current?.locate()} disabled={basemapStatus !== "ready" || locating} aria-busy={locating}>{locating ? "Locating…" : "Locate"}</button>
                <button type="button" onClick={() => mapApi.current?.zoomBy(1.6)} disabled={basemapStatus !== "ready"} aria-label="Zoom in">Zoom in</button>
                <button type="button" onClick={() => mapApi.current?.zoomBy(1 / 1.6)} disabled={basemapStatus !== "ready"} aria-label="Zoom out">Zoom out</button>
                <button type="button" aria-pressed={radarVisible} onClick={() => setRadarVisible(value => !value)}>Radar layer: {radarVisible ? "on" : "off"}</button>
                <button type="button" aria-pressed={alertsVisible} onClick={() => setAlertsVisible(value => !value)}>Alert shapes: {alertsVisible ? "on" : "off"}</button>
              </div>
              <div className="watch-hud">
                <WatchBezel label="Radar loop frames" ticks={radarFrames.map(item => ({ id: item.id, label: item.label, mark: item.offsetMinutes === 0 ? "Now" : String(item.offsetMinutes) }))}
                  selectedId={frame.id} onSelect={id => { setPlaying(false); setFrameIndex(Math.max(0, radarFrames.findIndex(item => item.id === id))); }}
                  centerLabel={playing ? "Pause radar loop" : "Play radar loop"} centerMark={playing ? "Pause" : "Play"} centerPressed={playing}
                  centerDisabled={radarStatus === "error" || basemapStatus !== "ready"} onCenter={() => setPlaying(value => !value)} />
                <div className="radar-clock" role="status">
                  <p className="eyebrow">{frame.label}</p>
                  {derived && clock ? (frame.offsetMinutes === 0
                    ? <p>Latest IEM N0Q composite <time dateTime={clock.latest}>{formatDateEt(clock.latest)}</time>.</p>
                    : <p>Derived clock <time dateTime={derived}>{formatDateEt(derived)}</time>. IEM reported the latest composite at {formatDateEt(clock.latest)}; this layer is that scan minus {frame.offsetMinutes} minutes.</p>)
                    : <p>{clockLoading ? "Reading the IEM composite clock." : clockError}</p>}
                  {reduced && <p>Reduced motion is on. The loop stays parked until you press play or choose a frame.</p>}
                  {locateMessage && <p>{locateMessage}</p>}
                  {sheetError && <p>{sheetError}</p>}
                </div>
                <ul className="severity-legend" aria-label="Alert severity colors">{severities.map(severity => <li key={severity}><i data-severity={severity} />{severity}</li>)}</ul>
              </div>
              {basemapStatus === "loading" && <p className="map-status-note" role="status">Opening the night chart.</p>}
              {basemapStatus === "error" && <div className="map-failure" role="alert"><h3>The base map didn't load.</h3><p>OpenFreeMap didn't return the night style. No substitute imagery is drawn.</p><button type="button" onClick={() => { setBasemapStatus("loading"); setMapGeneration(value => value + 1); }}>Retry base map</button></div>}
              {basemapStatus === "ready" && radarVisible && radarStatus === "error" && <div className="map-failure radar-failure" role="alert"><h3>Radar tiles didn't load.</h3><p>Iowa Environmental Mesonet didn't return this NEXRAD frame. No substitute echo is drawn.</p><button type="button" onClick={() => setRadarRetry(value => value + 1)}>Retry radar tiles</button></div>}
            </div>
          </section>
          <aside className="watch-alert-pane" aria-label="Official alerts">
            {!data && loading && <section className="watch-loading" aria-busy="true"><span className="eyebrow">Reading through Zetaris</span><h2>Checking the national source capture.</h2><p>No sample warnings or replacement radar are used.</p></section>}
            {!data && !loading && <section className="watch-loading"><h2>Weather data is unavailable.</h2><p>The local ingest worker, Zetaris connection or source verification needs attention. No cached example is passed off as live.</p><button type="button" onClick={() => void refresh()}>Retry audited weather</button></section>}
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
                    : <p>Every alert in this capture included a shape.</p>}
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
                  <h3>Facilities inside this alert</h3>
                  {!hasAlertShape(selected.geometry) ? <p>Not ranked yet. This record has no shape from NWS, so no facility coordinate was tested against it. National weather is not a national care-facility ranking.</p>
                    : inside.length ? <>
                      <p>These retrospective Manatee rows fall inside the published shape. This is not a new national ranking.</p>
                      <ul className="inside-facilities">{inside.map(row => <li key={row.id}><button type="button" onClick={() => openEvidence(row.id)}>Rank {row.rank}, {row.name}</button><span>{formatPhone(row.phone.value)}</span></li>)}</ul>
                    </> : <p>Not ranked yet. National weather is not a national care-facility ranking. The only ranked sheet here is the retrospective Manatee County snapshot, and none of those ranked coordinates fall inside this alert&apos;s published shape.</p>}
                  <a href={selected.id} target="_blank" rel="noreferrer" className="entry-secondary">Inspect original NWS record</a>
                  <p className="fineprint">Zetaris query {selected.zetaris_query_ids.join(", ")}</p>
                </> : <><h2 ref={detailHeading} tabIndex={-1}>No alert selected.</h2><p>Select an actual source alert from the list or the chart. No warning text is synthesized.</p></>}
              </div>
            </>}
          </aside>
        </div>
        <section className="watch-evidence">
          <span className="eyebrow">Capture and audit evidence</span>
          {data ? <>
            <p>Zetaris query <code>{data.data_access.zetaris_query_ids.join(", ")}</code> / automatic view refresh every minute / source ingestion targets five-minute captures.</p>
            <p>Map radar is the public Iowa Environmental Mesonet NEXRAD composite. It is not the audited NOAA file stored for this capture. Alert text and shapes come from the audited feed when that feed can be read.</p>
            <ul>{data.limits.map(limit => <li key={limit}>{limit}</li>)}</ul>
            <p className="fineprint">National weather discovery isn't national care-facility ranking. The verified ranked demonstration remains Manatee.</p>
          </> : <p>No audited capture is loaded. The chart can still show the public base map, the IEM radar composite, and ranked Manatee pins. It will not invent alerts.</p>}
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

const AlertButton = ({ alert, selected, onChoose, shapeless = false }: {
  alert: OfficialAlert; selected: boolean; onChoose: (id: string) => void; shapeless?: boolean;
}) => (
  <button type="button" aria-pressed={selected} onClick={() => onChoose(alert.id)}>
    <span className="alert-severity" data-severity={alert.severity ?? "Unknown"}>{alert.severity ?? "Severity not supplied"}</span>
    <strong>{alert.event ?? "Event name not supplied"}</strong>
    <span>{alert.areaDesc ?? "Area description not supplied"}{shapeless ? " · no shape from NWS" : ""}</span>
  </button>
);
