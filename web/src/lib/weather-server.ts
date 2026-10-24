import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { LiveWeather, RadarMaps, RadarRegion } from "./weather-types";

const execute = promisify(execFile);
type InternalRegion = RadarRegion & { file_path?: string; legend_file_path?: string };
type InternalWeather = Omit<LiveWeather, "radar" | "radar_maps"> & {
  radar: LiveWeather["radar"] & { file_path: string; content_type: string };
  radar_maps?: Omit<RadarMaps, "regions"> & { regions?: Record<string, InternalRegion> };
};
const cached = new Map<string, { value: InternalWeather; until: number }>();
const pending = new Map<string, Promise<InternalWeather>>();

export const readLiveWeather = async (captureId?: string): Promise<InternalWeather> => {
  if (captureId !== undefined && !/^[a-f0-9]{64}$/.test(captureId)) throw new Error("Invalid capture reference");
  const key = captureId ?? "latest";
  const previous = cached.get(key);
  if (previous && Date.now() < previous.until) return previous.value;
  if (pending.has(key)) return pending.get(key)!;
  const operation = (async () => {
    const { stdout } = await execute(
      process.env.PORCHLIGHT_PYTHON_EXECUTABLE ?? "python",
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

export const publicWeather = (value: InternalWeather): LiveWeather => {
  const { file_path: privatePath, ...radar } = value.radar;
  void privatePath;
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
    radar: { ...radar, image_url: `/api/weather/radar?capture=${value.capture_id}` },
    radar_maps: maps,
  };
};
