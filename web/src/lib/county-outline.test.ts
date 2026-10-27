import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Coordinate } from "./types.ts";
import { censusOutlineNote, countyGeometryFromFeatures, hasDrawableRings } from "./county-outline.ts";

const ring: Coordinate[] = [
  [-104.8515, 32.5205],
  [-104.4, 32.0005],
  [-103.95, 32.35],
  [-104.2, 33.05],
  [-104.7, 32.9],
  [-104.8515, 32.5205],
];

const envelope = (points: readonly Coordinate[]): Coordinate[] => {
  const west = Math.min(...points.map(point => point[0]));
  const east = Math.max(...points.map(point => point[0]));
  const south = Math.min(...points.map(point => point[1]));
  const north = Math.max(...points.map(point => point[1]));
  return [[west, south], [east, south], [east, north], [west, north], [west, south]];
};

test("a county ring is copied and is not replaced by its bounding box", () => {
  const picked = countyGeometryFromFeatures([{
    properties: { fips: "35015" },
    geometry: { type: "Polygon", coordinates: [ring] },
  }], "35015");
  assert.equal(picked.missing.length, 0);
  assert.deepEqual(picked.geometry.coordinates, [[ring]]);
  assert.notDeepEqual(picked.geometry.coordinates[0][0], envelope(ring));
  assert.equal(hasDrawableRings(picked.geometry), true);
  assert.equal(hasDrawableRings({ type: "MultiPolygon", coordinates: [] }), false);
});

test("a missing county stays empty and does not become a rectangle", () => {
  const picked = countyGeometryFromFeatures([{
    properties: { fips: "35009" },
    geometry: { type: "Polygon", coordinates: [ring] },
  }], "35015,99999");
  assert.deepEqual(picked.geometry.coordinates, []);
  assert.deepEqual(picked.missing, ["35015", "99999"]);
  assert.match(censusOutlineNote(0, picked.missing), /No bounding box was drawn/);
  assert.doesNotMatch(censusOutlineNote(1, []), /bounding box was drawn for/);
});

test("comma-separated counties keep each polygon", () => {
  const other: Coordinate[] = [[-100, 35], [-99, 35], [-99.4, 35.6], [-100.2, 35.4], [-100, 35]];
  const picked = countyGeometryFromFeatures([
    { properties: { fips: "35009" }, geometry: { type: "Polygon", coordinates: [other] } },
    { properties: { fips: "35015" }, geometry: { type: "MultiPolygon", coordinates: [[ring]] } },
  ], "35015,35009");
  assert.equal(picked.geometry.coordinates.length, 2);
  assert.deepEqual(picked.geometry.coordinates[0], [ring]);
  assert.deepEqual(picked.geometry.coordinates[1], [other]);
});

test("the cartographic file's Eddy and Harris outlines are not axis-aligned boxes", async () => {
  const atlas = JSON.parse(await readFile(new URL("../../public/geo/us-counties-wgs84.json", import.meta.url), "utf8")) as { features: unknown[] };
  for (const fips of ["35015", "48201"]) {
    const picked = countyGeometryFromFeatures(atlas.features, fips);
    assert.equal(picked.missing.length, 0, fips);
    const points = picked.geometry.coordinates.flat(2);
    const xs = new Set(points.map(point => point[0].toFixed(3)));
    const ys = new Set(points.map(point => point[1].toFixed(3)));
    assert.ok(xs.size > 2 && ys.size > 2, fips);
    assert.ok(points.length > 5, fips);
  }
});
