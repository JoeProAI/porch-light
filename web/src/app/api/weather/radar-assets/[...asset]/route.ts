import { readRadarAsset, readRadarBytes, validRadarKey } from "@/lib/radar-asset-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (request: Request, context: { params: Promise<{ asset: string[] }> }): Promise<Response> => {
  const { asset: parts } = await context.params;
  const key = parts.join("/").replace(/\.png$/, "");
  if (!validRadarKey(key) || request.headers.get("sec-fetch-site") === "cross-site") {
    return new Response("Invalid local radar asset request.", { status: 400 });
  }
  try {
    const verified = await readRadarAsset(key);
    const bytes = await readRadarBytes(verified.asset);
    const headers = {
      "Cache-Control": "private, max-age=30",
      "X-Porchlight-Zetaris-Query": verified.data_access.zetaris_query_ids.join(","),
      "X-Porchlight-Source-Capture": verified.asset.capture_id,
      "X-Porchlight-Source-SHA256": verified.asset.sha256,
    };
    if (key === "clock") {
      const { file_path, clock, ...source } = verified.asset;
      void file_path;
      return Response.json({ ...JSON.parse(bytes.toString("utf-8")), source, data_access: verified.data_access }, { headers });
    }
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/png" } });
  } catch {
    return new Response("Audited radar source unavailable. No substituted image or timestamp.", {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }
};
