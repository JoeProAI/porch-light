import { test, expect } from "@playwright/test";

test("an actual unmapped NWS alert returns audited gaps instead of a substitute county", async ({ page, request }) => {
  test.setTimeout(240000);
  const response = await request.get("/api/national", { timeout: 190000 });
  expect(response.ok()).toBe(true);
  const catalog = await response.json() as { weather: { alerts: {
    id: string; expires: string; county_fips: string[];
  }[] } };
  const alert = catalog.weather.alerts.find(item => !item.county_fips.length &&
    Date.parse(item.expires) > Date.now() + 300000);
  expect(alert).toBeTruthy();
  await page.goto("/nationwide");
  await expect(page.getByLabel("Captured live alert", { exact: true })).toBeEnabled({ timeout: 160000 });
  await page.getByLabel("Captured live alert", { exact: true }).check();
  await page.getByLabel("Official NWS alert", { exact: true }).selectOption(alert!.id);
  const build = page.getByRole("button", { name: "Build sourced call sheet and grounded drafts" });
  await expect(build).toBeEnabled();
  await build.click();
  await expect(page.getByRole("heading", { name: "Source gap, no ranking invented." })).toBeVisible({ timeout: 190000 });
  const gap = page.locator(".watch-error").filter({ hasText: "Source gap, no ranking invented." });
  await expect(gap).toContainText("No official county intersection or supported NWS zone mapping");
  await expect(gap).toContainText("Audited query");
  await expect(page.locator(".facility-row")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Verified care-facility call sheet" })).toHaveCount(0);
});
