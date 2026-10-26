import { test, expect } from "@playwright/test";
import cases from "../../../../docs/evaluation/spot-cases.json";
import type { SpotResult } from "../../src/lib/search/spot";

// Real first-pass ingestion/matching. Only external retrieval is mocked for this UI test.
for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`review and approve a query before extending a real document check (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/spot");
    await page.getByRole("button", { name: "Describe a design", exact: true }).click();
    await page.getByRole("textbox", { name: "Describe your design", exact: true }).fill(cases.positives[0].text);
    const firstResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/spot" && response.request().method() === "POST");
    await page.getByRole("button", { name: "SPOT IT", exact: true }).click();
    const response = await firstResponse;
    expect(response.status()).toBe(200);
    const original = await response.json() as SpotResult;
    expect(original.matches[0].patent.publicationNumber).toBe(cases.positives[0].publicationNumber);
    const expand = page.getByRole("button", { name: "Search additional sources", exact: true });
    await expect(expand).toBeDisabled();
    const queryInput = page.getByLabel("Search concepts to share", { exact: true });
    const consent = page.getByLabel("I approve sharing this short query with the available public search providers.", { exact: true });
    await queryInput.fill("implantable stent");
    await consent.check();
    await expect(expand).toBeEnabled();
    await queryInput.fill("implantable vascular stent");
    await expect(consent).not.toBeChecked();
    await expect(expand).toBeDisabled();
    await consent.check();
    await page.route("**/api/spot/expand", async route => {
      const form = await new Request(route.request().url(), { method: "POST", headers: route.request().headers(), body: new Uint8Array(route.request().postDataBuffer()!) }).formData();
      expect(form.get("query")).toBe("implantable vascular stent");
      expect(form.get("searchConsent")).toBe("true");
      const now = new Date().toISOString();
      const source = { id: "test-openaire", name: "OpenAIRE Graph", category: "mixed", method: "keyword-search", coverage: "Test transport using actual sourced patent records", queries: [form.get("query")], status: "succeeded", startedAt: now, completedAt: now, patentsRetrieved: 1, papersRetrieved: 0, patentNumbers: [original.matches[0].patent.publicationNumber], requests: [] };
      const result = { ...original, liveSearch: { query: form.get("query"), patentsRetrieved: 1, papersRetrieved: 0, trace: { searchId: "ui-test", context: "live-search", startedAt: now, completedAt: now, providers: [source], notQueried: [] } }, coverage: { ...original.coverage, mode: "reference-index-and-live-search" } };
      await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: [
        { type: "initial", result: original }, { type: "source", source },
        { type: "candidate", patent: original.matches[0].patent }, { type: "complete", result },
      ].map(event => JSON.stringify(event)).join("\n") + "\n" });
    });
    await expand.click();
    await expect(page.getByText("Sources checked in this search", { exact: true })).toBeVisible();
    await expect(page.locator(".spot-live-sources")).toContainText("OpenAIRE Graph · succeeded · 1 patents · 0 papers");
    await expect(page.locator(".spot-expansion .spot-notice")).toContainText("implantable vascular stent");
    await expect(page.locator(".spot-match").first()).toContainText(cases.positives[0].publicationNumber);
    await expect(page.locator(".spot-error")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
