import { createHash } from "node:crypto";
import { hasAlertShape } from "./geo.ts";
import type { LiveWeather, MapGeometry, OfficialAlert } from "./weather-types";

export const NWS_ALERT_URL = "https://api.weather.gov/alerts/active";
export const IEM_CLOCK_URL = "https://mesonet.agron.iastate.edu/json/radar.py?operation=list&radar=USCOMP&product=N0Q";
const USER_AGENT = "PorchLight (joe@joepro.ai)";
const MAX_BYTES = 8 * 1024 * 1024;

export type PublicWeather = Omit<LiveWeather, "radar"> & {
  radar: LiveWeather["radar"] & { file_path: string; content_type: string };
};

const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;

const geometryOf = (value: unknown): MapGeometry | null => {
  if (!value || typeof value !== "object") return null;
  return hasAlertShape(value as MapGeometry) ? value as MapGeometry : null;
};

export const alertsFromFeed = (payload: unknown): OfficialAlert[] => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Official active-alert response is not a FeatureCollection");
  }
  const collection = payload as { type?: unknown; features?: unknown };
  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error("Official active-alert response is not a FeatureCollection");
  }
  if (collection.features.length > 5000) throw new Error("Official active-alert feed is larger than the bounded read");
  const alerts: OfficialAlert[] = [];
  for (const feature of collection.features) {
    if (!feature || typeof feature !== "object") continue;
    const row = feature as { id?: unknown; properties?: unknown; geometry?: unknown };
    const properties = row.properties;
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) continue;
    const id = typeof row.id === "string" ? row.id : text((properties as { id?: unknown }).id);
    if (!id || !id.startsWith("https://api.weather.gov/alerts/")) continue;
    const fields = properties as Record<string, unknown>;
    alerts.push({
      id,
      status: text(fields.status),
      event: text(fields.event),
      severity: text(fields.severity),
      urgency: text(fields.urgency),
      certainty: text(fields.certainty),
      areaDesc: text(fields.areaDesc),
      headline: text(fields.headline),
      description: text(fields.description),
      instruction: text(fields.instruction),
      effective: text(fields.effective),
      expires: text(fields.expires),
      senderName: text(fields.senderName),
      geometry: geometryOf(row.geometry),
      zetaris_query_ids: [],
    });
  }
  return alerts;
};

const fetchDocument = async (url: string, accept: string): Promise<{ bytes: Buffer; fetchedAt: string }> => {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
    headers: { "User-Agent": USER_AGENT, Accept: accept },
  });
  if (response.status !== 200) throw new Error("Public weather source did not return the document");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error("Public weather source is outside the bounded size");
  return { bytes, fetchedAt: new Date().toISOString() };
};

let cached: { value: PublicWeather; until: number } | undefined;
let pending: Promise<PublicWeather> | undefined;

export const peekPublicWeather = (captureId: string): PublicWeather | undefined =>
  cached && cached.value.capture_id === captureId ? cached.value : undefined;

export const readPublicWeather = async (): Promise<PublicWeather> => {
  if (cached && Date.now() < cached.until) return cached.value;
  if (pending) return pending;
  const operation = (async () => {
    const [alertsDoc, clockDoc] = await Promise.all([
      fetchDocument(NWS_ALERT_URL, "application/geo+json, application/json"),
      fetchDocument(IEM_CLOCK_URL, "application/json"),
    ]);
    const payload = JSON.parse(alertsDoc.bytes.toString("utf8")) as { updated?: unknown };
    const clock = JSON.parse(clockDoc.bytes.toString("utf8")) as { scans?: { ts?: unknown }[] };
    const latest = clock.scans?.[0]?.ts;
    if (typeof latest !== "string" || !Number.isFinite(Date.parse(latest))) {
      throw new Error("IEM radar clock did not include a scan time");
    }
    const alerts = alertsFromFeed(payload);
    const alertSha = createHash("sha256").update(alertsDoc.bytes).digest("hex");
    const clockSha = createHash("sha256").update(clockDoc.bytes).digest("hex");
    const capturedAt = new Date().toISOString();
    const captureId = createHash("sha256").update(alertSha + clockSha + capturedAt).digest("hex");
    const value: PublicWeather = {
      schema_version: "porch-light.live-weather.v1",
      capture_id: captureId,
      captured_at: capturedAt,
      alerts,
      alert_feed: {
        source_url: NWS_ALERT_URL,
        fetched_at: alertsDoc.fetchedAt,
        sha256: alertSha,
        coverage: "US National Weather Service active-alert feed",
        provider_updated_at: typeof payload.updated === "string" ? payload.updated : undefined,
      },
      radar: {
        source_url: IEM_CLOCK_URL,
        fetched_at: clockDoc.fetchedAt,
        sha256: clockSha,
        provider_last_modified: null,
        file_path: "",
        content_type: "application/json",
        image_url: "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png",
        tile_template: "/api/weather/radar-assets/nexrad-n0q-900913/{z}/{x}/{y}.png",
        coverage: "Contiguous United States IEM composite. Alaska, Hawaii and territories are not in this radar layer.",
        observation_time_note: "Frame time is the IEM USCOMP N0Q clock. This hosted read is the public tile layer, not the NOAA GIF loop and not a Zetaris audit.",
      },
      data_access: {
        data_access_mode: "public_nws",
        executed_at: capturedAt,
        zetaris_query_ids: [],
        source_note: "Direct fetch of the public National Weather Service active-alert feed and the Iowa Environmental Mesonet radar clock. Not a Zetaris query. No query id is assigned.",
      },
      limits: [
        "Observed weather, not a forecast, outage report or facility-condition feed.",
        "This hosted capture is a direct public-source read. It is not a Zetaris audit.",
        "National alert discovery does not establish facility ranking coverage.",
        "Some alerts have no polygon. No geometry is invented from area text.",
        "Follow the original official warning instructions.",
      ],
    };
    cached = { value, until: Date.now() + 45_000 };
    return value;
  })();
  pending = operation;
  try { return await operation; }
  finally { pending = undefined; }
};
