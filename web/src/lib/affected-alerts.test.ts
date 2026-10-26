import assert from "node:assert/strict";
import test from "node:test";
import {
  affectedCatalogFips, catalogCountyFips, isAffectedAlert, orderAffectedAlerts, sameCountyFips,
} from "./affected-alerts.ts";
import type { OfficialAlert } from "./weather-types.ts";

const alert = (patch: Partial<OfficialAlert>): OfficialAlert => ({
  id: "https://api.weather.gov/alerts/urn:oid:example",
  event: "Flood Warning",
  severity: "Severe",
  urgency: null,
  certainty: null,
  areaDesc: "Eddy, NM",
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

test("SAME county codes keep a leading zero as the whole-county marker", () => {
  assert.deepEqual(sameCountyFips(["035015", "008021", "035015", "135015", "35015", "058850", ""]), ["35015", "08021", "58850"]);
  assert.deepEqual(sameCountyFips("035015"), []);
});

test("affected alerts are Actual severe, extreme, or warning events", () => {
  assert.equal(isAffectedAlert(alert({})), true);
  assert.equal(isAffectedAlert(alert({ severity: "Moderate", event: "Gale Warning" })), true);
  assert.equal(isAffectedAlert(alert({ severity: "Minor", event: "Small Craft Advisory" })), false);
  assert.equal(isAffectedAlert(alert({ status: "Test", event: "Test Warning", severity: "Extreme" })), false);
  assert.equal(isAffectedAlert(alert({ status: null, severity: "Severe", event: "Flood Warning" })), true);
});

test("area text is not turned into a county, and marine SAME codes stay out of the catalog", () => {
  const gale = alert({
    id: "https://api.weather.gov/alerts/urn:oid:gale",
    event: "Gale Warning",
    severity: "Moderate",
    areaDesc: "Waters from Savannah GA to Altamaha Sound GA",
    same_county_fips: ["58850", "75384"],
  });
  const flood = alert({
    id: "https://api.weather.gov/alerts/urn:oid:flood",
    same_county_fips: ["35015"],
    geometry: { type: "Polygon", coordinates: [[[-104, 32], [-103, 32], [-103, 33], [-104, 32]]] },
  });
  const catalog = new Set(["35015", "08021"]);
  assert.deepEqual(catalogCountyFips(gale.same_county_fips, catalog), []);
  assert.deepEqual(catalogCountyFips(flood.same_county_fips, catalog), ["35015"]);
  assert.deepEqual(affectedCatalogFips([gale, flood], catalog), ["35015"]);
  const ordered = orderAffectedAlerts([gale, flood], catalog);
  assert.equal(ordered[0].id, flood.id);
  assert.equal(ordered[1].areaDesc?.includes("Savannah"), true);
});
