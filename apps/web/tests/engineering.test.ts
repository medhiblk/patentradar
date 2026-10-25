import { describe, it, expect } from "vitest";
import { extractMeasured, buildable } from "../src/lib/cad/schema";
import { comparisonEvidence } from "../src/lib/intelligence/evidence";
import { realProfile } from "../src/lib/real-case";
describe("engineering measurements", () => {
  it("extracts only explicit mm values and retains page quotes", () => {
    const a = extractMeasured([
      {
        page: 3,
        text: "Base plate 80 x 50 x 6 mm\nShaft diameter 12 mm length 90 mm",
      },
    ]);
    expect(a.components).toHaveLength(2);
    expect(a.components[0].dimensions.width).toBe(50);
    expect(a.components[0].sourcePage).toBe(3);
    expect(a.components[1].dimensions.diameter).toBe(12);
    expect(buildable(a.components[1])).toBe(true);
  });
  it("does not invent dimensions from an unspecified description", () => {
    expect(
      extractMeasured([{ page: 1, text: "A large pump with a thick shaft." }])
        .components,
    ).toHaveLength(0);
  });
  it("validates AI claim quotes against actual source text", () => {
    const p = {
      id: "x",
      publicationNumber: "EP1000000A1",
      title: "Title",
      applicants: [],
      claims: ["A shaft is supported by a bearing."],
      source: "source",
      sourceUrl: "https://example.org",
      retrievedAt: "2026-10-25",
    };
    const valid = comparisonEvidence(realProfile, p, [
      { feature: 0, claim: 0, quote: "shaft", explanation: "Shared component" },
    ]);
    expect(valid[0].start).toBe(2);
    expect(() =>
      comparisonEvidence(realProfile, p, [
        {
          feature: 0,
          claim: 0,
          quote: "magnetic levitation",
          explanation: "Invalid",
        },
      ]),
    ).toThrow();
  });
});
