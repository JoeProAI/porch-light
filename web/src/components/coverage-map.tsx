"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { censusOutlineNote, countyGeometryFromFeatures, hasDrawableRings, loadCountyAtlas } from "@/lib/county-outline";
import { createProjection, hasCoordinates } from "@/lib/operator";
import type { Facility, Geometry } from "@/lib/types";

const emptyGeometry = (): Geometry => ({ type: "MultiPolygon", coordinates: [] });

export const CoverageMap = ({
  geometry, facilities, selectedId, onSelect, contextLabel, porchId = "", countyFips = "",
  frame, warningGeometry = null, warningLabel, outlineNote = "", outlineState = "none", extent = "facilities",
}: {
  geometry: Geometry;
  facilities: Facility[];
  selectedId: string;
  onSelect: (id: string) => void;
  contextLabel?: string;
  porchId?: string;
  countyFips?: string;
  frame?: "warning" | "source";
  warningGeometry?: Geometry | null;
  warningLabel?: string;
  outlineNote?: string;
  outlineState?: "snapshot" | "shape" | "missing" | "loading" | "unavailable" | "none";
  extent?: "coverage" | "facilities";
}) => {
  const resolvedFrame = frame ?? (contextLabel ? "source" : "warning");
  const censusFips = countyFips.split(",").map(code => code.trim()).filter(code => /^\d{5}$/.test(code)).join(",");
  const needsCensus = !hasDrawableRings(geometry) && censusFips.length > 0;
  const frameToCounty = needsCensus && resolvedFrame === "source";
  const [scope, setScope] = useState<"coverage" | "facilities">(frameToCounty ? "coverage" : extent);
  const touched = useRef(false);
  const [census, setCensus] = useState<{ status: "loading" | "ready" | "gap"; geometry: Geometry; note: string }>({
    status: "loading", geometry: emptyGeometry(), note: "",
  });
  useEffect(() => {
    if (!touched.current) setScope(frameToCounty ? "coverage" : extent);
  }, [extent, frameToCounty]);
  useEffect(() => {
    if (!needsCensus) return;
    let cancelled = false;
    setCensus({ status: "loading", geometry: emptyGeometry(), note: "" });
    void loadCountyAtlas().then(features => {
      if (cancelled) return;
      const picked = countyGeometryFromFeatures(features, censusFips);
      if (!picked.geometry.coordinates.length) {
        setCensus({ status: "gap", geometry: emptyGeometry(), note: censusOutlineNote(0, picked.missing) });
        return;
      }
      setCensus({ status: "ready", geometry: picked.geometry, note: censusOutlineNote(picked.geometry.coordinates.length, picked.missing) });
    }).catch(() => {
      if (!cancelled) setCensus({
        status: "gap",
        geometry: emptyGeometry(),
        note: "The county outline file on this site could not be read. No bounding box was drawn in its place.",
      });
    });
    return () => { cancelled = true; };
  }, [needsCensus, censusFips]);
  const usingCensus = needsCensus && census.status === "ready";
  const shown = usingCensus ? census.geometry : geometry;
  const pendingOutline = needsCensus && census.status === "loading";
  const countyShape = usingCensus || (resolvedFrame === "source" && hasDrawableRings(shown));
  const projection = useMemo(
    () => createProjection(pendingOutline ? emptyGeometry() : shown, facilities, scope, warningGeometry),
    [shown, facilities, scope, warningGeometry, pendingOutline],
  );
  const located = facilities.filter(hasCoordinates);
  const selected = located.find(row => row.id === selectedId);
  const selectedPoint = selected ? projection.project([selected.lon, selected.lat]) : null;
  const warningFrame = resolvedFrame === "warning";
  const mono = warningLabel ?? contextLabel ?? "Official warning area";
  const svgTitle = usingCensus
    ? "Census county boundary and ranked facility locations"
    : warningLabel
      ? `${warningLabel} and ranked facility locations`
      : (contextLabel ?? "Manatee source geometry and ranked facility locations");
  const svgDesc = usingCensus
    ? "Census 2023 cartographic county boundary for this FIPS, and ranked facility locations. The outline is the county polygon, not a bounding box. A live National Weather Service polygon is drawn only when the feed sent one."
    : warningLabel
      ? "Live National Weather Service polygon for this county and ranked facility locations. The outline is the alert shape from the feed. No shape is invented when geometry is missing. Select a point to inspect its source record."
      : contextLabel
        ? "Official source boundaries and ranked facility locations. County context is not a warning boundary. Select a point to inspect its source record."
        : "Static Web Mercator projection. Current published NWS geometry, not a verified 2024 boundary or live warning. Choose a point to select its ledger row.";
  const countyOutlineState = !needsCensus
    ? (countyShape ? "snapshot" : "none")
    : census.status === "ready" ? "census" : census.status === "gap" ? "gap" : "loading";
  const chooseScope = (next: "coverage" | "facilities") => {
    touched.current = true;
    setScope(next);
  };
  const censusNote = needsCensus && census.status !== "loading" ? census.note : "";
  return (
    <section className="map-section" aria-labelledby="map-title" data-warning-outline={outlineState} data-county-outline={countyOutlineState}>
      <div className="pane-heading"><span className="eyebrow">02 / {warningFrame ? "Warning-area facilities" : "Source-area facilities"}</span><span className="mono map-context-label">{mono}</span></div>
      <div className="section-heading">
        <h2 id="map-title">{warningFrame ? "Care facilities in the warning area" : "Care facilities in the source area"}</h2>
        <span className="mono muted">{located.length}/{facilities.length} located</span>
      </div>
      <div className="map-toolbar" role="group" aria-label="Map extent">
        <button aria-pressed={scope === "facilities"} onClick={() => chooseScope("facilities")}>Facility extent</button>
        <button aria-pressed={scope === "coverage"} onClick={() => chooseScope("coverage")}>Full zone</button>
      </div>
      <div className="map-canvas">
        {pendingOutline && <p role="status">Reading the county outline.</p>}
        {!pendingOutline && <svg viewBox="0 0 600 500" aria-labelledby="map-svg-title map-svg-desc" role="group">
          <title id="map-svg-title">{svgTitle}</title>
          <desc id="map-svg-desc">{svgDesc}</desc>
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" className="map-grid" /></pattern>
            <clipPath id="map-clip"><rect width="600" height="400" /></clipPath>
          </defs>
          <rect width="600" height="500" fill="url(#grid)" />
          <g className="map-registration" aria-hidden="true"><path d="M 16 44 V 16 H 44 M 556 16 H 584 V 44 M 16 456 V 484 H 44 M 556 484 H 584 V 456" /></g>
          <g transform="translate(0 50)">
          <g clipPath="url(#map-clip)">
            {projection.paths.map((d, i) => <path key={`zone-${i}`} d={d} className={countyShape ? "county-outline" : "zone-underlay"} data-county-outline={countyShape ? countyOutlineState : undefined} fillRule="evenodd" />)}
            {projection.overlayPaths.map((d, i) => <path key={`alert-${i}`} d={d} className="zone-underlay" data-warning-polygon="live" fillRule="evenodd" />)}
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
          <text x="27" y="447" className="map-direction">{usingCensus ? "CENSUS COUNTY OUTLINE / NOT A WARNING" : "SOURCE GEOMETRY / NOT RADAR"}</text>
          {selected && <g className={`source-index-plate${selected.id === porchId ? " is-porch" : ""}`} aria-hidden="true">
            <text x="564" y="47" textAnchor="end" className="map-direction">SELECTED CALL</text>
            <text x="570" y="78" textAnchor="end" className="map-index-number">{String(selected.rank).padStart(2, "0")}</text>
          </g>}
        </svg>}
        {!pendingOutline && !located.length && <p className="map-empty">No verified coordinates available. Use the ledger instead.</p>}
      </div>
      <div className="map-legend">
        {projection.overlayPaths.length > 0 && <span><i className="legend-zone" /> {warningLabel ?? "Official NWS alert polygon"}</span>}
        {countyShape && projection.paths.length > 0 && <span><i className="legend-county" /> {usingCensus ? "Census county boundary" : (contextLabel ?? "Official county boundary")}</span>}
        {!countyShape && projection.paths.length > 0 && <span><i className="legend-zone" /> {contextLabel ?? "Current NWS zone shapes"}</span>}
        <span><i className="legend-point" /> Facility</span>
      </div>
      {outlineNote && <p className="fineprint" role="status">{outlineNote}</p>}
      {censusNote && <p className="fineprint" role="status">{censusNote}</p>}
      <p className="fineprint">{contextLabel ? "Points require exact Census address matches and official county coverage. Boundaries are identified as context or official alert geometry. No patient locations." : "Points use CMS or Census address-match coordinates. Address quality needs operator review. No 2024 boundary equivalence verified. No patient locations."}</p>
    </section>
  );
};
