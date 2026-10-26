import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { auditedEngineRequired, markAuditedEngineDown, skipAuditedEngine } from "./audited-engine";
import { peekPublicWeather, readPublicWeather } from "./public-weather";
import type { LiveWeather, RadarMaps, RadarRegion } from "./weather-types";

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
type InternalRegion = RadarRegion & { file_path?: string; legend_file_path?: string };
type InternalWeather = Omit<LiveWeather, "radar" | "radar_maps"> & {
  radar: LiveWeather["radar"] & { file_path: string; content_type: string };
  radar_maps?: Omit<RadarMaps, "regions"> & { regions?: Record<string, InternalRegion> };
};
const cached = new Map<string, { value: InternalWeather; until: number }>();
const pending = new Map<string, Promise<InternalWeather>>();

const readAuditedWeather = async (captureId?: string): Promise<InternalWeather> => {
  if (captureId !== undefined && !/^[a-f0-9]{64}$/.test(captureId)) throw new Error("Invalid capture reference");
  const key = captureId ?? "latest";
  const previous = cached.get(key);
  if (previous && Date.now() < previous.until) return previous.value;
  if (pending.has(key)) return pending.get(key)!;
  const operation = (async () => {
    const { stdout } = await runEngine(
      ["-m", "engines.live_weather", ...(captureId ? ["--capture-id", captureId] : [])],
      {
        cwd: process.env.PORCHLIGHT_ENGINE_ROOT ?? path.resolve(process.cwd(), ".."),
        timeout: 190000, maxBuffer: 32 * 1024 * 1024, windowsHide: true,
      },
    );
    const value = JSON.parse(stdout) as InternalWeather;
    if (value.schema_version !== "porch-light.live-weather.v1" ||
      !/^[a-f0-9]{64}$/.test(value.capture_id) || !Array.isArray(value.alerts) ||
      value.data_access?.data_access_mode !== "zetaris" ||
      !value.data_access.zetaris_query_ids.length ||
      !Number.isFinite(Date.parse(value.captured_at))) {
      throw new Error("Weather publication lacks actual data or audit evidence");
    }
    if (captureId && value.capture_id !== captureId) throw new Error("Immutable capture identity mismatch");
    if (cached.size > 20) cached.delete(cached.keys().next().value!);
    cached.set(key, { value, until: Date.now() + 15000 });
    return value;
  })();
  pending.set(key, operation);
  try { return await operation; }
  finally { pending.delete(key); }
};

export const readLiveWeather = async (captureId?: string): Promise<InternalWeather> => {
  if (captureId !== undefined && !/^[a-f0-9]{64}$/.test(captureId)) throw new Error("Invalid capture reference");
  if (!skipAuditedEngine()) {
    try {
      return await readAuditedWeather(captureId);
    } catch (error) {
      if (captureId || auditedEngineRequired()) throw error;
      markAuditedEngineDown();
    }
  } else if (auditedEngineRequired()) {
    return readAuditedWeather(captureId);
  }
  if (captureId) {
    const pinned = peekPublicWeather(captureId);
    if (!pinned) throw new Error("Immutable capture identity mismatch");
    return pinned;
  }
  return readPublicWeather();
};

export const publicWeather = (value: InternalWeather): LiveWeather => {
  const { file_path: privatePath, content_type: contentType, ...radar } = value.radar;
  void privatePath;
  void contentType;
  const hosted = value.data_access.data_access_mode === "public_nws";
  const { radar_maps: privateMaps, ...base } = value;
  const maps: RadarMaps | undefined = privateMaps ? {
    ...privateMaps,
    regions: Object.fromEntries(Object.entries(privateMaps.regions ?? {}).map(([key, region]) => {
      const { file_path: imagePath, legend_file_path: legendPath, ...safe } = region;
      void imagePath; void legendPath;
      return [key, {
        ...safe,
        image_url: region.available ? `/api/weather/maps?capture=${value.capture_id}&region=${key}&asset=frame` : undefined,
        legend_url: region.available ? `/api/weather/maps?capture=${value.capture_id}&region=${key}&asset=legend` : undefined,
      }];
    })),
  } : undefined;
  return {
    ...base,
    radar: {
      ...radar,
      image_url: hosted && radar.image_url ? radar.image_url : `/api/weather/radar?capture=${value.capture_id}`,
    },
    radar_maps: maps,
  };
};
