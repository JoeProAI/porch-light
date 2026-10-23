export type OfficialAlert = {
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
  zetaris_query_ids: string[];
};

export type LiveWeather = {
  schema_version: string;
  capture_id: string;
  captured_at: string;
  alerts: OfficialAlert[];
  alert_feed: { source_url: string; fetched_at: string; sha256: string; coverage: string };
  radar: {
    source_url: string; fetched_at: string; sha256: string;
    provider_last_modified: string | null; coverage: string; observation_time_note: string;
    image_url: string;
  };
  data_access: { data_access_mode: string; executed_at: string; zetaris_query_ids: string[] };
  limits: string[];
};

export const weatherFreshness = (capturedAt: string, now: number) => {
  const timestamp = Date.parse(capturedAt);
  if (!Number.isFinite(timestamp) || timestamp > now + 300000) return "unverified";
  return now - timestamp > 600000 ? "stale" : "recent";
};
