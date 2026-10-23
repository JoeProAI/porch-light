import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { looksUnreachable, UNREACHABLE_MESSAGE } from "./national-gaps";
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

export class NationalEngineError extends Error {
  readonly unreachable: boolean;
  constructor(message: string, unreachable: boolean) {
    super(message);
    this.name = "NationalEngineError";
    this.unreachable = unreachable;
  }
}

const runPython = async (args: string[], timeout: number): Promise<string> => {
  try {
    const result = await execute(python(), args, {
      cwd: engineRoot(), timeout, maxBuffer: 48 * 1024 * 1024, windowsHide: true, encoding: "utf8",
    });
    return result.stdout;
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string; message?: string; code?: string };
    const detail = [failed.stderr, failed.stdout, failed.message, failed.code].filter(Boolean).join("\n");
    const unreachable = failed.code === "ENOENT" || failed.code === "ETIMEDOUT" || looksUnreachable(detail);
    throw new NationalEngineError(unreachable ? UNREACHABLE_MESSAGE : "The verified national operation failed. No substitute data was returned.", unreachable);
  }
};

const command = async (args: string[]): Promise<unknown> => JSON.parse(await runPython(["-m", "engines.national_jobs", ...args], 190000)) as unknown;

const publishActiveAlerts = async (): Promise<void> => {
  await runPython(["-m", "data.adapters.us.capture_live_weather", "--interval", "300", "--max-captures", "1"], 180000);
};

export const readNationalCatalog = async (refreshAlerts = false): Promise<unknown> => {
  if (!refreshAlerts && catalogCache && Date.now() < catalogCache.until) return catalogCache.value;
  if (!refreshAlerts && catalogPending) return catalogPending;
  const pending = (async () => {
    if (refreshAlerts) catalogCache = undefined;
    let refreshNote = "";
    if (refreshAlerts) {
      try { await publishActiveAlerts(); }
      catch (error) {
        if (error instanceof NationalEngineError && error.unreachable) throw error;
        refreshNote = "A new active-alert capture did not publish. This list is the latest audited feed only when that feed is still current.";
      }
    }
    const value = await command(["--catalog"]);
    if (!record(value) || !record(value.catalog) || !Array.isArray(value.catalog.counties) ||
      !record(value.catalog.data_access) || value.catalog.data_access.data_access_mode !== "zetaris" ||
      !Array.isArray(value.catalog.data_access.zetaris_query_ids) || !value.catalog.data_access.zetaris_query_ids.length) {
      throw new Error("The national catalog has no real source audit");
    }
    if (refreshNote && record(value.weather)) value.weather.refresh_note = refreshNote;
    catalogCache = { value, until: Date.now() + 30000 };
    return value;
  })();
  if (!refreshAlerts) catalogPending = pending;
  try { return await pending; }
  finally { if (!refreshAlerts) catalogPending = undefined; }
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
  child.once("error", () => { state.live = false; state.error = UNREACHABLE_MESSAGE; });
  child.once("close", code => { state.live = false; if (code && !state.error) state.error = "The local worker exited without a verified result."; });
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

export const readNationalRun = async (id: string): Promise<unknown> => {
  if (!validRun(id)) throw new Error("Invalid local run ID");
  const state = children.get(id);
  let status: unknown;
  try { status = (await readVerified(path.join(root, id, "status.json"))).value; }
  catch {
    if (state?.error) return { id, phase: "failed", message: state.error };
    if (state?.live) return { id, phase: "starting" };
    throw new Error("No verified local run checkpoint is available");
  }
  if (!record(status) || status.id !== id || typeof status.phase !== "string") throw new Error("Invalid run checkpoint");
  if (status.phase !== "completed") return status;
  const result = await readVerified(path.join(root, id, "snapshot.json"));
  return { ...status, snapshot: validateResult(result.value), provenance: result.provenance };
};

export const requestCallScript = async (ccn: string, run?: string): Promise<unknown> => {
  if (!/^[0-9A-Z]{6}$/.test(ccn) || run && !validRun(run)) throw new Error("Invalid verified facility/run reference");
  return command(["--call-script", ccn, ...(run ? ["--source-run", run] : [])]);
};
