import assert from "node:assert/strict";
import test from "node:test";
import type { Geometry } from "./types.ts";
import type { OfficialAlert } from "./weather-types.ts";
import { sheetOutline, warningFraming, warningOutlineForCounty } from "./warning-outline.ts";

const polygon = {
  type: "Polygon" as const,
  coordinates: [[[-104.5, 32.2], [-103.9, 32.2], [-103.9, 32.8], [-104.5, 32.2]]],
};

const alert = (patch: Partial<OfficialAlert>): OfficialAlert => ({
  id: "https://api.weather.gov/alerts/urn:oid:example",
  event: "Flood Warning",
  severity: "Severe",
  urgency: null,
  certainty: null,
  areaDesc: "Eddy County",
  headline: null,
  description: null,
  instruction: null,
  effective: null,
  expires: null,
  senderName: null,
  status: "Actual",
  geometry: null,
  zetaris_query_ids: [],
  same_county_fips: [],
  ...patch,
});

const emptyGeometry = (): Geometry => ({ type: "MultiPolygon", coordinates: [] });

test("a SAME match with a polygon is copied through, and area text does not become a box", () => {
  const shaped = warningOutlineForCounty("35015", [
    alert({ id: "https://api.weather.gov/alerts/urn:oid:flood", same_county_fips: ["35015"], geometry: polygon }),
    alert({
      id: "https://api.weather.gov/alerts/urn:oid:text-only",
      event: "Tornado Warning",
      areaDesc: "Eddy County box",
      same_county_fips: [],
      geometry: null,
    }),
  ], "https://api.weather.gov/alerts/urn:oid:flood");
  assert.equal(shaped.status, "shape");
  if (shaped.status !== "shape") return;
  assert.deepEqual(shaped.geometry.coordinates, [polygon.coordinates]);
  assert.equal(shaped.label, "Flood Warning polygon");
  assert.equal(JSON.stringify(shaped.geometry).includes("Eddy"), false);

  const textOnly = warningOutlineForCounty("35015", [
    alert({ areaDesc: "Eddy County", geometry: null, same_county_fips: [] }),
  ], "");
  assert.deepEqual(textOnly, { status: "none" });
});

test("a county on an alert with no shape gets no coordinates", () => {
  const missing = warningOutlineForCounty("35009", [
    alert({ event: "Winter Storm Warning", same_county_fips: ["35009"], geometry: null }),
    alert({
      event: "Test Warning",
      status: "Test",
      severity: "Extreme",
      same_county_fips: ["35009"],
      geometry: polygon,
    }),
  ], "");
  assert.deepEqual(missing, { status: "missing_geometry", events: ["Winter Storm Warning"] });
});

test("the selected alert is named first and a second shape is kept", () => {
  const wind = {
    type: "Polygon" as const,
    coordinates: [[[-104.2, 32.3], [-104.0, 32.3], [-104.0, 32.5], [-104.2, 32.3]]],
  };
  const outline = warningOutlineForCounty("35015,08021", [
    alert({ id: "https://api.weather.gov/alerts/urn:oid:flood", same_county_fips: ["35015"], geometry: polygon }),
    alert({
      id: "https://api.weather.gov/alerts/urn:oid:wind",
      event: "High Wind Warning",
      same_county_fips: ["08021"],
      geometry: wind,
    }),
    alert({ event: "Gale Warning", severity: "Moderate", same_county_fips: ["58850"], geometry: polygon }),
  ], "https://api.weather.gov/alerts/urn:oid:wind");
  assert.equal(outline.status, "shape");
  if (outline.status !== "shape") return;
  assert.equal(outline.label, "High Wind Warning polygon and 1 more");
  assert.equal(outline.geometry.coordinates.length, 2);
  assert.deepEqual(outline.geometry.coordinates[1], wind.coordinates);
});

test("a county-scale polygon frames the sheet and a multi-state polygon does not", () => {
  const facility = [{ lon: -104.2, lat: 32.4 }];
  const county = warningOutlineForCounty("35015", [
    alert({ same_county_fips: ["35015"], geometry: polygon }),
  ], "");
  assert.equal(county.status, "shape");
  if (county.status !== "shape") return;
  assert.equal(warningFraming(county.geometry, facility), "coverage");
  const wide: Geometry = {
    type: "MultiPolygon",
    coordinates: [[[[-120, 25], [-90, 25], [-90, 45], [-120, 25]]]],
  };
  assert.equal(warningFraming(wide, facility), "facilities");
  assert.equal(warningFraming(county.geometry, []), "coverage");
});

test("a national sheet with an empty published geometry uses the live shape", () => {
  const live = warningOutlineForCounty("35015", [
    alert({ same_county_fips: ["35015"], geometry: polygon }),
  ], "");
  const sheet = sheetOutline({
    national: true,
    geometryMode: "official_county_boundary",
    snapshotGeometry: emptyGeometry(),
    facilities: [{ lon: -104.2, lat: 32.4 }],
    live: { phase: "ready", outline: live },
  });
  assert.equal(sheet.state, "shape");
  assert.equal(sheet.frame, "warning");
  assert.equal(sheet.extent, "coverage");
  assert.equal(sheet.geometry?.coordinates.length, 1);
  assert.match(sheet.note, /Flood Warning polygon/);
});

test("a missing live shape does not borrow county geometry", () => {
  const sheet = sheetOutline({
    national: true,
    geometryMode: "official_county_boundary",
    snapshotGeometry: {
      type: "MultiPolygon",
      coordinates: [[[[-104.5, 32.2], [-103.9, 32.2], [-103.9, 32.8], [-104.5, 32.8], [-104.5, 32.2]]]],
    },
    facilities: [{ lon: -104.2, lat: 32.4 }],
    live: {
      phase: "ready",
      outline: { status: "missing_geometry", events: ["Winter Storm Warning"] },
    },
  });
  assert.equal(sheet.state, "missing");
  assert.equal(sheet.geometry, null);
  assert.equal(sheet.frame, "source");
  assert.match(sheet.note, /did not send a shape/);
  assert.match(sheet.note, /Winter Storm Warning/);
});

test("a stored official alert polygon is left on the snapshot path", () => {
  const stored: Geometry = {
    type: "MultiPolygon",
    coordinates: [polygon.coordinates] as Geometry["coordinates"],
  };
  const sheet = sheetOutline({
    national: true,
    geometryMode: "official_alert_polygon",
    snapshotGeometry: stored,
    facilities: [{ lon: -104.2, lat: 32.4 }],
    live: {
      phase: "ready",
      outline: warningOutlineForCounty("35015", [
        alert({ same_county_fips: ["35015"], geometry: polygon }),
      ], ""),
    },
  });
  assert.equal(sheet.state, "snapshot");
  assert.equal(sheet.geometry, null);
  assert.equal(sheet.frame, "warning");
  assert.equal(sheet.note, "");
});

test("the retrospective sheet does not take a live overlay", () => {
  const sheet = sheetOutline({
    national: false,
    snapshotGeometry: { type: "MultiPolygon", coordinates: [polygon.coordinates] as Geometry["coordinates"] },
    facilities: [{ lon: -82.5, lat: 27.5 }],
  });
  assert.equal(sheet.frame, "warning");
  assert.equal(sheet.geometry, null);
  assert.equal(sheet.extent, "facilities");
  assert.equal(sheet.note, "");
});
