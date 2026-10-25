import { afterEach, expect, it } from "vitest";
import { AssemblySchema } from "@formaproof/engineering";
import { clearDesignSession, setDesignSession } from "../src/lib/cad/design-session";
import { makeSpotDesignPages } from "../src/lib/cad/spot-design";

afterEach(clearDesignSession);

it("hands edited component functions to Spot without turning geometry dimensions into the query", () => {
  const hash = "a".repeat(64);
  const sourceFile = new File(["%PDF-fixture"], "fixture-manual.pdf", { type: "application/pdf" });
  const spec = AssemblySchema.parse({ title: "Fixture optical instrument", goal: "Measure reflected sample light", components: [{
    id: "detector", name: "Optical detector", description: "User-edited function: measures reflected light from the sample", shape: "box",
    dimensions: { length: 80, width: 50, height: 6, diameter: null, innerDiameter: null }, material: "Not specified",
    sourcePage: 4, sourceQuote: "Optical detector 80 x 50 x 6 mm", sourceHash: hash, sourceName: "fixture-manual.pdf",
    basis: "source-text", connections: ["Receives the sample channel signal"], position: [12, 5, 0], rotation: [0, 0, 25],
  }], limitations: [] });
  setDesignSession({ spec, source: { name: sourceFile.name, hash }, imports: {}, sourceFile, documentPages: [{ page: 4, text: "Literal fixture source text" }] });
  const draft = makeSpotDesignPages()!;
  expect(draft.profile.technicalFeatures[0].description).toBe(spec.components[0].description);
  expect(draft.designText).toContain("measures reflected light");
  expect(draft.designText).toContain("Receives the sample channel signal");
  expect(draft.designText).not.toContain("80");
  expect(draft.query).toBe("Optical detector");
  expect(draft.sourceLabel).toBe("user-design");
  expect(draft.pages[0].text).toContain("not an original PDF page");
  expect(draft.sourceExcerpts).toEqual([{ page: 4, text: spec.components[0].sourceQuote, sourceName: sourceFile.name, sourceHash: hash }]);
  expect(draft.sourceFile).toBe(sourceFile);
  expect(draft.documentPages).toEqual([{ page: 4, text: "Literal fixture source text" }]);
  // A Spot handoff does not consume the geometry session needed to return to CAD.
  expect(makeSpotDesignPages()?.profile.title).toBe(spec.title);
});

it("never promotes visual-only or unrelated-document text into verified PDF excerpts", () => {
  const spec = AssemblySchema.parse({ title: "Fixture", components: [{
    id: "part", name: "Part", description: "User supplied function", shape: "unresolved", dimensions: { length: null, width: null, height: null, diameter: null, innerDiameter: null },
    material: "Not specified", sourcePage: 2, sourceQuote: "Unverified image label", sourceHash: "b".repeat(64), basis: "visual-unverified", connections: [], position: [0, 0, 0], rotation: [0, 0, 0],
  }], limitations: [] });
  const session = { spec, source: { name: "current.pdf", hash: "a".repeat(64) }, imports: {} };
  expect(makeSpotDesignPages(session)?.sourceExcerpts).toEqual([]);
  spec.components[0].basis = "source-text";
  expect(makeSpotDesignPages(session)?.sourceExcerpts).toEqual([]);
  expect(makeSpotDesignPages(null)).toBeNull();
});
