import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readLiveWeather } from "@/lib/weather-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const regions = new Set(["conus", "alaska", "hawaii", "caribbean", "guam"]);

export const GET = async (request: Request): Promise<Response> => {
  try {
    const params = new URL(request.url).searchParams;
    const regionKey = params.get("region") ?? "";
    const asset = params.get("asset");
    if (!regions.has(regionKey) || !["frame", "legend"].includes(asset ?? "")) {
      return new Response("Unknown provider map asset.", { status: 400 });
    }
    const captureId = params.get("capture") ?? "";
    const weather = await readLiveWeather(captureId);
    if (weather.data_access.data_access_mode === "public_nws") {
      return new Response("Regional NOAA frames stay on the local audited filestore. No substitute map is drawn.", {
        status: 404,
        headers: { "Cache-Control": "no-store", "X-Porchlight-Data-Access": "public_nws" },
      });
    }
    if (params.get("capture") !== weather.capture_id) {
      return new Response("Map capture changed. Refresh the metadata.", { status: 409 });
    }
    const region = weather.radar_maps?.regions?.[regionKey];
    if (!region?.available) throw new Error("No verified regional frame");
    const filePath = asset === "legend" ? region.legend_file_path : region.file_path;
    const expectedHash = asset === "legend" ? region.legend_sha256 : region.sha256;
    if (!filePath || !expectedHash) throw new Error("No verified map reference");
    const root = await realpath(/* turbopackIgnore: true */ process.env.PORCHLIGHT_WEATHER_CACHE ??
      path.join(os.homedir(), ".porchlight", "live-weather"));
    const file = await realpath(/* turbopackIgnore: true */ filePath);
    const relative = path.relative(root, file);
    const basename = asset === "legend" ? "noaa-radar-legend.png" : `noaa-radar-${regionKey}.png`;
    if (relative.startsWith("..") || path.isAbsolute(relative) || path.basename(file) !== basename) {
      throw new Error("Map reference outside the private filestore");
    }
    const bytes = await readFile(/* turbopackIgnore: true */ file);
    if (bytes.length > 16 * 1024 * 1024 ||
      !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      createHash("sha256").update(bytes).digest("hex") !== expectedHash) {
      throw new Error("Map source bytes do not verify");
    }
    return new Response(bytes, { headers: {
      "Content-Type": "image/png", "Cache-Control": "private, max-age=60",
      ETag: `"${expectedHash}"`, "X-Content-Type-Options": "nosniff",
      "X-Porchlight-Zetaris-Query": weather.data_access.zetaris_query_ids.join(","),
    } });
  } catch {
    return new Response("Verified NOAA map asset unavailable. No substitute is drawn.", {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
};
