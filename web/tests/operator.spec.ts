import { test, expect } from "@playwright/test";
import { readFile, rename } from "node:fs/promises";
import snapshotJson from "../data/manatee-ranked.json";
import provenance from "../data/manatee-ranked.json.provenance.json";
import { createHash } from "node:crypto";
import { createCsv, createProjection, parseContacts } from "../src/lib/operator";
import type { Snapshot } from "../src/lib/types";

const snapshot = snapshotJson as unknown as Snapshot;

test("actual bytes, deterministic terms, projection and local record validation", async () => {
  expect(createHash("sha256").update(await readFile("data/manatee-ranked.json")).digest("hex")).toBe(provenance.sha256);
  expect(snapshot.facilities).toHaveLength(18);
  expect(snapshot.refused).toHaveLength(2);
  expect(snapshot.facilities.filter(row => row.evidence.model_explanation != null)).toHaveLength(3);
  expect(snapshot.facilities.map(row => row.rank)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  for (const row of snapshot.facilities) {
    expect(row.score.terms.reduce((sum, term) => sum + term.weighted, 0)).toBeCloseTo(row.score.total, 12);
  }
  const projection = createProjection(snapshot.warning_geometry, snapshot.facilities, "coverage");
  expect(projection.paths).toHaveLength(snapshot.warning_geometry.coordinates.length);
  expect(projection.paths.reduce((sum, d) => sum + (d.match(/Z/g)?.length ?? 0), 0))
    .toBe(snapshot.warning_geometry.coordinates.reduce((sum, polygon) => sum + polygon.length, 0));
  const first = snapshot.facilities[0], second = snapshot.facilities[1];
  const a = projection.project([first.lon!, first.lat!]), b = projection.project([second.lon!, second.lat!]);
  expect(b[0]).toBeGreaterThan(a[0]);
  expect(b[1]).toBeLessThan(a[1]);
  expect(parseContacts(null, snapshot.facilities)).toEqual({});
  expect(() => parseContacts("{", snapshot.facilities)).toThrow();
  expect(createCsv(snapshot, {}).split("\r\n")).toHaveLength(19);
});

test("real ledger, synchronized selection, keyboard evidence and no browser errors", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const failed: string[] = [];
  const external: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("requestfailed", request => failed.push(request.url()));
  page.on("request", request => { if (!request.url().startsWith("http://127.0.0.1:3101")) external.push(request.url()); });
  await page.goto("/");
  await expect(page.locator(".facility-row")).toHaveCount(18);
  await expect(page.locator(".facility-row").first()).toContainText("Not contacted");
  await expect(page.getByText("Not a live warning.")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("zq-mock");
  const third = page.locator(".facility-row").nth(2);
  await third.click();
  await expect(page.locator("#next-call-title")).toHaveText(snapshot.facilities[2].name);
  await expect(page.locator(".map-point.selected")).toHaveAttribute("aria-label", `Select rank 3, ${snapshot.facilities[2].name}`);
  await page.getByRole("button", { name: "Why this rank / inspect evidence" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".terms-table tbody tr")).toHaveCount(5);
  await expect(dialog).toContainText(snapshot.facilities[2].score.total.toFixed(6));
  await expect(dialog).toContainText("Zetaris integration pending");
  await expect(dialog).toContainText("Draft / operator review required");
  await expect(dialog).toContainText("nvidia/nemotron-3.5-super-vl-120b-a12b");
  for (const source of snapshot.facilities[2].evidence.sources) await expect(dialog.getByRole("link", { name: source.name })).toHaveAttribute("href", source.url);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Why this rank / inspect evidence" })).toBeFocused();
  await page.getByRole("button", { name: "Full zone", exact: true }).click();
  await expect(page.getByRole("button", { name: "Full zone", exact: true })).toHaveAttribute("aria-pressed", "true");
  const marker = page.getByRole("button", { name: `Select rank 1, ${snapshot.facilities[0].name}`, exact: true });
  await marker.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#next-call-title")).toHaveText(snapshot.facilities[0].name);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: testInfo.outputPath(`operator-${testInfo.project.name}.png`), fullPage: true });
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  expect(external).toEqual([]);
});

test("manual outcome persists, advances without reranking, CSV and print use actual rows", async ({ page }) => {
  await page.goto("/");
  const names = await page.locator(".facility-name").allTextContents();
  await expect(page.getByRole("button", { name: "Record & next uncontacted" })).toBeEnabled();
  await page.getByLabel("Manually record an outcome").selectOption("no_answer");
  const before = Date.now();
  await page.getByRole("button", { name: "Record & next uncontacted" }).click();
  await expect(page.locator("#next-call-title")).toHaveText(snapshot.facilities[1].name);
  await expect(page.getByRole("status")).toContainText("No answer recorded");
  expect(await page.locator(".facility-name").allTextContents()).toEqual(names);
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, { status: string; updatedAt: string }>, `porch-light:contacts:v1:${snapshot.source_snapshot_hash}`);
  expect(stored[snapshot.facilities[0].id].status).toBe("no_answer");
  expect(Date.parse(stored[snapshot.facilities[0].id].updatedAt)).toBeGreaterThanOrEqual(before);
  await page.reload();
  await expect(page.locator(".facility-row").first()).toContainText("No answer");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv.split("\r\n")).toHaveLength(19);
  expect(csv).toContain(snapshot.facilities[0].phone.value);
  expect(csv).toContain('"No answer"');
  expect(csv).toContain(snapshot.source_snapshot_hash);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".export-actions")).not.toBeVisible();
  await expect(page.locator(".facility-row")).toHaveCount(18);
  await expect(page.locator(".print-limits")).toBeVisible();
});

test("copy success and storage/clipboard failures are explicit; loaded snapshot works offline", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: `Copy phone for ${snapshot.facilities[0].name}`, exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Copied phone");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(snapshot.facilities[0].phone.value);
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "writeText", { value: async () => { throw new Error("denied"); } });
    Storage.prototype.setItem = () => { throw new Error("denied"); };
  });
  await page.getByRole("button", { name: `Copy phone for ${snapshot.facilities[0].name}`, exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Clipboard unavailable");
  await page.getByRole("button", { name: "Record & next uncontacted" }).click();
  await expect(page.locator(".storage-warning")).toContainText("session-only");
  await context.setOffline(true);
  await expect(page.locator(".source-strip")).toContainText("Offline", { timeout: 5000 });
  await page.locator(".facility-row").nth(3).click();
  await expect(page.locator("#next-call-title")).toHaveText(snapshot.facilities[3].name);
  await page.getByRole("button", { name: "Why this rank / inspect evidence" }).click();
  await expect(page.getByRole("dialog")).toContainText(snapshot.facilities[3].computed_reason);
  await context.setOffline(false);
});

test("social image routes are real 1200x630 PNGs and metadata resolves locally", async ({ request, page }) => {
  for (const route of ["/opengraph-image", "/twitter-image"]) {
    const response = await request.get(route);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
    const buffer = await response.body();
    expect(buffer.readUInt32BE(16)).toBe(1200);
    expect(buffer.readUInt32BE(20)).toBe(630);
  }
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "http://127.0.0.1:3101/opengraph-image");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
});

test("unreadable local contact records never seed an outcome", async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, "{"), `porch-light:contacts:v1:${snapshot.source_snapshot_hash}`);
  await page.goto("/");
  await expect(page.locator(".storage-warning")).toContainText("couldn't be read");
  await expect(page.locator(".facility-row").first()).toContainText("Not contacted");
});

test("missing provenance fails closed with a working retry", async ({ page }) => {
  const source = "data/manatee-ranked.json.provenance.json";
  const held = `${source}.unavailable`;
  await rename(source, held);
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "The ledger couldn't be verified." })).toBeVisible();
    await expect(page.locator(".facility-row")).toHaveCount(0);
  } finally {
    await rename(held, source);
  }
  await page.getByRole("button", { name: "Retry snapshot" }).click();
  await expect(page.locator(".facility-row")).toHaveCount(18);
});
