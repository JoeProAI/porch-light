import { isAffectedAlert } from "./affected-alerts.ts";
import { hasAlertShape } from "./geo.ts";
import type { Coordinate, Geometry } from "./types.ts";
import type { MapGeometry, OfficialAlert } from "./weather-types.ts";

/** A warning wider than this on both axes is a multi-state blob. The sheet stays on the facilities until Full zone is chosen. */
const WIDE_DEGREES = 6;

export type WarningOutline =
  | { status: "none" }
  | { status: "missing_geometry"; events: string[] }
  | { status: "shape"; geometry: Geometry; label: string; events: string[]; shapeless: string[] };

export type OutlinePhase = "loading" | "ready" | "unavailable";

export type SheetOutline = {
  state: "snapshot" | "shape" | "missing" | "loading" | "unavailable" | "none";
  geometry: Geometry | null;
  label: string | null;
  note: string;
  extent: "coverage" | "facilities";
  frame: "warning" | "source";
};

const countyCodes = (fips: string): Set<string> => new Set(
  fips.split(",").map(code => code.trim()).filter(code => /^\d{5}$/.test(code)),
);

const eventNames = (alerts: readonly OfficialAlert[]): string[] => {
  const names: string[] = [];
  for (const alert of alerts) {
    const name = alert.event ?? "NWS alert";
    if (!names.includes(name)) names.push(name);
  }
  return names;
};

const polygonsOf = (geometry: MapGeometry): Geometry["coordinates"] =>
  (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) as Geometry["coordinates"];

/** Alerts that carry this county's Census FIPS. Area text is never a join, and no box is built when the feed has no shape. */
export const warningOutlineForCounty = (
  fips: string,
  alerts: readonly OfficialAlert[],
  selectedId: string,
): WarningOutline => {
  const codes = countyCodes(fips);
  if (!codes.size) return { status: "none" };
  const covering = alerts.filter(alert =>
    isAffectedAlert(alert) && alert.same_county_fips?.some(code => codes.has(code)));
  if (!covering.length) return { status: "none" };
  const shaped = covering.filter(alert => hasAlertShape(alert.geometry));
  const shapeless = covering.filter(alert => !hasAlertShape(alert.geometry));
  const shapelessNames = eventNames(shapeless);
  if (!shaped.length) return { status: "missing_geometry", events: shapelessNames };
  const selected = shaped.find(alert => alert.id === selectedId);
  const ordered = [...shaped.filter(alert => alert !== selected), ...(selected ? [selected] : [])];
  const coordinates = ordered.flatMap(alert => polygonsOf(alert.geometry as MapGeometry));
  if (!coordinates.length) return { status: "missing_geometry", events: shapelessNames.length ? shapelessNames : eventNames(shaped) };
  const events = eventNames(ordered);
  const primary = selected?.event ?? events[0];
  const extra = events.filter(name => name !== primary).length;
  const label = extra ? `${primary} polygon and ${extra} more` : `${primary} polygon`;
  return {
    status: "shape",
    geometry: { type: "MultiPolygon", coordinates },
    label,
    events,
    shapeless: shapelessNames,
  };
};

const span = (points: readonly Coordinate[]): { w: number; h: number } => {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const [lon, lat] of points) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  if (!Number.isFinite(west)) return { w: 0, h: 0 };
  return { w: east - west, h: north - south };
};

/** County-scale alert polygons frame the sheet. A multi-state polygon stays on the facility extent. */
export const warningFraming = (
  geometry: Geometry,
  facilities: readonly { lon: number | null; lat: number | null }[],
): "coverage" | "facilities" => {
  const rings = geometry.coordinates.flat(2);
  if (!rings.length) return "facilities";
  const places = facilities.filter((row): row is { lon: number; lat: number } =>
    typeof row.lon === "number" && typeof row.lat === "number" && Number.isFinite(row.lon) && Number.isFinite(row.lat));
  if (!places.length) return "coverage";
  const zone = span(rings);
  return zone.w > WIDE_DEGREES && zone.h > WIDE_DEGREES ? "facilities" : "coverage";
};

export const carriesAlertPolygon = (geometry: Geometry | null | undefined, geometryMode?: string): boolean =>
  geometryMode === "official_alert_polygon"
  && geometry?.type === "MultiPolygon"
  && geometry.coordinates.some(polygon => polygon.some(ring => ring.length >= 3));

const quiet = (frame: "warning" | "source"): SheetOutline => ({
  state: frame === "warning" ? "snapshot" : "none",
  geometry: null,
  label: null,
  note: "",
  extent: "facilities",
  frame,
});

/** What the call-sheet map should stroke. Snapshot alert polygons stay as they are. Live shapes are copied, never invented. */
export const sheetOutline = (input: {
  national: boolean;
  geometryMode?: string;
  snapshotGeometry: Geometry;
  facilities: readonly { lon: number | null; lat: number | null }[];
  live?: { phase: OutlinePhase; outline: WarningOutline };
}): SheetOutline => {
  if (!input.national || carriesAlertPolygon(input.snapshotGeometry, input.geometryMode)) {
    return quiet(!input.national || carriesAlertPolygon(input.snapshotGeometry, input.geometryMode) ? "warning" : "source");
  }
  const live = input.live;
  if (!live || live.phase === "loading") {
    return {
      state: "loading",
      geometry: null,
      label: null,
      note: "Reading the live warning shape for this county.",
      extent: "facilities",
      frame: "source",
    };
  }
  if (live.phase === "unavailable") {
    return {
      state: "unavailable",
      geometry: null,
      label: null,
      note: "The live weather feed could not be read, so no warning outline was added to this sheet.",
      extent: "facilities",
      frame: "source",
    };
  }
  if (live.outline.status === "missing_geometry") {
    return {
      state: "missing",
      geometry: null,
      label: null,
      note: `This county is on ${live.outline.events.join(", ")}, but the National Weather Service did not send a shape. No outline was drawn from the area text.`,
      extent: "facilities",
      frame: "source",
    };
  }
  if (live.outline.status !== "shape") return quiet("source");
  const extent = warningFraming(live.outline.geometry, input.facilities);
  const extra = live.outline.shapeless.length
    ? ` Also listed for this county with no shape from NWS: ${live.outline.shapeless.join(", ")}. No outline was drawn for that alert.`
    : "";
  const wide = extent === "facilities"
    ? " This warning polygon is wider than the facilities on this sheet. Full zone shows the whole outline."
    : "";
  return {
    state: "shape",
    geometry: live.outline.geometry,
    label: live.outline.label,
    note: `The outline is the live National Weather Service polygon for this county (${live.outline.label}). Same alerts as the warning list on this page. It is not a forecast of facility conditions.${extra}${wide}`,
    extent,
    frame: "warning",
  };
};
