import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { publicReferenceCorpus, publicReferencePatents, publicReferenceText } from "../src/lib/patents/reference-corpus";
import { MEDTECH_CASES } from "../src/lib/demo/medtech-cases";
import dataset from "../src/lib/patents/data/public-medtech-patents.json";

describe("attributed public medical reference corpus", () => {
  it("contains sourced medical claims rather than synthetic/live-provider results", () => {
    const records = publicReferencePatents();
    expect(records.length).toBeGreaterThanOrEqual(12);
    expect(new Set(records.map(record => record.publicationNumber)).size).toBe(records.length);
    for (const record of records) {
      expect(record.synthetic).not.toBe(true);
      expect(record.claims?.length).toBeGreaterThan(0);
      expect(record.ipcCodes?.some(code => code.startsWith("A61"))).toBe(true);
      expect(record.source).toContain("indexed public reference corpus");
      expect(record.sourceUrl).toMatch(/^https:\/\/data\.epo\.org\/publication-server\/rest\/v1\.2\/publication-dates\/\d{8}\/patents\/EP\d+NW[A-B]\d\/document\.xml$/);
      const observation = dataset.observations.find(row => row.url === record.sourceUrl);
      expect(observation?.httpStatus).toBe(200);
      expect(observation?.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(publicReferenceCorpus.coverage).toMatch(/not live worldwide/i);
  });
  it("ships the actual bounded official PDFs under neutral filenames with matching source hashes", () => {
    expect(MEDTECH_CASES.length).toBe(3);
    for (const sample of MEDTECH_CASES) {
      const bytes = readFileSync("public" + sample.pdfPath);
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(bytes.length).toBe(sample.bytes);
      expect(bytes.length).toBeLessThan(4 * 1024 * 1024);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(sample.sha256);
      expect(sample.pdfPath).toMatch(/sample-document-\d+\.pdf$/);
      expect(sample.pdfPath).not.toContain(sample.publicationNumber);
    }
  });
  it("retains original claim language and isolates callers from mutation", () => {
    const records = publicReferencePatents();
    const french = records.find(record => record.publicationNumber === "EP1000594A1");
    expect(french?.evidence?.[0].fields.claimLanguage).toBe("fr");
    expect(publicReferenceText("EP3590450A1")).toContain("osteotomy");
    records[0].title = "Changed by caller";
    expect(publicReferencePatents()[0].title).not.toBe("Changed by caller");
    expect(publicReferenceText("NOT-A-PUBLICATION")).toBe("");
  });
});
