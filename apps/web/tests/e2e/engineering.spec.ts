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
  // Handoff never starts a search automatically or turns dimensions into patent similarity.
  let externalSearches = 0, spotChecks = 0;
  page.on("request", (request) => {
    if (/\/api\/(research|intelligence)/.test(request.url())) externalSearches++;
    if (/\/api\/spot(?:[?#]|$)/.test(request.url()) && request.method() === "POST") spotChecks++;
  });
  await page.getByRole("button", { name: "Check this design for related patents" }).click();
  await expect(page).toHaveURL(/\/spot\?from=design$/);
  const description = page.getByLabel("Describe your design", { exact: true });
  await expect(description).toHaveValue(/Component: Base plate/);
  await expect(page.getByText("Current component functions loaded.", { exact: false })).toBeVisible();
  expect(spotChecks).toBe(0);
  expect(externalSearches).toBe(0);
  await page.getByRole("checkbox", { name: "Verify detected publication numbers with EPO", exact: true }).uncheck();
  await page.getByRole("button", { name: "SPOT IT", exact: true }).click();
  await page.getByRole("button", { name: "Return to my design", exact: true }).click();
  await expect(page.getByLabel("width (mm)", { exact: true })).toHaveValue("55");
  await expect(page.getByText("Design and imported STEP references restored in this tab.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export STEP assembly", exact: true })).toBeDisabled();
  await page.getByLabel("width (mm)", { exact: true }).fill("60");
  await page.getByRole("button", { name: "Check this design for related patents" }).click();
  await expect(page).toHaveURL(/\/spot\?from=design$/);
  await expect(description).toHaveValue(/Component: Base plate/);
  // A second edit survives the next handoff without an automatic second search.
  expect(spotChecks).toBe(1);
  await page.goBack();
  await expect(page.getByLabel("width (mm)", { exact: true })).toHaveValue("60");
  expect(externalSearches).toBe(0);
});
