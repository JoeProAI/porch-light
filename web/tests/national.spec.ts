import { test, expect } from "@playwright/test";
import snapshot from "../data/manatee-ranked.json";

test("national source catalog exposes real geography and closed audit references", async ({ page, request }) => {
  test.setTimeout(180000);
  const response = await request.get("/api/national", { timeout: 160000 });
  expect(response.ok()).toBe(true);
  const value: unknown = await response.json();
  expect(value).toMatchObject({
    catalog: { data_access: { data_access_mode: "zetaris" } },
  });
  const catalog = value as { catalog: { counties: { fips: string; name: string }[]; data_access: { zetaris_query_ids: string[] } } };
  expect(catalog.catalog.counties).toHaveLength(3235);
  expect(catalog.catalog.counties.find(row => row.fips === "35013")?.name).toBe("Doña Ana");
  expect(catalog.catalog.data_access.zetaris_query_ids.every(id => /^\d+$/.test(id))).toBe(true);
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
  await page.getByLabel("State or territory").selectOption("AL");
  await page.getByLabel("County or county-equivalent").selectOption("01003");
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

test("live Nemotron call script carries source grounding and is retained without placing calls", async ({ page }) => {
  test.setTimeout(420000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/operate");
  await page.getByRole("button", { name: "Generate live Nemotron call script" }).click();
  await expect(page.getByRole("button", { name: "Call-script result retained" })).toBeVisible({ timeout: 380000 });
  const script = page.getByRole("region", { name: "Grounded live call script" });
  await expect(script).toContainText("Grounding passed / operator review required");
  expect(await script.locator("ol li").count()).toBeGreaterThanOrEqual(2);
  expect(await script.locator("ol li").count()).toBeLessThanOrEqual(4);
  await script.getByText("Actual model identity and trace").click();
  await expect(script).toContainText("nemotron");
  await expect(script).toContainText("chatcmpl-");
  expect(errors).toEqual([]);
});
