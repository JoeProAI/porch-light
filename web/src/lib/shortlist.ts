export const SHORTLIST_CAP = 8;

export const toggleShortlist = (current: readonly string[], fips: string, additive: boolean): string[] => {
  if (!/^\d{5}$/.test(fips)) return [...current];
  const has = current.includes(fips);
  if (!additive) return has && current.length === 1 ? [...current] : [fips];
  if (has) return current.filter(id => id !== fips);
  if (current.length >= SHORTLIST_CAP) return [...current];
  return [...current, fips];
};

const csvField = (value: string): string => /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

export const shortlistCsv = (rows: readonly { fips: string; name: string; state: string; alerts: readonly string[] }[]): string => {
  const lines = ["fips,name,state,alerts"];
  for (const row of rows) {
    const alerts = [...new Set(row.alerts.filter(Boolean))].sort();
    lines.push([row.fips, row.name, row.state, alerts.join(" | ")].map(csvField).join(","));
  }
  return `${lines.join("\n")}\n`;
};

export const alertsForCounty = (
  fips: string,
  alerts: readonly { event?: string | null; same_county_fips?: readonly string[] }[],
): string[] => {
  const names: string[] = [];
  for (const alert of alerts) {
    if (!alert.same_county_fips?.includes(fips) || !alert.event) continue;
    if (!names.includes(alert.event)) names.push(alert.event);
  }
  return names.sort();
};

export type SheetSummary = {
  fips: string;
  name: string;
  state: string;
  ranked: number | null;
  refused: number | null;
  facilities: { rank: number | null; name: string; phone: string | null }[];
};

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const readSheetSummary = (value: unknown): SheetSummary | null => {
  if (!object(value) || value.phase !== "completed" || !object(value.snapshot) || !object(value.snapshot.county)) return null;
  const county = value.snapshot.county;
  if (typeof county.name !== "string" || typeof county.fips !== "string" || typeof county.state !== "string") return null;
  const counts = object(value.snapshot.counts) ? value.snapshot.counts : {};
  const facilities = Array.isArray(value.snapshot.facilities) ? value.snapshot.facilities.flatMap(row => {
    if (!object(row) || typeof row.name !== "string" || !row.name) return [];
    const phone = object(row.phone) && typeof row.phone.value === "string" && row.phone.value ? row.phone.value : null;
    return [{ rank: typeof row.rank === "number" ? row.rank : null, name: row.name, phone }];
  }).slice(0, 3) : [];
  return {
    fips: county.fips,
    name: county.name,
    state: county.state,
    ranked: typeof counts.ranked_rows === "number" ? counts.ranked_rows : null,
    refused: typeof counts.refused_rows === "number" ? counts.refused_rows : null,
    facilities,
  };
};
