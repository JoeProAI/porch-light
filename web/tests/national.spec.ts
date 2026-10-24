import { test, expect } from "@playwright/test";
import snapshot from "../data/manatee-ranked.json";
import { searchCounties, type CountyRecord } from "../src/lib/county-search";

test("national source catalog exposes real geography and closed audit references", async ({ page, request }) => {
  test.setTimeout(180000);
  const response = await request.get("/api/national", { timeout: 160000 });
  expect(response.ok()).toBe(true);
  const value: unknown = await response.json();
  expect(value).toMatchObject({
    catalog: { data_access: { data_access_mode: "zetaris" } },
  });
  const catalog = value as { catalog: { counties: CountyRecord[]; data_access: { zetaris_query_ids: string[] } } };
  expect(catalog.catalog.counties).toHaveLength(3235);
  expect(catalog.catalog.counties.find(row => row.fips === "35013")?.name).toBe("Doña Ana");
  expect(catalog.catalog.data_access.zetaris_query_ids.every(id => /^\d+$/.test(id))).toBe(true);
  expect(searchCounties(catalog.catalog.counties, "Dona Ana County").map(row => row.fips)).toEqual(["35013"]);
  expect(searchCounties(catalog.catalog.counties, "Jefferson").length).toBeGreaterThan(1);
  expect(searchCounties(catalog.catalog.counties, "01003").map(row => row.fips)).toEqual(["01003"]);
  expect(searchCounties(catalog.catalog.counties, "No such county in this real source")).toEqual([]);
  await page.goto("/nationwide");
  await expect(page.getByLabel("State or territory")).toBeEnabled({ timeout: 160000 });
  await page.getByLabel("State or territory").selectOption("CT");
  await expect(page.getByLabel("County or county-equivalent")).toContainText("Capitol");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("State or territory").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("County or county-equivalent")).toBeFocused();
  const focus = await page.getByLabel("County or county-equivalent").evaluate(node => getComputedStyle(node).outlineStyle);
  expect(focus).not.toBe("none");
  await page.getByRole("searchbox", { name: "Search US counties by name or FIPS" }).fill("Dona Ana County");
  await page.getByRole("button", { name: "Doña Ana, NM / 35013", exact: true }).click();
  await expect(page.getByLabel("State or territory")).toHaveValue("NM");
  await expect(page.getByLabel("County or county-equivalent")).toHaveValue("35013");
});

test("a real empty county stays empty and source failures have recovery", async ({ page }) => {
  test.setTimeout(240000);
  await page.goto("/nationwide");
  await expect(page.getByLabel("State or territory")).toBeEnabled({ timeout: 160000 });
  await page.getByLabel("State or territory").selectOption("HI");
  await page.getByLabel("County or county-equivalent").selectOption("15005");
  await page.getByRole("button", { name: "Build sourced call sheet and grounded drafts" }).click();
  await expect(page.getByRole("heading", { name: "No ranked facilities." })).toBeVisible({ timeout: 160000 });
  await expect(page.locator(".sheet-meta")).toContainText("0 source records");
  await expect(page.locator(".facility-row")).toHaveCount(0);
  await expect(page.locator("#source-limits")).toContainText("not proof that a county has no care facilities");
  expect(await page.evaluate(() => document.querySelectorAll("main").length)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "No ranked facilities." })).toBeVisible({ timeout: 160000 });
  await page.route("**/api/national", route => route.abort("failed"));
  await page.goto("/nationwide");
  await expect(page.locator(".watch-error[role=alert]")).toBeVisible();
  await page.unroute("**/api/national");
  await page.getByRole("button", { name: "Retry verified source catalog" }).click();
  await expect(page.getByLabel("State or territory")).toBeEnabled({ timeout: 160000 });
});

test("a saved run reopens from its own checkpoint before the catalog read finishes", async ({ page }) => {
  test.setTimeout(240000);
  await page.goto("/nationwide");
  await expect(page.getByLabel("State or territory")).toBeEnabled({ timeout: 160000 });
  await page.getByLabel("State or territory").selectOption("HI");
  await page.getByLabel("County or county-equivalent").selectOption("15005");
  await page.getByRole("button", { name: "Build sourced call sheet and grounded drafts" }).click();
  await expect(page.getByRole("heading", { name: "No ranked facilities." })).toBeVisible({ timeout: 160000 });
  const saved = new URL(page.url()).searchParams.get("run");
  expect(saved).toMatch(/^[a-f0-9]{32}$/);
  // Hold the catalog read for longer than the assertion window. The run checkpoint is a separate request and must not wait on it.
  await page.route("**/api/national", async route => {
    if (new URL(route.request().url()).searchParams.has("job")) return route.continue();
    await new Promise(resolve => setTimeout(resolve, 20000));
    return route.continue();
  });
  const started = Date.now();
  await page.goto(`/nationwide?run=${saved}&county=15005`);
  await expect(page.getByRole("heading", { name: "No ranked facilities." })).toBeVisible({ timeout: 15000 });
  expect(Date.now() - started).toBeLessThan(15000);
  await expect(page.locator(".facility-row")).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelectorAll("main").length)).toBe(1);
  await page.unroute("**/api/national");
});

test("local model operations reject cross-site requests and unverified client facts", async ({ request }) => {
  const blocked = await request.post("/api/national", {
    headers: { Origin: "https://untrusted.example", "Sec-Fetch-Site": "cross-site" },
    data: { action: "call_script", ccn: snapshot.facilities[0].ccn },
  });
  expect(blocked.status()).toBe(403);
  const noOrigin = await request.post("/api/national", { data: { county: "12081" } });
  expect(noOrigin.status()).toBe(403);
  const facts = await request.post("/api/national", {
    headers: { Origin: "http://127.0.0.1:3101" },
    data: { county: "12081", score: 1 },
  });
  expect(facts.status()).toBe(400);
  expect((await request.get("/api/national?job=../../private")).status()).toBe(400);
});

test("a sourced Alabama county runs the actual ranked workflow outside the Manatee demo", async ({ page }) => {
  test.setTimeout(420000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/nationwide");
  await expect(page.getByLabel("State or territory")).toBeEnabled({ timeout: 160000 });
  await page.getByRole("searchbox", { name: "Search US counties by name or FIPS" }).fill("Baldwin");
  await page.getByRole("button", { name: "Baldwin, AL / 01003", exact: true }).click();
  await page.getByRole("button", { name: "Build sourced call sheet and grounded drafts" }).click();
  await expect(page.locator(".facility-row")).toHaveCount(8, { timeout: 380000 });
  await expect(page.locator(".sheet-meta")).toContainText("12 source records");
  await expect(page.locator(".source-limits")).toContainText("No archived Manatee plan or guessed plan value is applied");
  await page.getByRole("button", { name: "Why this rank / inspect evidence" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".terms-table tbody tr")).toHaveCount(4);
  await expect(dialog).toContainText("Seven statements. Seven audit records.");
  await expect(dialog).toContainText("official_county_geometry_covers_source_point");
  await page.keyboard.press("Escape");
  const ranks = await page.locator(".facility-row strong").allTextContents();
  await page.getByLabel("Manually record an outcome").selectOption("reached");
  await page.getByRole("button", { name: "Record & next uncontacted" }).click();
  expect(await page.locator(".facility-row strong").allTextContents()).toEqual(ranks);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("a real active NWS alert runs in the nationwide app without a Manatee substitute", async ({ page, request }) => {
  test.setTimeout(420000);
  const response = await request.get("/api/national", { timeout: 190000 });
  expect(response.ok()).toBe(true);
  const catalog = await response.json() as { weather: { status: string; alerts: {
    id: string; event: string; expires: string; county_fips: string[];
  }[] } };
  expect(catalog.weather.status).toBe("available");
  const selected = catalog.weather.alerts.find(alert => alert.county_fips.length === 1 &&
    alert.county_fips[0] !== "12081" && Date.parse(alert.expires) > Date.now() + 300000);
  expect(selected).toBeTruthy();
  await page.goto("/nationwide");
  await expect(page.getByLabel("Captured live alert", { exact: true })).toBeEnabled({ timeout: 160000 });
  await page.getByLabel("Captured live alert", { exact: true }).check();
  await page.getByLabel("Official NWS alert", { exact: true }).selectOption(selected!.id);
  await page.getByRole("button", { name: "Build sourced call sheet and grounded drafts" }).click();
  const sheet = page.getByRole("region", { name: "Verified care-facility call sheet" });
  await expect(sheet).toBeVisible({ timeout: 380000 });
  await expect(sheet.locator(".intro")).toContainText(selected!.event);
  await expect(sheet.locator(".watch-error a")).toHaveAttribute("href", selected!.id);
  await expect(sheet.locator(".source-strip")).toContainText("audit verified");
  await expect(sheet.locator(".edition")).not.toContainText("MANATEE");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("the alert list leads with mapped warnings and an unmapped alert cannot start a run", async ({ page, request }) => {
  test.setTimeout(240000);
  const response = await request.get("/api/national", { timeout: 190000 });
  expect(response.ok()).toBe(true);
  const catalog = await response.json() as { weather: { status: string; alerts: { id: string; county_fips: string[] }[] } };
  test.skip(catalog.weather.status !== "available", "No audited alert capture is available right now.");
  await page.goto("/nationwide");
  await expect(page.getByLabel("Captured live alert", { exact: true })).toBeEnabled({ timeout: 160000 });
  await page.getByLabel("Captured live alert", { exact: true }).check();
  const labels = await page.getByLabel("Official NWS alert", { exact: true }).locator("option").allTextContents();
  const mapped = labels.slice(1).map(label => !label.endsWith("/ no source county"));
  // Every mapped alert precedes every unmapped one; the feed itself is unchanged.
  expect(mapped.indexOf(false) === -1 || mapped.lastIndexOf(true) < mapped.indexOf(false)).toBe(true);
  expect(labels.length - 1).toBe(catalog.weather.alerts.length);
  const unmapped = catalog.weather.alerts.find(alert => alert.county_fips.length === 0);
  test.skip(!unmapped, "Every captured alert maps to a source county right now.");
  await page.getByLabel("Official NWS alert", { exact: true }).selectOption(unmapped!.id);
  await expect(page.getByRole("button", { name: "Build sourced call sheet and grounded drafts" })).toBeDisabled();
  await expect(page.locator("form .watch-error[role=alert]")).toContainText("nothing to run");
});

test("live Nemotron call script carries source grounding and is retained without placing calls", async ({ page }) => {
  test.setTimeout(420000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/operate");
  await page.getByRole("button", { name: "Generate live Nemotron call script" }).click();
  await expect(page.getByRole("button", { name: "Call-script result retained" })).toBeVisible({ timeout: 380000 });
  const script = page.getByRole("region", { name: "Grounded live call script" });
  await expect(script).toContainText("Grounding passed / operator review required");
  const questions = script.getByRole("list", { name: "Source-grounded verification questions" }).getByRole("listitem");
  expect(await questions.count()).toBeGreaterThanOrEqual(2);
  expect(await questions.count()).toBeLessThanOrEqual(4);
  await script.getByText("Actual model identity and trace").click();
  await expect(script).toContainText("nemotron");
  await expect(script).toContainText("chatcmpl-");
  expect(errors).toEqual([]);
});
