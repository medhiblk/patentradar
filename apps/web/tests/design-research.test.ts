import { expect, it } from "vitest";
import { AssemblySchema } from "@formaproof/engineering";
import { designResearchDraft } from "../src/lib/cad/design-research";
it("carries actual component functions into an editable search draft without dimensions as the query", () => {
  const spec = AssemblySchema.parse({ title: "Optical instrument", components: [{ id: "detector", name: "Optical detector", description: "Measures reflected light from samples", shape: "box", dimensions: { length: 80, width: 50, height: 6, diameter: null, innerDiameter: null }, material: "Not specified", sourcePage: 1, sourceQuote: "Optical detector 80 x 50 x 6 mm", basis: "source-text", connections: [], position: [0,0,0], rotation: [0,0,0] }], limitations: [] });
  const draft = designResearchDraft(spec)!;
  expect(draft.profile.technicalFeatures[0].description).toBe("Measures reflected light from samples");
  expect(draft.query).toBe("Optical detector");
  expect(draft.query).not.toContain("80");
});
it("does not invent an invention profile from an empty assembly", () => {
  expect(designResearchDraft(AssemblySchema.parse({ title: "Empty", components: [], limitations: [] }))).toBeNull();
});
