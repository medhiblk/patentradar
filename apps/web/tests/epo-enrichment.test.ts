import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import * as epo from "../src/lib/providers/epo-publication";
import { enrichEpoCandidates } from "../src/lib/search/epo-enrichment";
import { execute } from "../src/lib/search/orchestrator";
import { ResearchSchema } from "../src/lib/model";
import type { PatentRecord } from "../src/lib/providers/types";
import type { SourceRun } from "../src/lib/search/audit";
const patent = (publicationNumber = "EP1000000A1", publicationDate: string | undefined = "2000-05-17"): PatentRecord => ({
  id: publicationNumber, publicationNumber, title: "Retrieved metadata fixture", applicants: [], publicationDate,
  source: "Metadata fixture", sourceUrl: "https://example.test/record", retrievedAt: "2026-10-25",
});
const input = () => ResearchSchema.parse({ mode: "LIVE", query: "shaft bearing", consent: true,
  profile: { title: "Shaft", domain: "Engineering", operatingPrinciple: "A bearing supports a shaft.", technicalFeatures: [{ name: "Bearing", description: "A bearing supports a shaft." }], searchKeywords: ["shaft bearing"] } });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it("uses at most two genuine EP metadata dates and keeps original and EPO provenance", async () => {
  const lookup = vi.spyOn(epo, "lookup").mockImplementation(async (number) => [{ ...patent(number), claims: ["A bearing supports a shaft."], source: "EPO Publication Server", sourceUrl: "https://data.epo.org/publication-server/official.xml", pdfUrl: "https://data.epo.org/publication-server/official.pdf" }]);
  const records = [patent(), patent("EP1000001B1", "20000518"), patent("EP1000002A1", "2000-05-19")];
  const completed: SourceRun[] = [];
  const result = await enrichEpoCandidates(records, { onRun: (run, event) => { if (event === "provider_finished") completed.push(run); } });
  expect(lookup).toHaveBeenCalledTimes(2);
  expect(lookup).toHaveBeenNthCalledWith(1, "EP1000000A1", "20000517");
  expect(lookup).toHaveBeenNthCalledWith(2, "EP1000001B1", "20000518");
  expect(result.patents[0].claims?.[0]).toBe("A bearing supports a shaft.");
  expect(result.patents[0].evidence?.map((row) => row.source)).toEqual(["Metadata fixture", "EPO Publication Server"]);
  expect(completed[0]).toMatchObject({ method: "publication-lookup", category: "patent", status: "succeeded", queries: ["EP1000000A1"] });
});

it("does not guess unknown or invalid dates, retrieve non-EP records, or replace available claims", async () => {
  const lookup = vi.spyOn(epo, "lookup");
  const records = [patent("US20080003142A1"), { ...patent(), publicationDate: undefined }, patent("EP1000001A1", "2000-02-31"), { ...patent("EP1000002A1"), claims: ["Already retrieved claim."] }];
  const result = await enrichEpoCandidates(records);
  expect(lookup).not.toHaveBeenCalled();
  expect(result.patents).toBe(records);
});

it("keeps metadata when EPO fails and still emits failure coverage", async () => {
  vi.spyOn(epo, "lookup").mockRejectedValue(new Error("Fixture provider failure"));
  const events: string[] = [];
  const result = await enrichEpoCandidates([patent()], { onRun: (run, event) => events.push(event + ":" + run.status) });
  expect(result.patents[0].publicationNumber).toBe("EP1000000A1");
  expect(result.patents[0].claims).toBeUndefined();
  expect(result.warnings[0]).toContain("original metadata retained");
  expect(events).toContain("provider_failed:failed");
});

it("caps a hanging enrichment stage at twelve seconds", async () => {
  vi.useFakeTimers();
  vi.spyOn(epo, "lookup").mockImplementation(() => new Promise(() => {}));
  const pending = enrichEpoCandidates([patent()]);
  await vi.advanceTimersByTimeAsync(12000);
  const result = await pending;
  expect(result.patents[0].claims).toBeUndefined();
  expect(result.warnings).toHaveLength(1);
});

it("does not enrich a local-only search even when an injected local job returns an EP date", async () => {
  const lookup = vi.spyOn(epo, "lookup");
  const result = await execute({ ...input(), sources: "local", consent: false }, undefined, undefined,
    [{ name: "Local sourced patent index", run: async () => ({ patents: [patent()], papers: [] }) }]);
  expect(lookup).not.toHaveBeenCalled();
  expect(result.patents[0].claims).toBeUndefined();
});

it("records the actual mocked HTTP lookup and streams claims before final completion", async () => {
  const xml = readFileSync("tests/fixtures/EP1000000A1.xml", "utf8");
  const fetch = vi.fn().mockResolvedValue(new Response(xml, { headers: { "content-type": "application/xml" } }));
  vi.stubGlobal("fetch", fetch);
  const updates: string[] = [];
  const result = await execute(input(), (event) => { if (event.type === "candidate_upsert" && event.candidate?.claims?.length) updates.push("claims"); else if (event.type === "completed") updates.push("completed"); }, undefined,
    [{ name: "OpenAIRE Graph", run: async () => ({ patents: [patent()], papers: [] }) }]);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toContain("/publication-dates/20000517/patents/EP1000000NWA1/document.xml");
  const run = result.searchTrace!.providers.find((row) => row.id === "epo-enrichment:EP1000000A1");
  expect(run).toMatchObject({ method: "publication-lookup", status: "succeeded" });
  expect(run?.requests[0]).toMatchObject({ provider: "epo-publication", httpStatus: 200, servedFrom: "network" });
  expect(result.patents[0].claims).toHaveLength(11);
  expect(updates).toEqual(["claims", "completed"]);
});
