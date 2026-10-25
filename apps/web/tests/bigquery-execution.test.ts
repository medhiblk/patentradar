import { it, expect, vi, beforeEach } from "vitest";
const sdk = vi.hoisted(() => ({
  createQueryJob: vi.fn(),
  getMetadata: vi.fn(),
}));
vi.mock("@google-cloud/bigquery", () => ({
  BigQuery: class {
    dataset() {
      return { table: () => ({ getMetadata: sdk.getMetadata }) };
    }
    createQueryJob = sdk.createQueryJob;
  },
}));
import { retrieve } from "../src/lib/providers/google-patents";
beforeEach(() => {
  vi.stubEnv("ENABLE_BIGQUERY", "true");
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "test-project");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  sdk.getMetadata.mockResolvedValue([
    {
      location: "US",
      schema: {
        fields: [
          "publication_number",
          "title_localized",
          "abstract_localized",
          "assignee",
          "family_id",
        ].map((name) => ({ name })),
      },
    },
  ]);
  sdk.createQueryJob.mockReset();
});
it("rejects an over-budget dry run without executing a job", async () => {
  sdk.createQueryJob.mockResolvedValueOnce([
    { metadata: { statistics: { totalBytesProcessed: "9000000000" } } },
  ]);
  await expect(retrieve("pump", [])).rejects.toThrow("budget");
  expect(sdk.createQueryJob).toHaveBeenCalledTimes(1);
});
it("uses parameters and bounded seed retrieval after dry run", async () => {
  const row = {
    publication_number: "US-7650331-B1",
    title_localized: [{ language: "en", text: "Fixture instrument" }],
    assignee: [],
  };
  sdk.createQueryJob
    .mockResolvedValueOnce([
      { metadata: { statistics: { totalBytesProcessed: "1000" } } },
    ])
    .mockResolvedValueOnce([
      {
        id: "fixture-job",
        getQueryResults: async () => [[row]],
        getMetadata: async () => [
          { statistics: { query: { cacheHit: false } } },
        ],
        cancel: vi.fn(),
      },
    ]);
  expect(await retrieve("unused", ["US7650331B1"])).toHaveLength(1);
  const options = sdk.createQueryJob.mock.calls[1][0];
  expect(options.params).toEqual({ ids: ["US-7650331-B1"] });
  expect(options.query).toContain("IN UNNEST(@ids)");
  expect(options.maximumBytesBilled).toBe("1073741824");
});
