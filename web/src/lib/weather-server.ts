import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { LiveWeather } from "./weather-types";

const execute = promisify(execFile);
type InternalWeather = Omit<LiveWeather, "radar"> & {
  radar: LiveWeather["radar"] & { file_path: string; content_type: string };
};
let cached: { value: InternalWeather; until: number } | undefined;
let pending: Promise<InternalWeather> | undefined;

export const readLiveWeather = async (): Promise<InternalWeather> => {
  if (cached && Date.now() < cached.until) return cached.value;
  if (pending) return pending;
  pending = (async () => {
    const { stdout } = await execute(
      process.env.PORCHLIGHT_PYTHON_EXECUTABLE ?? "python",
      ["-m", "engines.live_weather"],
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
    cached = { value, until: Date.now() + 15000 };
    return value;
  })();
  try { return await pending; }
  finally { pending = undefined; }
};

export const publicWeather = (value: InternalWeather): LiveWeather => {
  const { file_path: privatePath, ...radar } = value.radar;
  void privatePath;
  return {
    ...value,
    radar: { ...radar, image_url: `/api/weather/radar?capture=${value.capture_id}` },
  };
};
