"use client";

import { useEffect, useState } from "react";
import "./county-map.css";

type Atlas = { view: [number, number]; counties: { fips: string; d: string }[] };

export const CountyMap = ({ selected, disabled, onPick, affected = [] }: {
  selected: string;
  disabled: boolean;
  onPick: (fips: string) => void;
  affected?: string[];
}) => {
  const affectedSet = new Set(affected);
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/geo/us-counties.json", { signal: controller.signal });
        const value: unknown = await response.json();
        if (!response.ok || !value || typeof value !== "object" || !Array.isArray((value as Atlas).counties)) {
          throw new Error("County outlines were not readable.");
        }
        if (!controller.signal.aborted) setAtlas(value as Atlas);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();
    return () => controller.abort();
  }, []);
  return <figure className="county-map-frame" data-affected={affected.length}>
    <figcaption>Census 2023 cartographic counties for the states, the District of Columbia, and Puerto Rico. Click a county to open its audited call sheet. Amber marks the county you picked. The severe color marks a catalog county whose FIPS was on an active severe or warning alert. Area text does not light a county. Island-area counties stay in the search.</figcaption>
    {failed && <p className="watch-error" role="alert">The county outline file on this site could not be read.</p>}
    {!atlas && !failed && <p role="status">Reading county outlines.</p>}
    {atlas && <svg className="county-map" viewBox={`0 0 ${atlas.view[0]} ${atlas.view[1]}`} role="img" aria-label="US county outlines. Click a county to fill its FIPS and start that county's source run.">
      {atlas.counties.map(county => {
        const classes = [
          affectedSet.has(county.fips) ? "is-affected" : "",
          county.fips === selected ? "is-selected" : "",
        ].filter(Boolean).join(" ");
        return <path key={county.fips} d={county.d} data-fips={county.fips}
          className={classes || undefined}
          onClick={() => { if (!disabled) onPick(county.fips); }}>
          {affectedSet.has(county.fips) ? <title>{county.fips} is on an active alert</title> : null}
        </path>;
      })}
    </svg>}
  </figure>;
};
