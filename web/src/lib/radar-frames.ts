export type RadarFrame = { id: string; offsetMinutes: number; label: string };

const offsets = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0] as const;

export const radarFrames: RadarFrame[] = offsets.map(offsetMinutes => ({
  id: offsetMinutes === 0 ? "nexrad-n0q-900913" : `nexrad-n0q-900913-m${String(offsetMinutes).padStart(2, "0")}m`,
  offsetMinutes,
  label: offsetMinutes === 0
    ? "Latest IEM composite"
    : `${offsetMinutes} minutes before the latest IEM composite`,
}));

export const radarTileUrl = (id: string): string =>
  `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/${id}/{z}/{x}/{y}.png`;

export const IEM_CLOCK_URL = "https://mesonet.agron.iastate.edu/json/radar.py?operation=list&radar=USCOMP&product=N0Q";

export type IemClock = { latest: string };

export const parseIemClock = (payload: unknown): IemClock | null => {
  if (!payload || typeof payload !== "object") return null;
  const scans = (payload as { scans?: unknown }).scans;
  if (!Array.isArray(scans) || scans.length === 0) return null;
  const ts = (scans[0] as { ts?: unknown }).ts;
  if (typeof ts !== "string") return null;
  const parsed = Date.parse(ts);
  if (!Number.isFinite(parsed)) return null;
  return { latest: new Date(parsed).toISOString() };
};

export const derivedFrameTime = (latestIso: string, offsetMinutes: number): string | null => {
  const parsed = Date.parse(latestIso);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed - offsetMinutes * 60_000).toISOString();
};
