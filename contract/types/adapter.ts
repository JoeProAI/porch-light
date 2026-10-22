// Country adapter interface (contract/adapter.md). One implementation per
// country under data/adapters/<country>/. The runtime surface below returns
// contract types only; build-time fetch/load/provenance follows the
// skeleton in data/adapters/us/README.md.

import {
  Alert,
  CountryCode,
  DataAsOf,
  Fact,
  Facility,
  FacilityType,
  RuleCite,
  Zone,
  ZoneRef,
} from "./types";

export type AlertMode = "archived" | "live";

// Answers the adapter gives the USL. At runtime the app reads these only
// through Zetaris SQL; the adapter registers tables, it never serves the
// app directly.
export interface CountryAdapter {
  country: CountryCode;

  // Archived alerts come from committed captures; live alerts come from a
  // live feed registered as a Zetaris REST table.
  alerts(mode: AlertMode): Promise<{ alerts: Alert[]; zones: Zone[] }>;

  // Admin areas and small areas inside a warning zone: county FIPS and
  // Census tracts in the US, OSM admin boundaries and WorldPop cells
  // in the global adapter.
  areas(zone: ZoneRef): Promise<Zone[]>;

  // Facilities inside an area. Key type is adapter specific: ccn (US CMS),
  // osm_id (global OSM).
  facilities(area: ZoneRef): Promise<Facility[]>;

  // Vulnerability facts per area (SVI in the US, WorldPop elsewhere).
  vulnerability(area: ZoneRef): Promise<Fact[]>;

  // Aggregate electricity-dependent counts only. The global adapter
  // returns an empty list and the UI says there is no open equivalent.
  dependents(area: ZoneRef): Promise<Fact[]>;

  // Preparedness rule cites per facility type (42 CFR in the US).
  rule_cites(facilityType: FacilityType): Promise<RuleCite[]>;

  // Per-source freshness for data-as-of stamps and stale flags.
  freshness(): Promise<DataAsOf[]>;
}
