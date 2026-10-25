import { test, expect } from "@playwright/test";
test("lightweight home explains the workflow without loading research or CAD", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/|\.wasm|cad-kernel/.test(r.url()))
      calls.push(new URL(r.url()).pathname);
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: /Before you build/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "How it works" }),
  ).toBeVisible();
  expect(calls).toEqual([]);
  await page
    .locator(".hero-actions")
    .getByRole("link", { name: "Check PDF", exact: true })
    .click();
  await expect(page).toHaveURL(/\/spot$/);
  await expect(page.getByLabel("Technical document", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "SPOT IT", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Describe a design", exact: true }).click();
  await expect(page.getByLabel("Describe your design", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "SPOT IT", exact: true })).toBeDisabled();
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(calls.filter((c) => c.includes("cad-kernel"))).toEqual([]);
});
test("mobile menu closes with Escape and deep links support refresh and Back", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Toggle menu" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).getByRole("link"),
  ).toHaveCount(2);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "My files", exact: true })).toHaveAttribute("href", "/files");
  await page.locator(".app-nav-actions").getByRole("link", { name: "Check PDF", exact: true }).click();
  await expect(page).toHaveURL(/\/spot$/);
  await expect(page.getByLabel("Technical document", { exact: true })).toBeVisible();
  // The adaptive design/project workspace remains directly available.
  await page.goto("/workspace");
  await expect(
    page.getByRole("heading", { name: /Partez de ce que vous avez/ }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Mes projets" })
    .click();
  await expect(page).toHaveURL(/#projects$/);
  await expect(
    page.getByRole("heading", { name: "Projects & attached documents" }),
  ).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Projects & attached documents" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "FormaProof home", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Before you build/ }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Projects & attached documents" }),
  ).toBeVisible();
});
