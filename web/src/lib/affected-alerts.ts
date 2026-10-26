import type { OfficialAlert } from "./weather-types.ts";

const blockedStatus = new Set(["Test", "Exercise", "Draft", "System"]);
const severityRank: Record<string, number> = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };

/** NWS SAME is a 6-digit code. A leading 0 means the whole county, and the last five digits are the Census FIPS. Anything else is left unused. */
export const sameCountyFips = (same: unknown): string[] => {
  if (!Array.isArray(same)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of same) {
    if (typeof item !== "string" || !/^0\d{5}$/.test(item)) continue;
    const fips = item.slice(1);
    if (seen.has(fips)) continue;
    seen.add(fips);
    out.push(fips);
  }
  return out;
};

export const isAffectedAlert = (alert: Pick<OfficialAlert, "status" | "severity" | "event">): boolean => {
  if (alert.status && (blockedStatus.has(alert.status) || alert.status !== "Actual")) return false;
  return alert.severity === "Extreme" || alert.severity === "Severe" || /warning/i.test(alert.event ?? "");
};

export const orderAffectedAlerts = <T extends OfficialAlert>(alerts: T[], catalogFips: ReadonlySet<string>): T[] =>
  alerts.filter(isAffectedAlert).slice().sort((a, b) =>
    Number(b.same_county_fips?.some(code => catalogFips.has(code)) ?? false)
      - Number(a.same_county_fips?.some(code => catalogFips.has(code)) ?? false)
    || Number(!!b.geometry) - Number(!!a.geometry)
    || (severityRank[a.severity ?? ""] ?? 5) - (severityRank[b.severity ?? ""] ?? 5)
    || (a.event ?? "").localeCompare(b.event ?? "")
    || (a.areaDesc ?? "").localeCompare(b.areaDesc ?? ""));

export const catalogCountyFips = (codes: readonly string[] | undefined, catalogFips: ReadonlySet<string>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of codes ?? []) {
    if (!/^\d{5}$/.test(code) || seen.has(code) || !catalogFips.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
};

export const affectedCatalogFips = (alerts: readonly OfficialAlert[], catalogFips: ReadonlySet<string>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const alert of alerts) {
    if (!isAffectedAlert(alert)) continue;
    for (const code of catalogCountyFips(alert.same_county_fips, catalogFips)) {
      if (seen.has(code)) continue;
      seen.add(code);
      out.push(code);
    }
  }
  return out;
};
