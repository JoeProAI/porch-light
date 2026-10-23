import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { weatherFreshness, type LiveWeather } from "../src/lib/weather-types";

test("actual national weather API has closed audit references and original radar bytes", async ({ request }) => {
  const response = await request.get("/api/weather");
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
  await page.goto("/watch");
  await expect(page.getByRole("heading", { name: "Contiguous US radar." })).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".radar-coverage")).toContainText("Alaska, Hawaii");
  await expect(page.getByRole("button", { name: "Load animated NOAA radar" })).toBeVisible();
  await page.getByRole("button", { name: "Load animated NOAA radar" }).click();
  await expect.poll(async () => page.locator(".radar-image > img").evaluate(
    (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
  )).toBe(true);
  await expect(page.locator(".watch-evidence")).toContainText("Zetaris query");
  await expect(page.locator(".watch-evidence")).toContainText("isn't national care-facility ranking");
  await page.getByRole("searchbox").fill("No source weather event matches this search");
  await expect(page.getByRole("heading", { name: "No matching source alerts." })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("weather read failure never becomes a sample warning or radar image", async ({ page }) => {
  await page.route("**/api/weather", route => route.abort("failed"));
  await page.goto("/watch");
  await expect(page.getByRole("heading", { name: "Weather data is unavailable." })).toBeVisible();
  await expect(page.locator(".official-alert-list button")).toHaveCount(0);
  await expect(page.locator(".radar-image > img")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry audited weather" })).toBeVisible();
});
