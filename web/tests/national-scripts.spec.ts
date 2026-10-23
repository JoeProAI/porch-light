import { test, expect } from "@playwright/test";
import source from "../data/manatee-ranked.json";
import type { Snapshot } from "../src/lib/types";

type ScriptResult = {
  status: string; message?: string;
  draft?: { ccn: string; trace_id: string; model_id: string; grounding: { passed: boolean; query_ids: string[] } };
  attempts: {
    event_id: string; status: string; validation_error?: string; retry_of?: string; response_id?: string;
    budget_attempt: number;
    meterless_receipt?: { request_id: string; actual_usd: number; winning_route: { provider: string; model: string } };
  }[];
};

for (const county of [{ fips: "01003", name: "Baldwin, AL" }, { fips: "44007", name: "Providence, RI" }]) {
  test(`real top-three Nemotron scripts for ${county.name} stay grounded and retained`, async ({ page, request }, testInfo) => {
    test.setTimeout(1500000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/nationwide");
    const search = page.getByRole("searchbox", { name: "Search US counties by name or FIPS" });
    await expect(search).toBeEnabled({ timeout: 190000 });
    await search.fill(county.fips);
    await page.getByRole("button", { name: `${county.name} / ${county.fips}`, exact: true }).click();
    await page.getByRole("button", { name: "Build sourced call sheet and grounded drafts" }).click();
    await expect(page.locator(".facility-row").nth(2)).toBeVisible({ timeout: 380000 });
    const run = new URL(page.url()).searchParams.get("run");
    expect(run).toMatch(/^[a-f0-9]{32}$/);
    const checkpoint = await request.get(`/api/national?job=${run}`);
    expect(checkpoint.ok()).toBe(true);
    const { snapshot } = await checkpoint.json() as { snapshot: Snapshot };
    expect(snapshot.county.fips).toBe(county.fips);
    expect(snapshot.data_access.zetaris_query_ids).toHaveLength(7);
    const results: { ccn: string; status: string; attempts: number; trace?: string; failures: string[] }[] = [];
    for (const row of snapshot.facilities.slice(0, 3)) {
      await page.locator(".facility-row").nth(row.rank - 1).click();
      const pending = page.waitForResponse(response => response.url().endsWith("/api/national") &&
        response.request().method() === "POST" && response.request().postDataJSON()?.ccn === row.ccn,
      { timeout: 430000 });
      await page.getByRole("button", { name: "Generate live Nemotron call script" }).click();
      const response = await pending;
      expect(response.ok()).toBe(true);
      const reply = await response.json() as ScriptResult;
      expect(["passed", "failed", "not_attempted_budget"]).toContain(reply.status);
      expect(reply.attempts.length).toBeLessThanOrEqual(2);
      const script = page.getByRole("region", { name: "Grounded live call script" });
      await expect(script.getByRole("button", { name: "Call-script result retained" })).toBeDisabled();
      if (reply.status === "passed") {
        expect(reply.draft?.ccn).toBe(row.ccn);
        expect(reply.draft?.grounding.passed).toBe(true);
        expect(reply.draft?.grounding.query_ids.every(id => row.evidence.zetaris_query_ids.includes(id))).toBe(true);
        expect(reply.draft?.model_id.toLowerCase()).toContain("nemotron");
        const last = reply.attempts.at(-1)!;
        expect(last.meterless_receipt?.request_id).toBe(reply.draft?.trace_id);
        expect(last.meterless_receipt?.winning_route.provider).toBe("nvidia");
        expect(last.meterless_receipt?.winning_route.model.toLowerCase()).toContain("nemotron");
        expect(last.meterless_receipt?.actual_usd).toBe(0);
        await expect(script).toContainText("Grounding passed / operator review required");
      } else {
        await expect(script.getByRole("alert")).toContainText(reply.message!);
        await expect(script).not.toContainText("Grounding passed / operator review required");
      }
      if (reply.attempts.length) {
        await script.getByText(`Retained request attempts (${reply.attempts.length})`, { exact: true }).click();
        for (const attempt of reply.attempts) {
          expect(attempt.budget_attempt).toBeLessThanOrEqual(2000);
          await expect(script).toContainText(attempt.event_id);
          if (attempt.validation_error) await expect(script).toContainText(attempt.validation_error);
        }
        if (reply.attempts.length === 2) expect(reply.attempts[1].retry_of).toBe(
          reply.attempts[0].response_id ?? reply.attempts[0].event_id);
      }
      const cached = await request.post("/api/national", {
        headers: { Origin: "http://127.0.0.1:3101" }, data: { action: "call_script", ccn: row.ccn, run },
        timeout: 430000,
      });
      expect(cached.ok()).toBe(true);
      expect((await cached.json() as ScriptResult).attempts.map(attempt => attempt.event_id)).toEqual(
        reply.attempts.map(attempt => attempt.event_id));
      results.push({ ccn: row.ccn, status: reply.status, attempts: reply.attempts.length,
        trace: reply.draft?.trace_id, failures: reply.attempts.flatMap(attempt => attempt.validation_error ? [attempt.validation_error] : []) });
    }
    await testInfo.attach("real-national-script-results", { body: JSON.stringify({ county: county.fips, run, results }), contentType: "application/json" });
    expect(results.some(result => result.status === "passed")).toBe(true);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("failure UI replays actual retained Nemotron failures without another provider call", async ({ page }) => {
  const attempts = source.model_executions.filter(event => event.status === "failed");
  expect(attempts).toHaveLength(2);
  await page.route("**/api/national", route => route.fulfill({ json: {
    status: "failed", attempts, fabricated_fallback: false,
    message: "Retained grounding failures. No script was substituted.",
  } }));
  await page.goto("/operate");
  await page.getByRole("button", { name: "Generate live Nemotron call script" }).click();
  const script = page.getByRole("region", { name: "Grounded live call script" });
  await expect(script.getByRole("alert")).toContainText("No script was substituted");
  await script.getByText("Retained request attempts (2)", { exact: true }).click();
  for (const attempt of attempts) await expect(script).toContainText(attempt.event_id);
  await expect(script).toContainText("Model changed the facility scope or output schema");
  await expect(script).toContainText("Sole retry of");
  await expect(script.getByRole("button", { name: "Call-script result retained" })).toBeDisabled();
  await expect(script).not.toContainText("Grounding passed / operator review required");
});
