import { test, expect } from "@playwright/test";
import { realProfile } from "../../src/lib/real-case";
test("three project seeds reach consented search and live results remain usable", async ({
  page,
}) => {
  let received: string[] = [];
  await page.route("**/api/extract", (route) =>
    route.fulfill({
      json: {
        profile: realProfile,
        mode: "LIVE",
        notice: "Fixture extraction",
      },
    }),
  );
  await page.route("**/api/research/stream", async (route) => {
    const body = route.request().postDataJSON();
    received = body.seedPublications.map(
      (s: { publicationNumber: string }) => s.publicationNumber,
    );
    expect(body.consent).toBe(true);
    await route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "completed",
          result: {
            profile: realProfile,
            mode: "PARTIAL",
            patents: [],
            papers: [],
            warnings: ["No fixture patents."],
            queries: received,
          },
        }) + "\n",
    });
  });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "My Inventions" })
    .click();
  await page
    .getByText("Device-only drafts (this browser)", { exact: true })
    .click();
  await page
    .getByLabel("Description", { exact: true })
    .fill(
      "An optical microfluidic instrument transports samples through channels and measures fluorescence.",
    );
  await page
    .getByText("Add a title and known patents", { exact: true })
    .click();
  await page
    .getByLabel("Known publication numbers", { exact: false })
    .fill("EP2345898B1\nCN102299288B\nJP1234567B2");
  await page.getByRole("button", { name: "Review technical features" }).click();
  await page
    .getByRole("button", { name: "Extract technical features" })
    .click();
  await page
    .getByRole("checkbox", { name: /Share the reviewed search concepts/ })
    .check();
  await page.getByRole("button", { name: "Retrieve & compare" }).click();
  await expect.poll(() => received.length).toBe(3);
  await expect(page.getByText("No fixture patents.")).toBeVisible();
});
