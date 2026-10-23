"use client";

import { useMemo, useState } from "react";
import { searchCounties, type NationalCounty } from "@/lib/national-gaps";

export const CountySearch = ({ counties, fips, onSelect, disabled }: {
  counties: NationalCounty[]; fips: string; onSelect: (fips: string) => void; disabled?: boolean;
}) => {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchCounties(counties, query), [counties, query]);
  const selected = counties.find(row => row.fips === fips);
  return <div className="national-search">
    <label htmlFor="national-county-search">Search by county name or state</label>
    <input id="national-county-search" role="combobox" aria-expanded={matches.length > 0} aria-controls="national-county-results"
      aria-autocomplete="list" value={query} disabled={disabled} autoComplete="off"
      placeholder="County, state, or FIPS"
      onChange={event => setQuery(event.target.value)}
      onKeyDown={event => {
        if (event.key === "Enter" && matches[0]) { event.preventDefault(); onSelect(matches[0].fips); }
      }} />
    <p className="fineprint">{counties.length.toLocaleString("en-US")} official Census counties in this catalog. Type at least two letters, a state name, or a FIPS code.</p>
    {selected && <p className="fineprint">Selected {selected.name}, {selected.state} · {selected.fips}{selected.geometry_valid === false ? " · geometry unavailable" : ""}.</p>}
    {query.trim().length >= 2 && <ul id="national-county-results" className="national-results" role="listbox" aria-label="Matching counties">
      {matches.length === 0 && <li className="fineprint">No catalog county matches that search.</li>}
      {matches.map(row => <li key={row.fips} role="presentation">
        <button type="button" role="option" aria-selected={row.fips === fips} disabled={disabled} onClick={() => onSelect(row.fips)}>
          {row.name}, {row.state} · {row.fips}{row.geometry_valid === false ? " · geometry unavailable" : ""}
        </button>
      </li>)}
    </ul>}
  </div>;
};
