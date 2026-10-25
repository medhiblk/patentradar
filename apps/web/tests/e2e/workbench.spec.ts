import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.use({ actionTimeout: 20000 });

test("compose a sourced board, real custom housing, purchase reference and imported STEP", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/engineering");
  await page
    .getByRole("button", { name: "Add Raspberry Pi Pico PCB", exact: true })
    .click();
  await expect(page.getByLabel("length (mm)", { exact: true })).toHaveValue(
    "51",
  );
  await page
    .getByRole("button", { name: "Create fitted housing", exact: true })
    .click();
  await expect(page.getByText(/fits-envelope/).first()).toBeVisible();
  await page.getByRole("button", { name: "Rebuild CAD", exact: true }).click();
  await expect(
    page.getByText("Solid volume: 3536 mm³", { exact: false }),
  ).toBeVisible({ timeout: 90000 });
  let download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export STEP assembly", exact: true })
    .click();
  const step = await download,
    bytes = await readFile((await step.path())!);
  expect(bytes.subarray(0, 100).toString()).toContain("ISO-10303-21");
  download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export selected part STL", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("selected-part.stl");
  await page
    .getByText("Add a product from a web link", { exact: true })
    .click();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Purchased controller");
  await page
    .getByLabel("Product URL", { exact: true })
    .fill("https://www.amazon.fr/");
  await page.getByLabel("Unit price (optional)", { exact: true }).fill("12.50");
  for (const [key, value] of [
    ["length", "40"],
    ["width", "30"],
    ["height", "10"],
  ])
    await page.getByLabel(`Purchased ${key} (mm)`, { exact: true }).fill(value);
  await page
    .getByRole("button", { name: "Add purchased part", exact: true })
    .click();
  await page
    .getByText("Parts list & known purchase costs", { exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "12.50 EUR", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Unit price (optional)", { exact: true }).fill("13.25");
  await page
    .getByRole("button", {
      name: "Attach product reference to selected part",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("cell", { name: "13.25 EUR", exact: true }),
  ).toBeVisible();
  await page
    .getByText("Rights evidence for Purchased controller", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Rights review status", exact: true })
    .selectOption("permission-documented");
  await page
    .getByLabel("Rights evidence URL", { exact: true })
    .fill("https://example.org/permission-document");
  await page
    .getByRole("button", { name: "Save rights evidence", exact: true })
    .click();
  download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export parts list CSV", exact: true })
    .click();
  const csv = await readFile((await (await download).path())!, "utf8");
  expect(csv).toContain("Purchased controller");
  expect(csv).toContain("User-entered, not a live quote");
  // Import real geometry alongside existing parts; do not replace the assembly.
  await page.getByLabel("Engineering source file").setInputFiles({
    name: "prototype.step",
    mimeType: "application/step",
    buffer: bytes,
  });
  await page
    .getByRole("button", {
      name: "Read document & identify parts",
      exact: true,
    })
    .click();
  await expect(page.locator(".cad-parts .part-item")).toHaveCount(5, {
    timeout: 90000,
  });
  await page
    .getByRole("button", { name: "Add Drive shaft", exact: true })
    .click();
  await page.getByRole("button", { name: "Rebuild CAD", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export STEP assembly", exact: true }),
  ).toBeEnabled({ timeout: 90000 });
  await expect(page.locator(".cad-parts .part-item")).toHaveCount(6);
  // Editable parameters include purchases, rights and source metadata and can be reopened.
  download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export editable parameters", exact: true })
    .click();
  const params = await readFile((await (await download).path())!);
  const parsed = JSON.parse(params.toString());
  expect(
    parsed.spec.components.find(
      (p: { name: string }) => p.name === "Purchased controller",
    ).commerce.unitPrice,
  ).toBe(13.25);
  const inspection = await page.request.post("/api/v1/cad/inspect", {
    data: parsed.spec,
  });
  expect(inspection.status()).toBe(200);
  const report = await inspection.json();
  expect(report.patentClearance).toBe("NOT ESTABLISHED");
  expect(
    report.rights.every((r: { verified: boolean }) => r.verified === false),
  ).toBe(true);
  await page.getByLabel("Engineering source file").setInputFiles({
    name: "parameters.json",
    mimeType: "application/json",
    buffer: params,
  });
  await page
    .getByLabel(
      "Add imported or identified parts to the existing assembly (uncheck to replace)",
      { exact: true },
    )
    .uncheck();
  await page
    .getByRole("button", {
      name: "Read document & identify parts",
      exact: true,
    })
    .click();
  await expect(page.locator(".cad-parts .part-item")).toHaveCount(6);
  await expect(
    page.getByText("Editable parameters imported.", { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("fuses overlapping solids and rejects a disconnected merge", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/engineering");
  await page
    .getByRole("button", { name: "Add Mounting plate", exact: true })
    .click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Fuse touching parts into one solid",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(/Export contains one fused solid · Volume 14400 mm³/),
  ).toBeVisible({ timeout: 90000 });
  await page.getByLabel("X", { exact: true }).fill("100");
  await page
    .getByRole("button", {
      name: "Fuse touching parts into one solid",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Fusion needs touching or overlapping solids" }),
  ).toBeVisible({ timeout: 90000 });
  await expect(
    page.getByRole("button", { name: "Export STEP assembly", exact: true }),
  ).toBeDisabled();
});

test("manual component list becomes editable parts with an explicit partial preview", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/engineering");
  await page
    .getByLabel("Que souhaitez-vous représenter ?", { exact: true })
    .fill("Review the motor components");
  await page
    .getByLabel("Ou saisissez des dimensions connues", { exact: true })
    .fill("Components\n1. Rotor\n2. Stator\n3. Drive shaft");
  await page
    .getByRole("button", {
      name: "Read document & identify parts",
      exact: true,
    })
    .click();
  await expect(page.locator(".cad-parts .part-item")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Rebuild CAD", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Primitive", exact: true })
    .selectOption("cylinder");
  await page.getByLabel("length (mm)", { exact: true }).fill("30");
  await page.getByLabel("diameter (mm)", { exact: true }).fill("12");
  await page
    .getByRole("button", { name: "Preview ready parts", exact: true })
    .click();
  await expect(
    page.getByText("Preview contains 1 of 3 parts.", { exact: false }),
  ).toBeVisible({ timeout: 90000 });
  await expect(
    page.getByText("Solid volume: 3392.92 mm³", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export STEP assembly", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Export selected part STL", exact: true }),
  ).toBeEnabled();
});
