import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.use({ actionTimeout: 30000 });
test("private attachments survive refresh and sign-in, remain isolated, and reopen in analysis and CAD", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const email = `files-${crypto.randomUUID()}@example.test`,
    password = `fixture-${crypto.randomUUID()}`,
    filename = "mechanical-dimensions.pdf";
  await page.goto("/files");
  await page.getByLabel("Workspace email", { exact: true }).fill(email);
  await page.getByLabel("Workspace password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create workspace account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign out of workspace", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page
    .getByLabel("Private project title", { exact: true })
    .fill("Private mechanical source");
  await page
    .getByRole("button", { name: "Create private project", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Private project saved" }),
  ).toBeVisible({ timeout: 60000 });
  await page
    .getByLabel("Project attachments", { exact: true })
    .setInputFiles("tests/fixtures/mechanical-dimensions.pdf");
  await page
    .getByRole("button", {
      name: "Upload selected files privately",
      exact: true,
    })
    .click();
  const fileLink = page.getByRole("link", {
    name: "Download " + filename,
    exact: true,
  });
  await expect(fileLink).toBeVisible({ timeout: 60000 });
  const privateUrl = new URL((await fileLink.getAttribute("href"))!, page.url())
    .href;
  const event = page.waitForEvent("download");
  await fileLink.click();
  const download = await event;
  expect(download.suggestedFilename()).toBe(filename);
  expect(await readFile((await download.path())!)).toEqual(
    await readFile("tests/fixtures/mechanical-dimensions.pdf"),
  );
  const anon = await browser.newContext();
  const denied = await anon.request.get(privateUrl);
  expect(denied.status()).toBe(401);
  await anon.close();
  await page.reload();
  await expect(fileLink).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Sign out of workspace", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in to workspace", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  expect((await page.request.get(privateUrl)).status()).toBe(401);
  await page.getByLabel("Workspace email", { exact: true }).fill(email);
  await page.getByLabel("Workspace password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Sign in to workspace", exact: true })
    .click();
  await expect(fileLink).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("button", {
      name: `Use ${filename} for patent analysis`,
      exact: true,
    })
    .click();
  await expect(page.locator(".dropzone strong")).toHaveText(filename, {
    timeout: 60000,
  });
  await page
    .getByRole("button", { name: "Comprendre mon document", exact: true })
    .click();
  // Extractive profiles include the document heading first; verify the actual body passage too.
  await expect.poll(async () => page.getByLabel(/^Feature \d+ description$/).evaluateAll(fields =>
    fields.map(field => (field as HTMLTextAreaElement).value).join("\n")), { timeout: 60000 }).toMatch(/Base plate 80 x 50 x 6 mm/);
  await page.goto("/files");
  await page
    .getByRole("button", { name: `Use ${filename} in 3D Studio`, exact: true })
    .click();
  await expect(
    page.getByText("Selected source: " + filename, { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("button", {
      name: "Read document & identify parts",
      exact: true,
    })
    .click();
  await expect(page.getByRole("button", { name: /Base plate/ })).toBeVisible({
    timeout: 60000,
  });
  await page.goto("/files");
  await expect(fileLink).toBeVisible({ timeout: 60000 });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Delete project & files", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Project and its attachments deleted" }),
  ).toBeVisible({ timeout: 60000 });
  expect((await page.request.get(privateUrl)).status()).toBe(404);
  await page
    .getByRole("button", { name: "Sign out of workspace", exact: true })
    .click();
});
