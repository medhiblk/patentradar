import { test, expect } from "@playwright/test";
test("real measured PDF generates CAD, edits geometry and downloads STEP", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Engineering Studio" })
    .click();
  await page
    .getByLabel("Engineering source file")
    .setInputFiles("tests/fixtures/mechanical-dimensions.pdf");
  await page
    .getByRole("button", { name: "Read document & identify parts" })
    .click();
  await expect(page.getByRole("button", { name: /Base plate/ })).toBeVisible({
    timeout: 90000,
  });
  await expect(page.getByLabel("width (mm)", { exact: true })).toHaveValue(
    "50",
  );
  await page.getByRole("button", { name: "Rebuild CAD", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export STEP assembly" }),
  ).toBeEnabled({ timeout: 90000 });
  await expect(
    page.getByText("Solid volume: 24000 mm³", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("width (mm)", { exact: true }).fill("55");
  await expect(
    page.getByRole("button", { name: "Export STEP assembly" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Rebuild CAD", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export STEP assembly" }),
  ).toBeEnabled({ timeout: 90000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export STEP assembly" }).click();
  expect((await download).suggestedFilename()).toBe("assembly.step");
});
