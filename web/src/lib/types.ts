export type Coordinate = [number, number];
export type Geometry = { type: "MultiPolygon"; coordinates: Coordinate[][][] };
export type Source = { name: string; url: string; license: string };
export type Term = { name: string; input: number; weight: number; weighted: number };
export type Facility = {
  id: string;
  ccn: string;
  name: string;
  type: string;
  lat: number | null;
  lon: number | null;
  address: string;
  zip: string;
  phone: { status: string; value?: string; source?: Source };
  score: { total: number; terms: Term[]; formula_version: string; tie_break: string; rank: number };
  rank: number;
  computed_reason: string;
  evidence: {
    sources: Source[];
    data_as_of: { source: string; fetched_at: string; stale: boolean }[];
    dq_results: { rule: string; passed: boolean }[];
    source_artifact_path: string;
    source_sha256: string;
    geography_artifact_path: string;
    svi_artifact_path: string;
    geography: string;
    operator_geocode_review_required: boolean;
    model_explanation: unknown;
    zetaris_query_ids: string[];
  };
};
export type Snapshot = {
  schema_version: string;
  generated_at: string;
  county: { name: string; fips: string; state: string };
  scenario: { event: string; warning_year: number; mode: string; zone_geometry_vintage: string; historical_2024_boundary_equivalence_verified: boolean };
  data_access: { executed_at: string; data_access_mode: string; statement_sha256: string; zetaris_query_ids: string[]; transaction_id: string };
  source_snapshot_hash: string;
  warning_geometry: Geometry;
  policy: { version: string; clinical_validation: boolean; plan_year: number; plan_flag: string; empower_density_pct: string; cms_risk: string; plan_artifact: string; plan_sha256: string; plan_current_applicability_verified: boolean };
  counts: { source_rows: number; ranked_rows: number; refused_rows: number };
  facilities: Facility[];
  refused: { ccn: string; name: string; reason: string }[];
  model_executions: unknown[];
  limits: string[];
};
export type Provenance = { source_url: string; fetched_at_utc: string; sha256: string; license: string; fetch_command: string };
export const contactLabels = {
  uncontacted: "Not contacted",
  reached: "Reached",
  no_answer: "No answer",
  follow_up: "Follow-up needed",
} as const;
export type ContactStatus = keyof typeof contactLabels;
export type Contacts = Record<string, { status: ContactStatus; updatedAt: string }>;
