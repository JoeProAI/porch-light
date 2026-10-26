import { test, expect } from "@playwright/test";
import { hasAlertShape } from "../src/lib/geo";
import type { LiveWeather } from "../src/lib/weather-types";

test("PR22 opens an actual locally audited warning and its original instructions", async ({ page, request }, testInfo) => {
  test.setTimeout(240000);
  const response = await request.get("/api/weather", { timeout: 190000 });
  expect(response.ok()).toBe(true);
  const weather = await response.json() as LiveWeather;
  expect(weather.data_access.zetaris_query_ids.every(id => /^\d+$/.test(id))).toBe(true);
  expect(Date.now() - Date.parse(weather.captured_at)).toBeLessThan(600000);
  const alert = weather.alerts.find(item => hasAlertShape(item.geometry) && item.status === "Actual" &&
    !!item.expires && Date.parse(item.expires) > Date.now());
  expect(alert).toBeTruthy();
  const errors: string[] = [];
  const failed: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED") failed.push(request.url());
  });
  await page.goto("/watch");
  await expect(page.locator(".storm-map")).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await expect(page.locator("#national-alerts-title")).toBeVisible({ timeout: 60000 });
  await page.getByRole("searchbox").fill(alert!.headline ?? alert!.areaDesc ?? alert!.event!);
  const button = page.locator(".official-alert-list button").filter({ hasText: alert!.areaDesc! }).first();
  await button.click();
  const detail = page.locator(".official-alert-detail");
  await expect(detail).toContainText(alert!.event!);
  if (alert!.headline) await expect(detail).toContainText(alert!.headline);
  if (alert!.instruction) await expect(detail).toContainText(alert!.instruction);
  await expect(detail.getByRole("link", { name: "Inspect original NWS record" })).toHaveAttribute("href", alert!.id);
  for (const id of alert!.zetaris_query_ids) await expect(detail).toContainText(id);
  await expect(detail.locator("h2")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".storm-map")).toHaveAttribute("data-tiles-loaded", "true", { timeout: 120000 });
  await page.screenshot({ path: testInfo.outputPath("pr22-real-alert.png"), fullPage: true });
  await expect(page.getByRole("button", { name: /retrospective/i })).toHaveCount(0);
  await expect(page.getByText(/Hurricane Milton/i)).toHaveCount(0);
  await expect(page.locator(".watch-evidence")).not.toContainText("Manatee");
  await expect(page.locator(".facility-pin")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
