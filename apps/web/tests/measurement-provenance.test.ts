import { describe, expect, it } from "vitest";
import { AssemblySchema, buildable, extractMeasured, measurementReview, validateDocumentMeasurements, type ComponentSpec } from "@formaproof/engineering";

const plate = () => extractMeasured([{ page: 3, text: "Base plate 80 x 50 x 6 mm" }]);
const verify = (component: ComponentSpec, text: string) => validateDocumentMeasurements({ title: "Evidence test", components: [component], limitations: [] }, [{ page: 3, text }]);

describe("engineering measurement provenance", () => {
  it("converts explicit cm tuples to mm and retains their original unit and page", () => {
    const part = extractMeasured([{ page: 2, text: "Plate 8 x 5 x 0,6 cm" }]).components[0];
    expect(part.dimensions).toMatchObject({ length: 80, width: 50, height: 6 });
    expect(part.measurementEvidence?.height).toMatchObject({ sourceValue: 0.6, sourceUnit: "cm", sourcePage: 2, valueMm: 6 });
    expect(measurementReview(part).state).toBe("ready");
  });
  it("normalizes comma decimals in explicitly labelled shaft measurements", () => {
    const part = extractMeasured([{ page: 1, text: "Shaft diamètre 12,5 mm longueur 9 cm" }]).components[0];
    expect(part.dimensions).toMatchObject({ diameter: 12.5, length: 90 });
    expect(buildable(part)).toBe(true);
  });
  it("converts explicitly stated inches without assuming units for bare numbers", () => {
    expect(extractMeasured([{ page: 1, text: "Plate 2 x 1 x 0.5 in" }]).components[0].dimensions).toMatchObject({ length: 50.8, width: 25.4, height: 12.7 });
    expect(extractMeasured([{ page: 1, text: "Plate 80 x 50 x 6" }]).components).toHaveLength(0);
  });
  it("separates inside and outside diameters even when the inside value is first", () => {
    const part = extractMeasured([{ page: 1, text: "Tube inner diameter 12 mm outer diameter 20 mm length 50 mm" }]).components[0];
    expect(part.shape).toBe("tube");
    expect(part.dimensions).toMatchObject({ innerDiameter: 12, diameter: 20, length: 50 });
    expect(buildable(part)).toBe(true);
    expect(buildable({ ...part, dimensions: { ...part.dimensions, innerDiameter: 20 } })).toBe(false);
  });
  it("does not validate 20 mm using a 120 mm source token", () => {
    const part = { ...plate().components[0], dimensions: { ...plate().components[0].dimensions, length: 20 }, sourceQuote: "Base plate 120 x 50 x 6 mm" };
    const result = verify(part, part.sourceQuote).components[0];
    expect(result.dimensions.length).toBeNull();
    expect(result.measurementEvidence?.length?.status).toBe("missing");
    expect(result.dimensions.width).toBe(50);
    expect(part.dimensions.length).toBe(20); // The caller's draft is not mutated.
  });
  it("does not borrow height evidence to validate a different width", () => {
    const part = plate().components[0];
    part.dimensions.width = 6;
    expect(verify(part, part.sourceQuote).components[0].dimensions.width).toBeNull();
  });
  it("validates explicitly converted AI dimensions with original unit provenance", () => {
    const part = { ...plate().components[0], sourceQuote: "Plate 8 x 5 x 0.6 cm" };
    const result = verify(part, part.sourceQuote).components[0];
    expect(result.measurementEvidence?.length).toMatchObject({ status: "text-verified", sourceValue: 8, sourceUnit: "cm", valueMm: 80 });
  });
  it("keeps visual suggestions approximate and never treats a model's user-entered flag as a human review", () => {
    const part = { ...plate().components[0], basis: "user-entered" as const };
    const result = verify(part, "No dimensional text was extracted").components[0];
    expect(result.basis).toBe("visual-unverified");
    expect(buildable(result)).toBe(true);
    expect(measurementReview(result).state).toBe("needs-review");
  });
  it("downgrades unmatched quotes and retains missing values without inventing them", () => {
    const part = plate().components[0];
    part.dimensions.height = null;
    const result = verify(part, "A different document page").components[0];
    expect(result.basis).toBe("visual-unverified");
    expect(result.dimensions.height).toBeNull();
    expect(measurementReview(result).state).toBe("missing");
  });
  it("ties each component to its actual source hash and rejects nonexistent source pages", () => {
    const source = plate();
    const result = validateDocumentMeasurements(source, [{ page: 3, text: source.components[0].sourceQuote }], "a".repeat(64));
    expect(result.components[0].sourceHash).toBe("a".repeat(64));
    expect(() => validateDocumentMeasurements(source, [{ page: 1, text: "Other page" }])).toThrow("Unverified source page");
    expect(AssemblySchema.safeParse(source).success).toBe(true); // Old assemblies remain supported.
  });
  it("does not retain verified status after a dimension changes", () => {
    const part = plate().components[0];
    expect(measurementReview(part).state).toBe("ready");
    part.dimensions.width = 51;
    expect(measurementReview(part)).toMatchObject({ state: "needs-review", unverified: ["width"] });
    part.basis = "user-entered";
    expect(measurementReview(part).state).toBe("ready");
  });
  it("preserves a component with an out-of-bounds explicit measurement as missing geometry", () => {
    const part = extractMeasured([{ page: 1, text: "Plate 3 x 0.05 x 0.006 m" }]).components[0];
    expect(part.dimensions.length).toBeNull();
    expect(part.dimensions.width).toBe(50);
    expect(measurementReview(part).state).toBe("missing");
  });
});
