import { afterEach, expect, it, vi } from "vitest";
const enrichment = vi.hoisted(() => ({ enrich: vi.fn() }));
vi.mock("../src/lib/providers/patent-pages", () => enrichment);
import { compare, tokens } from "../src/lib/compare";
import { applyPatentRanking, applyRankingIfCurrent, validatePatentRanking } from "../src/lib/search/ranking";
import { searchAvailability } from "../src/lib/search/availability";
import { execute, plan } from "../src/lib/search/orchestrator";
import { ReportSchema, ResearchSchema, type Profile, type Research } from "../src/lib/model";
import type { PatentRecord } from "../src/lib/providers/types";
import { reportSections } from "../src/lib/report";
import { aiEvidencePayload } from "../src/lib/intelligence/ai-payload";
const profile: Profile = { title: "Rotor support", domain: "Mechanical engineering", operatingPrinciple: "A rotor uses a bearing housing.", technicalFeatures: [{ name: "Rotor support", description: "A rotor uses a bearing housing." }], searchKeywords: ["rotor bearing housing"] };
const patent = (publicationNumber = "EP1000000A1"): PatentRecord => ({ id: publicationNumber, publicationNumber, title: "Rotor bearing housing", applicants: [], source: "Fixture only", sourceUrl: "https://example.test/publication", retrievedAt: "2026-10-25" });
const report = (patents: PatentRecord[] = []): Research => ({ profile, patents, papers: [], mode: "PARTIAL", warnings: [], queries: ["rotor bearing housing"] });
const input = () => ResearchSchema.parse({ profile, mode: "LIVE", consent: true, query: "rotor bearing housing" });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("shows matching text beyond the first 1200 characters with exact original offsets and claim index", () => {
  const claims = ["", "Unrelated background. ".repeat(200) + "The rotor turns within a bearing housing and support."];
  const match = compare(profile, { ...patent(), claims }).matches[0];
  expect(match.claimIndex).toBe(1);
  expect(match.start).toBeGreaterThan(1200);
  expect(claims[1].slice(match.start, match.end)).toBe(match.excerpt);
  expect(match.excerpt.length).toBeLessThanOrEqual(1200);
  expect(match.terms.length).toBeGreaterThanOrEqual(3);
  expect(match.terms.every((term) => tokens(match.excerpt).includes(term))).toBe(true);
});

it("keeps compatibility-normalized visible terms linked to exact original text", () => {
  const abstract = "Other context. ".repeat(100) + "ＲＯＴＯＲ bearing housing support.";
  const match = compare(profile, { ...patent(), abstract }).matches[0];
  expect(match.evidenceField).toBe("abstract");
  expect(abstract.slice(match.start, match.end)).toBe(match.excerpt);
  expect(match.terms).toContain("rotor");
});

it("applies a complete AI ordering to the saved/reportable evidence without changing provenance", () => {
  const original = report([patent("EP1000000A1"), patent("EP1000001A1")]);
  const ranked = applyPatentRanking(original, [{ publicationNumber: "EP1000001A1", reason: "Closer claim evidence." }, { publicationNumber: "EP1000000A1", reason: "Title-only evidence." }], "2026-10-25T00:00:00Z");
  expect(ranked.patents.map((p) => p.publicationNumber)).toEqual(["EP1000001A1", "EP1000000A1"]);
  expect(ranked.patents[0]).toBe(original.patents[1]);
  expect(ReportSchema.parse(ranked).ranking?.entries[0].reason).toBe("Closer claim evidence.");
  const sections = reportSections(ranked);
  expect(sections.find(([title]) => title === "Patent shortlist")?.[1]).toContain("Closer claim evidence.");
  expect(sections.find(([title]) => title === "Search methodology")?.[1]).toContain("reviewed with AI");
});

it("rejects omitted, duplicated and invented reranking IDs", () => {
  const patents = [patent(), patent("EP1000001A1")];
  expect(() => validatePatentRanking(patents, [{ publicationNumber: patents[0].publicationNumber, reason: "Only one" }])).toThrow();
  expect(() => validatePatentRanking(patents, [{ publicationNumber: "INVENTED", reason: "Invented" }, { publicationNumber: patents[1].publicationNumber, reason: "Known" }])).toThrow();
  expect(() => validatePatentRanking(patents, [{ publicationNumber: patents[0].publicationNumber, reason: "Duplicate" }, { publicationNumber: patents[0].publicationNumber, reason: "Duplicate" }])).toThrow();
});

it("ignores stale AI rankings after a new candidate, profile or search run", () => {
  const original = report([patent()]);
  const ranking = [{ publicationNumber: "EP1000000A1", reason: "Reviewed" }];
  const changed = { ...original, patents: [...original.patents, patent("EP1000001A1")] };
  expect(applyRankingIfCurrent(changed, original, ranking)).toBe(changed);
  const newProfile = { ...original, profile: { ...profile, title: "A different invention" } };
  expect(applyRankingIfCurrent(newProfile, original, ranking)).toBe(newProfile);
  const run = { ...original, searchTrace: { searchId: "new-run", context: "live-search" as const, startedAt: "2026-10-25", providers: [], notQueried: [] } };
  expect(applyRankingIfCurrent(run, original, ranking)).toBe(run);
  expect(applyRankingIfCurrent(original, original, ranking)?.ranking?.method).toBe("ai-assisted");
});

it("bounds realistic AI inputs and preserves original claim indexes for the selected publication", () => {
  const target = { ...patent(), claims: ["Unrelated technical background.", "A rotor bearing housing provides rotor support."] };
  const payload = aiEvidencePayload("compare", profile, [target, patent("EP1000001A1")]);
  expect(payload.evidence).toHaveLength(1);
  expect(payload.evidence[0].claims[0].index).toBe(1);
  expect(target.claims[1]).toContain(payload.evidence[0].claims[0].text);
  const longProfile = { ...profile, technicalFeatures: Array.from({ length: 20 }, (_, i) => ({ name: "Feature " + i, description: "rotor bearing housing support ".repeat(45) })) };
  const candidates = Array.from({ length: 20 }, (_, i) => ({ ...target, publicationNumber: "EP" + (1000000 + i) + "A1", claims: Array(8).fill("rotor bearing housing support ".repeat(140)), abstract: "Technical abstract. ".repeat(100) }));
  expect(JSON.stringify(aiEvidencePayload("rerank", longProfile, candidates)).length).toBeLessThan(50000);
});

it("does not plan an unavailable SQLite index on a stateless cloud host", () => {
  vi.stubEnv("VERCEL", "1"); vi.stubEnv("PATENTRADAR_DATA_DIR", "");
  expect(plan(input()).jobs.some((job) => job.name === "Local sourced patent index")).toBe(false);
  expect(plan({ ...input(), sources: "local" }).jobs).toHaveLength(0);
});

it("distinguishes failed patent sources from scientific success and an actual empty patent sample", async () => {
  const unavailable = await execute(input(), undefined, undefined, [
    { name: "OpenAIRE Graph", run: async () => { throw new Error("Fixture source unavailable"); } },
    { name: "Crossref", run: async () => ({ patents: [], papers: [{ id: "fixture", title: "Fixture paper", source: "Fixture", sourceUrl: "https://example.test/paper", retrievedAt: "2026-10-25" }] }) },
  ]);
  expect(searchAvailability(unavailable).outcome).toBe("patent-sources-unavailable");
  const empty = await execute(input(), undefined, undefined, [{ name: "OpenAIRE Graph", run: async () => ({ patents: [], papers: [] }) }]);
  expect(searchAvailability(empty).outcome).toBe("no-patents-in-returned-sample");
  expect(searchAvailability(report()).outcome).toBe("no-patent-source-planned");
});

it("re-ranks enriched claims before emitting the final report and ranking event", async () => {
  vi.stubEnv("ENABLE_GOOGLE_PATENT_PAGES", "true");
  enrichment.enrich.mockImplementation(async (p: PatentRecord) => p.publicationNumber === "EP1000001A1" ? { ...p, claims: ["The rotor uses a bearing housing support."] } : p);
  const first = { ...patent(), title: "Rotor" }, second = { ...patent("EP1000001A1"), title: "Mechanical arrangement" };
  const results: Research[] = [];
  const output = await execute(input(), (event) => { if (event.type === "ranking_updated" && event.result) results.push(event.result); }, undefined,
    [{ name: "OpenAIRE Graph", run: async () => ({ patents: [first, second], papers: [] }) }]);
  expect(output.patents[0].publicationNumber).toBe("EP1000001A1");
  expect(output.ranking?.method).toBe("lexical");
  expect(results[0].patents[0].claims?.[0]).toContain("bearing housing");
});
