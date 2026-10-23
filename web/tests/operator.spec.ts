import { test, expect } from "@playwright/test";
import { readFile, rename } from "node:fs/promises";
import snapshotJson from "../data/manatee-ranked.json";
import provenance from "../data/manatee-ranked.json.provenance.json";
import projectDirection from "../design/project-direction.json";
import satelliteProvenance from "../public/weather/milton-2024-nasa.jpg.provenance.json";
import { createHash } from "node:crypto";
import { createCsv, createProjection, parseContacts } from "../src/lib/operator";
import type { Snapshot } from "../src/lib/types";

const snapshot = snapshotJson as unknown as Snapshot;

test("storm-care direction drives typography and real archived imagery", async ({ page, request }) => {
  await page.goto("/operate");
  await expect(page.locator(".facility-row")).toHaveCount(18);
  const actual = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      ground: style.getPropertyValue("--color-bg").trim(),
      accent: style.getPropertyValue("--color-accent").trim(),
      body: getComputedStyle(document.body).fontFamily,
      display: getComputedStyle(document.querySelector("h1")!).fontFamily,
    };
  });
  expect(actual.ground).toBe(projectDirection.tokens.background);
  expect(actual.accent).toBe(projectDirection.tokens.accent);
  expect(actual.display).toContain("Libre Baskerville");
  expect(actual.body).toContain("Alegreya Sans");
  if (await page.evaluate(() => innerWidth < 768)) {
    await expect(page.locator(".phone-line")).toBeVisible();
    const phone = await page.locator(".phone-line").boundingBox();
    expect(phone).not.toBeNull();
    expect(phone!.y + phone!.height).toBeLessThan(812);
  }
  const material = await request.get("/weather/milton-2024-nasa.jpg");
  expect(material.ok()).toBe(true);
  expect(createHash("sha256").update(await material.body()).digest("hex")).toBe(satelliteProvenance.sha256);
});

test("project entry explains the storm and care-facility use case and opens the real tool", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Storm warning. Clear first call." })).toBeVisible();
  await expect(page.locator(".mission-description")).toContainText("dialysis centers and nursing homes");
  await expect(page.locator(".mission-limit")).toContainText("not a live warning");
  await expect(page.locator(".first-call-preview")).toContainText(snapshot.facilities[0].name);
  await expect(page.locator(".satellite-credit")).toContainText("October 8, 2024");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Open the Manatee call sheet" }).click();
  await expect(page).toHaveURL(/\/operate$/);
  await expect(page.locator(".facility-row")).toHaveCount(18);
});

test("source atlas and contact workbench stay ordered across desktop and tablet", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/operate");
  await expect(page.locator(".facility-row")).toHaveCount(18);
  await expect(page.locator(".atlas-column")).toBeVisible();
  const ledger = await page.locator(".ledger").boundingBox();
  const atlas = await page.locator(".atlas-column").boundingBox();
  const contact = await page.locator(".operator-rail").boundingBox();
  expect(ledger && atlas && contact).toBeTruthy();
  expect(atlas!.x).toBeGreaterThan(ledger!.x);
  expect(contact!.x).toBeGreaterThan(atlas!.x);
  expect(atlas!.width).toBeGreaterThan(ledger!.width);
  expect(atlas!.y).toBeLessThan(520);
  await page.setViewportSize({ width: 1024, height: 1024 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".facility-row").nth(1).click();
  await expect(page.locator(".intro-index strong")).toHaveText("02");
  await expect(page.locator(".atlas-index-strip")).toContainText(snapshot.facilities[1].name);
});

test("main site acknowledges sponsor roles and independent resources without false integration claims", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Built with Zetaris, Meterless and Nemotron." })).toBeVisible();
  await expect(page.locator(".sponsor-ledger")).toContainText("7 distinct audited statements");
  await expect(page.locator(".sponsor-ledger")).toContainText("15 actual stored texts / 18 ranked facilities");
  await expect(page.locator(".sponsor-ledger")).toContainText("authored by Devin");
  await expect(page.locator(".sponsor-ledger")).toContainText("joined in Zetaris SQL");
  await expect(page.locator(".sponsor-ledger")).toContainText("15 grounded, 3 unresolved");
  await expect(page.locator(".sponsor-ledger")).toContainText("retained failures");
  await expect(page.locator(".sponsor-ledger")).toContainText("Required build evidence remains missing");
  await expect(page.locator("#resources")).toContainText("not partnerships, endorsements or integrations");
  await expect(page.locator(".resource-list > li")).toHaveCount(6);
  const targets = await page.locator(".resource-list a").evaluateAll(links => links.map(link => ({
    href: (link as HTMLAnchorElement).href, target: link.getAttribute("target"), rel: link.getAttribute("rel"),
  })));
  expect(targets.every(link => link.href.startsWith("https://") && link.target === "_blank" && link.rel?.includes("noreferrer"))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Inspect draft status and trace" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Zetaris audit verified");
  await expect(page.getByRole("dialog")).toContainText("Seven statements. Seven audit records.");
  await expect(page.getByRole("dialog")).toContainText("nvidia/nemotron");
});

test("actual bytes, deterministic terms, projection and local record validation", async () => {
  expect(createHash("sha256").update(await readFile("data/manatee-ranked.json")).digest("hex")).toBe(provenance.sha256);
  expect(snapshot.facilities).toHaveLength(18);
  expect(snapshot.refused).toHaveLength(2);
  const modelRecords = snapshot.facilities.map(row => row.evidence.model_explanation as Record<string, unknown>);
  expect(modelRecords.filter(row => row.status === "passed")).toHaveLength(15);
  const rejected = modelRecords.filter(row => row.status === "failed");
  expect(rejected).toHaveLength(3);
  for (const record of rejected) {
    expect(record.text).toBeNull();
    expect(record.attempts).toHaveLength(2);
  }
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
  await page.goto("/operate");
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
  if (snapshot.data_access.data_access_mode === "zetaris") {
    await expect(dialog).toContainText("Zetaris audit verified");
    for (const id of snapshot.facilities[2].evidence.zetaris_query_ids) {
      await expect(dialog).toContainText(id);
    }
  } else {
    await expect(dialog).toContainText("Zetaris integration pending");
  }
  await expect(dialog).toContainText("No approved draft / failure retained");
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
  await page.goto("/operate");
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
  await page.goto("/operate");
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
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://porchlight.earth/opengraph-image");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
});

test("unreadable local contact records never seed an outcome", async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, "{"), `porch-light:contacts:v1:${snapshot.source_snapshot_hash}`);
  await page.goto("/operate");
  await expect(page.locator(".storage-warning")).toContainText("couldn't be read");
  await expect(page.locator(".facility-row").first()).toContainText("Not contacted");
});

test("missing provenance fails closed with a working retry", async ({ page }) => {
  const source = "data/manatee-ranked.json.provenance.json";
  const held = `${source}.unavailable`;
  await rename(source, held);
  try {
    await page.goto("/operate");
    await expect(page.getByRole("heading", { name: "The ledger couldn't be verified." })).toBeVisible();
    await expect(page.locator(".facility-row")).toHaveCount(0);
  } finally {
    await rename(held, source);
  }
  await page.getByRole("button", { name: "Retry snapshot" }).click();
  await expect(page.locator(".facility-row")).toHaveCount(18);
});
