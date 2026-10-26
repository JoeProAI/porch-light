export type MapGeometry = { type: "Polygon"; coordinates: number[][][] } |
  { type: "MultiPolygon"; coordinates: number[][][][] };
export type StateFeature = { type: "Feature"; properties: { NAME?: string; STUSAB?: string }; geometry: MapGeometry };
export type RadarRegion = {
  available: boolean; name: string; detail?: string; layer?: string; frame_time?: string;
  bbox?: number[]; crs?: string; width?: number; height?: number; sha256?: string;
  source_url?: string; image_url?: string; legend_url?: string; legend_sha256?: string;
};
export type RadarMaps = {
  available: boolean; detail?: string;
  regions?: Record<string, RadarRegion>;
  states?: { type: "FeatureCollection"; features: StateFeature[] };
  state_source?: { source_url: string; sha256: string };
  limits?: string[];
};

export type OfficialAlert = {
  status?: string | null;
  id: string;
  event: string | null;
  severity: string | null;
  urgency: string | null;
  certainty: string | null;
  areaDesc: string | null;
  headline: string | null;
  description: string | null;
  instruction: string | null;
  effective: string | null;
  expires: string | null;
  senderName: string | null;
  geometry?: MapGeometry | null;
  zetaris_query_ids: string[];
};

export type LiveWeather = {
  schema_version: string;
  capture_id: string;
  captured_at: string;
  alerts: OfficialAlert[];
  alert_feed: { source_url: string; fetched_at: string; sha256: string; coverage: string; provider_updated_at?: string };
  radar: {
    source_url: string; fetched_at: string; sha256: string;
    provider_last_modified: string | null; coverage: string; observation_time_note: string;
    image_url: string;
    tile_template?: string;
  };
  data_access: {
    data_access_mode: string; executed_at: string; zetaris_query_ids: string[];
    source_note?: string;
  };
  limits: string[];
  radar_maps?: RadarMaps;
};

export const weatherFreshness = (capturedAt: string, now: number) => {
  const timestamp = Date.parse(capturedAt);
  if (!Number.isFinite(timestamp) || timestamp > now + 300000) return "unverified";
  return now - timestamp > 600000 ? "stale" : "recent";
};
