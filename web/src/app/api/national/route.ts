import { UNREACHABLE_MESSAGE } from "@/lib/national-gaps";
import { NationalEngineError, readNationalCatalog, readNationalRun, requestCallScript, startNationalRun, validRun } from "@/lib/national-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
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

export const GET = async (request: Request): Promise<Response> => {
  if (!localHost(request) || request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "Local-origin access required." }, { status: 403, headers });
  const id = new URL(request.url).searchParams.get("job");
  if (id !== null && !validRun(id)) return Response.json({ error: "Invalid run reference." }, { status: 400, headers });
  try { return Response.json(id ? await readNationalRun(id) : await readNationalCatalog(), { headers }); }
  catch (error) {
    return failed(error, id ? "No verified run result is available. No substitute data was returned." :
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
