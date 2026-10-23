import type { MapGeometry, RadarRegion } from "./weather-types";

export type RadarView = { x: number; y: number; width: number; height: number };
export const initialRadarView: RadarView = { x: 0, y: 0, width: 1200, height: 700 };

export const constrainRadarView = (view: RadarView): RadarView => ({
  ...view,
  x: Math.max(0, Math.min(1200 - view.width, view.x)),
  y: Math.max(0, Math.min(700 - view.height, view.y)),
});

export const zoomRadarView = (view: RadarView, factor: number, anchor = { x: .5, y: .5 }): RadarView => {
  const width = Math.max(150, Math.min(1200, view.width / factor));
  const height = width * 700 / 1200;
  return constrainRadarView({
    x: view.x + (view.width - width) * anchor.x,
    y: view.y + (view.height - height) * anchor.y,
    width, height,
  });
};

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
  const unproject = (x: number, y: number): [number, number] => [
    bbox[0] + x / 1200 * (bbox[2] - bbox[0]),
    bbox[3] - y / 700 * (bbox[3] - bbox[1]),
  ];
  const geometryPoints = (geometry: MapGeometry): [number, number][] => {
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    return polygons.flatMap(polygon => polygon.flatMap(ring => ring.map(project)))
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  };
  const fitGeometry = (geometry: MapGeometry): RadarView | null => {
    const points = geometryPoints(geometry).filter(([x, y]) => x >= 0 && x <= 1200 && y >= 0 && y <= 700);
    if (!points.length) return null;
    const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
    const left = Math.min(...xs), right = Math.max(...xs);
    const top = Math.min(...ys), bottom = Math.max(...ys);
    const width = Math.min(1200, Math.max(150, (right - left) * 1.4, (bottom - top) * 1200 / 700 * 1.4));
    return constrainRadarView({
      x: (left + right - width) / 2,
      y: (top + bottom - width * 700 / 1200) / 2,
      width, height: width * 700 / 1200,
    });
  };
  const labelPoint = (geometry: MapGeometry): [number, number] | null => {
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    const rings = polygons.map(polygon => polygon[0]?.map(project) ?? [])
      .filter(ring => ring.length >= 3 && ring.some(([x, y]) => x >= 0 && x <= 1200 && y >= 0 && y <= 700));
    const area = (ring: [number, number][]) => Math.abs(ring.reduce((sum, p, i) => {
      const next = ring[(i + 1) % ring.length];
      return sum + p[0] * next[1] - next[0] * p[1];
    }, 0));
    const ring = rings.sort((a, b) => area(b) - area(a))[0];
    if (!ring) return null;
    const y = (Math.min(...ring.map(p => p[1])) + Math.max(...ring.map(p => p[1]))) / 2;
    const intersections: number[] = [];
    ring.forEach((point, i) => {
      const next = ring[(i + 1) % ring.length];
      if ((point[1] > y) !== (next[1] > y)) {
        intersections.push(point[0] + (y - point[1]) * (next[0] - point[0]) / (next[1] - point[1]));
      }
    });
    intersections.sort((a, b) => a - b);
    let best: [number, number] | null = null;
    let widest = 0;
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const left = Math.max(0, intersections[i]), right = Math.min(1200, intersections[i + 1]);
      if (right - left > widest) { widest = right - left; best = [(left + right) / 2, y]; }
    }
    return best;
  };
  const geometryPath = (geometry: MapGeometry | null | undefined): string => {
    if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) return "";
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    return polygons.map(polygon => polygon.map(ring => ring.map((point, index) => {
      const [x, y] = project(point);
      return Number.isFinite(x) && Number.isFinite(y) ? `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}` : "";
    }).join(" ") + " Z").join(" ")).join(" ");
  };
  return { project, unproject, geometryPath, fitGeometry, labelPoint };
};
