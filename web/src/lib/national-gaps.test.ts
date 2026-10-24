import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  nationalQueryIds, normalizePlace, parseCatalog, searchCounties, sourceGaps, type NationalCounty,
} from "./national-gaps.ts";

const manatee = JSON.parse(readFileSync(new URL("../../../engines/snapshots/manatee-zetaris-chain.json", import.meta.url), "utf8")) as unknown;

const county = (fips: string, name: string, state: string, geometry_valid = true): NationalCounty =>
  ({ fips, name, state, geometry_valid });

const catalog = (counties: NationalCounty[], extra: Record<string, unknown> = {}) => ({
  catalog: {
    counties,
    data_access: { data_access_mode: "zetaris", zetaris_query_ids: ["701"] },
  },
  weather: { status: "unavailable", message: "Current audited alerts unavailable. County discovery remains separate." },
  ...extra,
});

test("the Manatee engine snapshot is not reused as a national sheet", () => {
  assert.equal(sourceGaps(manatee).length, 0);
  assert.deepEqual(nationalQueryIds(manatee), []);
  assert.equal(parseCatalog(manatee), null);
});

test("catalog parsing keeps audited counties and drops a mock query id", () => {
  const parsed = parseCatalog(catalog([
    county("35013", "Doña Ana", "NM"),
    county("48201", "Harris", "TX"),
  ], {
    weather: {
      status: "available",
      capture_id: "a".repeat(64),
      captured_at: "2026-10-23T22:00:00+00:00",
      alerts: [{
        id: "https://api.weather.gov/alerts/urn:oid:example",
        event: "Tornado Warning",
        areaDesc: "Harris, TX",
        expires: "2026-10-23T23:00:00+00:00",
        county_fips: ["48201", "not-a-fips"],
        mapping_status: "mapped",
      }],
    },
  }));
  assert.ok(parsed);
  assert.equal(parsed.counties[0].name, "Doña Ana");
  assert.deepEqual(parsed.weather.alerts[0].county_fips, ["48201"]);
  assert.equal(parseCatalog(catalog([county("12081", "Manatee", "FL")], {
    catalog: { counties: [county("12081", "Manatee", "FL")], data_access: { data_access_mode: "zetaris", zetaris_query_ids: ["zq-mock"] } },
  })), null);
});

test("search covers a full 3235-county catalog by name, state, and FIPS", () => {
  const specials = new Map<number, NationalCounty>([
    [0, county("12081", "Manatee", "FL")],
    [1, county("48201", "Harris", "TX")],
    [2, county("17031", "Cook", "IL")],
    [3, county("35013", "Doña Ana", "NM")],
  ]);
  const counties = Array.from({ length: 3235 }, (_, index) => specials.get(index) ??
    county(String(10000 + index), `County ${index}`, index % 2 === 0 ? "TX" : "GA"));
  assert.equal(counties.length, 3235);
  assert.equal(searchCounties(counties, "h").length, 0);
  assert.deepEqual(searchCounties(counties, "Manatee").map(row => row.fips), ["12081"]);
  assert.deepEqual(searchCounties(counties, "48201").map(row => row.fips), ["48201"]);
  assert.ok(searchCounties(counties, "Texas").every(row => row.state === "TX"));
  assert.ok(searchCounties(counties, "Texas").length > 40);
  assert.equal(searchCounties(counties, "Dona Ana")[0]?.fips, "35013");
  assert.equal(normalizePlace("Doña Ana"), "dona ana");
});

test("gap rendering uses the engine refusal phrases and does not fill missing sources", () => {
  const empty = sourceGaps({
    schema_version: "porch-light.national-run.v1",
    state: "ranked",
    counts: { source_rows: 0, ranked_rows: 0, refused_rows: 0 },
    facilities: [],
    refused: [],
    policy: { plan_artifact: null },
    data_access: { data_access_mode: "zetaris", zetaris_query_ids: ["801", "802"] },
  });
  assert.ok(empty.some(gap => gap.text === "no CMS facilities in this county"));
  assert.ok(empty.some(gap => gap.text === "no county plan captured"));
  assert.deepEqual(nationalQueryIds({
    schema_version: "porch-light.national-run.v1",
    data_access: { zetaris_query_ids: ["801", "802"] },
  }), ["801", "802"]);

  const inexact = sourceGaps({
    schema_version: "porch-light.national-run.v1",
    counts: { source_rows: 2, ranked_rows: 1, refused_rows: 1 },
    facilities: [{ evidence: { operator_geocode_review_required: true } }],
    refused: [{ ccn: "102646", name: "Example Dialysis", reason: "census_address_match_not_exact" }],
    model_report: { unresolved_facilities: 1, not_attempted_budget: 0 },
    data_access: { zetaris_query_ids: ["901"] },
  });
  assert.equal(inexact.some(gap => gap.text === "no CMS facilities in this county"), false);
  const geocode = inexact.find(gap => gap.text === "geocode not exact");
  assert.ok(geocode);
  assert.match(geocode.detail ?? "", /102646/);
  assert.ok(inexact.some(gap => gap.text === "no county plan captured"));
  assert.ok(inexact.some(gap => gap.text === "grounding failed or was not attempted"));
  assert.ok(inexact.some(gap => gap.text === "operating status is unknown"));

  const geometry = sourceGaps({
    schema_version: "porch-light.national-gap.v1",
    state: "source_gap",
    reason: "official_county_geometry_unavailable_or_invalid",
    county: { fips: "00000", name: "Example", state: "TX" },
    data_access: { zetaris_query_ids: ["77"] },
  });
  assert.ok(geometry.some(gap => gap.text === "official county geometry is unavailable or invalid"));
  assert.equal(geometry.some(gap => gap.text === "no CMS facilities in this county"), false);
});
