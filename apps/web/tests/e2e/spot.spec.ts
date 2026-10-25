import { test, expect, type Page, type Request as BrowserRequest } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import cases from "../../../../docs/evaluation/spot-cases.json";
import type { SpotResult } from "../../src/lib/search/spot";
import { readPdfDocument } from "../../src/lib/documents/ingestion";

type ActualSpotResponse = SpotResult & {
  document: { sha256: string; pageCount: number; analyzedPages: number[]; inputKind: "pdf" | "description" };
};

async function postedForm(request: BrowserRequest) {
  const body = request.postDataBuffer();
  expect(body).not.toBeNull();
  return new Request(request.url(), {
    method: "POST", headers: request.headers(), body: new Uint8Array(body!),
  }).formData();
}

function spotRequest(request: BrowserRequest) {
  return new URL(request.url()).pathname === "/api/spot" && request.method() === "POST";
}

async function inspectSourceCard(page: Page, publicationNumber: string) {
  const card = page.locator(".spot-match").filter({
    has: page.locator(".spot-publication").filter({ hasText: publicationNumber }),
  });
  await expect(card).toHaveCount(1);
  await expect(card.locator(".spot-evidence").first()).toBeVisible();
  await expect(card.getByRole("link", { name: "Inspect original source ↗", exact: true }).first())
    .toHaveAttribute("href", /^https:\/\/data\.epo\.org\/publication-server\//);
  await expect(card.getByRole("link", { name: "Publication PDF ↗", exact: true }))
    .toHaveAttribute("href", /^https:\/\/data\.epo\.org\/publication-server\/.*\/document\.pdf$/);
  await expect(card.locator(".spot-source")).toContainText("Retrieved");
  await expect(page.getByRole("region", { name: "Search coverage", exact: true })).toContainText("indexed public patent publications");
  await expect(page.locator(".spot-coverage")).toContainText("not a live worldwide patent keyword search");
  return card;
}

// These tests exercise the actual UI -> multipart route -> PDF parser / matching
// engine -> attributed public reference index. No network/provider/UI mocks are used.
// Expected publication IDs below are assertion labels, never query/seed parameters.
for (const device of [
  { name: "desktop", viewport: { width: 1440, height: 1000 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
]) {
  test.describe(`SPOT real sourced evidence — ${device.name}`, () => {
    test.use({ viewport: device.viewport });
    test.setTimeout(90000);

    test("neutral PDF upload identifies its own publication and displays inspectable evidence", async ({ page }) => {
      const bytes = await readFile(path.resolve("../..", cases.blindPdf.path));
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      await page.goto("/spot");
      await expect(page.getByRole("button", { name: "SPOT IT", exact: true })).toBeDisabled();
      await page.getByLabel("Technical document", { exact: true }).setInputFiles({
        name: "technical-document.pdf", mimeType: "application/octet-stream", buffer: bytes,
      });
      await expect(page.locator(".spot-upload")).toContainText("technical-document.pdf");
      expect(await page.getByLabel("Technical document", { exact: true }).evaluate((element: HTMLInputElement) => {
        const selected = element.files?.[0];
        return selected ? { name: selected.name, type: selected.type, size: selected.size } : undefined;
      })).toEqual({ name: "technical-document.pdf", type: "application/octet-stream", size: bytes.length });
      await expect(page.getByRole("checkbox", { name: "Verify detected publication numbers with EPO", exact: true })).toBeChecked();
      const sent = page.waitForRequest(spotRequest);
      const received = page.waitForResponse(response => spotRequest(response.request()));
      await page.getByRole("button", { name: "SPOT IT", exact: true }).click();
      const [request, response] = await Promise.all([sent, received]);
      // Chromium omits file-backed multipart bytes from postDataBuffer(). The
      // server-calculated SHA below verifies the actual uploaded original bytes.
      expect(new URL(request.url()).search).toBe("");
      expect(request.headers()["content-type"]).toMatch(/^multipart\/form-data; boundary=/);
      expect(response.status()).toBe(200);
      const result = await response.json() as ActualSpotResponse;
      expect(result.document.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
      expect(result.document.inputKind).toBe("pdf");
      expect(result.identity.primary?.publicationNumber).toBe(cases.blindPdf.publicationNumber);
      expect(result.matches[0]?.patent.publicationNumber).toBe(cases.blindPdf.publicationNumber);
      expect(result.matches[0]?.matchType).toBe("same-publication");
      expect(result.matches[0]?.patent.synthetic).not.toBe(true);
      await expect(page.locator(".spot-detected").getByRole("heading", { name: cases.blindPdf.publicationNumber, exact: true })).toBeVisible();
      const card = await inspectSourceCard(page, cases.blindPdf.publicationNumber);
      await expect(card).toContainText("Same publication / source-text match");
      await expect(card.getByRole("link", { name: "Publication PDF ↗", exact: true })).toHaveAttribute("href", cases.blindPdf.sourceUrl);
      await expect(page.locator(".spot-error[role='alert']")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (device.name === "desktop") {
        const reportResponse = page.waitForResponse(item => new URL(item.url()).pathname === "/api/report" && item.request().method() === "POST");
        const downloaded = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download evidence PDF", exact: true }).click();
        const [report, download] = await Promise.all([reportResponse, downloaded]);
        expect(report.status()).toBe(200);
        expect(report.headers()["content-type"]).toContain("application/pdf");
        const supplied = report.request().postDataJSON();
        expect(supplied.patents.some((patent: { publicationNumber: string }) => patent.publicationNumber === cases.blindPdf.publicationNumber)).toBe(true);
        const pdf = await readFile((await download.path())!);
        expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
        expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(0);
        const reportDocument = await readPdfDocument(new Uint8Array(pdf));
        const reportText = reportDocument.pages.map(page => page.text).join("\n");
        expect(reportText.replace(/\s+/g, "")).toContain(cases.blindPdf.publicationNumber);
        expect(reportText).toMatch(/not\s+a\s+legal\s+opinion/i);
      }
    });

    test("an independently phrased design yields technical overlap rather than a false identity", async ({ page }) => {
      const design = cases.positives[0];
      expect(design.text).not.toContain(design.publicationNumber);
      await page.goto("/spot");
      await page.getByRole("button", { name: "Describe a design", exact: true }).click();
      await page.getByRole("textbox", { name: "Describe your design", exact: true }).fill(design.text);
      const sent = page.waitForRequest(spotRequest);
      const received = page.waitForResponse(response => spotRequest(response.request()));
      await page.getByRole("button", { name: "SPOT IT", exact: true }).click();
      const [request, response] = await Promise.all([sent, received]);
      const form = await postedForm(request);
      expect([...form.keys()].sort()).toEqual(["consent", "text"]);
      expect(form.get("text")).toBe(design.text);
      expect(form.get("consent")).toBe("true");
      expect(response.status()).toBe(200);
      const result = await response.json() as ActualSpotResponse;
      expect(result.document.inputKind).toBe("description");
      expect(result.identity.primary).toBeUndefined();
      expect(result.matches[0]?.patent.publicationNumber).toBe(design.publicationNumber);
      expect(result.matches[0]?.matchType).toBe("technical-overlap");
      expect(result.matches[0]?.evidence.length).toBeGreaterThan(0);
      await expect(page.locator(".spot-detected")).toHaveCount(0);
      const card = await inspectSourceCard(page, design.publicationNumber);
      await expect(card).toContainText("Technical overlap to review");
      await expect(card).toContainText("Your supplied description");
      await expect(card).toContainText("lexical");
      await expect(page.locator(".spot-error[role='alert']")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  });
}
