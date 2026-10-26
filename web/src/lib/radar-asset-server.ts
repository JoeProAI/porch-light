import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { auditedEngineRequired, markAuditedEngineDown, skipAuditedEngine } from "./audited-engine";
import { fetchPublicRadar } from "./public-radar";

const execute = promisify(execFile);
const pythonBins = (): string[] => process.env.PORCHLIGHT_PYTHON_EXECUTABLE
  ? [process.env.PORCHLIGHT_PYTHON_EXECUTABLE]
  : ["python", "python3"];
const runEngine = async (args: string[], options: { cwd: string; timeout: number; maxBuffer: number; windowsHide: boolean }) => {
  let last: unknown;
  for (const bin of pythonBins()) {
    try { return await execute(bin, args, options); }
    catch (error) {
      last = error;
      if ((error as { code?: string }).code !== "ENOENT") throw error;
    }
  }
  throw last;
};
type Audit = { query_id: string; finish_successfully: boolean; sql_query: string };
export type RadarAsset = {
  source_key: string; capture_id: string; captured_at: string; sha256: string;
  source_url: string; content_type: string; file_path: string; license: string;
  clock?: Record<string, unknown>; source_last_modified: string | null; limits: string[];
};
type Verified = { asset: RadarAsset; data_access: { data_access_mode: string; zetaris_query_ids: string[]; zetaris_audit?: Audit } };
const inlineBytes = new Map<string, Buffer>();
type Waiting = { resolve: (value: Verified) => void; reject: (error: Error) => void };
const cache = new Map<string, { value: Verified; until: number }>();
const pending = new Map<string, Promise<Verified>>();
const queue = new Map<string, Waiting>();
let scheduled = false;
let running = 0;
const frame = /^nexrad-n0q-900913(?:-m(?:05|10|15|20|25|30|35|40|45|50)m)?$/;

export const validRadarKey = (key: string): boolean => {
  if (key === "clock") return true;
  const parts = key.split("/");
  if (parts.length !== 4 || !frame.test(parts[0]) || parts.slice(1).some(value => !/^\d{1,4}$/.test(value))) return false;
  const [z, x, y] = parts.slice(1).map(Number);
  return z >= 0 && z <= 12 && x >= 0 && x < 2 ** z && y >= 0 && y < 2 ** z;
};

const schedule = () => {
  if (scheduled || running >= 2 || !queue.size) return;
  scheduled = true;
  setTimeout(() => { scheduled = false; void flush(); }, 80);
};

const flush = async () => {
  if (running >= 2 || !queue.size) return;
  const batch = [...queue.entries()].slice(0, 40);
  for (const [key] of batch) queue.delete(key);
  running++;
  try {
    const keys = batch.map(([key]) => key);
    const { stdout } = await runEngine(
      ["-m", "engines.radar_assets", "--keys", JSON.stringify(keys)], {
        cwd: process.env.PORCHLIGHT_ENGINE_ROOT ?? path.resolve(process.cwd(), ".."),
        timeout: 190000, maxBuffer: 2 * 1024 * 1024, windowsHide: true,
      });
    const result = JSON.parse(stdout) as { schema_version: string; assets: RadarAsset[]; data_access: Verified["data_access"] };
    const access = result.data_access;
    if (result.schema_version !== "porch-light.radar-assets.v1" || access?.data_access_mode !== "zetaris" ||
      !access.zetaris_audit?.finish_successfully || !/^\d+$/.test(access.zetaris_audit.query_id) ||
      access.zetaris_query_ids.length !== 1 || access.zetaris_query_ids[0] !== access.zetaris_audit.query_id ||
      result.assets.length !== keys.length || new Set(result.assets.map(asset => asset.source_key)).size !== keys.length) {
      throw new Error("Radar source audit closure failed");
    }
    const values = new Map(result.assets.map(asset => [asset.source_key, asset]));
    for (const [key] of batch) {
      const asset = values.get(key);
      if (!asset || !/^[a-f0-9]{64}$/.test(asset.capture_id) || !/^[a-f0-9]{64}$/.test(asset.sha256) ||
        !Number.isFinite(Date.parse(asset.captured_at))) throw new Error("Radar source identity is incomplete");
    }
    for (const [key, waiting] of batch) {
      const asset = values.get(key)!;
      const value = { asset, data_access: access };
      cache.set(key, { value, until: Date.parse(asset.captured_at) + 300000 });
      waiting.resolve(value);
    }
    while (cache.size > 1600) cache.delete(cache.keys().next().value!);
  } catch {
    for (const [, waiting] of batch) waiting.reject(new Error("Audited IEM source unavailable. No asset or timestamp fallback."));
  } finally {
    for (const [key] of batch) pending.delete(key);
    running--;
    schedule();
  }
};

const readAuditedRadarAsset = async (key: string): Promise<Verified> => {
  if (!validRadarKey(key)) throw new Error("Unsupported IEM source");
  const previous = cache.get(key);
  if (previous && Date.now() < previous.until) return previous.value;
  const existing = pending.get(key);
  if (existing) return existing;
  if (pending.size >= 256) throw new Error("The bounded radar queue is full. Retry after current source reads finish.");
  const operation = new Promise<Verified>((resolve, reject) => queue.set(key, { resolve, reject }));
  pending.set(key, operation);
  schedule();
  return operation;
};

const rememberInline = (captureId: string, bytes: Buffer) => {
  inlineBytes.set(captureId, bytes);
  while (inlineBytes.size > 400) inlineBytes.delete(inlineBytes.keys().next().value!);
};

export const readRadarAsset = async (key: string): Promise<Verified> => {
  if (!validRadarKey(key)) throw new Error("Unsupported IEM source");
  if (!skipAuditedEngine()) {
    try {
      return await readAuditedRadarAsset(key);
    } catch (error) {
      if (auditedEngineRequired()) throw error;
      markAuditedEngineDown();
    }
  } else if (auditedEngineRequired()) {
    return readAuditedRadarAsset(key);
  }
  const pub = await fetchPublicRadar(key);
  rememberInline(pub.asset.capture_id, pub.bytes);
  return { asset: pub.asset, data_access: pub.data_access };
};

export const readRadarBytes = async (asset: RadarAsset): Promise<Buffer> => {
  const inline = inlineBytes.get(asset.capture_id);
  if (inline) {
    if (createHash("sha256").update(inline).digest("hex") !== asset.sha256) {
      throw new Error("Radar checksum or source sidecar refused");
    }
    return inline;
  }
  if (!asset.file_path) throw new Error("Radar filestore boundary refused");
  const root = path.resolve(homedir(), ".porchlight", "radar-assets") + path.sep;
  const file = path.resolve(asset.file_path);
  if (!file.startsWith(root)) throw new Error("Radar filestore boundary refused");
  const bytes = await readFile(/* turbopackIgnore: true */ file);
  const sidecar = JSON.parse(await readFile(/* turbopackIgnore: true */ file + ".provenance.json", "utf-8")) as {
    sha256: string; source_url: string; fetched_at_utc: string;
  };
  if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256 ||
    sidecar.sha256 !== asset.sha256 || sidecar.source_url !== asset.source_url ||
    !Number.isFinite(Date.parse(sidecar.fetched_at_utc))) throw new Error("Radar checksum or source sidecar refused");
  return bytes;
};
