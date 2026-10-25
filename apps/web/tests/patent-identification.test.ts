import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { identifyPatentDocument } from "../src/lib/documents/patent-identification";
import { POST as extract } from "../src/app/api/extract/route";
const usFront = `(19) United States
(12) Patent Application Publication
(10) Pub. No.: US 2008/0003142 A1
(43) Pub. Date: Jan. 3, 2008
(54) MICROFLUIDIC DEVICES
(76) Inventors: Example name
(30) Priority date: 11.05.2006
(56) References Cited
US 2003/0012345 A1`;
afterEach(() => { vi.unstubAllEnvs(); });

describe("patent identity from actual document text", () => {
  it("recognizes its own US front-page publication and keeps citations separate", () => {
    const identity = identifyPatentDocument([{ page: 1, text: usFront }]);
    expect(identity.kind).toBe("patent-publication");
    expect(identity.primary).toMatchObject({ publicationNumber: "US20080003142A1", kindCode: "A1", role: "document-publication", confidence: "high", publicationDate: "20080103", title: "MICROFLUIDIC DEVICES" });
    expect(identity.primary?.publicationDateEvidence?.quote).toContain("Jan. 3, 2008");
    expect(identity.candidatePublications.find(candidate => candidate.publicationNumber === "US20030012345A1")).toMatchObject({ role: "mentioned-reference", confidence: "low" });
    for (const candidate of identity.candidatePublications)
      for (const evidence of candidate.evidence) expect(usFront).toContain(evidence.quote);
  });
  it("normalizes split spaces, newlines and printed US publication separators", () => {
    const text = usFront.replace("US 2008/0003142 A1", "US\n2 0 0 8 / 0 0 0 3 1 4 2\nA 1");
    expect(identifyPatentDocument([{ page: 1, text }]).primary?.publicationNumber).toBe("US20080003142A1");
  });
  it("recognizes EP metadata and publication date without using the priority date", () => {
    const identity = identifyPatentDocument([{ page: 1, text: `(19) European Patent Office
(12) EUROPEAN PATENT APPLICATION
(11) EP 1 000 000 A1
(30) Priority: 19981111
(43) Date of publication: 17.05.2000
(54) Apparatus for manufacturing green bricks
(71) Applicant: Example` }]);
    expect(identity.primary).toMatchObject({ publicationNumber: "EP1000000A1", publicationDate: "20000517", title: "Apparatus for manufacturing green bricks" });
    expect(identity.primary?.publicationDateEvidence?.label).toBe("(43)");
  });
  it("does not infer a missing kind code or use a priority date as publication date", () => {
    const identity = identifyPatentDocument([{ page: 1, text: `(19) European Patent Office
(12) EUROPEAN PATENT APPLICATION
(11) EP 1 000 000
(30) Priority date: 17.05.1998
(54) Mechanical instrument
(71) Applicant: Example` }]);
    expect(identity.primary?.publicationNumber).toBe("EP1000000");
    expect(identity.primary?.kindCode).toBeUndefined();
    expect(identity.primary?.publicationDate).toBeUndefined();
  });
  it("accepts a literal YYYYMMDD publication date and rejects an impossible calendar date", () => {
    expect(identifyPatentDocument([{ page: 1, text: usFront.replace("Jan. 3, 2008", "20080103") }]).primary?.publicationDate).toBe("20080103");
    expect(identifyPatentDocument([{ page: 1, text: usFront.replace("Jan. 3, 2008", "31.02.2008") }]).primary?.publicationDate).toBeUndefined();
  });
  it("ties grant metadata to the B-kind publication and leaves conflicting dates unresolved without a kind", () => {
    const metadata = `(19) European Patent Office
(12) EUROPEAN PATENT SPECIFICATION
(11) EP 1 000 000 B1
(43) Date of publication: 17.05.2000
(45) Date of publication: 10.07.2002
(54) Mechanical instrument
(71) Applicant: Example`;
    expect(identifyPatentDocument([{ page: 1, text: metadata }]).primary?.publicationDate).toBe("20020710");
    expect(identifyPatentDocument([{ page: 1, text: metadata.replace("EP 1 000 000 B1", "EP 1 000 000") }]).primary?.publicationDate).toBeUndefined();
  });
  it("never promotes bibliography references or application numbers into a primary identity", () => {
    const identity = identifyPatentDocument([{ page: 1, text: `Technical report
(21) Appl. No.: US 11/803104
(56) References Cited
US 2008/0003142 A1
EP 1000000 A1
WO 2020/123456 A1` }]);
    expect(identity.kind).toBe("references-only"); expect(identity.primary).toBeUndefined();
    expect(identity.candidatePublications.every(candidate => candidate.role === "mentioned-reference")).toBe(true);
    expect(identity.candidatePublications.some(candidate => candidate.publicationNumber === "US11803104")).toBe(false);
  });
  it("leaves visually recognized patent identities unverified until confirmed", () => {
    const identity = identifyPatentDocument([{ page: 1, text: usFront, basis: "visual-unverified" }]);
    expect(identity.kind).toBe("patent-publication"); expect(identity.basis).toBe("visual-unverified");
    expect(identity.confidence).toBe("medium"); expect(identity.primary).toBeUndefined();
  });
  it("requires a unique source identity when multiple actual patent front pages are present", () => {
    const other = usFront.replaceAll("US 2008/0003142 A1", "US 2009/0012345 A1");
    const identity = identifyPatentDocument([{ page: 1, text: usFront }, { page: 2, text: other }]);
    expect(identity.primary).toBeUndefined(); expect(identity.confidence).toBe("medium");
  });
  it("does not treat an EPO barcode or international family publication as another primary", () => {
    const text = `(19) EP 3 590 450 A1
*EP003590450A1*
(11) EP 3 590 450 A1
(12) EUROPEAN PATENT APPLICATION
(43) Date of publication: 08.01.2020
(87) International publication number: WO 2018/158962 (07.09.2018)
(54) ATTACHMENT POSITION CONFIRMATION MEMBER
(57) A surgical guide assists osteotomy.`;
    const identity = identifyPatentDocument([{ page: 1, text }]);
    expect(identity.primary).toMatchObject({ publicationNumber: "EP3590450A1", publicationDate: "20200108" });
    expect(identity.candidatePublications.some(candidate => candidate.publicationNumber === "EP003590450A1")).toBe(false);
    expect(identity.candidatePublications.find(candidate => candidate.publicationNumber === "WO2018158962")).toMatchObject({ role: "mentioned-reference" });
  });
  it("keeps identifiers in ordinary prose as references rather than guessing document identity", () => {
    const identity = identifyPatentDocument([{ page: 1, text: "An engineer is investigating EP1000000A1 alongside US20080003142A1. This report describes an unrelated new instrument." }]);
    expect(identity.kind).toBe("references-only"); expect(identity.primary).toBeUndefined();
    expect(identifyPatentDocument([{ page: 1, text: "An ordinary motor manual with no patent identification." }]).kind).toBe("undetermined");
  });
  it("extracts identity from a real patent PDF uploaded under a neutral filename with no hint", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const raw = readFileSync("public/examples/US20080003142A1-excerpt.pdf");
    const form = new FormData();
    form.set("file", new File([raw], "technical-document.pdf", { type: "application/octet-stream" }));
    form.set("consent", "false");
    const response = await extract(new Request("https://app.example/api/extract", { method: "POST", body: form }));
    const data = await response.json();
    expect(response.status, JSON.stringify(data)).toBe(200);
    expect(data.documentIdentity.primary).toMatchObject({ publicationNumber: "US20080003142A1", publicationDate: "20080103", confidence: "high" });
    expect(data.documentIdentity.primary.evidence[0].page).toBe(2);
    expect(data.ingestion.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("identifies the actual modern EPO PDF despite its zero-padded barcode and related WO publication", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const form = new FormData();
    form.set("file", new File([readFileSync("public/examples/medtech/sample-document-03.pdf")], "technical-source.pdf", { type: "application/octet-stream" }));
    form.set("consent", "false");
    const response = await extract(new Request("https://app.example/api/extract", { method: "POST", body: form }));
    const data = await response.json();
    expect(response.status, JSON.stringify(data)).toBe(200);
    expect(data.documentIdentity.primary).toMatchObject({ publicationNumber: "EP3590450A1", publicationDate: "20200108", confidence: "high" });
    expect(data.documentIdentity.primary.evidence[0].page).toBe(1);
  });
});
