import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parsePublication } from "../../src/lib/providers/epo-publication";
import { realProfile } from "../../src/lib/real-case";
import { sourceRun } from "../../src/lib/search/source-runs";
test("source execution, analysed publications and feature evidence remain inspectable on mobile", async ({
  page,
}) => {
  const url =
    "https://data.epo.org/publication-server/rest/v1.2/publication-dates/20000517/patents/EP1000000NWA1/document.xml";
  const patent = {
    ...parsePublication(
      readFileSync("tests/fixtures/EP1000000A1.xml", "utf8"),
      url,
    ),
    queries: ["EP1000000A1"],
  };
  const now = new Date().toISOString();
  const trace = {
    searchId: "automated-fixture",
    context: "live-search" as const,
    startedAt: now,
    completedAt: now,
    providers: [
      {
        ...sourceRun("EPO EP1000000A1", []),
        status: "succeeded" as const,
        patentsRetrieved: 1,
        patentNumbers: [patent.publicationNumber],
        requests: [
          {
            provider: "epo-publication",
            endpoint: url,
            observedAt: now,
            servedFrom: "memory-cache" as const,
          },
        ],
      },
      {
        ...sourceRun("Crossref", ["brick conveyor"]),
        status: "empty" as const,
      },
      {
        ...sourceRun("HAL", ["brick conveyor"]),
        status: "failed" as const,
        message: "Rate-limited; retry later.",
      },
    ],
    notQueried: [
      {
        name: "Google Patents Public Data / BigQuery",
        reason: "Not configured for this test.",
      },
    ],
  };
  await page.route("**/api/research/stream", (route) =>
    route.fulfill({
      contentType: "application/x-ndjson",
      body:
        [
          {
            type: "started",
            searchTrace: { ...trace, completedAt: undefined },
          },
          { type: "candidate_upsert", candidate: patent },
          {
            type: "completed",
            result: {
              searchTrace: trace,
              profile: realProfile,
              mode: "PARTIAL",
              patents: [patent],
              papers: [],
              queries: ["EP1000000A1"],
              warnings: [
                "Automated fixture; no real provider call performed by this test.",
              ],
            },
          },
        ]
          .map((event) => JSON.stringify(event))
          .join("\n") + "\n",
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Voir un cas brevet réel" }).click();
  const audit = page.getByRole("region", {
    name: "Search sources and analysed patents",
  });
  await expect(
    audit.getByText("Search completed", { exact: true }),
  ).toBeVisible();
  await expect(
    audit.getByText("No records returned", { exact: true }),
  ).toBeVisible();
  await expect(audit.getByText("Unavailable", { exact: true })).toBeVisible();
  const epo = audit.locator("article").filter({ hasText: "EPO EP1000000A1" });
  await epo.getByText("Queries, access and coverage", { exact: true }).click();
  await expect(epo.getByText(/Reviewed queries: EP1000000A1/)).toBeVisible();
  await expect(
    epo.getByText("Memory cache reused · no HTTP status recorded", {
      exact: true,
    }),
  ).toBeVisible();
  await audit.getByText("Sources not queried (1)", { exact: true }).click();
  await expect(
    audit.getByText("Google Patents Public Data / BigQuery", { exact: true }),
  ).toBeVisible();
  const evidence = page.getByRole("region", {
    name: "Evidence for EP1000000A1",
  });
  await expect(
    evidence.getByRole("heading", { name: "Evidence behind this result" }),
  ).toBeVisible();
  await expect(
    evidence.getByText("Retrieved claim text", { exact: true }),
  ).toBeVisible();
  await expect(
    evidence.getByRole("link", { name: "Verify passage source" }).first(),
  ).toHaveAttribute("href", url);
  await expect(evidence.locator("mark").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await audit.getByRole("button", { name: /EP1000000A1/ }).click();
  await expect(
    page.getByRole("region", { name: "Evidence for EP1000000A1" }),
  ).toBeVisible();
});
