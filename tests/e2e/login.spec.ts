import { test, expect } from "@playwright/test";

test("sign in explains validation, submits with Enter and restores the account page", async ({
  page,
}) => {
  test.setTimeout(120000);
  const email = `signin-${crypto.randomUUID()}@example.test`,
    password = `test-${crypto.randomUUID()}`;
  await page.goto("/files");
  await page.getByLabel("Workspace email", { exact: true }).fill(email);
  await page.getByLabel("Workspace password", { exact: true }).fill("short");
  await page
    .getByRole("button", { name: "Create workspace account", exact: true })
    .click();
  await expect(
    page.getByRole("form", { name: "Workspace sign in" }).getByRole("alert"),
  ).toContainText("12 characters");
  await page.getByLabel("Workspace password", { exact: true }).fill(password);
  await page.getByLabel("Show password", { exact: true }).check();
  await expect(
    page.getByLabel("Workspace password", { exact: true }),
  ).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Create workspace account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign out of workspace", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Sign out of workspace", exact: true })
    .click();
  await page.getByLabel("Workspace email", { exact: true }).fill(email);
  await page.getByLabel("Workspace password", { exact: true }).fill(password);
  await page.getByLabel("Workspace password", { exact: true }).press("Enter");
  await expect(
    page.getByRole("button", { name: "Sign out of workspace", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByText("More", { exact: true })
    .click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(
    page.getByText(`Signed in as ${email}`, { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const logout = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/vault" &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  expect((await logout).ok()).toBe(true);
  await page.goto("/files");
  await expect(
    page.getByRole("button", { name: "Sign in to workspace", exact: true }),
  ).toBeVisible({ timeout: 60000 });
});
