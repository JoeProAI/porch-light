"use client";

import { formatDate } from "@/lib/operator";
import type { NationalAlert, NationalCatalog, NationalCounty } from "@/lib/national-gaps";

export const AlertEntry = ({ weather, counties, alertId, onAlert, scope, onScope, disabled, refreshing, onRefresh }: {
  weather: NationalCatalog["weather"];
  counties: NationalCounty[];
  alertId: string;
  onAlert: (id: string) => void;
  scope: string;
  onScope: (scope: string) => void;
  disabled?: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) => {
  const selected = weather.alerts.find(row => row.id === alertId);
  const captured = weather.captured_at && Number.isFinite(Date.parse(weather.captured_at)) ? formatDate(weather.captured_at) : "";
  return <div className="national-search">
    {weather.status !== "available" ? <p className="watch-error" role="alert">{weather.message ?? "Active NWS alerts are not available from the audited feed."} County search stays separate. No county was guessed from an area description.</p> :
      <>
        <label htmlFor="national-alert">Active NWS alert</label>
        <select id="national-alert" value={alertId} disabled={disabled} onChange={event => onAlert(event.target.value)} required>
          <option value="">Choose an active official alert</option>
          {weather.alerts.map(row => <option key={row.id} value={row.id}>{row.event} / {row.areaDesc}</option>)}
        </select>
        {captured && <p className="fineprint">Active feed read {captured}. Expired and non-actual alerts are omitted. Alerts can expire while a job runs.</p>}
        {selected && <AlertScope alert={selected} counties={counties} scope={scope} onScope={onScope} disabled={disabled} />}
      </>}
    {weather.refresh_note && <p className="fineprint">{weather.refresh_note}</p>}
    <button type="button" onClick={onRefresh} disabled={disabled || refreshing}>
      {refreshing ? "Publishing the current NWS feed…" : weather.status === "available" ? "Refresh active NWS alerts" : "Load active NWS alerts"}
    </button>
    <p className="fineprint">Refresh fetches the official active-alert feed, publishes that capture, then reads it through Zetaris. A stale capture is not relabeled current.</p>
  </div>;
};

const AlertScope = ({ alert, counties, scope, onScope, disabled }: {
  alert: NationalAlert; counties: NationalCounty[]; scope: string; onScope: (scope: string) => void; disabled?: boolean;
}) => {
  const named = alert.county_fips.map(fips => counties.find(row => row.fips === fips));
  return <>
    <p className="fineprint">{alert.county_fips.length} source-mapped counties. Mapping: {alert.mapping_status}. <a href={alert.id} target="_blank" rel="noreferrer">Inspect the original NWS record</a></p>
    {alert.county_fips.length === 0 ? <p className="watch-error" role="alert">No county intersection or supported zone mapping for this alert. No county was guessed from the area description.</p> :
      <fieldset className="national-choice" disabled={disabled}>
        <legend>Call sheet scope</legend>
        <label><input type="radio" name="alert-scope" checked={scope === "combined"} onChange={() => onScope("combined")} /> Combined call sheet for all {alert.county_fips.length} mapped counties. Alert geometry is applied.</label>
        {alert.county_fips.map((fips, index) => {
          const county = named[index];
          return <label key={fips}><input type="radio" name="alert-scope" checked={scope === fips} onChange={() => onScope(fips)} /> {county ? `${county.name}, ${county.state}` : fips} · {fips}. County discovery only. The alert polygon is not applied.</label>;
        })}
      </fieldset>}
  </>;
};
