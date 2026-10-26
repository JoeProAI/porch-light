import assert from "node:assert/strict";
import test from "node:test";
import { alertsFromFeed } from "./public-weather.ts";
import { parseIemClock } from "./radar-frames.ts";

const polygon = {
  type: "Polygon",
  coordinates: [[[-104.0, 35.0], [-103.0, 35.0], [-103.0, 36.0], [-104.0, 35.0]]],
};

test("public alert feed keeps official ids and does not invent geometry", () => {
  const alerts = alertsFromFeed({
    type: "FeatureCollection",
    features: [
      {
        id: "https://api.weather.gov/alerts/urn:oid:example",
        geometry: polygon,
        properties: {
          event: "Flood Warning", severity: "Severe", status: "Actual", areaDesc: "Curry, NM",
          geocode: { SAME: ["035009"], UGC: ["NMC009"] },
        },
      },
      {
        id: "https://api.weather.gov/alerts/urn:oid:shapeless",
        geometry: null,
        properties: { event: "Gale Warning", severity: "Moderate" },
      },
      {
        id: "https://example.test/not-nws",
        geometry: polygon,
        properties: { event: "Invented" },
      },
    ],
  });
  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].geometry?.type, "Polygon");
  assert.deepEqual(alerts[0].same_county_fips, ["35009"]);
  assert.equal(alerts[0].zetaris_query_ids.length, 0);
  assert.equal(alerts[1].geometry, null);
  assert.deepEqual(alerts[1].same_county_fips, []);
  assert.equal(alerts.some(alert => alert.event === "Invented"), false);
});

test("a non-collection is refused", () => {
  assert.throws(() => alertsFromFeed({ type: "Feature", features: [] }), /FeatureCollection/);
});

test("public IEM clock parses without a Zetaris query id", () => {
  const clock = parseIemClock({
    scans: [{ ts: "2026-10-25T23:55Z" }],
    source: {
      captured_at: "2026-10-25T23:55:48.000Z",
      source_url: "https://mesonet.agron.iastate.edu/json/radar.py?operation=list&radar=USCOMP&product=N0Q",
    },
    data_access: { data_access_mode: "public_iem", zetaris_query_ids: [] },
  });
  assert.equal(clock?.latest, "2026-10-25T23:55:00.000Z");
  assert.deepEqual(clock?.queryIds, []);
});

test("a public clock with an invented query id is refused", () => {
  const clock = parseIemClock({
    scans: [{ ts: "2026-10-25T23:55Z" }],
    source: { captured_at: "2026-10-25T23:55:48.000Z", source_url: "https://mesonet.agron.iastate.edu/json/radar.py" },
    data_access: { data_access_mode: "public_iem", zetaris_query_ids: ["701"] },
  });
  assert.equal(clock, null);
});
