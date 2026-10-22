"use client";

import { useMemo, useState } from "react";
import { createProjection, hasCoordinates } from "@/lib/operator";
import type { Facility, Geometry } from "@/lib/types";

export const CoverageMap = ({ geometry, facilities, selectedId, onSelect }: {
  geometry: Geometry; facilities: Facility[]; selectedId: string; onSelect: (id: string) => void;
}) => {
  const [scope, setScope] = useState<"coverage" | "facilities">("facilities");
  const projection = useMemo(() => createProjection(geometry, facilities, scope), [geometry, facilities, scope]);
  const located = facilities.filter(hasCoordinates);
  const selected = located.find(row => row.id === selectedId);
  return (
    <section className="map-section" aria-labelledby="map-title">
      <div className="section-heading">
        <h2 id="map-title">Source geography</h2>
        <span className="mono muted">{located.length}/{facilities.length} located</span>
      </div>
      <div className="map-toolbar" role="group" aria-label="Map extent">
        <button aria-pressed={scope === "facilities"} onClick={() => setScope("facilities")}>Facility extent</button>
        <button aria-pressed={scope === "coverage"} onClick={() => setScope("coverage")}>Full zone</button>
      </div>
      <div className="map-canvas">
        <svg viewBox="0 0 600 400" aria-labelledby="map-svg-title map-svg-desc" role="group">
          <title id="map-svg-title">Manatee source geometry and ranked facility locations</title>
          <desc id="map-svg-desc">Static Web Mercator projection. Current published NWS geometry, not a verified 2024 boundary or live warning. Choose a point to select its ledger row.</desc>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" className="map-grid" /></pattern>
            <clipPath id="map-clip"><rect width="600" height="400" /></clipPath>
          </defs>
          <rect width="600" height="400" fill="url(#grid)" />
          <g clipPath="url(#map-clip)">
            {projection.paths.map((d, i) => <path key={i} d={d} className="zone-path" fillRule="evenodd" />)}
            {[...located.filter(row => row.id !== selectedId), ...(selected ? [selected] : [])].map(row => {
              const [x, y] = projection.project([row.lon, row.lat]);
              const active = row.id === selectedId;
              return (
                <g key={row.id} role="button" tabIndex={0} aria-label={`Select rank ${row.rank}, ${row.name}`}
                  aria-pressed={active} className={`map-point ${active ? "selected" : ""}`}
                  transform={`translate(${x.toFixed(2)},${y.toFixed(2)})`} onClick={() => onSelect(row.id)}
                  onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(row.id); } }}>
                  <title>{`${row.rank}. ${row.name} · location review required`}</title>
                  <circle r="17" className="point-target" />
                  <circle r={active ? 11 : 5} className="point-dot" />
                  {active && <text textAnchor="middle" dominantBaseline="central" className="point-number">{row.rank}</text>}
                </g>
              );
            })}
          </g>
          <text x="22" y="28" className="map-direction">N ↑</text>
          <text x="22" y="379" className="map-direction">STATIC SOURCE GEOMETRY · NOT RADAR</text>
        </svg>
        {!located.length && <p className="map-empty">No verified coordinates available. Use the ledger instead.</p>}
      </div>
      <div className="map-legend"><span><i className="legend-zone" /> Current NWS zone shapes</span><span><i className="legend-point" /> Facility</span></div>
      <p className="fineprint">Points use CMS or Census address-match coordinates. Address quality needs operator review. No 2024 boundary equivalence verified. No patient locations.</p>
    </section>
  );
};
