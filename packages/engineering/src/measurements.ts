import { AssemblySchema, type AssemblySpec, type ComponentSpec } from "./schema.js";
import { dimensionKeys, findMeasurementEvidence } from "./measurement-values.js";

/** Validate document-derived measurements. Uncalibrated visual suggestions remain
 * explicitly unverified; this never certifies manufacturability or tolerances. */
export function validateDocumentMeasurements(
  input: AssemblySpec,
  pages: { page: number; text: string }[],
  sourceHash?: string,
): AssemblySpec {
  const spec = AssemblySchema.parse(input);
  const addLimitation = (message: string) => {
    if (spec.limitations.length < 20 && !spec.limitations.includes(message)) spec.limitations.push(message);
  };
  for (const component of spec.components) {
    const page = pages.find(item => item.page === component.sourcePage);
    if (!page) throw new Error("Unverified source page");
    if (sourceHash && /^[a-f0-9]{64}$/.test(sourceHash)) component.sourceHash = sourceHash;
    const quoteVerified = !!component.sourceQuote.trim() && page.text.replace(/\s+/g, " ").includes(component.sourceQuote.replace(/\s+/g, " "));
    const textEvidence = component.basis === "source-text" && quoteVerified;
    const measurementEvidence: NonNullable<ComponentSpec["measurementEvidence"]> = {};
    if (component.basis === "source-text" && !quoteVerified) {
      component.basis = "visual-unverified";
      addLimitation(`Quote not text-verified for ${component.name}; verify every measurement.`);
    }
    for (const key of dimensionKeys) {
      const value = component.dimensions[key];
      const base = { valueMm: value, sourcePage: component.sourcePage, sourceQuote: component.sourceQuote };
      if (value === null) {
        measurementEvidence[key] = { ...base, status: "missing" };
      } else if (textEvidence) {
        const proof = findMeasurementEvidence(value, component.sourceQuote, key);
        if (proof) {
          measurementEvidence[key] = { ...base, status: "text-verified", sourceValue: proof.sourceValue, sourceUnit: proof.sourceUnit };
        } else {
          component.dimensions[key] = null;
          measurementEvidence[key] = { ...base, valueMm: null, status: "missing" };
          addLimitation(`Measurement ${key} for ${component.name} had no matching dimension/unit in its quoted evidence and was removed.`);
        }
      } else {
        measurementEvidence[key] = { ...base, status: "unverified" };
      }
    }
    component.measurementEvidence = measurementEvidence;
    // Model output cannot claim a human entered/reviewed these measurements.
    if (component.basis === "user-entered") component.basis = "visual-unverified";
    component.position = [0, 0, 0];
    component.rotation = [0, 0, 0];
  }
  return AssemblySchema.parse(spec);
}
