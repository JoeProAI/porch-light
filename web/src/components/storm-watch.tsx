"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatDate } from "@/lib/operator";
import { weatherFreshness, type LiveWeather } from "@/lib/weather-types";
import { RadarMap } from "./radar-map";

export const StormWatch = () => {
  const [data, setData] = useState<LiveWeather | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(0);
  const [radarError, setRadarError] = useState(false);
  const [radarLoaded, setRadarLoaded] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);
  const [animateRadar, setAnimateRadar] = useState(false);
  const [offline, setOffline] = useState(false);
  const [radarView, setRadarView] = useState<"map" | "loop">("map");

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
      setSelectedId(previous => next.alerts.some(alert => alert.id === previous) ? previous : next.alerts[0]?.id ?? "");
      setRadarError(false);
      setRadarLoaded(false);
      setImageVersion(previous => previous + 1);
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
    setAnimateRadar(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const connection = () => setOffline(!navigator.onLine);
    connection();
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    void refresh(controller.signal);
    const timer = window.setInterval(() => { void refresh(controller.signal); }, 60000);
    const clock = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      controller.abort(); window.clearInterval(timer); window.clearInterval(clock);
      window.removeEventListener("online", connection); window.removeEventListener("offline", connection);
    };
  }, [refresh]);

  const freshness = data ? weatherFreshness(data.captured_at, now || Date.now()) : "unverified";
  const filtered = data?.alerts.filter(alert => (
    `${alert.event ?? ""} ${alert.areaDesc ?? ""} ${alert.headline ?? ""}`
  ).toLowerCase().includes(search.toLowerCase().trim())) ?? [];
  const selected = filtered.find(alert => alert.id === selectedId);
  const expired = selected?.expires ? Date.parse(selected.expires) <= now : false;
  const radarStale = data?.radar.provider_last_modified ?
    now - Date.parse(data.radar.provider_last_modified) > 1200000 : true;

  return (
    <div className="watch-shell">
      <header className="entry-header">
        <Link href="/" className="wordmark">Porch Light<span className="wordmark-period">.</span></Link>
        <span className="entry-category">Storm Watch</span>
        <nav aria-label="Project navigation"><Link href="/">About the project</Link><Link href="/operate">Manatee call sheet</Link></nav>
      </header>
      <main>
        <section className="watch-intro">
          <div><p className="eyebrow">Official observations / US alert discovery</p><h1>Watch the weather.<br /><em>Keep the source in view.</em></h1><p>NOAA observed radar and National Weather Service alerts. Separate from the retrospective Manatee call sheet.</p></div>
          <div className="watch-status" role="status" aria-live="polite">
            <span className={`weather-state ${freshness}`}>{!data ? "Connecting to audited feed" : freshness === "recent" ? "Recent official capture" : "Stale or unverified capture"}</span>
            {offline && <span>Offline. No new source updates are available.</span>}
            {data && <><time dateTime={data.captured_at}>{formatDate(data.captured_at)}</time><span>Source capture age: {Math.max(0, Math.floor((now - Date.parse(data.captured_at)) / 60000))} minutes</span></>}
            <button onClick={() => void refresh()} disabled={loading}>{loading ? "Reading sources..." : "Refresh displayed feed"}</button>
          </div>
        </section>
        {error && <p className="watch-error" role="alert">{error}</p>}
        {data && freshness !== "recent" && <div className="watch-error" role="alert"><p>This capture isn't recent. Don't treat the displayed weather or alert list as current. Use the official source links.</p><p>The local capture worker may be stopped or an upstream source may be unavailable. Refreshing this page only rereads the stored capture. On this machine, run <code>.\Start-Local.ps1</code> from the repository root to start a bounded worker if none is running.</p><a href="https://www.weather.gov/" target="_blank" rel="noreferrer">Check current NWS warnings</a></div>}
        {!data && loading && <section className="watch-loading" aria-busy="true"><span className="eyebrow">Reading through Zetaris</span><h2>Checking the national source capture.</h2><p>No sample warnings or replacement radar are used.</p></section>}
        {!data && !loading && <section className="watch-loading"><h2>Weather data is unavailable.</h2><p>The local ingest worker, Zetaris connection or source verification needs attention. No cached example is passed off as live.</p><button onClick={() => void refresh()}>Retry audited weather</button></section>}
        {data && <>
          <section className="radar-stage" aria-labelledby="radar-title">
            <div className="radar-heading"><div><span className="eyebrow">NOAA / Observed precipitation</span><h2 id="radar-title">Observed radar. Real warning shapes.</h2></div><span className="radar-coverage">Night map offers available NOAA regions. The original animated loop is contiguous US only. Provider coverage can have gaps.</span></div>
            <div className="radar-view-toggle" role="group" aria-label="Radar display mode">
              <button aria-pressed={radarView === "map"} onClick={() => setRadarView("map")}>Interactive night map</button>
              <button aria-pressed={radarView === "loop"} onClick={() => setRadarView("loop")}>Original NOAA loop</button>
            </div>
            {radarView === "map" ? data.radar_maps?.available ?
              <RadarMap maps={data.radar_maps} alerts={data.alerts} selectedId={selectedId} onSelect={id => { setSelectedId(id); setSearch(""); }} captureId={data.capture_id} /> :
              <div className="radar-placeholder"><h3>Transparent radar layers aren't available in this capture.</h3><p>The original verified NOAA loop is a separate view. No basemap inversion or replacement radar is used.</p><button onClick={() => setRadarView("loop")}>View original NOAA loop</button></div> :
              <div className="radar-image">
              {!animateRadar ? <div className="radar-placeholder"><h3>Reduced motion is active.</h3><p>The official radar is an animated observed-frame loop.</p><button onClick={() => setAnimateRadar(true)}>Load animated NOAA radar</button></div> :
                radarError ? <div className="radar-placeholder" role="alert"><h3>The radar image couldn't be verified or loaded.</h3><p>Use the official radar source, or reload the last verified capture.</p><button onClick={() => void refresh()} disabled={loading}>Reload verified radar</button></div> :
                  <><img key={`${data.capture_id}:${imageVersion}`} src={data.radar.image_url} alt="Official NOAA radar observation loop for the contiguous United States, with source frame timestamps and legend" onLoad={() => setRadarLoaded(true)} onError={() => setRadarError(true)} />{!radarLoaded && <p className="radar-loading" role="status">Loading verified NOAA source bytes...</p>}</>}
            </div>}
            {radarView === "loop" && <><div className="radar-source-line">
              <span>Asset updated: {data.radar.provider_last_modified ? formatDate(data.radar.provider_last_modified) : "Not supplied by source"}{radarStale ? " / source age needs review" : ""}</span>
              <a href="https://radar.weather.gov/" target="_blank" rel="noreferrer">Open official NOAA radar</a>
            </div>
            <p className="fineprint">{data.radar.observation_time_note} Radar isn't a forecast, outage report or facility-condition report.</p></>}
          </section>
          <section className="national-alerts" aria-labelledby="national-alerts-title">
            <div className="alert-list-pane">
              <div className="alert-list-heading"><span className="eyebrow">US National Weather Service feed</span><h2 id="national-alerts-title">{data.alerts.length} source alerts.</h2><p>Warnings, watches and advisories as published at capture time. Alerts may expire between captures.</p></div>
              <label className="alert-search">Find a place or event<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Try Florida, flood or wind" type="search" /></label>
              <p className="fineprint">{filtered.length} matching source records</p>
              {!filtered.length && <div className="empty-state"><h3>No matching source alerts.</h3><p>{search ? "Try another place or event. No alert has been invented to fill this view." : "The official source returned no active alerts in this capture."}</p>{search && <button onClick={() => setSearch("")}>Clear search</button>}</div>}
              <ol className="official-alert-list">{filtered.map(alert => <li key={alert.id}>
                <button aria-pressed={selectedId === alert.id} onClick={() => setSelectedId(alert.id)}>
                  <span className="alert-severity" data-severity={alert.severity}>{alert.severity ?? "Severity not supplied"}</span>
                  <strong>{alert.event ?? "Event name not supplied"}</strong><span>{alert.areaDesc ?? "Area description not supplied"}</span>
                </button>
              </li>)}</ol>
            </div>
            <aside className="official-alert-detail" aria-label="Selected official alert">
              {selected ? <><span className="eyebrow">Official source, not model advice</span><h2>{selected.event ?? "Selected alert"}</h2><p className="alert-area">{selected.areaDesc}</p><p>{selected.senderName ?? "Issuing office not supplied"}</p>
                <dl className="alert-times"><dt>Effective</dt><dd>{selected.effective ? formatDate(selected.effective) : "Not supplied"}</dd><dt>Expires</dt><dd>{selected.expires ? formatDate(selected.expires) : "Not supplied"}{expired ? " / expired since capture" : ""}</dd></dl>
                {selected.headline && <h3>{selected.headline}</h3>}
                <p className="official-instructions">{selected.description ?? "No description supplied."}</p>
                <h3>Official instructions</h3><p className="official-instructions">{selected.instruction ?? "No instructions supplied in this source record. Consult the issuing NWS office."}</p>
                <a href={selected.id} target="_blank" rel="noreferrer" className="entry-secondary">Inspect original NWS record</a><p className="fineprint">Zetaris query {selected.zetaris_query_ids.join(", ")}</p>
                {freshness === "recent" && !expired && <a className="entry-secondary" href={`/nationwide?alert=${encodeURIComponent(selected.id)}`}>Build the sourced care-facility call sheet</a>}
                <p className="fineprint">The care-facility workbench checks actual alert geometry and source joins. A mapped alert doesn't guarantee rankable facility data. Manatee remains a separate retrospective walkthrough.</p>
              </> : <><h2>No alert selected.</h2><p>Select an actual source alert from the list. No warning text is synthesized.</p></>}
            </aside>
          </section>
          <section className="watch-evidence"><span className="eyebrow">Capture and audit evidence</span><p>Zetaris query <code>{data.data_access.zetaris_query_ids.join(", ")}</code> / automatic view refresh every minute / source ingestion targets five-minute captures.</p><ul>{data.limits.map(limit => <li key={limit}>{limit}</li>)}</ul><p className="fineprint">National weather discovery isn't national care-facility ranking. The verified ranked demonstration remains Manatee.</p></section>
        </>}
      </main>
      <footer className="entry-footer"><Link className="wordmark" href="/">Porch Light.</Link><p>Follow official warnings. No patient tracking. No inferred outages or facility conditions.</p><Link href="/#resources">Related official resources</Link></footer>
    </div>
  );
};
