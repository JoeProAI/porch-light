import { test, expect } from "@playwright/test";

const floodId = "https://api.weather.gov/alerts/urn:oid:nationwide-flood";
const galeId = "https://api.weather.gov/alerts/urn:oid:nationwide-gale";

const catalog = {
  catalog: {
    counties: [{ fips: "35015", name: "Eddy", state: "NM", geometry_valid: true }],
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
  await expect(page.getByRole("button", { name: /Flood Warning/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Test Warning/ })).toHaveCount(0);
  await expect(page.locator('path[data-fips="35015"]')).toHaveClass(/is-affected/, { timeout: 15000 });
  await expect(page.getByRole("button", { name: "Open published call sheet: Eddy, NM / 35015" })).toBeVisible();
  await page.getByRole("button", { name: /Gale Warning/ }).click();
  await expect(page.getByText("The area description is not a county join.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Storm Watch" }).first()).toHaveAttribute("href", "/watch");
  await page.getByLabel("Captured live alert", { exact: true }).check();
  await expect(page.locator("form .watch-error")).toContainText("Live alert refresh stays on local origin");
  await expect(page.getByRole("button", { name: /Flood Warning/ })).toBeVisible();
});
