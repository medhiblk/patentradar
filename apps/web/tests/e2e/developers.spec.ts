import { test, expect } from "@playwright/test";
test("developer portal uses the versioned API only after query-sharing consent", async ({
  page,
}) => {
  await page.route("**/api/v1/search", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      query: "optical detection",
      shareQuery: true,
    });
    await route.fulfill({
      json: {
        patents: [
          {
            publicationNumber: "EP1000000A1",
            title: "Fixture evidence card",
            source: "Fixture source",
            sourceUrl: "https://example.test/patent",
          },
        ],
        papers: [],
      },
    });
  });
  await page.goto("/developers");
  await page
    .getByLabel("Approved technical concepts")
    .fill("optical detection");
  await expect(
    page.getByRole("button", { name: "Search through the API" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "Share this query with the public patent and research providers.",
    })
    .check();
  await page.getByRole("button", { name: "Search through the API" }).click();
  await expect(page.getByText("EP1000000A1")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Fixture source" }),
  ).toHaveAttribute("href", "https://example.test/patent");
});
