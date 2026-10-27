import type { Coordinate, Geometry } from "./types.ts";

export type AtlasGeometry = {
  type?: unknown;
  coordinates?: unknown;
};

const isPoint = (value: unknown): value is Coordinate =>
  Array.isArray(value) && value.length >= 2 &&
  typeof value[0] === "number" && typeof value[1] === "number" &&
  Number.isFinite(value[0]) && Number.isFinite(value[1]) &&
  Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;

const isRing = (value: unknown): value is Coordinate[] =>
  Array.isArray(value) && value.length >= 4 && value.every(isPoint);

const polygonsOf = (geometry: AtlasGeometry | null | undefined): Coordinate[][][] => {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === "Polygon") {
    return geometry.coordinates.every(isRing) ? [geometry.coordinates as Coordinate[][]] : [];
  }
  if (geometry.type !== "MultiPolygon") return [];
  const polygons: Coordinate[][][] = [];
  for (const polygon of geometry.coordinates) {
    if (Array.isArray(polygon) && polygon.every(isRing)) polygons.push(polygon as Coordinate[][]);
  }
  return polygons;
};

export const hasDrawableRings = (geometry: Geometry | null | undefined): boolean =>
  !!geometry?.coordinates.some(polygon => polygon.some(ring => ring.length >= 4));

const fipsCodes = (fipsList: string): string[] =>
  fipsList.split(",").map(code => code.trim()).filter(code => /^\d{5}$/.test(code));

/** Copy cartographic rings for the requested FIPS. A missing county stays empty. No bounding box is built. */
export const countyGeometryFromFeatures = (
  features: readonly unknown[],
  fipsList: string,
): { geometry: Geometry; missing: string[] } => {
  const wanted = fipsCodes(fipsList);
  const byFips = new Map<string, Coordinate[][][]>();
  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue;
    const record = feature as { properties?: { fips?: unknown }; geometry?: AtlasGeometry | null };
    const fips = record.properties?.fips;
    if (typeof fips !== "string" || !/^\d{5}$/.test(fips) || byFips.has(fips)) continue;
    const polygons = polygonsOf(record.geometry);
    if (polygons.length) byFips.set(fips, polygons);
  }
  const coordinates: Coordinate[][][] = [];
  const missing: string[] = [];
  for (const fips of wanted) {
    const polygons = byFips.get(fips);
    if (!polygons) missing.push(fips);
    else coordinates.push(...polygons);
  }
  return { geometry: { type: "MultiPolygon", coordinates }, missing };
};

export const censusOutlineNote = (drawnPolygons: number, missing: readonly string[]): string => {
  const gap = missing.length
    ? ` No cartographic outline is on this site for ${missing.join(", ")}. No bounding box was drawn for ${missing.length === 1 ? "that county" : "those counties"}.`
    : "";
  if (!drawnPolygons) return `This sheet has no Census cartographic county outline.${gap}`;
  return `The outline is the Census 2023 cartographic county boundary on this site (cb_2023_us_county_20m). It is county context, not a warning, and not a bounding box.${gap}`;
};

export type CountyAtlasFeature = { properties?: { fips?: string }; geometry?: AtlasGeometry | null };

let atlasLoad: Promise<readonly unknown[]> | null = null;

export const loadCountyAtlas = (): Promise<readonly unknown[]> => {
  if (!atlasLoad) {
    atlasLoad = fetch("/geo/us-counties-wgs84.json").then(async response => {
      const value: unknown = await response.json();
      const features = value && typeof value === "object" && Array.isArray((value as { features?: unknown }).features)
        ? (value as { features: unknown[] }).features : null;
      if (!response.ok || !features?.length) throw new Error("County outlines were not readable.");
      return features;
    }).catch(error => {
      atlasLoad = null;
      throw error;
    });
  }
  return atlasLoad;
};
