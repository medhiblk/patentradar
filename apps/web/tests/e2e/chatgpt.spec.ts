import { test, expect } from "@playwright/test";
test("home links to a usable ChatGPT connection guide and public MCP discovery", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).getByRole("link"),
  ).toHaveCount(2);
  await page.getByRole("link", { name: "Connecter FormaProof", exact: true }).click();
  await expect(page).toHaveURL(/\/connect$/);
  await expect(
    page.getByRole("link", { name: "Open ChatGPT Plugins", exact: true }),
  ).toHaveAttribute("href", "https://chatgpt.com/plugins");
  await expect(
    page.getByLabel("Public MCP server URL", { exact: true }),
  ).toHaveValue(/\/api\/mcp$/);
  await page
    .getByRole("button", { name: "Test this MCP connection", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "MCP reachable · 7 public tools discovered" }),
  ).toBeVisible({ timeout: 30000 });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download MCP client config", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("formaproof-mcp.json");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("demo preloads its PDF and its motion preview supports pause and scene selection", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("status").filter({ hasText: "Example PDF preloaded" }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  const tour = page.getByRole("region", {
    name: "Animated product walkthrough",
  });
  await tour.getByRole("button", { name: "Pause walkthrough" }).click();
  await expect(
    tour.getByRole("button", { name: "Play walkthrough" }),
  ).toBeVisible();
  await tour
    .getByRole("button", { name: "Explore the design", exact: true })
    .click();
  await expect(
    tour.getByRole("heading", { name: "Explore the design", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
