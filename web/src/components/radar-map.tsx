"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { constrainRadarView as constrain, createRadarProjection, initialRadarView as initialView, zoomRadarView, type RadarView as View } from "@/lib/radar-map";
import { formatDate } from "@/lib/operator";
import type { OfficialAlert, RadarMaps } from "@/lib/weather-types";

export const RadarMap = ({ maps, alerts, selectedId, onSelect, captureId }: {
  maps: RadarMaps; alerts: OfficialAlert[]; selectedId: string;
  onSelect: (id: string) => void; captureId: string;
}) => {
  const [regionKey, setRegionKey] = useState("conus");
  const [theme, setTheme] = useState<"night" | "chart">("night");
  const [warnings, setWarnings] = useState(true);
  const [radar, setRadar] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [place, setPlace] = useState("");
  const [mapWidth, setMapWidth] = useState(1200);
  const [view, setView] = useState<View>(initialView);
  const [drag, setDrag] = useState<{ x: number; y: number; view: View } | null>(null);
  const [failedCapture, setFailedCapture] = useState("");
  const [failedLegend, setFailedLegend] = useState("");
  const svg = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gestureMoved = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const region = maps.regions?.[regionKey];
  const projection = useMemo(() => region?.available ? createRadarProjection(region) : null, [region]);
  const states = useMemo(() => maps.states?.features.filter(feature =>
    projection?.labelPoint(feature.geometry)).sort((a, b) =>
    (a.properties.NAME ?? "").localeCompare(b.properties.NAME ?? "")) ?? [], [maps.states, projection]);
  const selectedAlert = alerts.find(alert => alert.id === selectedId);
  const selectedView = projection && selectedAlert?.geometry ? projection.fitGeometry(selectedAlert.geometry) : null;
  const scale = view.width / mapWidth;
  const center = projection?.unproject(view.x + view.width / 2, view.y + view.height / 2);
  const labels = useMemo(() => {
    const boxes: { left: number; right: number; top: number; bottom: number }[] = [];
    return states.flatMap(state => {
      const point = projection?.labelPoint(state.geometry);
      if (!point) return [];
      const full = view.width < 650;
      const text = full ? state.properties.NAME : state.properties.STUSAB;
      if (!text) return [];
      const size = full ? 14 : 11;
      const halfWidth = (text.length * size * .7 + 8) * scale / 2;
      const halfHeight = (size + 6) * scale / 2;
      const box = { left: point[0] - halfWidth, right: point[0] + halfWidth,
        top: point[1] - halfHeight, bottom: point[1] + halfHeight };
      if (box.left < view.x || box.right > view.x + view.width ||
        box.top < view.y || box.bottom > view.y + view.height ||
        boxes.some(other => box.left < other.right && box.right > other.left &&
          box.top < other.bottom && box.bottom > other.top)) return [];
      boxes.push(box);
      return [{ key: state.properties.STUSAB, point, text, size }];
    });
  }, [states, projection, view, scale]);
  const coordinate = (value: number, positive: string, negative: string) =>
    `${Math.abs(value).toFixed(2)}${value >= 0 ? positive : negative}`;
  const sourceFailed = failedCapture === `${captureId}:${regionKey}`;
  const frameStale = !region?.frame_time || Date.now() - Date.parse(region.frame_time) > 1200000;
  const zoom = (factor: number) => setView(old => zoomRadarView(old, factor));
  const changeRegion = (value: string) => {
    setRegionKey(value); setView(initialView); setFailedCapture(""); setPlace("");
  };
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const resize = new ResizeObserver(() => setMapWidth(element.getBoundingClientRect().width || 1200));
    resize.observe(element);
    const wheel = (event: WheelEvent) => {
      if (document.activeElement !== element) return;
      event.preventDefault();
      const box = element.getBoundingClientRect();
      setView(old => zoomRadarView(old, event.deltaY < 0 ? 1.2 : 1 / 1.2,
        { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => { resize.disconnect(); element.removeEventListener("wheel", wheel); };
  }, [regionKey, sourceFailed, projection]);
  useEffect(() => {
    if (!expanded) return;
    const previousFocus = document.activeElement;
    panel.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
      if (event.key !== "Tab") return;
      const items = panel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
      );
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [expanded]);

  return (
    <div ref={panel} className={`radar-map-panel ${theme}${expanded ? " expanded" : ""}`}
      role={expanded ? "dialog" : undefined} aria-modal={expanded || undefined}
      aria-label={expanded ? "Expanded geographic radar map" : undefined} tabIndex={expanded ? -1 : undefined}>
      <div className="radar-atlas-heading"><div><p className="eyebrow">Geographic radar atlas</p><h3>Find the place.<br />Then read the weather.</h3></div><p>Named states and territories. Source warning areas. Observed radar, never a forecast of facility conditions.</p></div>
      <div className="radar-map-controls">
        <label>NOAA region<select value={regionKey} onChange={event => changeRegion(event.target.value)}>
          {Object.entries(maps.regions ?? {}).map(([key, item]) => <option key={key} value={key}>{item.name}{item.available ? "" : " / unavailable"}</option>)}
        </select></label>
        <label>Find state or territory<select value={place} disabled={!states.length} onChange={event => {
          const value = event.target.value;
          setPlace(value);
          const state = states.find(item => item.properties.STUSAB === value);
          const next = state && projection?.fitGeometry(state.geometry);
          setView(next || initialView);
        }}><option value="">All places in this region</option>{states.map(state =>
          <option key={state.properties.STUSAB} value={state.properties.STUSAB}>{state.properties.NAME}</option>)}</select></label>
        <div role="group" aria-label="Map basemap theme"><button aria-pressed={theme === "night"} onClick={() => setTheme("night")}>Night map</button><button aria-pressed={theme === "chart"} onClick={() => setTheme("chart")}>Light chart</button></div>
        <button aria-pressed={radar} onClick={() => setRadar(old => !old)}>Radar layer: {radar ? "on" : "off"}</button>
        <button aria-pressed={warnings} onClick={() => setWarnings(old => !old)}>NWS alert outlines: {warnings ? "on" : "off"}</button>
        <div role="group" aria-label="Map zoom"><button aria-label="Zoom in radar map" disabled={view.width <= 150} onClick={() => zoom(1.5)}>+</button><button aria-label="Zoom out radar map" disabled={view.width >= 1200} onClick={() => zoom(1 / 1.5)}>-</button><button onClick={() => { setView(initialView); setPlace(""); }}>Reset view</button></div>
        <button disabled={!selectedView} onClick={() => { if (selectedView) { setView(selectedView); setPlace(""); } }}>Locate selected alert</button>
        <button aria-pressed={expanded} onClick={() => setExpanded(old => !old)}>{expanded ? "Close large map" : "Expand map"}</button>
      </div>
      {!region?.available || !projection ? <div className="radar-placeholder" role="status"><h3>No verified frame for this region.</h3><p>{region?.detail ?? "Provider capture unavailable."} No radar is inferred.</p></div> :
        <><p className="radar-frame-time">Observed NOAA frame: <time dateTime={region.frame_time}>{formatDate(region.frame_time!)}</time>{frameStale ? " / stale or time needs review" : ""}</p>
          {sourceFailed ? <div className="radar-placeholder" role="alert"><h3>The verified radar overlay couldn't load.</h3><p>Use the original loop or official NOAA link. No substitute echo field is drawn.</p><button onClick={() => setFailedCapture("")}>Retry verified overlay</button></div> :
            <svg ref={svg} className="interactive-radar-map" viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
              role="group" aria-label={`${region.name} observed radar and actual NWS warning polygons`}
              tabIndex={0}
              onDoubleClick={event => {
                if ((event.target as Element).closest("[data-warning]")) return;
                const box = event.currentTarget.getBoundingClientRect();
                setView(old => zoomRadarView(old, 1.5,
                  { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }));
              }}
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
                if (!pointers.current.size) gestureMoved.current = false;
                const warning = (event.target as Element).closest("[data-warning]");
                if (warning && event.pointerType !== "touch") return;
                event.currentTarget.focus();
                if (!warning) event.currentTarget.setPointerCapture(event.pointerId);
                pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
                setDrag(pointers.current.size === 1 ? { x: event.clientX, y: event.clientY, view } : null);
              }}
              onPointerMove={event => {
                if (!pointers.current.has(event.pointerId)) return;
                const box = event.currentTarget.getBoundingClientRect();
                const previous = [...pointers.current.values()];
                pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
                if (pointers.current.size === 2) {
                  gestureMoved.current = true;
                  const next = [...pointers.current.values()];
                  const before = Math.hypot(previous[1].x - previous[0].x, previous[1].y - previous[0].y);
                  const after = Math.hypot(next[1].x - next[0].x, next[1].y - next[0].y);
                  if (before > 0 && after > 0) {
                    const x = (previous[0].x + previous[1].x) / 2, y = (previous[0].y + previous[1].y) / 2;
                    setView(old => {
                      const zoomed = zoomRadarView(old, after / before,
                        { x: (x - box.left) / box.width, y: (y - box.top) / box.height });
                      return constrain({ ...zoomed,
                        x: zoomed.x - ((next[0].x + next[1].x) / 2 - x) / box.width * zoomed.width,
                        y: zoomed.y - ((next[0].y + next[1].y) / 2 - y) / box.height * zoomed.height,
                      });
                    });
                  }
                  return;
                }
                if (!drag) return;
                if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) gestureMoved.current = true;
                setView(constrain({ ...drag.view,
                  x: drag.view.x - (event.clientX - drag.x) / box.width * drag.view.width,
                  y: drag.view.y - (event.clientY - drag.y) / box.height * drag.view.height,
                }));
              }}
              onPointerUp={event => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                pointers.current.delete(event.pointerId);
                const remaining = [...pointers.current.values()][0];
                setDrag(remaining ? { ...remaining, view } : null);
              }}
              onPointerCancel={() => { pointers.current.clear(); setDrag(null); }}>
              <title>{region.name}: actual NOAA reflectivity, Census boundaries and NWS warning shapes</title>
              <desc>Drag to pan after zooming. Plus and minus zoom. Arrow keys pan. Home resets. Only basemap colors change between themes; radar colors are the provider's unaltered image.</desc>
              <rect x="0" y="0" width="1200" height="700" className="map-ocean" />
              <g aria-hidden="true">{maps.states?.features.map((feature, index) =>
                <path key={index} d={projection.geometryPath(feature.geometry)} className="map-state" fillRule="evenodd" />)}</g>
              <g className="map-graticule" aria-hidden="true">{Array.from({ length: 37 }, (_, i) => -180 + i * 10).map(lon => {
                const [x] = projection.project([lon, 0]);
                return <path key={lon} d={`M ${x} 0 V 700`} />;
              })}{Array.from({ length: 19 }, (_, i) => -90 + i * 10).map(lat => {
                const [, y] = projection.project([0, lat]);
                return <path key={lat} d={`M 0 ${y} H 1200`} />;
              })}</g>
              <image href={region.image_url} x="0" y="0" width="1200" height="700"
                preserveAspectRatio="none" className="noaa-radar-overlay" visibility={radar ? "visible" : "hidden"}
                onError={() => setFailedCapture(`${captureId}:${regionKey}`)} aria-hidden="true" />
              {warnings && alerts.map(alert => {
                const d = projection.geometryPath(alert.geometry);
                if (!d) return null;
                return <g key={alert.id} data-warning={alert.id} role="button" tabIndex={0}
                  aria-label={`Select official ${alert.event ?? "alert"}: ${alert.areaDesc ?? "area not supplied"}`}
                  aria-pressed={selectedId === alert.id} onClick={() => { if (!gestureMoved.current) onSelect(alert.id); }}
                  onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onSelect(alert.id); } }}>
                  <path d={d} className={`warning-map-shape ${selectedId === alert.id ? "selected" : ""}`}
                    data-severity={alert.severity} fillRule="evenodd" />
                </g>;
              })}
              <g className="map-place-labels" aria-hidden="true">{labels.map(label =>
                <text key={label.key} x={label.point[0]} y={label.point[1]}
                  fontSize={label.size * scale} strokeWidth={3 * scale}>{label.text}</text>)}</g>
            </svg>}
          <div className="radar-navigation-strip"><span>{region.name} / {(1200 / view.width).toFixed(1)}x</span><span>{center ? `${coordinate(center[1], "N", "S")}  ${coordinate(center[0], "E", "W")}` : "Coordinates unavailable"}</span><span>North up / geographic coordinates</span></div>
          <div className="radar-location-detail"><strong>{selectedAlert?.event ?? "Select an NWS alert"}</strong><span>{selectedAlert?.areaDesc ?? "Choose a source warning outline or an alert from the list below."}</span>{!selectedView && selectedAlert && <small>This alert has no source polygon in the current region. Its area is not guessed.</small>}</div>
          <div className="radar-map-caption"><p>NOAA radar colors are unchanged. State labels come from Census boundaries. Choose a named place or locate an alert to zoom geographically. Double-click to zoom; focus the map to scroll-zoom; arrow keys pan; Home resets. Zoom enlarges the captured frame, not its underlying radar resolution.</p>
            {failedLegend === `${captureId}:${regionKey}` ?
              <p role="status">The official legend couldn't load. Consult the NOAA source before interpreting radar colors.</p> :
              <img src={region.legend_url} alt="Official NOAA base-reflectivity legend, original source colors" className="noaa-radar-legend" onError={() => setFailedLegend(`${captureId}:${regionKey}`)} />}</div>
          <p className="fineprint">NOAA nowCOAST observations / US Census TIGERweb boundaries / EPSG:4326. Gaps in radar coverage and alerts without polygons are not filled or guessed.</p></>}
      <div className="radar-map-links"><a href="https://nowcoast.noaa.gov/" target="_blank" rel="noreferrer">Open official NOAA nowCOAST</a><a href="/#resources">Other emergency resources</a></div>
    </div>
  );
};
