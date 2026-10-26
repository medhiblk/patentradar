import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { search } from "../src/lib/providers/openaire";
import { request } from "../src/lib/providers/http";
vi.mock("../src/lib/providers/http", () => ({ request: vi.fn() }));
afterEach(() => vi.clearAllMocks());
const fixture = readFileSync("tests/fixtures/discovery/openaire.json", "utf8");
it("uses the documented, case-sensitive Patent filter for patent-focused retrieval", async () => {
  vi.mocked(request).mockResolvedValue(fixture);
  const result = await search("microfluidic", 1, true);
  const url = new URL(vi.mocked(request).mock.calls.at(-1)![1]);
  expect(url.searchParams.get("instancetype")).toBe("Patent");
  expect(url.searchParams.get("keywords")).toBe("microfluidic");
  expect(result.patents.length).toBeGreaterThan(0);
  expect(result.patents.every(patent => patent.source.includes("OpenAIRE"))).toBe(true);
});
it("preserves the existing mixed-search behavior for independent adapter callers", async () => {
  vi.mocked(request).mockResolvedValue(fixture);
  await search("microfluidic");
  expect(new URL(vi.mocked(request).mock.calls.at(-1)![1]).searchParams.has("instancetype")).toBe(false);
});
it("recognizes patent instances nested directly under children instead of misclassifying them as papers", async () => {
  const raw = JSON.parse(fixture);
  const row = Array.isArray(raw.response.results.result) ? raw.response.results.result[0] : raw.response.results.result;
  delete row.metadata["oaf:entity"]["oaf:result"].children.result;
  vi.mocked(request).mockResolvedValue(JSON.stringify(raw));
  const result = await search("microfluidic", 1, true);
  expect(result.patents.some(patent => patent.publicationNumber === "US12233417B2")).toBe(true);
  expect(result.papers).toHaveLength(0);
});
