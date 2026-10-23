import type { MapGeometry } from "./weather-types";
import { hasCoordinates } from "./operator";
import type { Facility } from "./types";

const ringContains = (ring: number[][], lon: number, lat: number): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const crosses = (yi > lat) !== (yj > lat);
    if (crosses && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export const geometryContains = (geometry: MapGeometry, lon: number, lat: number): boolean => {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(polygon => {
    const [outer, ...holes] = polygon;
    if (!outer || outer.length < 3 || !ringContains(outer, lon, lat)) return false;
    return !holes.some(hole => hole.length >= 3 && ringContains(hole, lon, lat));
  });
};

export const hasAlertShape = (geometry: MapGeometry | null | undefined): geometry is MapGeometry => {
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(polygon => polygon.some(ring => ring.length >= 3 && ring.every(point => point.length >= 2 && point.every(Number.isFinite))));
};

export const facilitiesInside = (facilities: Facility[], geometry: MapGeometry | null | undefined): Facility[] => {
  if (!hasAlertShape(geometry)) return [];
  return facilities.filter(row => hasCoordinates(row) && geometryContains(geometry, row.lon, row.lat));
};

export const geometryBounds = (geometry: MapGeometry): [[number, number], [number, number]] | null => {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const polygon of polygons) for (const ring of polygon) for (const [lon, lat] of ring) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    west = Math.min(west, lon); east = Math.max(east, lon);
    south = Math.min(south, lat); north = Math.max(north, lat);
  }
  if (!Number.isFinite(west) || west >= east || south >= north) return null;
  return [[west, south], [east, north]];
};
