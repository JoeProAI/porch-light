import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { access, readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { Provenance, Snapshot } from "./types";

const execute = promisify(execFile);
const root = path.join(os.homedir(), ".porchlight", "national", "jobs");
const children = new Map<string, { live: boolean; error?: string }>();
let catalogCache: { value: unknown; until: number } | undefined;
let catalogPending: Promise<unknown> | undefined;
const python = () => process.env.PORCHLIGHT_PYTHON_EXECUTABLE ?? "python";
const engineRoot = () => process.env.PORCHLIGHT_ENGINE_ROOT ?? path.resolve(process.cwd(), "..");
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const command = async (args: string[], timeout = 190000): Promise<unknown> => {
  const { stdout } = await execute(python(), ["-m", "engines.national_jobs", ...args], {
    cwd: engineRoot(), timeout, maxBuffer: 48 * 1024 * 1024, windowsHide: true,
    encoding: "utf8",
  });
  return JSON.parse(stdout) as unknown;
};

export const readNationalCatalog = async (): Promise<unknown> => {
  if (catalogCache && Date.now() < catalogCache.until) return catalogCache.value;
  if (catalogPending) return catalogPending;
  catalogPending = (async () => {
    const value = await command(["--catalog"]);
    if (!record(value) || !record(value.catalog) || !Array.isArray(value.catalog.counties) ||
      !record(value.catalog.data_access) || value.catalog.data_access.data_access_mode !== "zetaris" ||
      !Array.isArray(value.catalog.data_access.zetaris_query_ids) || !value.catalog.data_access.zetaris_query_ids.length) {
      throw new Error("The national catalog has no real source audit");
    }
    catalogCache = { value, until: Date.now() + 30000 };
    return value;
  })();
  try { return await catalogPending; }
  finally { catalogPending = undefined; }
};

export const validRun = (id: string): boolean => /^[a-f0-9]{32}$/.test(id);
export const startNationalRun = (selection: { county?: string; alert?: string; capture?: string }): string => {
  if (selection.county && !/^\d{5}$/.test(selection.county)) throw new Error("Invalid county source code");
  if (selection.alert && (!selection.alert.startsWith("https://api.weather.gov/alerts/") ||
    selection.alert.length > 500)) throw new Error("Invalid official alert identifier");
  if (!!selection.county === !!selection.alert) throw new Error("Choose one county or one official alert");
  if (selection.capture && !/^[a-f0-9]{64}$/.test(selection.capture)) throw new Error("Invalid weather capture");
  if ([...children.values()].filter(child => child.live).length >= 2) throw new Error("Two local runs are already processing. Wait for a result.");
  const id = randomUUID().replaceAll("-", "");
  const state: { live: boolean; error?: string } = { live: true };
  const args = ["-m", "engines.national_jobs", "--job", id,
    ...(selection.county ? ["--county", selection.county] : ["--alert", selection.alert!]),
    ...(selection.capture ? ["--weather-capture", selection.capture] : [])];
  const child = spawn(/* turbopackIgnore: true */ python(), args, { cwd: engineRoot(), windowsHide: true, stdio: "ignore", detached: false });
  children.set(id, state);
  child.once("error", () => { state.live = false; state.error = "The local audited source worker couldn't start."; });
  child.once("close", code => { state.live = false; if (code) state.error = "The local worker exited without a verified result."; });
  child.unref();
  return id;
};

const readVerified = async (file: string): Promise<{ value: unknown; provenance: Provenance }> => {
  const [bytes, sidecar] = await Promise.all([readFile(file), readFile(file + ".provenance.json", "utf8")]);
  const provenance: unknown = JSON.parse(sidecar);
  if (!record(provenance) || provenance.sha256 !== createHash("sha256").update(bytes).digest("hex") ||
    typeof provenance.source_url !== "string" || typeof provenance.fetched_at_utc !== "string" ||
    typeof provenance.license !== "string" || typeof provenance.fetch_command !== "string") {
    throw new Error("Source-derived artifact checksum or provenance failed");
  }
  return { value: JSON.parse(bytes.toString("utf8")) as unknown, provenance: provenance as Provenance };
};

const validateResult = (value: unknown): Snapshot | Record<string, unknown> => {
  if (!record(value) || !record(value.data_access) || value.data_access.data_access_mode !== "zetaris" ||
    !Array.isArray(value.data_access.chain_steps) || !Array.isArray(value.data_access.zetaris_query_ids)) {
    throw new Error("A result is missing audited source steps");
  }
  const ids = new Set(value.data_access.zetaris_query_ids);
  if (!ids.size || ids.size !== value.data_access.zetaris_query_ids.length ||
    [...ids].some(id => typeof id !== "string" || !/^\d+$/.test(id))) throw new Error("Invalid source audit IDs");
  for (const step of value.data_access.chain_steps) {
    if (!record(step) || !record(step.audit) || step.audit.finish_successfully !== true ||
      !ids.has(step.audit.query_id) || !step.audit.end_time) throw new Error("An audit receipt isn't closed");
  }
  if (value.state === "source_gap") return value;
  const snapshot = value as unknown as Snapshot;
  if (snapshot.schema_version !== "porch-light.national-run.v1" ||
    !Array.isArray(snapshot.facilities) || !Array.isArray(snapshot.refused) ||
    snapshot.counts.ranked_rows !== snapshot.facilities.length ||
    snapshot.counts.refused_rows !== snapshot.refused.length ||
    snapshot.counts.source_rows !== snapshot.facilities.length + snapshot.refused.length ||
    !/^[a-f0-9]{64}$/.test(snapshot.source_snapshot_hash) ||
    snapshot.warning_geometry?.type !== "MultiPolygon") throw new Error("National source cardinality or geometry is invalid");
  const seen = new Set<string>();
  snapshot.facilities.forEach((row, index) => {
    const total = row.score.terms.reduce((sum, term) => sum + term.weighted, 0);
    if (seen.has(row.id) || row.rank !== index + 1 || !Number.isFinite(row.score.total) ||
      Math.abs(total - row.score.total) > 1e-10 || !row.evidence.zetaris_query_ids.length ||
      row.evidence.zetaris_query_ids.some(id => !ids.has(id))) throw new Error("A ranked row changed identity, score or audit references");
    seen.add(row.id);
  });
  return snapshot;
};


export type RecentNationalRun = {
  id: string;
  county_name: string;
  state: string;
  fips: string;
  facility_count: number;
  alert_event: string | null;
  generated_at: string;
};

const summarizeCompletedSnapshot = (id: string, value: unknown): RecentNationalRun | null => {
  if (!record(value) || !record(value.county) || !record(value.counts) || !record(value.scenario)) return null;
  const county = value.county;
  const counts = value.counts;
  const scenario = value.scenario;
  if (typeof county.name !== "string" || typeof county.state !== "string" || typeof county.fips !== "string") return null;
  if (typeof value.generated_at !== "string" || typeof counts.ranked_rows !== "number" || !Number.isFinite(counts.ranked_rows)) return null;
  const facilities = Array.isArray(value.facilities) ? value.facilities.length : counts.ranked_rows;
  // Prefer the ranked cardinality when present; never invent a higher count.
  const facility_count = value.state === "source_gap" ? 0 : Math.max(0, Math.trunc(counts.ranked_rows || facilities));
  const alert_event = typeof scenario.event === "string" && scenario.event.trim() ? scenario.event : null;
  return {
    id,
    county_name: county.name,
    state: county.state,
    fips: county.fips,
    facility_count,
    alert_event,
    generated_at: value.generated_at,
  };
};

export const listRecentCompletedNationalRuns = async (limit = 20): Promise<RecentNationalRun[]> => {
  const cap = Math.min(Math.max(1, Math.trunc(limit)), 20);
  let entries: string[] = [];
  try { entries = await readdir(root); }
  catch { return []; }
  const ranked: { id: string; mtime: number }[] = [];
  for (const name of entries) {
    if (!validRun(name)) continue;
    try {
      const info = await stat(path.join(root, name));
      if (!info.isDirectory()) continue;
      ranked.push({ id: name, mtime: info.mtimeMs });
    } catch { /* missing entry */ }
  }
  ranked.sort((a, b) => b.mtime - a.mtime);
  const recent: RecentNationalRun[] = [];
  for (const item of ranked) {
    if (recent.length >= cap) break;
    try {
      const status = (await readVerified(path.join(root, item.id, "status.json"))).value;
      if (!record(status) || status.id !== item.id || status.phase !== "completed") continue;
      const snapshot = (await readVerified(path.join(root, item.id, "snapshot.json"))).value;
      const summary = summarizeCompletedSnapshot(item.id, snapshot);
      if (summary) recent.push(summary);
    } catch { /* incomplete or unverified job folder */ }
  }
  return recent;
};

export const readNationalRun = async (id: string): Promise<unknown> => {
  if (!validRun(id)) throw new Error("Invalid local run ID");
  const state = children.get(id);
  if (state?.error) return { id, phase: "failed", message: state.error };
  let status: unknown;
  try { status = (await readVerified(path.join(root, id, "status.json"))).value; }
  catch {
    if (state?.live) return { id, phase: "starting" };
    // A bookmarked run with no folder can never complete; a non-terminal error would keep the
    // client polling and leave the whole nationwide form disabled.
    try { await access(path.join(root, id)); }
    catch { return { id, phase: "failed", message: "No verified checkpoint exists for this run reference. Start a new county or alert run." }; }
    throw new Error("No verified local run checkpoint is available");
  }
  if (!record(status) || status.id !== id || typeof status.phase !== "string") throw new Error("Invalid run checkpoint");
  if (!["grounding_nemotron_drafts", "completed", "failed"].includes(status.phase)) return status;
  try {
    const result = await readVerified(path.join(root, id, "snapshot.json"));
    return { ...status, snapshot: validateResult(result.value), provenance: result.provenance };
  } catch {
    if (status.phase === "completed") throw new Error("The completed source result failed verification");
    return status;
  }
};

export const requestCallScript = async (ccn: string, run?: string): Promise<unknown> => {
  if (!/^[0-9A-Z]{6}$/.test(ccn) || run && !validRun(run)) throw new Error("Invalid verified facility/run reference");
  // Both bounded provider attempts must finish so the sole retry and its receipt survive a slow route.
  return command(["--call-script", ccn, ...(run ? ["--source-run", run] : [])], 420000);
};
