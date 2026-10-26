import type { LiveWeather } from "./weather-types";

export const acceptedLiveWeather = (next: LiveWeather): boolean => {
  if (next.schema_version !== "porch-light.live-weather.v1" || !Array.isArray(next.alerts) || !next.data_access) return false;
  const mode = next.data_access.data_access_mode;
  if (mode === "zetaris") {
    return next.data_access.zetaris_query_ids.length > 0 && next.alerts.every(alert =>
      alert.zetaris_query_ids.every(id => next.data_access.zetaris_query_ids.includes(id)));
  }
  if (mode === "public_nws") {
    return next.data_access.zetaris_query_ids.length === 0
      && next.alert_feed?.source_url === "https://api.weather.gov/alerts/active"
      && /^[a-f0-9]{64}$/.test(next.alert_feed.sha256)
      && next.alerts.every(alert => alert.id.startsWith("https://api.weather.gov/alerts/") && alert.zetaris_query_ids.length === 0);
  }
  return false;
};
