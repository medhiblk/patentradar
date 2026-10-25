import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

for (const viewport of [{ width: 1280, height: 960 }, { width: 390, height: 844 }]) {
  test(`source picker stays readable without overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/engineering");
    const panel = page.locator("#studio-source");
    await expect(panel.getByRole("heading", { name: "Que voulez-vous construire ?" })).toBeVisible();
    await expect(panel.getByLabel("Que souhaitez-vous représenter ?", { exact: true })).toBeVisible();
    await expect(panel.getByLabel("Ou saisissez des dimensions connues", { exact: true })).toBeVisible();
    await expect(panel.locator(".studio-source-picker-action")).toHaveText("Choisir un document");
    await expect(panel.locator("#studio-source-file-help")).toHaveText("PDF, PNG/JPEG, STEP/STL ou JSON · 4 Mo maximum.");
    const file = panel.getByLabel("Engineering source file", { exact: true });
    await file.focus();
    await expect(file).toBeFocused();
    const fileName = "manuel-" + "assemblage-mecanique-".repeat(8) + ".pdf";
    await file.setInputFiles({ name: fileName, mimeType: "application/pdf", buffer: await readFile("tests/fixtures/mechanical-dimensions.pdf") });
    await expect(panel.locator(".studio-source-file-name")).toHaveText(fileName);
    await expect(panel.locator(".studio-source-picker-action")).toHaveText("Choisir un autre document");
    const layout = await panel.locator(".studio-source-fields").evaluate((grid) => {
      const fields = Array.from(grid.children).map(element => element.getBoundingClientRect());
      return {
        overflow: grid.scrollWidth > grid.clientWidth + 1,
        first: { left: fields[0].left, right: fields[0].right, top: fields[0].top, bottom: fields[0].bottom },
        second: { left: fields[1].left, right: fields[1].right, top: fields[1].top, bottom: fields[1].bottom },
        pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    expect(layout.overflow).toBe(false);
    expect(layout.pageOverflow).toBe(false);
    if (viewport.width > 760) expect(layout.second.left).toBeGreaterThanOrEqual(layout.first.right);
    else expect(layout.second.top).toBeGreaterThanOrEqual(layout.first.bottom);
  });
}
