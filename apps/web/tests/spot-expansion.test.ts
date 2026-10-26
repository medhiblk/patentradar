import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expandSpot, type SpotExpansionEvent } from "../src/lib/search/spot-expand";
import { POST } from "../src/app/api/spot/expand/route";
import { execute } from "../src/lib/search/orchestrator";
import * as corpus from "../src/lib/patents/reference-corpus";
import { sourceRun } from "../src/lib/search/source-runs";
import type { Research } from "../src/lib/model";
import type { SearchTrace } from "../src/lib/search/audit";
import cases from "../../../docs/evaluation/spot-cases.json";

vi.mock("../src/lib/search/orchestrator", () => ({ execute: vi.fn() }));
const realRecords = corpus.publicReferencePatents();
const liveRecord = realRecords.find(record => record.publicationNumber === "EP1000581A1")!;
const otherRecord = realRecords.find(record => record.publicationNumber !== liveRecord.publicationNumber)!;
const pages = [{ page: 3, text: liveRecord.claims!.slice(0, 3).join("\n") }];
const query = "medical x ray apparatus";
beforeEach(() => {
  vi.mocked(execute).mockReset();
  vi.spyOn(corpus, "publicReferencePatents").mockReturnValue([otherRecord]);
});
afterEach(() => vi.restoreAllMocks());
function provider() {
  return { ...sourceRun("OpenAIRE Graph", [query]), status: "running" as const, startedAt: new Date().toISOString() };
}
function stubSearch(fail = false) {
  vi.mocked(execute).mockImplementation(async (input, emit) => {
    expect(input.query).toBe(query);
    expect(input.query).not.toContain(pages[0].text);
    expect(input.consent).toBe(true);
    const source = provider();
    const trace: SearchTrace = { searchId: "fixture-search", context: "live-search", startedAt: source.startedAt, providers: [source], notQueried: [] };
    const event = { schemaVersion: 1 as const, searchId: "fixture-search", sequence: 1, timestamp: source.startedAt, type: "started" };
    emit?.({ ...event, searchTrace: trace });
    emit?.({ ...event, type: "provider_started", providerRun: source });
    emit?.({ ...event, type: "candidate_upsert", candidate: liveRecord });
    if (fail) throw Error("Mocked provider timeout");
    const finished = { ...source, status: "succeeded" as const, patentsRetrieved: 1, patentNumbers: [liveRecord.publicationNumber] };
    emit?.({ ...event, type: "provider_finished", providerRun: finished });
    return { profile: input.profile, mode: "PARTIAL", patents: [liveRecord], papers: [], queries: [query], warnings: [], searchTrace: { ...trace, providers: [finished] } } as Research;
  });
}
it("streams the original comparison before retrieval, then compares genuine additional source records", async () => {
  stubSearch();
  const events: SpotExpansionEvent[] = [];
  const result = await expandSpot({ pages, query }, event => events.push(event));
  expect(events[0].type).toBe("initial");
  expect(events.at(-1)?.type).toBe("complete");
  expect(events.some(event => event.type === "candidate")).toBe(true);
  expect(result.coverage.indexedPatentCount).toBe(1);
  expect(result.coverage.mode).toBe("reference-index-and-live-search");
  expect(result.matches[0]?.patent.publicationNumber).toBe(liveRecord.publicationNumber);
  expect(result.matches[0]?.evidence[0].sourceUrl).toMatch(/^https:/);
  expect(result.liveSearch?.patentsRetrieved).toBe(1);
  expect(result.liveSearch?.papersRetrieved).toBe(0);
  for (const evidence of result.matches[0].evidence) {
    expect(evidence.inputPage).toBe(3);
    expect(pages[0].text.slice(evidence.inputStart, evidence.inputEnd)).toBe(evidence.inputExcerpt);
    if (evidence.evidenceField === "claim") expect(liveRecord.claims![evidence.claimIndex!].slice(evidence.sourceStart, evidence.sourceEnd)).toBe(evidence.sourceExcerpt);
  }
});
it("retains streamed records and source failures if retrieval times out", async () => {
  stubSearch(true);
  const result = await expandSpot({ pages, query }, () => {});
  expect(result.matches[0]?.patent.publicationNumber).toBe(liveRecord.publicationNumber);
  expect(result.liveSearch?.trace.providers[0].status).toBe("failed");
  expect(result.warnings.join(" ")).toContain("retained");
});
it("never transmits a search query without explicit separate approval", async () => {
  const form = new FormData(); form.set("text", pages[0].text); form.set("query", query);
  const response = await POST(new Request("http://localhost/api/spot/expand", { method: "POST", headers: { "x-forwarded-for": randomUUID() }, body: form }));
  expect(response.status).toBe(400);
  expect((await response.json()).code).toBe("SEARCH_CONSENT_REQUIRED");
  expect(execute).not.toHaveBeenCalled();
});
it("ingests real PDF bytes and returns a complete NDJSON result with original document provenance", async () => {
  stubSearch();
  const bytes = await readFile(cases.blindPdf.path.replace(/^apps\/web\//, ""));
  const form = new FormData();
  form.set("file", new File([bytes], "neutral-document.pdf", { type: "application/pdf" }));
  form.set("query", query); form.set("searchConsent", "true"); form.set("consent", "false");
  const response = await POST(new Request("http://localhost/api/spot/expand", { method: "POST", headers: { "x-forwarded-for": randomUUID() }, body: form }));
  expect(response.headers.get("content-type")).toContain("application/x-ndjson");
  const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
  expect(events[0].type).toBe("initial");
  const last = events.at(-1);
  expect(last.type).toBe("complete");
  expect(last.result.document.inputKind).toBe("pdf");
  expect(last.result.document.pageCount).toBeGreaterThan(1);
  expect(last.result.liveSearch.query).toBe(query);
});
