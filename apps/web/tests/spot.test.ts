import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import cases from "../../../docs/evaluation/spot-cases.json";
import { POST } from "../src/app/api/spot/route";
import { readPdfDocument } from "../src/lib/documents/ingestion";
import { publicReferencePatents } from "../src/lib/patents/reference-corpus";
import type { SpotResult, SpotMatch } from "../src/lib/search/spot";

type ResponseData = SpotResult & { document: { sha256: string; pageCount: number; analyzedPages: number[] } };
const fetchMock = vi.fn();
const blindFixture = cases.blindPdf.path.replace(/^apps\/web\//, "");
beforeEach(() => {
  fetchMock.mockReset().mockRejectedValue(new Error("External transport is not permitted in these API integration tests."));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
const request = (form: FormData) => new Request("http://localhost:3000/api/spot", { method: "POST", headers: { "x-forwarded-for": randomUUID() }, body: form });
async function describeText(text: string) {
  const form = new FormData(); form.set("text", text); form.set("consent", "false");
  const response = await POST(request(form));
  expect(response.status).toBe(200);
  return await response.json() as ResponseData;
}
function evidenceIsExact(match: SpotMatch) {
  const original = publicReferencePatents().find(patent => patent.publicationNumber === match.patent.publicationNumber)!;
  expect(original).toBeDefined();
  expect(original.synthetic).not.toBe(true);
  expect(match.evidence.length).toBeGreaterThan(0);
  for (const item of match.evidence) {
    const source = item.evidenceField === "publication-number" ? original.publicationNumber
      : item.evidenceField === "claim" ? original.claims?.[item.claimIndex!]
        : item.evidenceField === "abstract" ? original.abstract : original.title;
    expect(source?.slice(item.sourceStart, item.sourceEnd)).toBe(item.sourceExcerpt);
    expect(item.inputExcerpt.trim()).not.toBe("");
    expect(item.sourceUrl).toMatch(/^https:\/\//);
    expect(Number.isFinite(Date.parse(item.sourceRetrievedAt))).toBe(true);
  }
}
describe("SPOT API using actual sourced patent files and records", () => {
  it("ingests actual bytes under a neutral filename and returns the true publication with exact evidence", async () => {
    const bytes = await readFile(blindFixture);
    const form = new FormData();
    form.set("file", new File([bytes], "technical-document.pdf", { type: "application/octet-stream" }));
    form.set("consent", "false");
    const response = await POST(request(form));
    expect(response.status).toBe(200);
    const result = await response.json() as ResponseData;
    expect(result.document.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(result.document.pageCount).toBeGreaterThan(1);
    expect(result.identity.primary?.publicationNumber).toBe(cases.blindPdf.publicationNumber);
    expect(result.matches[0].matchType).toBe("same-publication");
    expect(result.matches[0].patent.publicationNumber).toBe(cases.blindPdf.publicationNumber);
    evidenceIsExact(result.matches[0]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.coverage.mode).toBe("reference-index");
  });
  it("does not trust a different patent number placed in the filename", async () => {
    const bytes = await readFile(blindFixture);
    const form = new FormData();
    form.set("file", new File([bytes], "EP9999999A1.pdf", { type: "application/pdf" }));
    const response = await POST(request(form));
    expect(response.status).toBe(200);
    const result = await response.json() as ResponseData;
    expect(result.identity.primary?.publicationNumber).toBe(cases.blindPdf.publicationNumber);
    expect(result.identity.candidatePublications.some(item => item.publicationNumber === "EP9999999A1")).toBe(false);
  });
  it("also recognizes a second genuine historical stent PDF under a neutral filename", async () => {
    const fixture = cases.historicalBlindPdf;
    const bytes = await readFile(fixture.path.replace(/^apps\/web\//, ""));
    const form = new FormData(); form.set("file", new File([bytes], "document.pdf", { type: "application/octet-stream" }));
    const response = await POST(request(form));
    expect(response.status).toBe(200);
    const result = await response.json() as ResponseData;
    expect(result.document.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(result.identity.primary?.publicationNumber).toBe(fixture.publicationNumber);
    expect(result.matches[0].patent.publicationNumber).toBe(fixture.publicationNumber);
    evidenceIsExact(result.matches[0]);
  });
  it("finds sourced technical matches after identifier/title redaction without inventing document identity", async () => {
    const bytes = await readFile(blindFixture);
    const document = await readPdfDocument(new Uint8Array(bytes));
    let text = document.pages.map(page => page.text).join("\n\n")
      .replace(/\b(?:US|EP|WO|CN|JP|KR|GB|FR|DE|CA|AU)\s*\d[\d\s,./-]{4,28}(?:[A-C]\s*\d?)?\b/gi, "[publication removed]");
    for (const phrase of [cases.blindPdf.title, ...cases.blindPdf.applicants, ...cases.blindPdf.inventors]) {
      const words = phrase.match(/[\p{L}\p{N}]+/gu) || [];
      text = text.replace(new RegExp(words.join("[\\s\\W_]+"), "giu"), "[metadata removed]");
    }
    expect(text.replace(/\W/g, "")).not.toContain(cases.blindPdf.publicationNumber);
    const result = await describeText(text);
    expect(result.identity.primary).toBeUndefined();
    const match = result.matches.find(item => item.patent.publicationNumber === cases.blindPdf.publicationNumber)!;
    expect(match).toBeDefined();
    expect(result.matches[0].patent.publicationNumber).toBe(cases.blindPdf.publicationNumber);
    expect(["same-publication", "technical-overlap"]).toContain(match.matchType);
    expect(match.explanation).toMatch(/passages|wording|text|terms/i);
    evidenceIsExact(match);
    const serialized = text.replace(/\r\n|\r|\n/g, "\r\n").trim().slice(0, 60000);
    for (const evidence of match.evidence)
      expect(serialized.slice(evidence.inputStart, evidence.inputEnd)).toBe(evidence.inputExcerpt);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(cases.positives)("ranks $publicationNumber first for an independently phrased technical description", async item => {
    expect(item.text).not.toContain(item.publicationNumber);
    const result = await describeText(item.text);
    expect(result.identity.primary).toBeUndefined();
    expect(result.matches[0]?.patent.publicationNumber).toBe(item.publicationNumber);
    expect(result.matches[0].matchType).toBe("technical-overlap");
    evidenceIsExact(result.matches[0]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.coverage.limitations.join(" ")).toMatch(/not.*worldwide|not.*live worldwide/i);
  });
  it("does not invent a close medtech match for an unrelated parasol", async () => {
    const result = await describeText(cases.negativeText);
    expect(result.matches).toEqual([]);
    expect(result.warnings.join(" ")).toMatch(/does not mean|not.*free/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects an invalid file rather than returning an apparent completed search", async () => {
    const form = new FormData(); form.set("file", new File(["not a PDF"], "technical-document.pdf", { type: "application/pdf" }));
    const response = await POST(request(form));
    expect(response.status).toBe(400);
    expect((await response.json()).matches).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
