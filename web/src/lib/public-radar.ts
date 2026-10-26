import { createHash } from "node:crypto";

const USER_AGENT = "PorchLight (joe@joepro.ai)";
const CLOCK_URL = "https://mesonet.agron.iastate.edu/json/radar.py?operation=list&radar=USCOMP&product=N0Q";
const LICENSE = "Iowa Environmental Mesonet public data; source terms: https://mesonet.agron.iastate.edu/disclaimer.php";

export type PublicRadarAsset = {
  source_key: string; capture_id: string; captured_at: string; sha256: string;
  source_url: string; content_type: string; file_path: string; license: string;
  source_last_modified: string | null; limits: string[];
};
export type PublicRadar = {
  asset: PublicRadarAsset;
  bytes: Buffer;
  data_access: { data_access_mode: "public_iem"; zetaris_query_ids: string[] };
};

const cache = new Map<string, { value: PublicRadar; until: number }>();
const pending = new Map<string, Promise<PublicRadar>>();

const sourceFor = (key: string): { url: string; kind: "clock" | "png" } => {
  if (key === "clock") return { url: CLOCK_URL, kind: "clock" };
  return { url: `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/${key}.png`, kind: "png" };
};

const load = async (key: string): Promise<PublicRadar> => {
  const source = sourceFor(key);
  const response = await fetch(source.url, {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent": USER_AGENT,
      Accept: source.kind === "clock" ? "application/json" : "image/png",
    },
  });
  if (response.status !== 200) throw new Error("IEM radar source did not return the asset");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) throw new Error("IEM radar asset is outside the bounded size");
  if (source.kind === "clock") {
    const parsed = JSON.parse(bytes.toString("utf8")) as { scans?: unknown };
    const ts = Array.isArray(parsed.scans) ? (parsed.scans[0] as { ts?: unknown } | undefined)?.ts : undefined;
    if (typeof ts !== "string" || !Number.isFinite(Date.parse(ts))) throw new Error("IEM radar clock did not include a scan time");
  } else if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error("IEM radar tile is not a PNG");
  }
  const capturedAt = new Date().toISOString();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const captureId = createHash("sha256").update(source.url + sha256 + capturedAt).digest("hex");
  return {
    bytes,
    asset: {
      source_key: key,
      capture_id: captureId,
      captured_at: capturedAt,
      sha256,
      source_url: source.url,
      content_type: source.kind === "clock" ? "application/json" : "image/png",
      file_path: "",
      license: LICENSE,
      source_last_modified: response.headers.get("last-modified"),
      limits: [
        "Direct public IEM read. Not a Zetaris audit. No query id is assigned.",
        "Capture time is not radar observation time.",
      ],
    },
    data_access: { data_access_mode: "public_iem", zetaris_query_ids: [] },
  };
};

export const fetchPublicRadar = async (key: string): Promise<PublicRadar> => {
  const hit = cache.get(key);
  if (hit && Date.now() < hit.until) return hit.value;
  const existing = pending.get(key);
  if (existing) return existing;
  const operation = load(key).then(value => {
    cache.set(key, { value, until: Date.now() + 90_000 });
    while (cache.size > 400) cache.delete(cache.keys().next().value!);
    return value;
  });
  pending.set(key, operation);
  try { return await operation; }
  finally { pending.delete(key); }
};
