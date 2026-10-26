import { test, expect } from "@playwright/test";

const floodId = "https://api.weather.gov/alerts/urn:oid:nationwide-flood";
const galeId = "https://api.weather.gov/alerts/urn:oid:nationwide-gale";

const catalog = {
  catalog: {
    counties: [
      { fips: "35015", name: "Eddy", state: "NM", geometry_valid: true },
      { fips: "35009", name: "Curry", state: "NM", geometry_valid: true },
    ],
    data_access: {
      data_access_mode: "zetaris",
      zetaris_query_ids: ["833"],
      publication: { mode: "published_static", sweep_run_id: "20261023T200048Z-78a426ba", ranked_counties: 1 },
    },
  },
  weather: {
    status: "unavailable",
    message: "Live alert refresh stays on local origin. County discovery uses the published sweep catalog.",
  },
  publication: { mode: "published_static", sweep_run_id: "20261023T200048Z-78a426ba" },
};

const weather = {
  schema_version: "porch-light.live-weather.v1",
  capture_id: "a".repeat(64),
  captured_at: "2026-10-26T00:55:00.000Z",
  alerts: [
    {
      id: floodId,
      status: "Actual",
      event: "Flood Warning",
      severity: "Severe",
      urgency: null,
      certainty: null,
      areaDesc: "Eddy, NM",
      headline: "Flood warning for Eddy County",
      description: null,
      instruction: "Move to higher ground.",
      effective: "2026-10-26T00:00:00.000Z",
      expires: "2026-10-26T06:00:00.000Z",
      senderName: "NWS Albuquerque",
      geometry: { type: "Polygon", coordinates: [[[-104.5, 32.2], [-103.9, 32.2], [-103.9, 32.8], [-104.5, 32.2]]] },
      zetaris_query_ids: [],
      same_county_fips: ["35015"],
    },
    {
      id: galeId,
      status: "Actual",
      event: "Gale Warning",
      severity: "Moderate",
      urgency: null,
      certainty: null,
      areaDesc: "Waters from Savannah GA to Altamaha Sound GA",
      headline: null,
      description: null,
      instruction: null,
      effective: null,
      expires: "2026-10-26T06:00:00.000Z",
      senderName: "NWS Charleston",
      geometry: null,
      zetaris_query_ids: [],
      same_county_fips: ["58850"],
    },
    {
      id: "https://api.weather.gov/alerts/urn:oid:nationwide-test",
      status: "Test",
      event: "Test Warning",
      severity: "Extreme",
      urgency: null,
      certainty: null,
      areaDesc: "Montgomery",
      headline: null,
      description: null,
      instruction: null,
      effective: null,
      expires: null,
      senderName: null,
      geometry: null,
      zetaris_query_ids: [],
      same_county_fips: ["24031"],
    },
  ],
  alert_feed: {
    source_url: "https://api.weather.gov/alerts/active",
    fetched_at: "2026-10-26T00:55:00.000Z",
    sha256: "b".repeat(64),
    coverage: "US National Weather Service active-alert feed",
  },
  radar: {
    source_url: "https://mesonet.agron.iastate.edu/json/radar.py?operation=list&radar=USCOMP&product=N0Q",
    fetched_at: "2026-10-26T00:55:00.000Z",
    sha256: "c".repeat(64),
    provider_last_modified: null,
    coverage: "Contiguous United States",
    observation_time_note: "test",
    image_url: "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png",
    tile_template: "/api/weather/radar-assets/nexrad-n0q-900913/{z}/{x}/{y}.png",
  },
  data_access: {
    data_access_mode: "public_nws",
    executed_at: "2026-10-26T00:55:00.000Z",
    zetaris_query_ids: [],
    source_note: "Direct National Weather Service capture. Not a Zetaris query.",
  },
  limits: ["Observed weather, not a forecast."],
};

test("nationwide lists live weather without using the frozen catalog weather blob", async ({ page }) => {
  await page.route("**/api/national**", async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("recent") === "1") {
      await route.fulfill({ json: { recent: [] } });
      return;
    }
    const county = url.searchParams.get("county");
    if (county === "35015") {
      await route.fulfill({ json: {
        id: "published-35015",
        phase: "completed",
        snapshot: {
          county: { name: "Eddy", fips: "35015", state: "NM" },
          counts: { ranked_rows: 2, refused_rows: 0 },
          facilities: [],
        },
      } });
      return;
    }
    if (county) {
      await route.fulfill({ status: 404, json: { error: "No published snapshot for this county." } });
      return;
    }
    await route.fulfill({ json: catalog });
  });
  await page.route("**/api/weather", async route => {
    if (route.request().method() !== "GET" || new URL(route.request().url()).pathname !== "/api/weather") {
      await route.continue();
      return;
    }
    await route.fulfill({ json: weather });
  });
  await page.goto("/nationwide");
  await expect(page.getByRole("heading", { name: "Affected areas, then the county catalog." })).toBeVisible();
  await expect(page.getByText("3 alerts in this capture. 2 are marked Actual.")).toBeVisible();
  await expect(page.getByText("1 warning shape is on the map. 1 catalog county is lit")).toBeVisible();
  await expect(page.getByText("Radar is drawn at 28% opacity under the county lines.")).toBeVisible();
  await expect(page.getByText("A click lands on the county and opens its published sheet.")).toBeVisible();
  await expect(page.locator(".county-weather-map")).toHaveAttribute("data-weather-pointer", "county");
  await expect(page.locator(".county-weather-map")).toHaveAttribute("data-ready", "true", { timeout: 15000 });
  await expect(page.getByRole("button", { name: /Flood Warning/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Test Warning/ })).toHaveCount(0);
  const eddy = page.getByRole("checkbox", { name: "Eddy, NM / 35015", exact: true });
  await expect(eddy).not.toBeChecked();
  await eddy.check();
  await expect(page.getByRole("button", { name: "Open published call sheet: Eddy, NM / 35015" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search US counties by name or FIPS" }).fill("Curry");
  await page.getByRole("checkbox", { name: "Add Curry, NM / 35009 to the shortlist" }).check();
  await expect(page.getByRole("region", { name: "Shortlist" })).toContainText("Curry, NM");
  await page.getByRole("button", { name: "Compare published sheets" }).click();
  await expect(page.getByText("2 ranked facilities in this published sheet.")).toBeVisible();
  await expect(page.getByText("No published snapshot for this county.")).toBeVisible();
  await page.getByRole("button", { name: /Gale Warning/ }).click();
  await expect(page.getByText("The area description is not a county join.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Storm Watch" }).first()).toHaveAttribute("href", "/watch");
  await page.getByLabel("Captured live alert", { exact: true }).check();
  await expect(page.locator("form .watch-error")).toContainText("Live alert refresh stays on local origin");
  await expect(page.getByRole("button", { name: /Flood Warning/ })).toBeVisible();
});

const eddySheet = {
  id: "published-35015",
  phase: "completed",
  provenance: {
    source_url: "file://published/35015.json.gz",
    fetched_at_utc: "2026-10-24T16:47:04Z",
    sha256: "d".repeat(64),
    license: "Published audited snapshot.",
    fetch_command: "published pack",
  },
  snapshot: {
    schema_version: "porch-light.national-run.v1",
    generated_at: "2026-10-24T16:47:04Z",
    county: { name: "Eddy", fips: "35015", state: "NM" },
    scenario: {
      event: "County source discovery",
      warning_year: 2026,
      mode: "county_discovery",
      zone_geometry_vintage: "Census 2023",
      historical_2024_boundary_equivalence_verified: false,
      geometry_mode: "official_county_boundary",
    },
    data_access: {
      executed_at: "2026-10-24T16:47:04Z",
      data_access_mode: "zetaris",
      statement_sha256: "e".repeat(64),
      zetaris_query_ids: ["833"],
      transaction_id: "zetaris-chain:833",
    },
    source_snapshot_hash: "f".repeat(64),
    warning_geometry: {
      type: "MultiPolygon",
      coordinates: [[[[-104.5, 32.2], [-103.9, 32.2], [-103.9, 32.8], [-104.5, 32.8], [-104.5, 32.2]]]],
    },
    policy: {
      version: "national.v1",
      clinical_validation: false,
      plan_year: null,
      plan_flag: "none",
      empower_density_pct: "unknown",
      cms_risk: "unknown",
      plan_artifact: null,
      plan_sha256: null,
      plan_current_applicability_verified: false,
    },
    counts: { source_rows: 1, ranked_rows: 1, refused_rows: 0 },
    facilities: [{
      id: "cms-323456",
      ccn: "323456",
      name: "Eddy Dialysis",
      type: "dialysis",
      lat: 32.4,
      lon: -104.2,
      address: "1 Main St",
      zip: "88201",
      phone: { status: "present", value: "5755550100" },
      score: {
        total: 0.5,
        terms: [{ name: "example", input: 0.5, weight: 1, weighted: 0.5 }],
        formula_version: "v1",
        tie_break: "ccn",
        rank: 1,
      },
      rank: 1,
      computed_reason: "Highest source score in this county.",
      evidence: {
        sources: [],
        data_as_of: [],
        dq_results: [],
        source_artifact_path: "cms",
        source_sha256: "a".repeat(64),
        geography_artifact_path: "geo",
        svi_artifact_path: "svi",
        geography: "exact",
        operator_geocode_review_required: false,
        model_explanation: null,
        zetaris_query_ids: ["833"],
      },
    }],
    refused: [],
    model_executions: [],
    limits: ["Directory records, not verified facility conditions."],
  },
};

test("a nationwide county open scrolls to the large county map with facility dots", async ({ page }) => {
  await page.route("**/api/national**", async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("recent") === "1") {
      await route.fulfill({ json: { recent: [] } });
      return;
    }
    if (url.searchParams.get("county") === "35015") {
      await route.fulfill({ json: eddySheet });
      return;
    }
    if (url.searchParams.get("county")) {
      await route.fulfill({ status: 404, json: { error: "No published snapshot for this county." } });
      return;
    }
    await route.fulfill({ json: catalog });
  });
  await page.route("**/api/weather", async route => {
    if (route.request().method() !== "GET" || new URL(route.request().url()).pathname !== "/api/weather") {
      await route.continue();
      return;
    }
    await route.fulfill({ json: weather });
  });
  await page.goto("/nationwide");
  await expect(page.getByRole("button", { name: "Open published call sheet: Eddy, NM / 35015" })).toBeVisible();
  await page.getByRole("button", { name: "Open published call sheet: Eddy, NM / 35015" }).click();
  const atlas = page.locator("#source-atlas");
  await expect(atlas).toBeVisible();
  await expect(page.locator("#map-title")).toHaveText("Care facilities in the source area");
  await expect(page.locator(".map-point")).toHaveCount(1);
  await expect.poll(async () => atlas.evaluate(node => {
    const box = node.getBoundingClientRect();
    return box.top >= -8 && box.top < window.innerHeight * 0.45;
  })).toBe(true);
  const placement = await page.evaluate(() => {
    const atlasBox = document.getElementById("source-atlas")!.getBoundingClientRect();
    const result = document.getElementById("national-result");
    const footer = document.querySelector(".site-footer");
    return {
      atlasTop: atlasBox.top,
      resultTop: result?.getBoundingClientRect().top ?? null,
      footerTop: footer?.getBoundingClientRect().top ?? null,
      viewport: window.innerHeight,
      atPageBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8,
    };
  });
  expect(placement.resultTop).not.toBeNull();
  expect(placement.resultTop!).toBeLessThan(0);
  expect(placement.footerTop).toBeGreaterThan(placement.viewport * 0.5);
  expect(placement.atPageBottom).toBe(false);
});
