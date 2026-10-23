"use client";

import { useMemo, useState } from "react";
import { createRadarProjection } from "@/lib/radar-map";
import { formatDate } from "@/lib/operator";
import type { OfficialAlert, RadarMaps } from "@/lib/weather-types";

type View = { x: number; y: number; width: number; height: number };
const initialView: View = { x: 0, y: 0, width: 1200, height: 700 };
const constrain = (view: View): View => ({
  ...view, x: Math.max(0, Math.min(1200 - view.width, view.x)),
  y: Math.max(0, Math.min(700 - view.height, view.y)),
});

export const RadarMap = ({ maps, alerts, selectedId, onSelect, captureId }: {
  maps: RadarMaps; alerts: OfficialAlert[]; selectedId: string;
  onSelect: (id: string) => void; captureId: string;
}) => {
  const [regionKey, setRegionKey] = useState("conus");
  const [theme, setTheme] = useState<"night" | "chart">("night");
  const [warnings, setWarnings] = useState(true);
  const [view, setView] = useState<View>(initialView);
  const [drag, setDrag] = useState<{ x: number; y: number; view: View } | null>(null);
  const [failedCapture, setFailedCapture] = useState("");
  const [failedLegend, setFailedLegend] = useState("");
  const region = maps.regions?.[regionKey];
  const projection = useMemo(() => region?.available ? createRadarProjection(region) : null, [region]);
  const sourceFailed = failedCapture === `${captureId}:${regionKey}`;
  const frameStale = !region?.frame_time || Date.now() - Date.parse(region.frame_time) > 1200000;
  const zoom = (factor: number) => setView(old => {
    const width = Math.max(150, Math.min(1200, old.width / factor));
    const height = width * 700 / 1200;
    return constrain({ x: old.x + (old.width - width) / 2, y: old.y + (old.height - height) / 2, width, height });
  });
  const changeRegion = (value: string) => {
    setRegionKey(value); setView(initialView); setFailedCapture("");
  };

  return (
    <div className={`radar-map-panel ${theme}`}>
      <div className="radar-map-controls">
        <label>NOAA region<select value={regionKey} onChange={event => changeRegion(event.target.value)}>
          {Object.entries(maps.regions ?? {}).map(([key, item]) => <option key={key} value={key}>{item.name}{item.available ? "" : " / unavailable"}</option>)}
        </select></label>
        <div role="group" aria-label="Map basemap theme"><button aria-pressed={theme === "night"} onClick={() => setTheme("night")}>Night map</button><button aria-pressed={theme === "chart"} onClick={() => setTheme("chart")}>Light chart</button></div>
        <button aria-pressed={warnings} onClick={() => setWarnings(old => !old)}>NWS alert outlines: {warnings ? "on" : "off"}</button>
        <div role="group" aria-label="Map zoom"><button aria-label="Zoom in radar map" onClick={() => zoom(1.5)}>+</button><button aria-label="Zoom out radar map" onClick={() => zoom(1 / 1.5)}>-</button><button onClick={() => setView(initialView)}>Reset view</button></div>
      </div>
      {!region?.available || !projection ? <div className="radar-placeholder" role="status"><h3>No verified frame for this region.</h3><p>{region?.detail ?? "Provider capture unavailable."} No radar is inferred.</p></div> :
        <><p className="radar-frame-time">Observed NOAA frame: <time dateTime={region.frame_time}>{formatDate(region.frame_time!)}</time>{frameStale ? " / stale or time needs review" : ""}</p>
          {sourceFailed ? <div className="radar-placeholder" role="alert"><h3>The verified radar overlay couldn't load.</h3><p>Use the original loop or official NOAA link. No substitute echo field is drawn.</p><button onClick={() => setFailedCapture("")}>Retry verified overlay</button></div> :
            <svg className="interactive-radar-map" viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
              role="group" aria-label={`${region.name} observed radar and actual NWS warning polygons`}
              tabIndex={0}
              onKeyDown={event => {
                const step = view.width / 12;
                if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(1.5); }
                else if (event.key === "-") { event.preventDefault(); zoom(1 / 1.5); }
                else if (event.key === "Home") { event.preventDefault(); setView(initialView); }
                else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                  event.preventDefault();
                  setView(old => constrain({ ...old,
                    x: old.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
                    y: old.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0),
                  }));
                }
              }}
              onPointerDown={event => {
                if ((event.target as Element).closest("[data-warning]")) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrag({ x: event.clientX, y: event.clientY, view });
              }}
              onPointerMove={event => {
                if (!drag) return;
                const box = event.currentTarget.getBoundingClientRect();
                setView(constrain({ ...drag.view,
                  x: drag.view.x - (event.clientX - drag.x) / box.width * drag.view.width,
                  y: drag.view.y - (event.clientY - drag.y) / box.height * drag.view.height,
                }));
              }}
              onPointerUp={event => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                setDrag(null);
              }}
              onPointerCancel={() => setDrag(null)}>
              <title>{region.name}: actual NOAA reflectivity, Census boundaries and NWS warning shapes</title>
              <desc>Drag to pan after zooming. Plus and minus zoom. Arrow keys pan. Home resets. Only basemap colors change between themes; radar colors are the provider's unaltered image.</desc>
              <rect x="0" y="0" width="1200" height="700" className="map-ocean" />
              <g aria-hidden="true">{maps.states?.features.map((feature, index) =>
                <path key={index} d={projection.geometryPath(feature.geometry)} className="map-state" fillRule="evenodd" />)}</g>
              <image href={region.image_url} x="0" y="0" width="1200" height="700"
                preserveAspectRatio="none" className="noaa-radar-overlay"
                onError={() => setFailedCapture(`${captureId}:${regionKey}`)} aria-hidden="true" />
              {warnings && alerts.map(alert => {
                const d = projection.geometryPath(alert.geometry);
                if (!d) return null;
                return <g key={alert.id} data-warning={alert.id} role="button" tabIndex={0}
                  aria-label={`Select official ${alert.event ?? "alert"}: ${alert.areaDesc ?? "area not supplied"}`}
                  aria-pressed={selectedId === alert.id} onClick={() => onSelect(alert.id)}
                  onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onSelect(alert.id); } }}>
                  <path d={d} className={`warning-map-shape ${selectedId === alert.id ? "selected" : ""}`}
                    data-severity={alert.severity} fillRule="evenodd" />
                </g>;
              })}
            </svg>}
          <div className="radar-map-caption"><p>NOAA radar colors are unchanged. Warning outlines are NWS source polygons, not predicted storm tracks. Drag after zooming; arrow keys pan; Home resets.</p>
            {failedLegend === `${captureId}:${regionKey}` ?
              <p role="status">The official legend couldn't load. Consult the NOAA source before interpreting radar colors.</p> :
              <img src={region.legend_url} alt="Official NOAA base-reflectivity legend, original source colors" className="noaa-radar-legend" onError={() => setFailedLegend(`${captureId}:${regionKey}`)} />}</div>
          <p className="fineprint">NOAA nowCOAST observations / US Census TIGERweb boundaries / EPSG:4326. Gaps in radar coverage and alerts without polygons are not filled or guessed.</p></>}
      <div className="radar-map-links"><a href="https://nowcoast.noaa.gov/" target="_blank" rel="noreferrer">Open official NOAA nowCOAST</a><a href="/#resources">Other emergency resources</a></div>
    </div>
  );
};
