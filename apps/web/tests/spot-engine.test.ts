import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { spotDocument } from "../src/lib/search/spot";
import { publicReferencePatents } from "../src/lib/patents/reference-corpus";
import * as epo from "../src/lib/providers/epo-publication";
const indexed = publicReferencePatents();
const xray = indexed.find(record => record.publicationNumber === "EP1000581A1")!;
afterEach(() => vi.restoreAllMocks());

it("recognizes publication wording with all identifiers and titles absent from the supplied body", async () => {
  const text = xray.claims!.slice(0, 3).join("\n");
  const result = await spotDocument({ pages: [{ page: 4, text }] });
  expect(result.identity.primary).toBeUndefined();
  const found = result.matches.find(match => match.patent.publicationNumber === xray.publicationNumber)!;
  expect(found.matchType).toBe("same-publication");
  expect(found.explanation).toContain("reproduce wording");
  expect(found.evidence.filter(item => item.kind === "verbatim").length).toBeGreaterThanOrEqual(2);
  for (const evidence of found.evidence) {
    expect(text.slice(evidence.inputStart, evidence.inputEnd)).toBe(evidence.inputExcerpt);
    if (evidence.evidenceField === "claim") expect(xray.claims![evidence.claimIndex!].slice(evidence.sourceStart, evidence.sourceEnd)).toBe(evidence.sourceExcerpt);
    expect(evidence.sourceUrl).toMatch(/^https:\/\/data\.epo\.org\//);
  }
});

it("finds technical overlap for an independent description without pretending it is the same document", async () => {
  const text = "An imaging detector converts incident X-rays into visible light inside a scintillation fiber bundle. Optical fibers relay this light to an image sensor and processing electronics. A radiation shielding layer protects the camera while allowing visible wavelengths to pass.";
  const result = await spotDocument({ pages: [{ page: 1, text }] });
  const found = result.matches.find(match => match.patent.publicationNumber === xray.publicationNumber)!;
  expect(found.matchType).toBe("technical-overlap");
  expect(found.evidence.some(item => item.terms.length >= 4)).toBe(true);
  expect(found.explanation).toContain("lexical");
});

it("does not identify cited publication numbers as the uploaded document or manufacture a negative clearance", async () => {
  const text = "References cited: EP1000581A1. Our product is a garden bench made from cedar timber slats, joined using wooden mortise and tenon connections. Its finish is weatherproof linseed oil.";
  const result = await spotDocument({ pages: [{ page: 1, text }] });
  expect(result.identity.primary).toBeUndefined();
  expect(result.matches).toHaveLength(0);
  expect(result.warnings.join(" ")).toContain("does not mean the invention is new");
});

it("recognizes substantive patent wording late in a long supplied document rather than dropping it after 12000 characters", async () => {
  const text = "General administrative background without medical language. ".repeat(260) + xray.claims!.slice(0, 3).join("\n");
  expect(text.indexOf(xray.claims![0])).toBeGreaterThan(12000);
  const result = await spotDocument({ pages: [{ page: 1, text }] });
  const match = result.matches.find(item => item.patent.publicationNumber === xray.publicationNumber)!;
  expect(match.matchType).toBe("same-publication");
  expect(match.evidence.some(item => item.inputStart > 12000)).toBe(true);
  expect(result.warnings.some(warning => warning.includes("source characters"))).toBe(false);
});

it("does not call an external lookup without consent and does not send document text when consent is given", async () => {
  const xml = readFileSync("tests/fixtures/EP1000000A1.xml", "utf8");
  const record = epo.parsePublication(xml, "https://data.epo.org/publication-server/fixture.xml");
  const lookup = vi.spyOn(epo, "lookup").mockResolvedValue([{ ...record, pdfUrl: "https://data.epo.org/publication-server/fixture.pdf" }]);
  const text = "(19) European Patent Application\n(11) EP 1 000 000 A1\n(43) Date of publication: 17.05.2000\n(54) Improvements in manufacturing bricks\nA mechanical process shapes building materials into green bricks.";
  const first = await spotDocument({ pages: [{ page: 1, text }] });
  expect(first.identity.primary?.publicationNumber).toBe("EP1000000A1");
  expect(lookup).not.toHaveBeenCalled();
  const events: string[] = [];
  const second = await spotDocument({ pages: [{ page: 1, text }], consentToPublicLookup: true }, event => events.push(event.type));
  expect(lookup).toHaveBeenCalledExactlyOnceWith("EP1000000A1", "20000517");
  expect(second.matches.find(match => match.patent.publicationNumber === "EP1000000A1")?.matchType).toBe("same-publication");
  expect(second.lookupTraces[0]).toMatchObject({ status: "succeeded", method: "publication-lookup" });
  expect(events).toEqual(["indexed-results", "lookup-started", "lookup-finished", "completed"]);
});

it("retains indexed results when the optional exact lookup fails", async () => {
  vi.spyOn(epo, "lookup").mockRejectedValue(new Error("Fixture unavailable"));
  const text = "(19) European Patent Application\n(11) EP1000000A1\n(43) Date of publication: 17.05.2000\n(54) Manufacturing apparatus\n" + xray.claims!.slice(0, 3).join("\n");
  const result = await spotDocument({ pages: [{ page: 1, text }], consentToPublicLookup: true });
  expect(result.matches.some(match => match.patent.publicationNumber === xray.publicationNumber)).toBe(true);
  expect(result.lookupTraces[0].status).toBe("failed");
  expect(result.warnings.join(" ")).toContain("indexed results retained");
});
