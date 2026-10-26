import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readLiveWeather } from "@/lib/weather-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (request: Request): Promise<Response> => {
  try {
    const captureId = new URL(request.url).searchParams.get("capture") ?? "";
    const weather = await readLiveWeather(captureId);
    if (weather.data_access.data_access_mode === "public_nws") {
      return new Response("Hosted Storm Watch draws IEM radar tiles. The NOAA GIF loop stays on the local audited filestore. No substitute GIF is drawn.", {
        status: 404,
        headers: { "Cache-Control": "no-store", "X-Porchlight-Data-Access": "public_nws" },
      });
    }
    if (captureId !== weather.capture_id) {
      return new Response("Weather capture changed. Refresh the source metadata.", { status: 409 });
    }
    const root = await realpath(/* turbopackIgnore: true */ process.env.PORCHLIGHT_WEATHER_CACHE ??
      path.join(os.homedir(), ".porchlight", "live-weather"));
    const file = await realpath(/* turbopackIgnore: true */ weather.radar.file_path);
    const relative = path.relative(root, file);
    if (relative.startsWith("..") || path.isAbsolute(relative) || path.basename(file) !== "noaa-conus-loop.gif") {
      throw new Error("Radar path is outside the verified filestore");
    }
    const bytes = await readFile(/* turbopackIgnore: true */ file);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (bytes.length > 16 * 1024 * 1024 || hash !== weather.radar.sha256 ||
      !["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString())) {
      throw new Error("Radar source bytes do not verify");
    }
    const etag = `"${hash}"`;
    if (request.headers.get("If-None-Match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/gif", ETag: etag, "Cache-Control": "private, max-age=60",
        "X-Porchlight-Zetaris-Query": weather.data_access.zetaris_query_ids.join(","),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Verified radar unavailable. No replacement image is shown.", {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
};
