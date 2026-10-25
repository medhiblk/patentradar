import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
async function downloadSource(page: Page) {
  await page.goto("/demo");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download the source PDF", exact: true })
    .click();
  const download = await pending,
    bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  return { name: download.suggestedFilename(), bytes };
}
test("downloaded PDF can be reuploaded directly from the demo with a file-provider MIME type", async ({
  page,
}) => {
  const { name, bytes } = await downloadSource(page);
  await page.getByLabel("Demo source file", { exact: true }).setInputFiles({
    name,
    mimeType: "application/octet-stream",
    buffer: bytes,
  });
  await expect(
    page.getByText("Selected source: " + name, { exact: true }),
  ).toBeVisible();
  const pending = page.waitForResponse((response) =>
    response.url().includes("/api/cad/interpret"),
  );
  await page
    .getByRole("button", {
      name: "Read document & identify parts",
      exact: true,
    })
    .click();
  const response = await pending;
  expect(response.status()).toBe(200);
  expect((await response.json()).sourceHash).toBe(
    createHash("sha256").update(bytes).digest("hex"),
  );
  await expect(page.getByLabel("width (mm)", { exact: true })).toHaveValue(
    "50",
  );
  await expect(page.getByText(/this PDF was read locally/)).toHaveCount(0);
});
test("an HTML upload failure still reads the actual downloaded PDF and produces a real STEP solid", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.route("**/api/cad/interpret", (route) =>
    route.fulfill({
      status: 503,
      contentType: "text/html",
      body: "<html>Temporary gateway failure</html>",
    }),
  );
  const { name, bytes } = await downloadSource(page);
  await page
    .getByLabel("Demo source file", { exact: true })
    .setInputFiles({ name, mimeType: "application/pdf", buffer: bytes });
  await page
    .getByRole("button", {
      name: "Read document & identify parts",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("width (mm)", { exact: true })).toHaveValue(
    "50",
    { timeout: 30000 },
  );
  await expect(
    page.getByText(/Upload service unavailable: this PDF was read locally/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rebuild CAD", exact: true }).click();
  await expect(
    page.getByText("Solid volume: 24000 mm³", { exact: false }),
  ).toBeVisible({ timeout: 90000 });
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export STEP assembly", exact: true })
    .click();
  expect(
    (await readFile((await (await pending).path())!, "utf8")).slice(0, 100),
  ).toContain("ISO-10303-21");
  await expect(
    page.getByText("The string did not match the expected pattern.", {
      exact: true,
    }),
  ).toHaveCount(0);
});
test("dropping a different PDF extracts its own measurements rather than replaying the sample", async ({
  page,
}) => {
  await page.route("**/api/cad/interpret", (route) =>
    route.fulfill({
      status: 502,
      contentType: "text/html",
      body: "<html>Gateway failure</html>",
    }),
  );
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText("Variant plate 92 x 37 x 8 mm", {
    x: 30,
    y: 700,
    size: 14,
    font,
  });
  const bytes = Array.from(await pdf.save());
  await page.goto("/demo");
  const transfer = await page.evaluateHandle((data) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array(data)], "variant-plate.pdf", {
        type: "application/pdf",
      }),
    );
    return transfer;
  }, bytes);
  await page
    .locator("#main-content")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect(
    page.getByText("Selected source: variant-plate.pdf", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Read document & identify parts",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("width (mm)", { exact: true })).toHaveValue(
    "37",
    { timeout: 30000 },
  );
  await expect(page.getByLabel("length (mm)", { exact: true })).toHaveValue(
    "92",
  );
  await expect(page.getByLabel("height (mm)", { exact: true })).toHaveValue(
    "8",
  );
  const second = await PDFDocument.create();
  const secondFont = await second.embedFont(StandardFonts.Helvetica);
  second
    .addPage()
    .drawText("Second plate 60 x 22 x 4 mm", {
      x: 30,
      y: 700,
      size: 14,
      font: secondFont,
    });
  const nextTransfer = await page.evaluateHandle(
    (data) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array(data)], "second-plate.pdf", {
          type: "application/pdf",
        }),
      );
      return transfer;
    },
    Array.from(await second.save()),
  );
  await page
    .locator("#studio-source")
    .dispatchEvent("drop", { dataTransfer: nextTransfer });
  await page
    .getByRole("button", {
      name: "Read document & identify parts",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("width (mm)", { exact: true })).toHaveValue(
    "22",
  );
  await expect(page.locator(".cad-parts .part-item")).toHaveCount(2);
  await page.locator(".cad-parts .part-item").first().click();
  await expect(page.getByLabel("width (mm)", { exact: true })).toHaveValue(
    "37",
  );
});
