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
  const readSource = page.getByRole("button", {
    name: "Read document & identify parts",
    exact: true,
  });
  await expect(readSource).toBeInViewport({ ratio: 1 });
  await expect(readSource).toBeFocused();
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
  await expect(page.locator(".cad-stage canvas")).toBeInViewport();
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
  await page
    .getByRole("button", {
      name: "Check this design for related patents",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel(
      "Describe your invention. We’ll find the closest existing technologies.",
    ),
  ).toHaveValue(/width 55 mm/);
  expect(externalCalls).toBe(0);
});
test("mobile sample recovers from failed preloading and opens the next usable action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pdf = await readFile("public/examples/mechanical-assembly.pdf");
  let requests = 0;
  await page.route("**/examples/mechanical-assembly.pdf", (route) => {
    if (++requests === 1) return route.abort("failed");
    return route.fulfill({ contentType: "application/pdf", body: pdf });
  });
  await page.goto("/demo");
  await expect(
    page.getByRole("status").filter({ hasText: "Preload unavailable" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Try the example document", exact: true })
    .click();
  const readSource = page.getByRole("button", {
    name: "Read document & identify parts",
    exact: true,
  });
  await expect(readSource).toBeEnabled();
  await expect(readSource).toBeInViewport({ ratio: 1 });
  await expect(readSource).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("width (mm)", { exact: true })).toHaveValue(
    "50",
    { timeout: 60000 },
  );
  await expect(page.locator("#studio-model")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Restart the example", exact: true })
    .click();
  await expect(readSource).toBeInViewport({ ratio: 1 });
  await expect(readSource).toBeFocused();
  await expect(
    page.getByText("Import a document or add a component to begin.", {
      exact: true,
    }),
  ).toBeVisible();
});
test("a corrupt sample download displays an immediate error and can be retried", async ({
  page,
}) => {
  await page.route("**/examples/mechanical-assembly.pdf", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html>Gateway error</html>",
    }),
  );
  await page.goto("/demo");
  await expect(
    page.getByRole("status").filter({ hasText: "Preload unavailable" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Try the example document", exact: true })
    .click();
  const error = page.getByRole("alert").filter({ hasText: "not a valid PDF" });
  await expect(error).toBeVisible();
  await expect(error).toBeInViewport();
  await expect(
    page.getByRole("region", { name: "Interactive example workspace" }),
  ).toHaveCount(0);
  await page.unroute("**/examples/mechanical-assembly.pdf");
  await page
    .getByRole("button", { name: "Try the example document", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Read document & identify parts",
      exact: true,
    }),
  ).toBeInViewport({ ratio: 1 });
});
