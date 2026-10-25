import { test, expect } from "@playwright/test";
test.use({ actionTimeout: 30000 });
test("real publication is ingested, compared, stored in a private portfolio and surfaced as a sourced alert", async ({
  page,
}) => {
  test.setTimeout(180000);
  const email = `reference-${crypto.randomUUID()}@example.test`,
    password = `test-${crypto.randomUUID()}`;
  await page.goto("/files");
  await page.getByLabel("Workspace email", { exact: true }).fill(email);
  await page.getByLabel("Workspace password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create workspace account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign out of workspace", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page.goto("/demo/patent");
  await page
    .getByRole("button", {
      name: "Ingest the real patent excerpt",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Verified excerpt loaded" }),
  ).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("button", {
      name: "Compare this design with the publication",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Save to private portfolio", exact: true })
    .click();
  const final = page.getByRole("region", {
    name: "Saved patent similarity result",
  });
  await expect(
    final.getByRole("heading", {
      name: "A similar publication already exists.",
      exact: true,
    }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    final.getByRole("link", { name: "Open publication", exact: true }),
  ).toHaveAttribute(
    "href",
    "https://patents.google.com/patent/US20080003142A1/en",
  );
  await expect(final.getByText(/reports “Abandoned”/)).toBeVisible();
  await expect(page.getByRole("form", { name: "Workspace sign in" })).toHaveCount(0);
  await page
    .getByRole("link", { name: "Open project ↗", exact: true })
    .click();
  await expect(
    page.getByRole("link", {
      name: "Download US20080003142A1-excerpt.pdf",
      exact: true,
    }),
  ).toBeVisible({ timeout: 60000 });
  const projectId = new URL(page.url()).searchParams.get("projectId")!;
  await page.goto("/alerts");
  await expect(
    page.getByText("1 unread · 1 displayed", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Mark reviewed", exact: true })
    .click();
  await expect(
    page.getByText("0 unread · 1 displayed", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Mark unread", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const remove = await page.request.post("/api/vault", {
    data: { action: "delete", id: projectId },
  });
  expect(remove.status()).toBe(200);
  await page.request.post("/api/vault", { data: { action: "logout" } });
});
