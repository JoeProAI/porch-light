"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  affectedCatalogFips, catalogCountyFips, orderAffectedAlerts,
} from "@/lib/affected-alerts";
import type { CountyRecord } from "@/lib/county-search";
import { hasAlertShape } from "@/lib/geo";
import { radarFrames } from "@/lib/radar-frames";
import { formatDateEt } from "@/lib/operator";
import { weatherFreshness, type LiveWeather, type OfficialAlert } from "@/lib/weather-types";
import { CountyMap } from "./county-map";
import { StormMap, type StormMapApi, type StormMapStatus } from "../storm-map";

const shownCounties = 8;

export const StormDesk = ({
  weather, loading, error, onRetry, counties, selectedId, onSelect, onOpenCounty, busy, published, selectedCounty,
}: {
  weather: LiveWeather | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  counties: CountyRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpenCounty: (fips: string) => void;
  busy: boolean;
  published: boolean;
  selectedCounty: string;
}) => {
  const mapApi = useRef<StormMapApi>(null);
  const [basemapStatus, setBasemapStatus] = useState<StormMapStatus>("loading");
  const [radarStatus, setRadarStatus] = useState<StormMapStatus>("loading");
  const [mapGeneration, setMapGeneration] = useState(0);
  const [radarRetry, setRadarRetry] = useState(0);
  const [radarVisible, setRadarVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const catalogFips = new Set(counties.map(row => row.fips));
  const byFips = new Map(counties.map(row => [row.fips, row]));
  const affected = weather ? orderAffectedAlerts(weather.alerts, catalogFips) : [];
  const actual = weather?.alerts.filter(alert => alert.status === "Actual").length ?? 0;
  const highlighted = affectedCatalogFips(affected, catalogFips);
  const selected = affected.find(alert => alert.id === selectedId) ?? weather?.alerts.find(alert => alert.id === selectedId);
  const freshness = weather ? weatherFreshness(weather.captured_at, Date.now()) : "unverified";
  const frame = radarFrames[radarFrames.length - 1];

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(motion.matches);
    apply();
    motion.addEventListener("change", apply);
    return () => motion.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (basemapStatus === "ready" && selected && hasAlertShape(selected.geometry)) {
      mapApi.current?.fitGeometry(selected.geometry);
    }
  }, [selected, basemapStatus]);

  return <section className="storm-desk" aria-labelledby="storm-desk-title" data-live-alerts={weather?.alerts.length ?? 0} data-affected={affected.length}>
    <div className="storm-desk-heading">
      <p className="eyebrow">Active weather / National Weather Service</p>
      <h2 id="storm-desk-title">Affected areas, then the county catalog.</h2>
      {!weather && loading && <p role="status">Reading the live weather feed. No sample warnings are shown.</p>}
      {!weather && !loading && <p className="watch-error" role="alert">{error || "The live weather feed could not be read."} The county catalog stays available. <button type="button" onClick={onRetry}>Retry weather</button></p>}
      {weather && <>
        <p>{weather.alerts.length} alerts in this capture. {actual} are marked Actual. {affected.length} severe, extreme, or warning alerts are listed here. The rest of the feed stays on Storm Watch.</p>
        <p className="fineprint">
          <span className={`weather-state ${freshness}`}>{freshness === "recent" ? (weather.data_access.data_access_mode === "zetaris" ? "Recent audited capture" : "Recent NWS capture") : "This capture is out of date"}</span>
          {" "}<time dateTime={weather.captured_at}>{formatDateEt(weather.captured_at)}</time>
          {". "}{weather.data_access.source_note ?? "Audited weather capture."}
          {" "}<Link href="/watch">Open Storm Watch</Link>
        </p>
        <p className="fineprint">A county lights up only when this alert carries that Census FIPS and the county is in the catalog on screen. Area text is not a county join. Active alerts are not a drafted call sheet for every county. This desk does not run an offline DGX, H-MEM, or a World Model.</p>
      </>}
    </div>
    <div className="storm-stage national-storm-stage">
      <StormMap key={mapGeneration} ref={mapApi} alerts={affected} facilities={[]}
        selectedAlertId={selectedId} selectedFacilityId="" frameId={frame.id}
        radarVisible={radarVisible} radarOpacity={0.4} playing={false} porchId=""
        alertsVisible radarRetry={radarRetry} reducedMotion={reduced}
        onSelectAlert={onSelect} onSelectFacility={() => undefined}
        onBasemapStatus={setBasemapStatus} onRadarStatus={setRadarStatus} onLocateResult={() => undefined} />
      {basemapStatus === "loading" && <p className="map-status-note" role="status">Opening the weather map.</p>}
      {basemapStatus === "error" && <div className="map-failure" role="alert"><h3>The base map did not load.</h3><p>Alert text below is unchanged. No substitute imagery is drawn.</p><button type="button" onClick={() => { setBasemapStatus("loading"); setMapGeneration(value => value + 1); }}>Retry base map</button></div>}
      {basemapStatus === "ready" && radarVisible && radarStatus === "error" && <div className="map-failure radar-failure" role="alert"><h3>Radar tiles did not load.</h3><p>Alert shapes stay up when the feed sent them. No substitute radar is drawn.</p><button type="button" onClick={() => setRadarRetry(value => value + 1)}>Retry radar tiles</button></div>}
    </div>
    <div className="map-toolbar" role="toolbar" aria-label="Weather map controls">
      <button type="button" onClick={() => mapApi.current?.national()} disabled={basemapStatus !== "ready"}>National view</button>
      <button type="button" onClick={() => selected && hasAlertShape(selected.geometry) && mapApi.current?.fitGeometry(selected.geometry)} disabled={!selected || !hasAlertShape(selected.geometry)}>Fit selected alert</button>
      <button type="button" aria-pressed={radarVisible} onClick={() => setRadarVisible(value => !value)}>Radar layer: {radarVisible ? "on" : "off"}</button>
    </div>
    <p className="fineprint">Observed radar, contiguous US only. Roads stay visible. Not a forecast or a call ranking. Base map © OpenStreetMap, © OpenMapTiles, © OpenFreeMap. Radar © Iowa Environmental Mesonet.</p>
    <CountyMap selected={selectedCounty} disabled={busy} onPick={onOpenCounty} affected={highlighted} />
    {weather && <AlertList alerts={affected} selected={selected} onSelect={onSelect} byFips={byFips} catalogFips={catalogFips} busy={busy} published={published} catalogReady={counties.length > 0} onOpenCounty={onOpenCounty} />}
  </section>;
};

const AlertList = ({
  alerts, selected, onSelect, byFips, catalogFips, busy, published, catalogReady, onOpenCounty,
}: {
  alerts: OfficialAlert[];
  selected: OfficialAlert | undefined;
  onSelect: (id: string) => void;
  byFips: Map<string, CountyRecord>;
  catalogFips: Set<string>;
  busy: boolean;
  published: boolean;
  catalogReady: boolean;
  onOpenCounty: (fips: string) => void;
}) => {
  const matches = selected ? catalogCountyFips(selected.same_county_fips, catalogFips) : [];
  const shown = matches.slice(0, shownCounties);
  const rest = matches.slice(shownCounties);
  const unusedCodes = (selected?.same_county_fips ?? []).filter(code => !catalogFips.has(code)).length;
  return <div className="storm-desk-alerts">
    {!alerts.length && <p>This capture has no Actual severe, extreme, or warning alerts. No warning was added to fill the list.</p>}
    {!!alerts.length && <ol className="official-alert-list national-alert-list">
      {alerts.map(alert => <li key={alert.id}>
        <button type="button" aria-pressed={selected?.id === alert.id} onClick={() => onSelect(alert.id)}>
          <span className="alert-severity" data-severity={alert.severity ?? "Unknown"}>{alert.severity ?? "Severity not supplied"}{alert.status ? ` / ${alert.status}` : " / status not supplied"}</span>
          <strong>{alert.event ?? "Event name not supplied"}</strong>
          <span>{alert.areaDesc ?? "Area description not supplied"}{hasAlertShape(alert.geometry) ? "" : " / no shape from NWS"}</span>
        </button>
      </li>)}
    </ol>}
    <div className="storm-alert-detail" aria-live="polite">
      {!selected && <p>Select an alert. No warning text is written on this desk.</p>}
      {selected && <>
        <h3>{selected.event ?? "Selected alert"}</h3>
        <p>{selected.areaDesc ?? "Area description not supplied"}</p>
        <p className="fineprint">{selected.senderName ?? "Issuing office not supplied"}{selected.expires ? ` / expires ${formatDateEt(selected.expires)}` : ""}</p>
        {hasAlertShape(selected.geometry) ? <p>The shape is on the weather map.</p> : <p>The National Weather Service did not send a shape for this alert. No outline was drawn from the area text.</p>}
        {!catalogReady && <p>The county catalog is not on screen, so no county is opened from this alert. <Link href="/watch">Open Storm Watch</Link> or use the state list once the catalog loads.</p>}
        {catalogReady && !!shown.length && <>
          <p>{matches.length} catalog {matches.length === 1 ? "county matches" : "counties match"} a Census code on this alert. Open one to read its audited call sheet. The order is the catalog, not a storm rank.</p>
          <ul className="affected-county-list">{shown.map(fips => {
            const row = byFips.get(fips);
            const name = row ? `${row.name}, ${row.state}` : fips;
            return <li key={fips}><button type="button" disabled={busy} onClick={() => onOpenCounty(fips)}>{published ? "Open published call sheet" : "Open audited call sheet"}: {name} / {fips}</button></li>;
          })}</ul>
          {!!rest.length && <p className="fineprint">{rest.length} more catalog counties: {rest.join(", ")}. Search the catalog by FIPS to open one.</p>}
        </>}
        {catalogReady && !shown.length && <p>No Census county code from this alert is in the catalog, so no county is highlighted from it. <Link href="/watch">Open Storm Watch</Link> for the full feed, or choose a state in the county catalog. The area description is not a county join.</p>}
        {catalogReady && unusedCodes > 0 && <p className="fineprint">{unusedCodes} NWS SAME {unusedCodes === 1 ? "code on this alert is" : "codes on this alert are"} not a Census county in this catalog.</p>}
        <a href={selected.id} target="_blank" rel="noreferrer">Inspect the original NWS record</a>
        {(selected.headline || selected.instruction) && <details>
          <summary>Official text from this alert</summary>
          {selected.headline && <p>{selected.headline}</p>}
          {selected.instruction && <p>{selected.instruction}</p>}
        </details>}
      </>}
    </div>
  </div>;
};
