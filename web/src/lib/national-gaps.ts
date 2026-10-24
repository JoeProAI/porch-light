/** Honest labels for national engine results. Manatee demo snapshots are ignored. */

export const UNREACHABLE_MESSAGE = "Zetaris unreachable on this machine";

export type NationalCounty = { fips: string; name: string; state: string; geometry_valid?: boolean };
export type NationalAlert = {
  id: string; event: string; areaDesc: string; expires: string;
  county_fips: string[]; mapping_status: string;
};
export type NationalCatalog = {
  counties: NationalCounty[];
  queryIds: string[];
  weather: {
    status: "available" | "unavailable";
    capture_id?: string;
    captured_at?: string;
    message?: string;
    refresh_note?: string;
    alerts: NationalAlert[];
  };
};
export type SourceGap = { source: string; text: string; detail?: string };

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const looksUnreachable = (text: string): boolean =>
  /Zetaris|JDBC|credentials are unavailable|source capture is not loaded|couldn't compile|Vendor audit database/i.test(text);

export const isNationalSheet = (value: unknown): boolean =>
  record(value) && (
    value.schema_version === "porch-light.national-run.v1" ||
    value.schema_version === "porch-light.national-gap.v1"
  );

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", AS: "American Samoa",
  GU: "Guam", MP: "Northern Mariana Islands", PR: "Puerto Rico", VI: "Virgin Islands",
};

export const normalizePlace = (value: string): string =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const STATE_BY_NAME = Object.fromEntries(Object.entries(STATE_NAMES).map(([code, name]) => [normalizePlace(name), code]));

export const searchCounties = (counties: NationalCounty[], query: string): NationalCounty[] => {
  const normalized = normalizePlace(query);
  if (normalized.length < 2) return [];
  const stateCode = STATE_BY_NAME[normalized] ?? (/^[a-z]{2}$/.test(normalized) ? normalized.toUpperCase() : "");
  if (stateCode && counties.some(row => row.state === stateCode) && (STATE_BY_NAME[normalized] || normalized.length === 2)) {
    return counties.filter(row => row.state === stateCode);
  }
  const digits = normalized.replace(/ /g, "");
  const matches = counties.filter(row => {
    if (digits.length >= 2 && /^\d+$/.test(digits) && row.fips.startsWith(digits)) return true;
    const haystack = `${normalizePlace(row.name)} ${normalizePlace(STATE_NAMES[row.state] ?? "")} ${row.state.toLowerCase()} ${row.fips}`;
    return haystack.includes(normalized);
  });
  return matches.length <= 300 ? matches : matches.slice(0, 40);
};

const digits = (ids: unknown): string[] | null => {
  if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== "string" || !/^\d+$/.test(id))) return null;
  return ids as string[];
};

export const parseCatalog = (value: unknown): NationalCatalog | null => {
  if (!record(value) || !record(value.catalog) || !Array.isArray(value.catalog.counties) || !record(value.catalog.data_access)) return null;
  const queryIds = digits(value.catalog.data_access.zetaris_query_ids);
  if (!queryIds || value.catalog.data_access.data_access_mode !== "zetaris") return null;
  const counties: NationalCounty[] = [];
  for (const row of value.catalog.counties) {
    if (!record(row) || typeof row.fips !== "string" || !/^\d{5}$/.test(row.fips) ||
      typeof row.name !== "string" || !row.name || typeof row.state !== "string" || !row.state) return null;
    counties.push({
      fips: row.fips, name: row.name, state: row.state,
      geometry_valid: typeof row.geometry_valid === "boolean" ? row.geometry_valid : undefined,
    });
  }
  const weatherRaw = record(value.weather) ? value.weather : {};
  const alerts: NationalAlert[] = [];
  if (Array.isArray(weatherRaw.alerts)) {
    for (const alert of weatherRaw.alerts) {
      if (!record(alert) || typeof alert.id !== "string" || !alert.id.startsWith("https://api.weather.gov/alerts/")) continue;
      const fips = Array.isArray(alert.county_fips)
        ? alert.county_fips.filter((item): item is string => typeof item === "string" && /^\d{5}$/.test(item)) : [];
      alerts.push({
        id: alert.id,
        event: typeof alert.event === "string" ? alert.event : "Alert",
        areaDesc: typeof alert.areaDesc === "string" ? alert.areaDesc : "",
        expires: typeof alert.expires === "string" ? alert.expires : "",
        county_fips: fips,
        mapping_status: typeof alert.mapping_status === "string" ? alert.mapping_status : "unknown",
      });
    }
  }
  const available = weatherRaw.status === "available";
  return {
    counties, queryIds,
    weather: {
      status: available ? "available" : "unavailable",
      capture_id: typeof weatherRaw.capture_id === "string" ? weatherRaw.capture_id : undefined,
      captured_at: typeof weatherRaw.captured_at === "string" ? weatherRaw.captured_at : undefined,
      message: typeof weatherRaw.message === "string" ? weatherRaw.message : undefined,
      refresh_note: typeof weatherRaw.refresh_note === "string" ? weatherRaw.refresh_note : undefined,
      alerts: available ? alerts : [],
    },
  };
};

const REFUSAL: Record<string, { source: string; text: string }> = {
  census_address_match_not_exact: { source: "Census geocode", text: "geocode not exact" },
  census_address_not_matched: { source: "Census geocode", text: "geocode not matched" },
  source_point_not_covered_by_current_county_geometry: { source: "County geometry", text: "source point is outside official county geometry" },
  cms_source_marked_closed: { source: "CMS", text: "CMS source marks this listing closed" },
  missing_source_facility_name: { source: "CMS", text: "CMS row has no facility name" },
  missing_or_invalid_source_phone: { source: "CMS", text: "CMS phone is missing or not a dialable number" },
  missing_valid_cms_rating: { source: "CMS", text: "CMS rating is missing" },
  missing_or_suppressed_exact_tract_svi: { source: "CDC SVI", text: "tract SVI is missing or suppressed" },
  missing_measured_zip_cardinality: { source: "HHS emPOWER", text: "emPOWER ZIP match was not measured" },
  missing_zip_context: { source: "HHS emPOWER", text: "no emPOWER ZIP context for this county" },
  zip_context_fanout: { source: "HHS emPOWER", text: "emPOWER ZIP context matched more than one row" },
  missing_published_zip_counts: { source: "HHS emPOWER", text: "emPOWER ZIP counts were not published" },
  ambiguous_or_masked_source_count_11: { source: "HHS emPOWER", text: "emPOWER count is masked at 11" },
  invalid_published_zip_ratio: { source: "HHS emPOWER", text: "emPOWER ZIP ratio is not usable" },
  eligible_county_zip_reference_unavailable: { source: "HHS emPOWER", text: "county ZIP reference percentile is unavailable" },
  outside_selected_official_warning: { source: "NWS alert", text: "facility is outside the selected alert geometry" },
  official_warning_geometry_join_unavailable: { source: "NWS alert", text: "alert geometry join is unavailable" },
};

const planGap = (): SourceGap => ({
  source: "County plan",
  text: "no county plan captured",
  detail: "The national screen does not import another county's plan or invent a plan value.",
});

export const sourceGaps = (value: unknown): SourceGap[] => {
  if (!isNationalSheet(value) || !record(value)) return [];
  const gaps: SourceGap[] = [planGap()];
  if (value.state === "source_gap" || value.schema_version === "porch-light.national-gap.v1") {
    const reason = typeof value.reason === "string" ? value.reason : "source_gap";
    gaps.push({
      source: "County geometry",
      text: reason === "official_county_geometry_unavailable_or_invalid"
        ? "official county geometry is unavailable or invalid" : reason,
      detail: "No ranking was invented for this gap.",
    });
    return gaps;
  }
  const sourceRows = record(value.counts) && typeof value.counts.source_rows === "number" ? value.counts.source_rows : null;
  if (sourceRows === 0) {
    gaps.push({
      source: "CMS",
      text: "no CMS facilities in this county",
      detail: "No matching CMS nursing-home or dialysis rows were returned. That is not proof the county has no care facilities.",
    });
  }
  const grouped = new Map<string, { source: string; text: string; names: string[] }>();
  for (const row of Array.isArray(value.refused) ? value.refused : []) {
    if (!record(row) || typeof row.reason !== "string") continue;
    const mapped = REFUSAL[row.reason] ?? { source: "Source refusal", text: row.reason };
    const key = `${mapped.source}\0${mapped.text}`;
    const bucket = grouped.get(key) ?? { ...mapped, names: [] };
    const name = typeof row.name === "string" && row.name ? row.name : "Unnamed facility";
    const ccn = typeof row.ccn === "string" ? row.ccn : "";
    bucket.names.push(ccn ? `${name} · ${ccn}` : name);
    grouped.set(key, bucket);
  }
  for (const bucket of grouped.values()) {
    const shown = bucket.names.slice(0, 8);
    const extra = bucket.names.length - shown.length;
    gaps.push({
      source: bucket.source, text: bucket.text,
      detail: `${bucket.names.length} refused. ${shown.join("; ")}${extra > 0 ? `; and ${extra} more` : ""}.`,
    });
  }
  const facilities = Array.isArray(value.facilities) ? value.facilities.filter(record) : [];
  if (facilities.some(row => record(row.evidence) && row.evidence.operator_geocode_review_required === true)) {
    gaps.push({
      source: "Census geocode",
      text: "geocode review still required",
      detail: "Ranked rows keep an exact Census match marked for operator review. Coordinates are not treated as verified operating locations.",
    });
  }
  if (facilities.length) {
    gaps.push({
      source: "CMS operating status", text: "operating status is unknown",
      detail: "Directory records are not a verified open or closed check beyond a source-marked closure refusal.",
    });
    gaps.push({
      source: "Emergency contact", text: "emergency contact reachability is unknown",
      detail: "Source phone numbers are directory numbers. No call was placed.",
    });
  }
  const report = record(value.model_report) ? value.model_report : null;
  if (report) {
    const unresolved = typeof report.unresolved_facilities === "number" ? report.unresolved_facilities : 0;
    const budget = typeof report.not_attempted_budget === "number" ? report.not_attempted_budget : 0;
    if (unresolved > 0 || budget > 0) {
      gaps.push({
        source: "Nemotron", text: "grounding failed or was not attempted",
        detail: `${unresolved} unresolved. ${budget} not attempted because the approved request cap was reached. Failures are retained. No script was substituted.`,
      });
    }
  }
  return gaps;
};

export const nationalQueryIds = (value: unknown): string[] => {
  if (!isNationalSheet(value) || !record(value) || !record(value.data_access)) return [];
  return digits(value.data_access.zetaris_query_ids) ?? [];
};
