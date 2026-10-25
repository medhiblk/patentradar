import * as extra from "../src/lib/providers/new-research";
import * as openaire from "../src/lib/providers/openaire";
import * as pubmed from "../src/lib/providers/pubmed";
import * as semantic from "../src/lib/providers/semantic-scholar";
import * as publicPatents from "../src/lib/providers/europe-pmc";
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  normalizePublication,
  deduplicate,
  normalizeApplicant,
} from "../src/lib/normalize";
import { parsePublication } from "../src/lib/providers/epo-publication";
import { demoProfile, demoPatents } from "../src/lib/demo";
import { compare, queries } from "../src/lib/compare";
import { createReport, reportSections } from "../src/lib/report";
import * as crossref from "../src/lib/providers/crossref";
import * as openalex from "../src/lib/providers/openalex";
import { registry } from "../src/lib/providers/registry";
import { POST as research } from "../src/app/api/research/route";
import { POST as extract } from "../src/app/api/extract/route";
const xml = readFileSync("tests/fixtures/EP1000000A1.xml", "utf8");
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("normalization and source parsing", () => {
  it("normalizes publication identifiers and rejects malformed inputs", () => {
    expect(normalizePublication("ep 1 000 000 a1")).toBe("EP1000000A1");
    expect(() => normalizePublication("../../x")).toThrow();
    expect(() => normalizePublication("EP1000000")).toThrow();
  });
  it("deduplicates identical publications without merging distinct kind codes", () => {
    const p = parsePublication(xml, "https://data.epo.org/test");
    expect(p.title).toContain("green bricks");
    expect(p.claims?.length).toBe(11);
    expect(p.applicants.length).toBeGreaterThan(0);
    expect(
      deduplicate([p, p, { ...p, publicationNumber: "EP1000000B1" }]),
    ).toHaveLength(2);
  });
  it("normalizes applicants", () =>
    expect(normalizeApplicant(" Acme   Corp ")).toBe("ACME CORP"));
  it("rejects HTML instead of patent XML", () =>
    expect(() =>
      parsePublication("<html>login</html>", "https://example.org"),
    ).toThrow());
});
describe("comparison and reports", () => {
  it("generates bounded unique queries", () =>
    expect(
      queries({
        ...demoProfile,
        searchKeywords: ["optical", "optical", "pump"],
      }),
    ).toEqual(["optical", "pump"]));
  it("uses supplied excerpts and identifies missing claims", () => {
    const p = demoPatents()[1];
    const c = compare(demoProfile, p);
    expect(c.limitation).toBe(
      "Comparison based on bibliographic information and abstract only.",
    );
    expect(c.matches.every((m) => m.excerpt === p.abstract)).toBe(true);
    expect(c.score).toBeLessThanOrEqual(100);
  });
  it("produces a real PDF with ten report sections", async () => {
    const data = {
      profile: demoProfile,
      mode: "DEMO" as const,
      patents: demoPatents(),
      papers: [],
      queries: ["sample"],
      warnings: ["Synthetic"],
    };
    expect(reportSections(data)).toHaveLength(10);
    const bytes = await createReport(data);
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
describe("provider contracts", () => {
  it("parses real-shaped Crossref responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: {
              items: [
                {
                  DOI: "10.1234/test",
                  title: ["Optical measurement"],
                  published: { "date-parts": [[2024]] },
                },
              ],
            },
          }),
        ),
      ),
    );
    const records = await crossref.search("unit-unique");
    expect(records[0].sourceUrl).toBe("https://doi.org/10.1234/test");
    vi.unstubAllGlobals();
  });
  it("does not report unconfigured providers as healthy", () => {
    vi.stubEnv("EPO_OPS_KEY", "");
    expect(registry().find((p) => p.id === "epo-ops")?.status).toBe(
      "NOT CONFIGURED",
    );
  });
});
describe("workflow integration", () => {
  it("rejects synthetic research without calling providers", async () => {
    const spy = vi.spyOn(crossref, "search");
    const r = await research(
      new Request("http://localhost/api/research", {
        method: "POST",
        body: JSON.stringify({ profile: demoProfile, mode: "DEMO" }),
      }),
    );
    expect(r.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
  it("continues with partial real results when one provider fails", async () => {
    const network = vi.fn(() => { throw new Error("Unexpected external request in integration test"); });
    vi.stubGlobal("fetch", network);
    vi.spyOn(openaire, "search").mockResolvedValue({ patents: [], papers: [] });
    for (const name of ["datacite", "hal", "arxiv", "zenodo", "nasa", "doe", "inspire"] as const)
      vi.spyOn(extra, name).mockResolvedValue([]);
    vi.spyOn(publicPatents, "search").mockResolvedValue([]);
    vi.spyOn(pubmed, "search").mockResolvedValue([]);
    vi.spyOn(semantic, "search").mockResolvedValue([]);
    vi.spyOn(crossref, "search").mockRejectedValue(new Error("unavailable"));
    vi.spyOn(openalex, "search").mockResolvedValue([
      {
        id: "W1",
        title: "Paper",
        source: "OpenAlex",
        sourceUrl: "https://openalex.org/W1",
        retrievedAt: new Date().toISOString(),
      },
    ]);
    const r = await research(
      new Request("http://localhost/api/research", {
        method: "POST",
        body: JSON.stringify({
          profile: demoProfile,
          mode: "LIVE",
          consent: true,
        }),
      }),
    );
    const d = await r.json();
    expect(d.mode).toBe("PARTIAL");
    expect(d.papers).toHaveLength(1);
    expect(d.patents).toHaveLength(0);
    expect(d.warnings.join(" ")).toContain("Crossref unavailable");
    expect(network).not.toHaveBeenCalled();
  });
  it("requires explicit external search consent", async () => {
    const r = await research(
      new Request("http://localhost/api/research", {
        method: "POST",
        body: JSON.stringify({ profile: demoProfile, mode: "LIVE" }),
      }),
    );
    expect(r.status).toBe(400);
  });
  it("extracts actual PDF text locally when OpenAI is not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const form = new FormData();
    form.set(
      "file",
      new File([readFileSync("public/synthetic-manual.pdf")], "manual.pdf", {
        type: "application/pdf",
      }),
    );
    const r = await extract(
      new Request("http://localhost/api/extract", {
        method: "POST",
        body: form,
      }),
    );
    const d = await r.json();
    expect(r.status).toBe(200);
    expect(d.profile.technicalFeatures.length).toBeGreaterThan(0);
    expect(d.notice).toContain("No AI model was used");
    expect(d.profile.title).not.toBe(demoProfile.title);
  });
  it("rejects non-PDF content with a PDF extension", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File(["hello"], "bad.pdf", { type: "application/pdf" }),
    );
    const r = await extract(
      new Request("http://localhost/api/extract", {
        method: "POST",
        body: form,
      }),
    );
    expect(r.status).toBe(400);
  });
});

describe("origin validation", () => {
  it("accepts a same-host browser request behind Next internal binding", async () => {
    const { guard } = await import("../src/lib/security");
    expect(() =>
      guard(
        new Request("http://0.0.0.0:3000/api/extract", {
          headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
        }),
      ),
    ).not.toThrow();
  });
  it("rejects a different browser origin", async () => {
    const { guard } = await import("../src/lib/security");
    expect(() =>
      guard(
        new Request("http://0.0.0.0:3000/api/extract", {
          headers: {
            host: "127.0.0.1:3000",
            origin: "https://untrusted.example",
          },
        }),
      ),
    ).toThrow("Cross-origin");
  });
});

describe("public Europe PMC patent search", () => {
  it("uses the source-supplied complete publication identifier without inventing applicants or dates", async () => {
    const { parsePatentSearch } =
      await import("../src/lib/providers/europe-pmc");
    const records = parsePatentSearch(
      JSON.parse(readFileSync("tests/fixtures/europe-pmc.json", "utf8")),
      "microfluidic",
    );
    expect(records[0].publicationNumber).toBe("US20120070886A1");
    expect(records[0].abstract).toContain("curvilinear cavities");
    expect(records[0].applicants).toEqual([]);
    expect(records[0].claims).toBeUndefined();
    expect(records[0].publicationDate).toBeUndefined();
  });
  it("rejects malformed provider responses", async () => {
    const { parsePatentSearch } =
      await import("../src/lib/providers/europe-pmc");
    expect(() =>
      parsePatentSearch(
        { resultList: { result: [{ id: "x", source: "MED" }] } },
        "test",
      ),
    ).toThrow();
  });
});

describe("input-grounded extraction and claims", () => {
  it("extracts the users digital twin description without substituting another invention", async () => {
    const { localExtract } = await import("../src/lib/local-extract");
    const text =
      "It is a digital twin: AI learns from you to replicate and imitate you.";
    const p = localExtract(text);
    expect(p.technicalFeatures[0].description).toBe(text);
    expect(p.searchKeywords).toContain("digital twin");
    expect(p.searchKeywords).toContain("imitation learning");
  });
  it("extracts assignee, claims and PDF from a verified publication page", async () => {
    const { parsePatentPage } =
      await import("../src/lib/providers/patent-pages");
    const record = {
      ...demoPatents()[0],
      synthetic: false,
      publicationNumber: "US20120070886A1",
      source: "Europe PMC",
      sourceUrl: "https://europepmc.org/article/PAT/US2012070886",
    };
    const enriched = parsePatentPage(
      readFileSync("tests/fixtures/google-patent.html", "utf8"),
      record,
    );
    expect(enriched.applicants).toContain("University of Rochester");
    expect(enriched.claims?.length).toBeGreaterThan(0);
    expect(enriched.pdfUrl).toContain("US20120070886A1.pdf");
    expect(enriched.additionalSources).toHaveLength(2);
  });
  it("rejects enrichment for another publication", async () => {
    const { parsePatentPage } =
      await import("../src/lib/providers/patent-pages");
    expect(() =>
      parsePatentPage(
        readFileSync("tests/fixtures/google-patent.html", "utf8"),
        demoPatents()[0],
      ),
    ).toThrow();
  });
});
