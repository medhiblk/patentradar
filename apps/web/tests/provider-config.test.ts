import { it, expect, vi, afterEach } from "vitest";
import {
  epoPublicationBase,
  openAlexWorksUrl,
  wikidataSparqlUrl,
  datasetCatalogues,
} from "../src/lib/providers/urls";
import {
  parseResearch,
  search,
} from "../src/lib/providers/europe-pmc-research";
import { plan } from "../src/lib/search/orchestrator";
import { ResearchSchema } from "../src/lib/model";
import { realProfile } from "../src/lib/real-case";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("supports new and legacy EPO roots without duplicating the REST suffix", () => {
  vi.stubEnv("EPO_PUBLICATION_SERVER_URL", "");
  vi.stubEnv(
    "EPO_PUBLICATION_URL",
    "https://legacy.example/publication-server/",
  );
  expect(epoPublicationBase()).toBe(
    "https://legacy.example/publication-server/rest/v1.2",
  );
  vi.stubEnv(
    "EPO_PUBLICATION_SERVER_URL",
    "https://new.example/publication-server/rest/v1.2/",
  );
  expect(epoPublicationBase()).toBe(
    "https://new.example/publication-server/rest/v1.2",
  );
});
it("honors OpenAlex base aliases and explicit works overrides", () => {
  vi.stubEnv("OPENALEX_WORKS_URL", "");
  vi.stubEnv("OPENALEX_API_URL", "https://new.example/api");
  expect(openAlexWorksUrl().href).toBe("https://new.example/api/works");
  vi.stubEnv("OPENALEX_WORKS_URL", "https://works.example/works");
  expect(openAlexWorksUrl().hostname).toBe("works.example");
  vi.stubEnv("WIKIDATA_SPARQL_URL", "https://graph.example/sparql");
  expect(wikidataSparqlUrl().hostname).toBe("graph.example");
});
it("never interprets a Europe PMC patent record or abstract as scientific metadata", () => {
  const rows = parseResearch({
    hitCount: 2,
    resultList: {
      result: [
        {
          id: "123",
          source: "MED",
          title: "<i>Microfluidics</i> study",
          pubYear: "2025",
          doi: "10.1234/example",
          abstractText: "Not redistributed",
        },
        { id: "patent", source: "PAT", title: "Patent" },
      ],
    },
  });
  expect(rows).toHaveLength(1);
  expect(rows[0].sourceUrl).toBe("https://doi.org/10.1234/example");
  expect(rows[0].title).toBe("Microfluidics study");
  expect(rows[0]).not.toHaveProperty("abstract");
  expect(rows[0]).not.toHaveProperty("claims");
});
it("uses the configured scientific endpoint, bounded metadata and article source restriction", async () => {
  vi.stubEnv("EUROPE_PMC_API_URL", "https://epmc.example/search");
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ hitCount: 0, resultList: { result: [] } })),
    );
  vi.stubGlobal("fetch", fetch);
  expect(await search("unique-provider-config")).toEqual([]);
  const url = new URL(fetch.mock.calls[0][0]);
  expect(url.hostname).toBe("epmc.example");
  expect(url.searchParams.get("query")).toContain("SRC:MED OR SRC:PMC");
  expect(url.searchParams.get("pageSize")).toBe("4");
  await expect(search("x", 2)).rejects.toThrow(/cursor/);
});
it("adds scientific discovery without enabling the legacy patent archive", () => {
  vi.stubEnv("ENABLE_EPMC_PATENT_ARCHIVE", "false");
  const i = ResearchSchema.parse({
    profile: realProfile,
    query: "microfluidic",
    mode: "LIVE",
    consent: true,
  });
  const jobs = plan(i).jobs;
  expect(jobs.some((j) => j.name === "Europe PMC scientific")).toBe(true);
  expect(jobs.some((j) => j.name === "Europe PMC")).toBe(false);
});
it("keeps dataset pages separate from search and does not publish secret-bearing URL overrides", () => {
  vi.stubEnv("USPTO_DATASETS_URL", "https://token:secret@example.org/catalog");
  vi.stubEnv(
    "PATENTSVIEW_DATA_URL",
    "https://example.org/catalog?api_key=secret",
  );
  const rows = datasetCatalogues();
  expect(JSON.stringify(rows)).not.toContain("secret");
  expect(rows.every((r) => r.kind === "download-catalogue")).toBe(true);
  expect(rows[1].status).toBe("ACCESS TO VERIFY");
});
