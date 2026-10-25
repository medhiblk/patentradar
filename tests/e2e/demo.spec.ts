import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("guided demo builds real editable CAD from the synthetic source PDF", async ({
  page,
}) => {
  test.setTimeout(120000);
  let externalCalls = 0;
  page.on("request", (r) => {
    if (/\/api\/(research|intelligence)/.test(r.url())) externalCalls++;
  });
  await page.goto("/demo");
  await expect(
    page.getByText("GUIDED DEMO · SYNTHETIC DOCUMENT", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Try the example document", exact: true })
    .click();
  await expect(
    page.getByText("Selected source: example-mounting-plate.pdf", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Read document & identify parts",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("width (mm)", { exact: true })).toHaveValue(
    "50",
    { timeout: 60000 },
  );
  await page.getByRole("button", { name: "Rebuild CAD", exact: true }).click();
  await expect(
    page.getByText("Solid volume: 24000 mm³", { exact: false }),
  ).toBeVisible({ timeout: 90000 });
  await page.getByLabel("width (mm)", { exact: true }).fill("55");
  await page.getByRole("button", { name: "Rebuild CAD", exact: true }).click();
  const exportButton = page.getByRole("button", {
    name: "Export STEP assembly",
    exact: true,
  });
  await expect(exportButton).toBeEnabled({ timeout: 90000 });
  const download = page.waitForEvent("download");
  await exportButton.click();
  expect(
    (await readFile((await (await download).path())!, "utf8")).slice(0, 100),
  ).toContain("ISO-10303-21");
  expect(externalCalls).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
