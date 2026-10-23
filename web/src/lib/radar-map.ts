import type { MapGeometry, RadarRegion } from "./weather-types";

export const createRadarProjection = (region: RadarRegion) => {
  const bbox = region.bbox;
  if (region.crs !== "EPSG:4326" || !bbox || bbox.length !== 4 ||
    !bbox.every(Number.isFinite) || bbox[2] <= bbox[0] || bbox[3] <= bbox[1]) {
    throw new Error("Missing provider-declared map extent");
  }
  const project = (point: number[]): [number, number] => [
    (point[0] - bbox[0]) / (bbox[2] - bbox[0]) * 1200,
    (bbox[3] - point[1]) / (bbox[3] - bbox[1]) * 700,
  ];
  const geometryPath = (geometry: MapGeometry | null | undefined): string => {
    if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) return "";
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    return polygons.map(polygon => polygon.map(ring => ring.map((point, index) => {
      const [x, y] = project(point);
      return Number.isFinite(x) && Number.isFinite(y) ? `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}` : "";
    }).join(" ") + " Z").join(" ")).join(" ");
  };
  return { project, geometryPath };
};
