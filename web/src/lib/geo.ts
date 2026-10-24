import type { MapGeometry } from "./weather-types";
export const hasAlertShape = (geometry: MapGeometry | null | undefined): geometry is MapGeometry => {
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(polygon => polygon.some(ring => ring.length >= 3 && ring.every(point => point.length >= 2 && point.every(Number.isFinite))));
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
