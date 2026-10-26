import { test, expect } from "@playwright/test";
import { readFile, rename } from "node:fs/promises";
import snapshotJson from "../data/manatee-ranked.json";
import provenance from "../data/manatee-ranked.json.provenance.json";
import projectDirection from "../design/project-direction.json";
import satelliteProvenance from "../public/weather/milton-2024-nasa.jpg.provenance.json";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
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
  expect(actual.body).toContain("Atkinson Hyperlegible");
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

test("storm watch uses the night masthead, type, and a solid radar bar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/watch");
  await expect(page.locator("header.masthead")).toBeVisible();
  await expect(page.locator("header.entry-header")).toHaveCount(0);
  const nav = await page.locator("header nav a").allTextContents();
  expect(nav).toEqual(["Project home", "US county runs", "Storm Watch", "Source map", "Call order"]);
  await expect(page.getByRole("link", { name: "About the project" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Manatee call sheet" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /retrospective/i })).toHaveCount(0);
  await expect(page.getByText(/Hurricane Milton/i)).toHaveCount(0);
  await expect(page.locator(".watch-evidence")).not.toContainText("Manatee");
  await expect(page.locator(".facility-cluster")).toHaveCount(0);
  await expect(page.locator(".radar-controls")).toBeVisible();
  await expect(page.getByRole("button", { name: "Play radar" })).toBeVisible();
  await expect(page.getByLabel("Radar frame")).toBeVisible();
  await expect(page.getByLabel("Radar opacity")).toBeVisible();
  await expect(page.getByRole("button", { name: /Radar layer/ })).toBeVisible();
  await expect(page.locator(".watch-map-frame .bezel-circular")).toHaveCount(0);
  const paint = await page.evaluate(() => {
    const bg = (selector: string) => getComputedStyle(document.querySelector(selector)!).backgroundColor;
    const style = getComputedStyle(document.documentElement);
    return {
      ground: style.getPropertyValue("--color-bg").trim(),
      surface: style.getPropertyValue("--color-surface").trim(),
      body: getComputedStyle(document.body).fontFamily,
      display: getComputedStyle(document.querySelector("h1")!).fontFamily,
      mono: getComputedStyle(document.querySelector(".radar-readout span")!).fontFamily,
      pane: bg(".watch-alert-pane"),
      bar: bg(".radar-controls"),
      toolbar: bg(".watch-map-frame .map-toolbar"),
      play: bg(".radar-play"),
    };
  });
  expect(paint.ground).toBe(projectDirection.tokens.background);
  expect(paint.surface).toBe(projectDirection.tokens.surface);
  expect(paint.body).toContain("Atkinson Hyperlegible");
  expect(paint.display).toContain("Libre Baskerville");
  expect(paint.mono).toContain("IBM Plex Mono");
  for (const value of [paint.pane, paint.bar, paint.toolbar, paint.play]) expect(value).toBe("rgb(5, 7, 11)");
  await expect(page.locator(".radar-readout")).toContainText(/Paused · (checking radar time|radar time unknown|\d{1,2}:\d{2} [AP]M ET frame)/);
});

test("the call sheet has no canvas-gray band across the workspace", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/operate");
  await expect(page.locator(".facility-row")).toHaveCount(18);
  const paint = await page.evaluate(() => {
    const bg = (selector: string) => getComputedStyle(document.querySelector(selector)!).backgroundColor;
    const samples = [540, 640, 760, 820].map(y => {
      const el = document.elementFromPoint(720, y) as HTMLElement | null;
      let node: HTMLElement | null = el;
      const chain: string[] = [];
      while (node && chain.length < 6) {
        chain.push(`${node.tagName}.${String(node.className).slice(0, 40)}:${getComputedStyle(node).backgroundColor}`);
        node = node.parentElement;
      }
      return { y, chain };
    });
    return {
      html: getComputedStyle(document.documentElement).backgroundColor,
      workspace: bg(".workspace"),
      list: bg(".facility-list"),
      rail: bg(".operator-rail"),
      samples,
    };
  });
  expect(paint.html).toBe("rgb(5, 7, 11)");
  expect(paint.workspace).toBe("rgb(5, 7, 11)");
  expect(paint.list).toBe("rgb(5, 7, 11)");
  expect(paint.rail).toBe("rgb(5, 7, 11)");
  await expect(page.getByText("01 / Call order")).toBeVisible();
  await expect(page.getByText("02 / Warning-area facilities")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Care facilities in the warning area" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Facility extent" })).toBeVisible();
  const phone = page.locator(".facility-row[data-porch='true'] .facility-phone");
  await expect(phone).toBeVisible();
  const phoneBox = await phone.boundingBox();
  expect(phoneBox && phoneBox.height).toBeLessThan(32);
  for (const sample of paint.samples) {
    expect(sample.chain.join(" "), `y=${sample.y}`).not.toContain("rgb(18, 18, 18)");
  }
  await expect(page.locator(".map-canvas svg")).toBeVisible();
  const shot = decodePng(await page.screenshot());
  expect(shot.width).toBeGreaterThanOrEqual(1440);
  const scale = shot.width / 1440;
  for (const [x, y] of [[10, 820], [1420, 820]] as const) {
    const [r, g, b] = pngPixel(shot, Math.round(x * scale), Math.round(y * scale));
    expect(Math.abs(r - 5), `(${x},${y}) red ${r}`).toBeLessThanOrEqual(6);
    expect(Math.abs(g - 7), `(${x},${y}) green ${g}`).toBeLessThanOrEqual(6);
    expect(Math.abs(b - 11), `(${x},${y}) blue ${b}`).toBeLessThanOrEqual(6);
  }
});

test("project entry explains the storm and care-facility use case and opens the real tool", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Storm warning. Clear first call." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Any US county." })).toBeVisible();
  await expect(page.locator(".mission-description")).toContainText("dialysis centers and nursing homes");
  await expect(page.locator(".mission-description")).toContainText("any US county");
  await expect(page.locator(".mission-limit")).toContainText("not a live warning");
  await expect(page.locator(".first-call-preview")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "See the Hurricane Milton walkthrough" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Manatee County, Florida." })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Hurricane Milton retrospective" })).toHaveCount(0);
  await expect(page.locator(".entry-footer")).not.toContainText("Hurricane Milton");
  await expect(page.locator(".entry-footer")).not.toContainText("Manatee");
  await expect(page.locator(".satellite-credit")).toContainText("not a live warning");
  const rain = await page.locator(".storm-photo").evaluate(node => {
    const after = getComputedStyle(node, "::after");
    return { content: after.content, image: after.backgroundImage };
  });
  expect(rain.image).toBe("none");
  expect(rain.content === "none" || rain.content === "normal").toBe(true);
  const primary = page.getByRole("link", { name: "Pick any US county" });
  await expect(primary).toHaveCount(1);
  await expect(primary).toHaveAttribute("href", "/nationwide");
  const paint = await primary.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(paint).toBe("rgb(242, 169, 59)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await primary.click();
  await expect(page).toHaveURL(/\/nationwide$/);
});

test("source map and call order stay nationwide, not the Manatee retrospective", async ({ page }) => {
  const sourceLink = page.locator("header.masthead nav a", { hasText: "Source map" }).first();
  const orderLink = page.locator("header.masthead nav a", { hasText: "Call order" }).first();

  await page.goto("/");
  await expect(sourceLink).toHaveAttribute("href", "/#source-map");
  await expect(orderLink).toHaveAttribute("href", "/nationwide#county-catalog");
  await expect(page.getByRole("link", { name: "Hurricane Milton retrospective" })).toHaveCount(0);
  await expect(page.locator(".entry-footer")).not.toContainText("Hurricane Milton");
  await expect(page.locator(".entry-footer")).not.toContainText("Manatee");
  expect(await page.locator("header.masthead").evaluate(node => getComputedStyle(node, "::after").backgroundImage)).toBe("none");
  await page.goto("/#source-map");
  await expect(page.locator("#source-map")).toBeVisible();
  await expect(page.locator("#source-map")).toContainText("any US county");
  await expect(page.locator("#source-map")).toContainText("Gaps stay visible");
  await expect(page.locator("#source-map")).toContainText("No Manatee substitute");
  await expect(page.locator("#source-map")).not.toContainText("Manatee Bay");
  await expect(page.locator("#source-map")).not.toContainText("Hurricane Milton");
  await expect(page.getByRole("heading", { name: "How sources work for every county." })).toBeVisible();

  await page.goto("/nationwide");
  await expect(sourceLink).toHaveAttribute("href", "#source-map");
  await expect(orderLink).toHaveAttribute("href", "#county-catalog");
  await expect(sourceLink).not.toHaveAttribute("href", /operate/);
  await expect(orderLink).not.toHaveAttribute("href", /operate/);
  await expect(page.locator("#source-map")).toBeVisible();
  await expect(page.locator("#source-map")).toContainText("any US county");
  await expect(page.locator("#county-catalog")).toBeAttached();
  await expect(page.locator("#zone-hatch")).toHaveCount(0);
  expect(await page.locator("header.masthead").evaluate(node => getComputedStyle(node, "::after").backgroundImage)).toBe("none");

  await page.goto("/watch");
  await expect(sourceLink).toHaveAttribute("href", "/#source-map");
  await expect(orderLink).toHaveAttribute("href", "/nationwide#county-catalog");
  await expect(page.getByRole("button", { name: /retrospective/i })).toHaveCount(0);
  await expect(page.getByText(/Hurricane Milton/i)).toHaveCount(0);
  await expect(page.locator(".watch-evidence")).not.toContainText("Manatee");
  await expect(page.locator(".facility-cluster")).toHaveCount(0);
  await expect(page.locator("#zone-hatch")).toHaveCount(0);
  expect(await page.locator("header.masthead").evaluate(node => getComputedStyle(node, "::after").backgroundImage)).toBe("none");

  await page.goto("/operate");
  await expect(page.getByText("Retrospective · Hurricane Milton / 2024")).toBeVisible();
  await expect(page.getByText("RETROSPECTIVE / MANATEE")).toBeVisible();
  await expect(sourceLink).toHaveAttribute("href", "#source-atlas");
  await expect(orderLink).toHaveAttribute("href", "#call-ledger");
  await expect(page.locator("#zone-hatch")).toHaveCount(0);
  await expect(page.locator(".zone-underlay")).not.toHaveCount(0);
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
  await expect(page.locator(".sponsor-ledger")).toContainText("Cursor's cloud agent authored");
  await expect(page.locator(".sponsor-ledger")).toContainText("joined in Zetaris SQL");
  await expect(page.locator(".sponsor-ledger")).toContainText("15 grounded, 3 unresolved");
  await expect(page.locator(".sponsor-ledger")).toContainText("retained failures");
  await expect(page.locator(".sponsor-ledger")).toContainText("Actual Cursor-authored code and cloud build evidence");
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
  const countyCsv = createCsv(snapshot, {});
  expect(countyCsv.split("\r\n")).toHaveLength(19);
  expect(countyCsv).toContain("NWS alert URL");
  expect(countyCsv).toContain("Alert captured at UTC");
  expect(countyCsv).toContain("Alert expires at UTC");
  const alertSnapshot = {
    ...snapshot,
    selected_alert: {
      id: "https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.example",
      event: "Tornado Warning",
      captured_at: "2026-10-23T20:00:00Z",
      expires: "2026-10-23T21:00:00Z",
      capture_id: "0000000000000000000000000000000000000000000000000000000000000000",
    },
  } as Snapshot;
  const alertCsv = createCsv(alertSnapshot, {});
  expect(alertCsv).toContain("https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.example");
  expect(alertCsv).toContain("2026-10-23T20:00:00Z");
  expect(alertCsv).toContain("2026-10-23T21:00:00Z");
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
  await page.locator(".facility-row").nth(3).click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".export-actions")).not.toBeVisible();
  await expect(page.locator(".facility-row")).toHaveCount(18);
  await expect(page.locator(".print-limits")).toBeVisible();
  const printed = await page.locator(".facility-row[aria-pressed='true']").evaluate(row => ({
    porch: row.getAttribute("data-porch"),
    rank: getComputedStyle(row.querySelector(".rank")!).color,
    score: getComputedStyle(row.querySelector(".score")!).color,
  }));
  expect(printed.porch).toBe("false");
  expect(printed.rank).toBe("rgb(17, 17, 17)");
  expect(printed.score).toBe("rgb(17, 17, 17)");
});

test("a finished call sheet does not light a next bezel tick", async ({ page }) => {
  await page.addInitScript(({ key, ids }) => {
    const contacts = Object.fromEntries(ids.map(id => [id, { status: "reached", updatedAt: "2026-10-24T00:00:00.000Z" }]));
    localStorage.setItem(key, JSON.stringify(contacts));
  }, { key: `porch-light:contacts:v1:${snapshot.source_snapshot_hash}`, ids: snapshot.facilities.map(row => row.id) });
  await page.goto("/operate");
  await expect(page.locator(".facility-row")).toHaveCount(18);
  await expect(page.locator(".facility-row[data-porch='true']")).toHaveCount(0);
  await expect(page.locator(".bezel-step.is-lit, .bezel-tick.is-lit")).toHaveCount(0);
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

const decodePng = (buffer: Buffer) => {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const chunks: Buffer[] = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "IDAT") chunks.push(Buffer.from(data));
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const source = y * (stride + 1) + 1;
    const row = y * stride;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? pixels[row + i - channels] : 0;
      const up = y > 0 ? pixels[row - stride + i] : 0;
      const upLeft = y > 0 && i >= channels ? pixels[row - stride + i - channels] : 0;
      const value = raw[source + i];
      pixels[row + i] = filter === 1 ? (value + left) & 255
        : filter === 2 ? (value + up) & 255
          : filter === 3 ? (value + Math.floor((left + up) / 2)) & 255
            : filter === 4 ? (value + paeth(left, up, upLeft)) & 255
              : value;
    }
  }
  return { width, height, channels, pixels };
};

const pngPixel = (image: ReturnType<typeof decodePng>, x: number, y: number) => {
  const index = (y * image.width + x) * image.channels;
  return [image.pixels[index], image.pixels[index + 1], image.pixels[index + 2]] as const;
};
