import { test, expect } from "@playwright/test";
test("real measured PDF generates CAD, edits geometry and downloads STEP", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/engineering");
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
  // Research is a reviewed handoff, never an automatic confidential search.
  let externalSearches = 0;
  page.on("request", (request) => {
    if (/\/api\/(research|intelligence)/.test(request.url()))
      externalSearches++;
  });
  await page
    .getByRole("button", { name: "Check this design for related patents" })
    .click();
  const description = page.getByLabel(
    "Describe your invention. We’ll find the closest existing technologies.",
  );
  await expect(description).toHaveValue(/width 55 mm/);
  await expect(
    page.getByRole("region", { name: "Design iteration" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Return to design iteration" })
    .click();
  await expect(page.getByLabel("width (mm)", { exact: true })).toHaveValue(
    "55",
  );
  await expect(
    page.getByText("Design restored in this tab.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("width (mm)", { exact: true }).fill("60");
  await page
    .getByRole("button", { name: "Check this design for related patents" })
    .click();
  await expect(description).toHaveValue(/width 60 mm/);
  expect(externalSearches).toBe(0);
});
