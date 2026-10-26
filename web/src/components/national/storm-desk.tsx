"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  affectedCatalogFips, catalogCountyFips, orderAffectedAlerts,
} from "@/lib/affected-alerts";
import type { CountyRecord } from "@/lib/county-search";
import { hasAlertShape } from "@/lib/geo";
import { radarFrames } from "@/lib/radar-frames";
import { formatDateEt } from "@/lib/operator";
import {
  alertsForCounty, readSheetSummary, SHORTLIST_CAP, shortlistCsv, type SheetSummary,
} from "@/lib/shortlist";
import { weatherFreshness, type LiveWeather, type OfficialAlert } from "@/lib/weather-types";
import { CountyMap } from "./county-map";
import { CountyWeatherMap, RADAR_OPACITY, type CountyView, type CountyWeatherMapApi } from "./county-weather-map";

const shownCounties = 8;

export const StormDesk = ({
  weather, loading, error, onRetry, counties, selectedId, onSelect, onOpenCounty, onShortlist, shortlist,
  readPublished, busy, published,
}: {
  weather: LiveWeather | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  counties: CountyRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpenCounty: (fips: string) => void;
  onShortlist: (fips: string, additive: boolean) => void;
  shortlist: string[];
  readPublished: (fips: string) => Promise<unknown>;
  busy: boolean;
  published: boolean;
}) => {
  const mapApi = useRef<CountyWeatherMapApi>(null);
  const [basemapStatus, setBasemapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [atlasStatus, setAtlasStatus] = useState<"loading" | "ready" | "error">("loading");
  const [radarStatus, setRadarStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mapGeneration, setMapGeneration] = useState(0);
  const [radarRetry, setRadarRetry] = useState(0);
  const [radarVisible, setRadarVisible] = useState(true);
  const [compare, setCompare] = useState<Record<string, { summary?: SheetSummary; error?: string }>>({});
  const [comparing, setComparing] = useState(false);
  const catalogFips = new Set(counties.map(row => row.fips));
  const byFips = new Map(counties.map(row => [row.fips, row]));
  const affected = weather ? orderAffectedAlerts(weather.alerts, catalogFips) : [];
  const actual = weather?.alerts.filter(alert => alert.status === "Actual").length ?? 0;
  const highlighted = affectedCatalogFips(affected, catalogFips);
  const selected = affected.find(alert => alert.id === selectedId) ?? weather?.alerts.find(alert => alert.id === selectedId);
  const freshness = weather ? weatherFreshness(weather.captured_at, Date.now()) : "unverified";
  const frame = radarFrames[radarFrames.length - 1];
  const shapes = affected.filter(alert => hasAlertShape(alert.geometry)).length;
  const outlineFallback = atlasStatus === "error" || basemapStatus === "error";
  const selectedGeometry = selected && hasAlertShape(selected.geometry) ? selected.geometry : null;

  const runCompare = async () => {
    if (!published || !shortlist.length) return;
    setComparing(true);
    const next: Record<string, { summary?: SheetSummary; error?: string }> = {};
    await Promise.all(shortlist.map(async fips => {
      try {
        const summary = readSheetSummary(await readPublished(fips));
        next[fips] = summary ? { summary } : { error: "The published snapshot could not be read. No other county was substituted." };
      } catch (failure) {
        next[fips] = { error: failure instanceof Error ? failure.message : "The published snapshot could not be read." };
      }
    }));
    setCompare(next);
    setComparing(false);
  };

  const exportShortlist = () => {
    const csv = shortlistCsv(shortlist.map(fips => {
      const row = byFips.get(fips);
      return {
        fips,
        name: row?.name ?? "",
        state: row?.state ?? "",
        alerts: alertsForCounty(fips, affected),
      };
    }));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "porch-light-shortlist.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const show = (view: CountyView) => mapApi.current?.show(view);
  const pickOnMap = (fips: string, additive: boolean) => {
    onShortlist(fips, additive);
    if (!additive) onOpenCounty(fips);
  };

  return <section className="storm-desk" aria-labelledby="storm-desk-title" data-live-alerts={weather?.alerts.length ?? 0} data-affected={affected.length}>
    <div className="storm-desk-heading">
      <p className="eyebrow">Active weather / National Weather Service</p>
      <h2 id="storm-desk-title">Affected areas, then the county catalog.</h2>
      {!weather && loading && <p role="status">Reading the live weather feed. No sample warnings are shown.</p>}
      {!weather && !loading && <p className="watch-error" role="alert">{error || "The live weather feed could not be read."} The county catalog stays available. <button type="button" onClick={onRetry}>Retry weather</button></p>}
      {weather && <>
        <p className="warning-surface" role="status">{shapes} warning {shapes === 1 ? "shape is" : "shapes are"} on the map. {highlighted.length} catalog {highlighted.length === 1 ? "county is" : "counties are"} lit from NWS SAME codes. {weather.alerts.length} alerts in this capture. {actual} are marked Actual. {affected.length} severe, extreme, or warning alerts are listed.</p>
        <p className="fineprint">
          <span className={`weather-state ${freshness}`}>{freshness === "recent" ? (weather.data_access.data_access_mode === "zetaris" ? "Recent audited capture" : "Recent NWS capture") : "This capture is out of date"}</span>
          {" "}<time dateTime={weather.captured_at}>{formatDateEt(weather.captured_at)}</time>
          {". "}{weather.data_access.source_note ?? "Audited weather capture."}
          {" "}<Link href="/watch">Open Storm Watch</Link>
        </p>
        <p className="fineprint">A county lights up only when this alert carries that Census FIPS and the county is in the catalog on screen. Area text is not a county join. Active alerts are not a drafted call sheet for every county. This desk does not run an offline DGX, H-MEM, or a World Model.</p>
      </>}
    </div>
    <div className="storm-desk-stage">
      <div className="county-weather-frame">
        {outlineFallback ? <>
          <p className="watch-error" role="alert">The aligned county file did not load, so radar is not drawn on top of these outlines. Clicks still select a county. <button type="button" onClick={() => { setBasemapStatus("loading"); setAtlasStatus("loading"); setMapGeneration(value => value + 1); }}>Retry county map</button></p>
          <CountyMap selected={shortlist[0] ?? ""} disabled={busy} affected={highlighted} onPick={pickOnMap} />
        </> : <>
          <CountyWeatherMap key={mapGeneration} ref={mapApi} alerts={affected} selectedId={selectedId}
            highlighted={highlighted} shortlist={shortlist} frameId={frame.id}
            radarVisible={radarVisible} radarRetry={radarRetry} onCountyClick={pickOnMap}
            onBasemapStatus={setBasemapStatus} onRadarStatus={setRadarStatus} onAtlasStatus={setAtlasStatus} />
          {basemapStatus === "loading" && <p className="map-status-note" role="status">Opening county outlines and the weather wash.</p>}
          {basemapStatus === "ready" && radarVisible && radarStatus === "error" && <div className="map-failure radar-failure" role="alert"><h3>Radar tiles did not load.</h3><p>Warning shapes and county lines stay up. No substitute radar is drawn.</p><button type="button" onClick={() => setRadarRetry(value => value + 1)}>Retry radar tiles</button></div>}
        </>}
      </div>
      <aside className="warning-rail" aria-label="Warning counties">
        <h3>Warning counties</h3>
        <p className="fineprint">Lit counties are on the map now. Check one or several. The list is not a storm rank.</p>
        {!highlighted.length && <p>No catalog county is on an active severe, extreme, or warning alert in this capture.</p>}
        {!!highlighted.length && <ul className="matched-counties">{highlighted.map(fips => {
          const row = byFips.get(fips);
          const label = row ? `${row.name}, ${row.state} / ${fips}` : fips;
          return <li key={fips}><label><input type="checkbox" checked={shortlist.includes(fips)} onChange={() => onShortlist(fips, true)} /> {label}</label></li>;
        })}</ul>}
        <Shortlist shortlist={shortlist} byFips={byFips} affected={affected} busy={busy} published={published}
          comparing={comparing} compare={compare} onOpenCounty={onOpenCounty} onCompare={() => void runCompare()} onExport={exportShortlist} />
      </aside>
    </div>
    {!outlineFallback && <div className="map-toolbar" role="toolbar" aria-label="Weather map controls">
      <button type="button" onClick={() => show("conus")} disabled={basemapStatus !== "ready"}>Contiguous view</button>
      <button type="button" onClick={() => show("alaska")} disabled={basemapStatus !== "ready"}>Alaska view</button>
      <button type="button" onClick={() => show("hawaii")} disabled={basemapStatus !== "ready"}>Hawaii view</button>
      <button type="button" onClick={() => show("puerto-rico")} disabled={basemapStatus !== "ready"}>Puerto Rico view</button>
      <button type="button" onClick={() => selectedGeometry && mapApi.current?.fitGeometry(selectedGeometry)} disabled={!selectedGeometry}>Fit selected alert</button>
      <button type="button" aria-pressed={radarVisible} onClick={() => setRadarVisible(value => !value)}>Radar layer: {radarVisible ? "on" : "off"}</button>
    </div>}
    {!outlineFallback && <p className="fineprint overlay-note">Radar is drawn at {Math.round(RADAR_OPACITY * 100)}% opacity under the county lines. Warning shapes are a light wash and do not take the click. A click lands on the county and opens its published sheet. Shift, Command, or Control click adds a county without opening a sheet. A checkbox does the same. The view does not pan on its own.</p>}
    <p className="fineprint">Census 2023 cartographic counties, NAD83 degrees, on the web map. Radar is the latest Iowa Environmental Mesonet composite for the contiguous United States. Not a forecast or a call ranking.</p>
    {weather && <AlertList alerts={affected} selected={selected} onSelect={onSelect} byFips={byFips} catalogFips={catalogFips} busy={busy} published={published} catalogReady={counties.length > 0} onOpenCounty={onOpenCounty} shortlist={shortlist} onShortlist={onShortlist} />}
  </section>;
};

const Shortlist = ({
  shortlist, byFips, affected, busy, published, comparing, compare, onOpenCounty, onCompare, onExport,
}: {
  shortlist: string[];
  byFips: Map<string, CountyRecord>;
  affected: OfficialAlert[];
  busy: boolean;
  published: boolean;
  comparing: boolean;
  compare: Record<string, { summary?: SheetSummary; error?: string }>;
  onOpenCounty: (fips: string) => void;
  onCompare: () => void;
  onExport: () => void;
}) => <div className="shortlist" role="region" aria-label="Shortlist">
  <h3>Shortlist</h3>
  {!shortlist.length && <p>No counties checked yet. The map still shows every warning shape.</p>}
  {!!shortlist.length && <ol>{shortlist.map(fips => {
    const row = byFips.get(fips);
    const name = row ? `${row.name}, ${row.state}` : fips;
    const alerts = alertsForCounty(fips, affected);
    const card = compare[fips];
    return <li key={fips}>
      <p><strong>{name}</strong> / {fips}</p>
      <p className="fineprint">{alerts.length ? alerts.join(", ") : "No severe, extreme, or warning alert in this capture carries this Census code."}</p>
      <button type="button" disabled={busy} onClick={() => onOpenCounty(fips)}>{published ? "Open this published sheet" : "Open this audited sheet"}</button>
      {card?.error && <p role="alert">{card.error}</p>}
      {card?.summary && <div className="sheet-compare">
        <p>{card.summary.ranked === null ? "Ranked count was not in this snapshot." : `${card.summary.ranked} ranked facilities in this published sheet.`} {card.summary.refused === null ? "" : `${card.summary.refused} refused.`}</p>
        {!!card.summary.facilities.length && <ul>{card.summary.facilities.map(facility => <li key={`${facility.rank}-${facility.name}`}>{facility.rank === null ? facility.name : `Rank ${facility.rank} in this county: ${facility.name}`}{facility.phone ? ` / ${facility.phone}` : " / phone not in this snapshot"}</li>)}</ul>}
      </div>}
    </li>;
  })}</ol>}
  <div className="shortlist-actions">
    <button type="button" disabled={!published || !shortlist.length || comparing} onClick={onCompare}>{comparing ? "Reading published sheets..." : "Compare published sheets"}</button>
    <button type="button" disabled={!shortlist.length} onClick={onExport}>Export shortlist</button>
  </div>
  {shortlist.length >= SHORTLIST_CAP && <p className="fineprint">The shortlist holds {SHORTLIST_CAP} counties. Remove one to add another.</p>}
  {!published && <p className="fineprint">Published sheet compare is for the hosted catalog. On this machine, open one county to start its source run.</p>}
  <p className="fineprint">Compare reads each county&apos;s own published sheet. It does not rank the shortlist, and it does not draft a call for every county.</p>
</div>;

const AlertList = ({
  alerts, selected, onSelect, byFips, catalogFips, busy, published, catalogReady, onOpenCounty, shortlist, onShortlist,
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
  shortlist: string[];
  onShortlist: (fips: string, additive: boolean) => void;
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
        {hasAlertShape(selected.geometry) ? <p>The shape is on the county map. The map stays at the current view until you choose Fit selected alert.</p> : <p>The National Weather Service did not send a shape for this alert. No outline was drawn from the area text.</p>}
        {!catalogReady && <p>The county catalog is not on screen, so no county is opened from this alert. <Link href="/watch">Open Storm Watch</Link> or use the state list once the catalog loads.</p>}
        {catalogReady && !!shown.length && <>
          <p>{matches.length} catalog {matches.length === 1 ? "county matches" : "counties match"} a Census code on this alert. Open one to read its audited call sheet. The order is the catalog, not a storm rank.</p>
          <ul className="affected-county-list">{shown.map(fips => {
            const row = byFips.get(fips);
            const name = row ? `${row.name}, ${row.state}` : fips;
            return <li key={fips}>
              <label><input type="checkbox" checked={shortlist.includes(fips)} onChange={() => onShortlist(fips, true)} aria-label={`Shortlist ${name} / ${fips}`} /> Shortlist</label>
              <button type="button" disabled={busy} onClick={() => onOpenCounty(fips)}>{published ? "Open published call sheet" : "Open audited call sheet"}: {name} / {fips}</button>
            </li>;
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
