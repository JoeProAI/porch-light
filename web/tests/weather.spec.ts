import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import snapshotJson from "../data/manatee-ranked.json";
import { weatherFreshness, type LiveWeather } from "../src/lib/weather-types";
import { createRadarProjection, initialRadarView, zoomRadarView } from "../src/lib/radar-map";
import type { Snapshot } from "../src/lib/types";

const snapshot = snapshotJson as unknown as Snapshot;

test("zoomable radar assets close actual source hashes and Zetaris receipts without leaking paths", async ({ request }) => {
  test.setTimeout(190000);
  const clock = await request.get("/api/weather/radar-assets/clock", { timeout: 190000 });
  expect(clock.ok()).toBe(true);
  const value = await clock.json();
  expect(value.data_access.data_access_mode).toBe("zetaris");
  expect(value.data_access.zetaris_query_ids).toEqual([clock.headers()["x-porchlight-zetaris-query"]]);
  expect(Array.isArray(value.scans)).toBe(true);
  expect(JSON.stringify(value).includes("file_path")).toBe(false);
  const image = await request.get("/api/weather/radar-assets/nexrad-n0q-900913/4/3/6.png", { timeout: 190000 });
  expect(image.ok()).toBe(true);
  const bytes = await image.body();
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(image.headers()["x-porchlight-source-sha256"]);
  expect(image.headers()["x-porchlight-zetaris-query"]).toMatch(/^\d+$/);
  expect(image.headers()["x-porchlight-source-capture"]).toMatch(/^[a-f0-9]{64}$/);
  for (const key of ["nexrad-n0q-900913/4/16/0.png", "nexrad-n0q-900913-m01m/4/1/1.png"]) {
    expect((await request.get(`/api/weather/radar-assets/${key}`)).status()).toBe(400);
  }
  for (const key of ["constructor", "__proto__", "unknown.mjs"]) {
    expect((await request.get(`/vendor/${key}`)).status()).toBe(404);
  }
});

const waitForChart = async (page: import("@playwright/test").Page) => {
  await expect(page.locator(".storm-map")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await expect(page.locator(".storm-map canvas")).toHaveAttribute("aria-label", /Storm Watch chart/);
};

test("actual national weather API has closed audit references and original radar bytes", async ({ request }) => {
  const response = await request.get("/api/weather");
  test.skip(!response.ok(), "Audited weather feed is not published in this environment");
  expect(response.ok()).toBe(true);
  const weather = await response.json() as LiveWeather;
  expect(weather.schema_version).toBe("porch-light.live-weather.v1");
  expect(weather.data_access.data_access_mode).toBe("zetaris");
  expect(weather.data_access.zetaris_query_ids.length).toBeGreaterThan(0);
  expect(weather.alerts.every(alert => alert.zetaris_query_ids.every(id =>
    weather.data_access.zetaris_query_ids.includes(id)))).toBe(true);
  expect("file_path" in weather.radar).toBe(false);
  const captureTime = Date.parse(weather.captured_at);
  expect(weatherFreshness(weather.captured_at, captureTime + 1000)).toBe("recent");
  expect(weatherFreshness(weather.captured_at, captureTime + 660000)).toBe("stale");
  expect(weatherFreshness(weather.captured_at, captureTime - 400000)).toBe("unverified");
  const radar = await request.get(weather.radar.image_url);
  expect(radar.ok()).toBe(true);
  const bytes = await radar.body();
  expect(["GIF87a", "GIF89a"]).toContain(bytes.subarray(0, 6).toString());
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(weather.radar.sha256);
  expect(radar.headers()["x-porchlight-zetaris-query"]).toMatch(/^\d+(,\d+)*$/);
  expect(weather.radar.coverage).toContain("Alaska, Hawaii");
});

test("Storm Watch renders actual alerts, authentic radar and explicit national scope", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const radar = page.waitForResponse(response => response.url().includes("/nexrad-n0q-900913/") && response.ok());
  await page.goto("/watch");
  await expect(page.getByRole("heading", { name: "Watch the weather. Keep the source in view." })).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#radar-title")).toHaveText("Observed radar. Real warning shapes.");
  await expect(page.locator(".radar-coverage")).toContainText("contiguous US only");
  await radar;
  await waitForChart(page);
  await expect(page.locator(".storm-map")).toHaveAttribute("data-frame", "nexrad-n0q-900913");
  const loadedFeed = page.locator("#national-alerts-title");
  const unavailable = page.getByRole("heading", { name: "Weather data is unavailable." });
  await expect(loadedFeed.or(unavailable)).toBeVisible();
  if (await loadedFeed.isVisible()) {
    await expect(page.locator(".watch-evidence")).toContainText("Zetaris query");
    await expect(page.locator(".watch-evidence")).toContainText("isn't proof of rankable care-facility coverage");
    await expect(page.getByRole("region", { name: "Alerts with no shape from NWS" })).toBeVisible();
    await page.getByRole("searchbox").fill("No source weather event matches this search");
    await expect(page.getByRole("heading", { name: "No matching source alerts." })).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
  } else {
    await expect(page.locator(".official-alert-list button")).toHaveCount(0);
    await expect(page.locator(".watch-evidence")).toContainText("No audited capture is loaded");
    await expect(page.locator(".watch-evidence")).toContainText("No alerts are invented");
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("weather read failure never becomes a sample warning or radar image", async ({ page }) => {
  await page.route("**/api/weather", route => route.abort("failed"));
  await page.goto("/watch");
  await expect(page.getByRole("heading", { name: "Weather data is unavailable." })).toBeVisible();
  await expect(page.locator(".official-alert-list button")).toHaveCount(0);
  await expect(page.locator(".radar-image > img")).toHaveCount(0);
  await expect(page.locator(".official-alert-detail")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry audited weather" })).toBeVisible();
});

test("regional map assets are original source PNGs and use the provider geographic extent", async ({ request }) => {
  const response = await request.get("/api/weather");
  test.skip(!response.ok(), "Audited weather feed is not published in this environment");
  expect(response.ok()).toBe(true);
  const weather = await response.json() as LiveWeather;
  expect(weather.radar_maps?.available).toBe(true);
  expect(Boolean(JSON.stringify(weather).includes("file_path"))).toBe(false);
  for (const key of ["conus", "alaska", "hawaii", "caribbean", "guam"]) {
    const region = weather.radar_maps!.regions![key];
    expect(region.available).toBe(true);
    const projection = createRadarProjection(region);
    const [west, south, east, north] = region.bbox!;
    expect(projection.project([west, north])).toEqual([0, 0]);
    expect(projection.project([east, south])).toEqual([1200, 700]);
    const png = await request.get(region.image_url!);
    expect(png.ok()).toBe(true);
    expect(createHash("sha256").update(await png.body()).digest("hex")).toBe(region.sha256);
    const legend = await request.get(region.legend_url!);
    expect(legend.ok()).toBe(true);
    expect(createHash("sha256").update(await legend.body()).digest("hex")).toBe(region.legend_sha256);
  }
});

test("the night chart keeps radar tiles unfiltered and supports zoom, keyboard pan and the radar layer", async ({ page }) => {
  await page.goto("/watch");
  await waitForChart(page);
  const canvas = page.locator(".storm-map canvas");
  expect(await canvas.evaluate(element => getComputedStyle(element).filter)).toBe("none");
  const zoomedOut = await page.locator(".storm-map").getAttribute("data-zoom");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(() => page.locator(".storm-map").getAttribute("data-zoom")).not.toBe(zoomedOut);
  const longitude = await page.locator(".storm-map").getAttribute("data-lng");
  await canvas.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => page.locator(".storm-map").getAttribute("data-lng")).not.toBe(longitude);
  await page.getByRole("button", { name: "National view", exact: true }).click();
  await expect.poll(async () => Number(await page.locator(".storm-map").getAttribute("data-zoom"))).toBeLessThan(6);
  await page.getByRole("button", { name: "Radar layer: on", exact: true }).click();
  await expect(page.getByRole("button", { name: "Radar layer: off", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Radar layer: off", exact: true }).click();
  await expect(page.getByRole("button", { name: "Radar layer: on", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".severity-legend")).toContainText("Extreme");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("geographic labels, source-bound fitting and cursor-centered navigation identify actual places", async ({ page, request }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const response = await request.get("/api/weather");
  if (response.ok()) {
    const weather = await response.json() as LiveWeather;
    const region = weather.radar_maps!.regions!.conus;
    const projection = createRadarProjection(region);
    const florida = weather.radar_maps!.states!.features.find(state => state.properties.STUSAB === "FL")!;
    const point = projection.labelPoint(florida.geometry)!;
    expect(point).not.toBeNull();
    const lonlat = projection.unproject(...point);
    const roundtrip = projection.project(lonlat);
    expect(roundtrip[0]).toBeCloseTo(point[0]);
    expect(roundtrip[1]).toBeCloseTo(point[1]);
    const fitted = projection.fitGeometry(florida.geometry)!;
    expect(fitted.width).toBeLessThan(1200);
    expect(fitted.x).toBeGreaterThanOrEqual(0);
    expect(fitted.y + fitted.height).toBeLessThanOrEqual(700);
  }
  const zoomed = zoomRadarView(initialRadarView, 2, { x: .2, y: .3 });
  expect(zoomed.x + zoomed.width * .2).toBeCloseTo(1200 * .2);
  expect(zoomed.y + zoomed.height * .3).toBeCloseTo(700 * .3);
  expect(zoomRadarView(initialRadarView, 1000).width).toBe(150);
  expect(zoomRadarView(initialRadarView, .001)).toEqual(initialRadarView);
  await page.goto("/watch");
  await waitForChart(page);
  const map = page.locator(".storm-map");
  const nationalZoom = await map.getAttribute("data-zoom");
  await page.getByRole("button", { name: "Fit ranked facilities", exact: true }).click();
  await expect.poll(() => map.getAttribute("data-zoom")).not.toBe(nationalZoom);
  await expect.poll(async () => Number(await map.getAttribute("data-lng"))).toBeLessThan(-80);
  const countyZoom = await map.getAttribute("data-zoom");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeGreaterThan(Number(countyZoom));
  await page.getByRole("button", { name: "National view", exact: true }).click();
  await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeLessThan(6);
  if (testInfo.project.name === "mobile") {
    const before = await map.getAttribute("data-zoom");
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect.poll(() => map.getAttribute("data-zoom")).not.toBe(before);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.locator(".watch-map-frame").screenshot({ path: testInfo.outputPath("geographic-map.png") });
});

test("a failed radar tile stays explicit and can retry without substituting imagery", async ({ page }) => {
  await page.route("**/api/weather/radar-assets/nexrad-*/**", route => route.abort("failed"));
  await page.goto("/watch");
  await expect(page.getByRole("heading", { name: "Radar tiles didn't load." })).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".map-failure")).toContainText("No substitute echo is drawn.");
  await page.unroute("**/api/weather/radar-assets/nexrad-*/**");
  const radar = page.waitForResponse(response => response.url().includes("/nexrad-n0q-900913/") && response.ok());
  await page.getByRole("button", { name: "Retry radar tiles" }).click();
  await radar;
  await expect(page.getByRole("heading", { name: "Radar tiles didn't load." })).toHaveCount(0);
});

test("map load, alert click and facility pin open the evidence drawer", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const style = page.waitForResponse(response => response.url().includes("tiles.openfreemap.org/styles/dark") && response.ok());
  const radar = page.waitForResponse(response => response.url().includes("/nexrad-n0q-900913/") && response.ok());
  await page.goto("/watch");
  await style;
  await radar;
  await waitForChart(page);
  const alert = page.locator(".official-alert-list button").first();
  const unavailable = page.getByRole("heading", { name: "Weather data is unavailable." });
  await expect(alert.first().or(unavailable)).toBeVisible({ timeout: 30000 });
  if (await alert.isVisible()) {
    const eventName = (await alert.locator("strong").innerText()).trim();
    await alert.click();
    await expect(alert).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".official-alert-detail h2")).toHaveText(eventName);
    await expect(page.getByRole("heading", { name: "Official instructions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Care-facility source chain" })).toBeVisible();
  } else {
    await expect(page.locator(".official-alert-detail")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "25 minutes before the latest IEM composite", exact: true }).click();
  await expect(page.locator(".storm-map")).toHaveAttribute("data-frame", "nexrad-n0q-900913-m25m");
  await page.getByRole("button", { name: "Fit ranked facilities", exact: true }).click();
  const pin = page.getByRole("button", { name: `Rank 1, ${snapshot.facilities[0].name}`, exact: true });
  await expect(pin).toBeVisible();
  await pin.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(snapshot.facilities[0].name);
  await expect(dialog).toContainText("UTC");
  expect(errors).toEqual([]);
});

test("aging a real capture preserves the stale warning and explains how to restart ingestion", async ({ page, request }) => {
  const response = await request.get("/api/weather");
  test.skip(!response.ok(), "Audited weather feed is not published in this environment");
  const weather = await response.json() as LiveWeather;
  await page.clock.setFixedTime(Date.parse(weather.captured_at) + 1800000);
  await page.goto("/watch");
  await expect(page.locator(".watch-error")).toContainText("Don't treat the displayed weather or alert list as current");
  await expect(page.locator(".watch-error")).toContainText("Refreshing this page only rereads the stored capture");
  await expect(page.locator(".watch-error code")).toHaveText(".\\Start-Local.ps1");
  await expect(page.getByRole("link", { name: "Check current NWS warnings" })).toHaveAttribute("href", "https://www.weather.gov/");
});
