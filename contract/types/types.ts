// Porch Light contract types. Mirror of contract/openapi.yaml schemas.
// Country agnostic: everything adapter specific arrives via ExternalKey
// and the country field, never a US-only column.

export type CountryCode = string; // lowercase adapter key: "us", "jm", ...

export type ExternalKeyType =
  | "ccn"
  | "osm_id"
  | "worldpop_cell"
  | "gdacs_event"
  | "cap_id"
  | "ugc"
  | "fips"
  | "tract_geoid"
  | "zip"
  | "ssa_county"
  | "nws_zone";

export interface ExternalKey {
  type: ExternalKeyType;
  value: string;
}

export type AlertSource = "nws" | "iem" | "gdacs" | "cap" | "mock";

export interface Vtec {
  office?: string;
  phenomena?: string;
  significance?: string;
  event_id?: number;
}

export interface ZoneRef {
  id: string;
  kind: "county" | "zone" | "tract" | "admin" | "grid" | "cap_area";
  name?: string;
  country?: CountryCode;
}

export interface Alert {
  id: string;
  country: CountryCode;
  source: AlertSource;
  event: string;
  headline: string;
  severity?: "extreme" | "severe" | "moderate" | "minor" | "unknown";
  urgency?: "immediate" | "expected" | "future" | "past" | "unknown";
  certainty?: "observed" | "likely" | "possible" | "unlikely" | "unknown";
  sent: string; // ISO 8601
  effective?: string;
  expires?: string;
  geocode?: { ugc?: string[]; same?: string[] };
  affected_zones: ZoneRef[];
  geometry?: object | null; // GeoJSON Polygon/MultiPolygon; null for zone-based alerts
  zone_based: boolean;
  vtec?: Vtec;
  raw_ref?: string; // repo-relative path of captured raw JSON
  fetched_at?: string;
  mock?: boolean;
}

export interface Zone extends ZoneRef {
  country: CountryCode;
  keys?: ExternalKey[];
  geometry?: object | null;
}

export interface WarningArea {
  id: string;
  country: CountryCode;
  built_from: "zone_shapes" | "storm_polygon" | "admin_boundary" | "gdacs_buffer";
  keys: ExternalKey[];
  zones?: ZoneRef[];
  geometry?: object | null;
  area_km2?: number;
}

export interface AlertList {
  items: Alert[];
  empty_state?: EmptyState;
}

// Exactly one of alert_id or alert.
export type CreateRunRequest =
  | { alert_id: string; alert?: never; country?: CountryCode }
  | { alert_id?: never; alert: Alert; country?: CountryCode };

export type RunStatus =
  | "queued"
  | "building_area"
  | "finding_facilities"
  | "measuring_joins"
  | "scoring"
  | "writing_reasons"
  | "ready"
  | "exporting"
  | "done"
  | "failed";

export interface Run {
  id: string;
  status: RunStatus;
  alert: Alert;
  warning_area?: WarningArea;
  snapshot_id?: string;
  country?: CountryCode;
  counts?: {
    facilities?: number;
    joins_accepted?: number;
    joins_failed?: number;
    checkins_done?: number;
  };
  created_at: string;
  updated_at?: string;
  error?: ApiErrorBody;
}

export type FacilityType =
  | "dialysis"
  | "nursing_home"
  | "home_health"
  | "hospital"
  | "clinic"
  | "other";

export interface GeocodeInfo {
  source?: string;
  match_quality?: "exact" | "partial" | "tied" | "failed";
}

export type FacilityPhone =
  | { status: "available"; value: string; source: SourceRef; source_record_key?: string }
  | { status: "unavailable"; reason: string; value?: never };

export interface Facility {
  id: string;
  country: CountryCode;
  name: string;
  type: FacilityType;
  key: ExternalKey; // ccn in the US, osm_id in the global adapter
  alt_keys?: ExternalKey[];
  address?: string;
  phone?: FacilityPhone;
  zip?: string;
  county_key?: ExternalKey;
  tract_key?: ExternalKey;
  lat: number;
  lon: number;
  geocode?: GeocodeInfo;
  attributes?: Record<string, unknown>;
  score?: ScoreBreakdown;
  evidence?: Evidence;
  mock?: boolean;
}

export type ScoreTermName =
  | "type_weight"
  | "svi_pct"
  | "empower_density_pct"
  | "cms_risk"
  | "plan_flag";

export interface ScoreTerm {
  name: ScoreTermName;
  input: number;
  weight: number;
  weighted: number;
  note?: string;
}

export interface ScoreBreakdown {
  total: number;
  terms: ScoreTerm[];
  formula_version: string;
  rank: number;
  tie_break?: string;
}

export interface SourceRef {
  name: string;
  dataset_id?: string;
  url?: string;
  license: string;
}

export interface DataAsOf {
  source: string;
  modified?: string;
  fetched_at: string;
  snapshot_id: string;
  stale: boolean;
  provenance_file?: string;
}

export type JoinMethod =
  | "exact_key"
  | "ssa_to_fips_crosswalk"
  | "census_geocode"
  | "postgis_point_in_polygon"
  | "zip_to_empower"
  | "osm_admin_lookup";

export interface JoinHop {
  from_key: ExternalKeyType;
  to_key: ExternalKeyType;
  method: JoinMethod;
  match_rate: number; // measured by Zetaris SQL, never an LLM confidence
  query_id?: string;
}

export interface DqResult {
  rule: string;
  passed: boolean;
  detail?: string;
}

export interface Fact {
  name: string;
  value: unknown;
  unit?: string;
  query_id: string;
}

export interface RuleCite {
  cite: string; // e.g. "42 CFR 494.62"
  plan_section?: string;
  page?: number;
}

export type MeterlessMode = "meterless/deep" | "meterless/fast" | "meterless/local";
export type ModelProvider = "local" | "nim" | "none";

export interface Reason {
  text: string;
  rule_cites?: RuleCite[];
  model_id?: string;
  mode?: MeterlessMode;
  provider?: ModelProvider;
  trace_id: string;
}

export interface Evidence {
  zetaris_query_ids: string[];
  sources: SourceRef[];
  data_as_of: DataAsOf[];
  join_path: JoinHop[];
  score: ScoreBreakdown;
  dq_results: DqResult[];
  failed_joins: FailedJoin[];
  facts: Fact[];
  reason?: Reason;
  ledger_ids?: string[];
}

export interface JoinProposal {
  id: string;
  from_table?: string;
  from_key: ExternalKeyType;
  to_table?: string;
  to_key: ExternalKeyType;
  method: JoinMethod;
  measured_match_rate?: number;
  fan_out?: number;
  threshold?: number;
  status: "proposed" | "accepted" | "refused";
  seen_before?: boolean;
  query_id?: string;
}

export interface FailedJoin {
  from_key: ExternalKeyType;
  to_key: ExternalKeyType;
  method: JoinMethod;
  reason: string;
  row_count?: number;
  query_id?: string;
}

export interface JoinReport {
  proposals: JoinProposal[];
  failed: FailedJoin[];
}

export interface TraceStep {
  step: string;
  model_id?: string;
  mode?: MeterlessMode | "none";
  provider: ModelProvider;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  tokens_per_sec?: number;
  trace_id?: string;
  query_ids?: string[];
  started_at: string;
  detail?: string;
}

export interface Trace {
  run_id: string;
  steps: TraceStep[];
}

export type CheckInStatus = "called" | "answered" | "no_answer";

export interface CheckIn {
  facility_id: string;
  status: CheckInStatus;
  by: string; // staff initials or role, never a patient or resident name
  at: string;
  note?: string;
}

export interface CheckInList {
  items: CheckIn[];
}

export type ContractAction =
  | "export_call_sheet"
  | "export_csv"
  | "draft_call_script";

export interface Contract {
  id: string;
  action: ContractAction;
  engine: "scout_intent";
  request_hash: string;
  inputs_hash?: string;
  evidence_ids?: string[];
  trace_ids?: string[];
  signed_at: string;
  signature: string;
  disclaimers?: string[];
}

export type ExportFormat = "csv" | "print_sheet" | "call_script";

export interface ExportArtifact {
  format: ExportFormat;
  sha256: string;
  href: string; // download path under /runs/{id}/exports/{export_id}/artifacts/{format}
  media_type?: string;
  filename?: string;
}

export interface ExportRequest {
  formats: ("csv" | "print_sheet" | "call_script")[];
  include_call_script?: boolean;
}

export interface ExportReceipt {
  export_id: string;
  run_id: string;
  created_at: string;
  artifacts: ExportArtifact[]; // one per requested format, each retrievable at href
  csv_sha256?: string; // present when the csv format was exported
  zetaris_query_ids: string[];
  snapshot_id: string;
  model_trace_ids?: string[];
  contract?: Contract;
  contract_signature: string;
  held?: string[]; // outputs Scout Intent held back (e.g. call script offline)
}

// A facility after ranking: GET /runs/{id}/facilities always carries
// score and evidence. Raw Facility stays for adapter output pre-scoring.
export interface RankedFacility extends Facility {
  score: ScoreBreakdown;
  evidence: Evidence;
}

export interface FacilityList {
  items: RankedFacility[];
  total?: number;
  empty_state?: EmptyState;
}

export type EmptyStateCode =
  | "no_facilities"
  | "no_alerts"
  | "no_joins"
  | "no_dependents_data";

export interface EmptyState {
  code: EmptyStateCode;
  message: string;
}

export type ErrorCode =
  | "not_found"
  | "bad_request"
  | "no_facilities"
  | "source_stale"
  | "zetaris_down"
  | "meterless_unauthorized"
  | "meterless_offline"
  | "timeout"
  | "export_refused";

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  detail?: unknown;
  retry_after_ms?: number;
}

export interface ApiError {
  error: ApiErrorBody;
}

export type ServiceState = "up" | "down" | "unauthorized" | "offline" | "degraded";

export interface ServiceStatus {
  status: ServiceState;
  latency_ms?: number;
  detail?: string;
}

export interface MeterlessStatus extends ServiceStatus {
  provider?: ModelProvider;
  mode?: string;
}

export interface Health {
  zetaris: ServiceStatus;
  meterless: MeterlessStatus;
  network: { status: "online" | "offline" };
  snapshot: {
    snapshot_id: string;
    data_as_of: DataAsOf[];
    age_minutes?: number;
  };
}
