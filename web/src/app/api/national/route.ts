import { UNREACHABLE_MESSAGE } from "@/lib/national-gaps";
import {
  listRecentCompletedNationalRuns, NationalEngineError, readNationalCatalog, readNationalRun,
  requestCallScript, startNationalRun, validRun, validatePublishedResult,
} from "@/lib/national-server";
import {
  listPublishedCountySummaries, publishedPackAvailable, readPublishedCatalog, readPublishedCounty,
} from "@/lib/national-published";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const publicHeaders = { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" };

const localHost = (request: Request): URL | null => {
  try {
    const target = new URL("http://" + request.headers.get("host"));
    return ["127.0.0.1", "localhost"].includes(target.hostname) && target.port === "3101" ? target : null;
  } catch { return null; }
};
const localOrigin = (request: Request): boolean => {
  const target = localHost(request);
  return !!target && request.headers.get("origin") === target.origin &&
    !["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") ?? "");
};
const failed = (error: unknown, fallback: string): Response => {
  const unreachable = error instanceof NationalEngineError && error.unreachable;
  return Response.json({ error: unreachable ? UNREACHABLE_MESSAGE : fallback, unreachable }, { status: 503, headers });
};

const publishedCompleted = async (fips: string): Promise<Response> => {
  const published = await readPublishedCounty(fips);
  return Response.json({
    id: published.id,
    phase: "completed",
    snapshot: validatePublishedResult(published.value),
    provenance: published.provenance,
    publication: { mode: "published_sweep_snapshot", fips },
  }, { headers: publicHeaders });
};

export const GET = async (request: Request): Promise<Response> => {
  const local = !!localHost(request) && request.headers.get("sec-fetch-site") !== "cross-site";
  const params = new URL(request.url).searchParams;
  const id = params.get("job");
  const recent = params.get("recent");
  const county = params.get("county");

  if (county !== null) {
    if (!/^\d{5}$/.test(county)) {
      return Response.json({ error: "County source code must be five digits." }, { status: 400, headers });
    }
    try {
      if (await publishedPackAvailable()) return await publishedCompleted(county);
      if (!local) {
        return Response.json({ error: "Local-origin access required." }, { status: 403, headers });
      }
      return Response.json({
        error: "No published audited snapshot is installed for hosted county reads.",
      }, { status: 404, headers });
    } catch (error) {
      return failed(error, "No published audited snapshot is available for this county. No substitute data was returned.");
    }
  }

  if (!local) {
    if (!(await publishedPackAvailable())) {
      return Response.json({ error: "Local-origin access required." }, { status: 403, headers });
    }
    if (id !== null && recent !== null) {
      return Response.json({ error: "Choose either a run reference or recent completed runs." }, { status: 400, headers });
    }
    if (recent !== null && recent !== "1") {
      return Response.json({ error: "Use recent=1 for published county summaries." }, { status: 400, headers });
    }
    try {
      if (recent === "1") {
        return Response.json({ recent: await listPublishedCountySummaries(20) }, { headers: publicHeaders });
      }
      if (id) {
        return Response.json({
          error: "Hosted reads use county=FIPS for published snapshots. Local job ids stay on localhost:3101.",
        }, { status: 400, headers });
      }
      const published = await readPublishedCatalog();
      return Response.json(published.value, { headers: publicHeaders });
    } catch (error) {
      return failed(error, "The published national catalog is unavailable. No sample counties are substituted.");
    }
  }

  if (id !== null && recent !== null) {
    return Response.json({ error: "Choose either a run reference or recent completed runs." }, { status: 400, headers });
  }
  if (id !== null && !validRun(id)) return Response.json({ error: "Invalid run reference." }, { status: 400, headers });
  if (recent !== null && recent !== "1") {
    return Response.json({ error: "Use recent=1 for completed local runs." }, { status: 400, headers });
  }
  try {
    if (id) return Response.json(await readNationalRun(id), { headers });
    if (recent === "1") return Response.json({ recent: await listRecentCompletedNationalRuns(20) }, { headers });
    return Response.json(await readNationalCatalog(), { headers });
  } catch (error) {
    return failed(error, id ? "No verified run result is available. No substitute data was returned." :
      recent === "1" ? "Completed local runs couldn't be listed. No sample counties were substituted." :
      "The audited national source catalog is unavailable. No sample counties are substituted.");
  }
};

export const POST = async (request: Request): Promise<Response> => {
  if (!localOrigin(request)) return Response.json({ error: "Same-origin local access is required for model operations." }, { status: 403, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "JSON is required." }, { status: 415, headers });
  const text = await request.text();
  if (text.length > 2048) return Response.json({ error: "The request is too large." }, { status: 413, headers });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "A source selection is required." }, { status: 400, headers });
  const value = body as Record<string, unknown>;
  try {
    if (value.action === "refresh_alerts") {
      if (Object.keys(value).length !== 1) return Response.json({ error: "Only actual source identifiers are accepted." }, { status: 400, headers });
      return Response.json(await readNationalCatalog(true), { headers });
    }
    if (value.action === "call_script") {
      if (typeof value.ccn !== "string" || value.run !== undefined && typeof value.run !== "string") {
        return Response.json({ error: "Select a verified facility." }, { status: 400, headers });
      }
      return Response.json(await requestCallScript(value.ccn, value.run as string | undefined), { headers });
    }
    if (Object.keys(value).some(key => !["county", "alert", "capture"].includes(key)) ||
      Object.values(value).some(entry => typeof entry !== "string")) return Response.json({ error: "Only actual source identifiers are accepted." }, { status: 400, headers });
    const id = startNationalRun(value as { county?: string; alert?: string; capture?: string });
    return Response.json({ id, phase: "starting" }, { status: 202, headers });
  } catch (error) {
    return failed(error, "The verified operation couldn't start or complete. No fabricated model reply was substituted.");
  }
};
