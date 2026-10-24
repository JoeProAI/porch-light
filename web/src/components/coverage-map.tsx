"use client";

import { useMemo, useState } from "react";
import { createProjection, hasCoordinates } from "@/lib/operator";
import type { Facility, Geometry } from "@/lib/types";

export const CoverageMap = ({ geometry, facilities, selectedId, onSelect, contextLabel, porchId = "" }: {
  geometry: Geometry; facilities: Facility[]; selectedId: string; onSelect: (id: string) => void; contextLabel?: string; porchId?: string;
}) => {
  const [scope, setScope] = useState<"coverage" | "facilities">("facilities");
  const projection = useMemo(() => createProjection(geometry, facilities, scope), [geometry, facilities, scope]);
  const located = facilities.filter(hasCoordinates);
  const selected = located.find(row => row.id === selectedId);
  const selectedPoint = selected ? projection.project([selected.lon, selected.lat]) : null;
  return (
    <section className="map-section" aria-labelledby="map-title">
      <div className="pane-heading"><span className="eyebrow">02 / {contextLabel ? "Source-area facilities" : "Warning-area facilities"}</span><span className="mono">{contextLabel ?? "Official warning area"}</span></div>
      <div className="section-heading">
        <h2 id="map-title">{contextLabel ? "Care facilities in the source area" : "Care facilities in the warning area"}</h2>
        <span className="mono muted">{located.length}/{facilities.length} located</span>
      </div>
      <div className="map-toolbar" role="group" aria-label="Map extent">
        <button aria-pressed={scope === "facilities"} onClick={() => setScope("facilities")}>Facility extent</button>
        <button aria-pressed={scope === "coverage"} onClick={() => setScope("coverage")}>Full zone</button>
      </div>
      <div className="map-canvas">
        <svg viewBox="0 0 600 500" aria-labelledby="map-svg-title map-svg-desc" role="group">
          <title id="map-svg-title">{contextLabel ?? "Manatee source geometry and ranked facility locations"}</title>
          <desc id="map-svg-desc">{contextLabel ? "Official source boundaries and ranked facility locations. County context is not a warning boundary. Select a point to inspect its source record." : "Static Web Mercator projection. Current published NWS geometry, not a verified 2024 boundary or live warning. Choose a point to select its ledger row."}</desc>
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" className="map-grid" /></pattern>
            <pattern id="zone-hatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M -1 1 L 1 -1 M 0 7 L 7 0 M 6 8 L 8 6" className="zone-hatch-line" /></pattern>
            <clipPath id="map-clip"><rect width="600" height="400" /></clipPath>
          </defs>
          <rect width="600" height="500" fill="url(#grid)" />
          <g className="map-registration" aria-hidden="true"><path d="M 16 44 V 16 H 44 M 556 16 H 584 V 44 M 16 456 V 484 H 44 M 556 484 H 584 V 456" /></g>
          <g transform="translate(0 50)">
          <g clipPath="url(#map-clip)">
            {projection.paths.map((d, i) => <g key={i}><path d={d} className="zone-underlay" fillRule="evenodd" /><path d={d} className="zone-path" fill="url(#zone-hatch)" fillRule="evenodd" /></g>)}
            {selectedPoint && <g className="selected-registration" aria-hidden="true">
              <path d={`M 24 ${selectedPoint[1]} H 576 M ${selectedPoint[0]} 12 V 388`} />
              <circle cx={selectedPoint[0]} cy={selectedPoint[1]} r="27" />
            </g>}
            {[...located.filter(row => row.id !== selectedId), ...(selected ? [selected] : [])].map(row => {
              const [x, y] = projection.project([row.lon, row.lat]);
              const active = row.id === selectedId;
              return (
                <g key={row.id} role="button" tabIndex={0} aria-label={`Select rank ${row.rank}, ${row.name}`}
                  aria-pressed={active} className={`map-point ${active ? "selected" : ""} ${row.id === porchId ? "is-porch" : ""}`}
                  transform={`translate(${x.toFixed(2)},${y.toFixed(2)})`} onClick={() => onSelect(row.id)}
                  onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(row.id); } }}>
                  <title>{`${row.rank}. ${row.name} · location review required`}</title>
                  <circle r="40" className="point-target" />
                  <circle r={active ? 11 : 5} className="point-dot" />
                  {active && <text textAnchor="middle" dominantBaseline="central" className="point-number">{row.rank}</text>}
                </g>
              );
            })}
          </g>
          </g>
          <g className="atlas-compass" aria-hidden="true"><path d="M 36 70 V 36 M 31 43 L 36 36 L 41 43" /><text x="32" y="27">N</text></g>
          {[100, 200, 300, 400, 500].map(x => {
            const [lon] = projection.unproject([x, 400]);
            return Number.isFinite(lon) ? <text key={x} x={x} y="473" textAnchor="middle" className="map-axis">{Math.abs(lon).toFixed(2)} {lon < 0 ? "W" : "E"}</text> : null;
          })}
          <text x="27" y="447" className="map-direction">SOURCE GEOMETRY / NOT RADAR</text>
          {selected && <g className={`source-index-plate${selected.id === porchId ? " is-porch" : ""}`} aria-hidden="true">
            <text x="564" y="47" textAnchor="end" className="map-direction">SELECTED CALL</text>
            <text x="570" y="128" textAnchor="end" className="map-index-number">{String(selected.rank).padStart(2, "0")}</text>
          </g>}
        </svg>
        {!located.length && <p className="map-empty">No verified coordinates available. Use the ledger instead.</p>}
      </div>
      <div className="map-legend"><span><i className="legend-zone" /> {contextLabel ?? "Current NWS zone shapes"}</span><span><i className="legend-point" /> Facility</span></div>
      <p className="fineprint">{contextLabel ? "Points require exact Census address matches and official county coverage. Boundaries are identified as context or official alert geometry. No patient locations." : "Points use CMS or Census address-match coordinates. Address quality needs operator review. No 2024 boundary equivalence verified. No patient locations."}</p>
    </section>
  );
};
