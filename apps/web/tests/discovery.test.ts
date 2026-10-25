import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { parseOpenaire } from "../src/lib/providers/openaire";
import {
  parseMcp,
  normalizeVeyip,
  search as mcpSearch,
} from "../src/lib/providers/veyip";
import { parseApplication } from "../src/lib/providers/epo-linked";
import {
  parseArxiv,
  datacite,
  hal,
  zenodo,
} from "../src/lib/providers/new-research";
import {
  normalizeMultilingual,
  normalizeClassification,
  familyGroups,
  entityKey,
} from "../src/lib/providers/normalization";
import { tokens } from "../src/lib/compare";
import { request } from "../src/lib/providers/http";
const fixture = (name: string) =>
  JSON.parse(
    readFileSync("tests/fixtures/discovery/" + name + ".json", "utf8"),
  );
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("source-specific normalization", () => {
  it("separates real OpenAIRE patents from papers, preserving grant dates and Lens provenance", () => {
    const d = parseOpenaire(fixture("openaire"), "microfluidic");
    expect(d.patents.map((p) => p.publicationNumber)).toContain("US12233417B2");
    expect(
      d.patents.find((p) => p.publicationNumber === "US12233417B2")
        ?.publicationDate,
    ).toBe("2025-02-25");
    expect(
      d.patents.every(
        (p) => p.applicants.length === 0 && p.familyId === undefined,
      ),
    ).toBe(true);
    expect(d.patents[0].source).toContain("Lens-derived");
    expect(d.papers).toHaveLength(0);
  });
  it("normalizes a real EPO graph without creating search/claims fields", () => {
    const d = parseApplication(
      fixture("epo-application"),
      "https://data.epo.org/linked-data/doc/application/EP/81850042.json",
    );
    expect(d.familyId).toContain("20340535");
    expect(d.publications[0].number).toBe("EP0037802A2");
    expect(d.classifications).toContain("H01M 4/765");
  });
  it("parses the anonymous MCP patent search response but does not promote legal status to verified truth", () => {
    const records = normalizeVeyip(fixture("veyip-search"), "ts:电池");
    expect(records[0].publicationNumber).toBe("CN102299288B");
    expect(records[0].applicants[0]).toBe("福特全球技术公司");
    expect(records[0].source).toContain("experimental");
    expect(records[0]).not.toHaveProperty("legalStatus");
  });
  it("keeps experimental MCP disabled by default", async () => {
    vi.stubEnv("ENABLE_EXPERIMENTAL_VEYIP", "");
    await expect(mcpSearch("电池")).rejects.toThrow("disabled");
  });
  it("handles MCP SSE and rejects error envelopes", () => {
    expect(
      parseMcp(
        'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n',
      ),
    ).toEqual({ ok: true });
    expect(() => parseMcp('{"error":{"code":-1}}')).toThrow();
  });
  it("parses arXiv Atom metadata", () => {
    const rows = parseArxiv(
      readFileSync("tests/fixtures/discovery/arxiv.xml", "utf8"),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].sourceUrl).toContain("https://arxiv.org/abs/");
  });
  it("reads DataCite DOI metadata without making it a patent record", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(fixture("datacite")))),
    );
    const rows = await datacite("fixture-discovery-datacite");
    expect(rows[0].sourceUrl).toContain("https://doi.org/");
    expect(rows[0]).not.toHaveProperty("claims");
  });
  it("reads HAL metadata and retains the original repository link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture("hal")))),
    );
    expect((await hal("fixture-discovery-hal"))[0].sourceUrl).toContain(
      "hal.science",
    );
  });
  it("reads Zenodo metadata without exposing or downloading record files", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(fixture("zenodo")))),
    );
    const rows = await zenodo("fixture-discovery-zenodo");
    expect(rows[0].title).toContain("microfluidic");
    expect(rows[0]).not.toHaveProperty("files");
  });
});
describe("multilingual and transport boundaries", () => {
  it("normalizes full-width text and supports Chinese, Japanese and Korean tokens", () => {
    expect(normalizeMultilingual(" ＣＮ１２３　 电池 ")).toBe("CN123 电池");
    expect(tokens("电池热管理")).toContain("电池");
    expect(tokens("電池制御")).toContain("制御");
    expect(tokens("특허 검색")).toContain("특허");
    expect(entityKey("ＳＩＥＭＥＮＳ")).toBe("siemens");
    expect(normalizeClassification("H01M 4/765")).toBe("H01M4/765");
  });
  it("does not invent families for ungrouped patent records", () => {
    expect(familyGroups([])).toEqual([]);
  });
  it("deduplicates identical inflight public requests and caches the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
    vi.stubGlobal("fetch", fetchMock);
    const args = [
      "transport-fixture",
      "https://example.org/cache-fixture",
    ] as const;
    const [a, b] = await Promise.all([request(...args), request(...args)]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await request(...args);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed OpenAIRE data rather than treating HTTP success as patent evidence", () => {
    expect(() => parseOpenaire({ login: true }, "x")).toThrow();
  });
});

describe("supplementary API policy boundaries", () => {
  it("rejects arbitrary provider names without making outbound requests", async () => {
    const { POST } = await import("../src/app/api/intelligence/route");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await POST(
      new Request("http://localhost/api/intelligence", {
        method: "POST",
        body: JSON.stringify({
          provider: "https://example.org/ssrf",
          query: "x",
          consent: true,
        }),
      }),
    );
    expect(r.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires consent before sending even a public organization query", async () => {
    const { POST } = await import("../src/app/api/intelligence/route");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await POST(
      new Request("http://localhost/api/intelligence", {
        method: "POST",
        body: JSON.stringify({ provider: "ror", query: "Rochester" }),
      }),
    );
    expect(r.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not expose arbitrary MCP tool execution", async () => {
    const { POST } = await import("../src/app/api/intelligence/route");
    vi.stubEnv("ENABLE_EXPERIMENTAL_VEYIP", "");
    const r = await POST(
      new Request("http://localhost/api/intelligence", {
        method: "POST",
        body: JSON.stringify({
          provider: "veyip",
          query: "电池",
          operation: "submit_consultation",
          consent: true,
        }),
      }),
    );
    expect(r.status).toBe(400);
  });
});
it("parses real EPO Turtle without remote graph execution", async () => {
  const { parseApplicationRdf } =
    await import("../src/lib/providers/epo-linked");
  const parsed = await parseApplicationRdf(
    readFileSync("tests/fixtures/discovery/epo-application.ttl", "utf8"),
  );
  expect(parsed.totalTriples).toBeGreaterThan(10);
  expect(parsed.triples.some((t) => t.object.includes("81850042"))).toBe(true);
});
it("keeps a less prolific research source visible in a bounded mixed result set", async () => {
  const { diversePapers } = await import("../src/lib/normalize");
  const input = [
    ...Array.from({ length: 20 }, (_, i) => ({
      source: "A",
      sourceUrl: "https://example.org/a/" + i,
    })),
    { source: "B", sourceUrl: "https://example.org/b" },
  ];
  expect(diversePapers(input, 4).some((r) => r.source === "B")).toBe(true);
});
it('reports provider outages as service failures rather than invalid user input',async()=>{const {failure}=await import('../src/lib/security');const {ProviderRequestError}=await import('../src/lib/providers/http');const r=failure(new ProviderRequestError('hal','UNAVAILABLE','Network unavailable'));expect(r.status).toBe(503);expect((await r.json()).provider).toBe('hal');});
it('preserves a safe Retry-After response for provider throttling',async()=>{const {failure}=await import('../src/lib/security');const {ProviderRequestError}=await import('../src/lib/providers/http');const r=failure(new ProviderRequestError('openaire','RATE_LIMITED','Limit reached',61000));expect(r.status).toBe(429);expect(r.headers.get('Retry-After')).toBe('61');});
it('classifies the EPO adapter by its implemented XML endpoint instead of an HTML index route',async()=>{const {registry}=await import('../src/lib/providers/registry');expect(registry().find(p=>p.id==='epo-publication')?.tier).toBe('A');});
