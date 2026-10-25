import { z } from "zod";

export const dimensionKeys = ["length", "width", "height", "diameter", "innerDiameter"] as const;
export type DimensionKey = (typeof dimensionKeys)[number];
export type SourceUnit = "mm" | "cm" | "m" | "in";
export const MeasurementEvidenceSchema = z.object({
  status: z.enum(["text-verified", "user-entered", "unverified", "missing"]),
  valueMm: z.number().positive().max(2000).nullable(),
  sourceValue: z.number().positive().optional(),
  sourceUnit: z.enum(["mm", "cm", "m", "in"]).optional(),
  sourcePage: z.number().int().min(1).max(80).optional(),
  sourceQuote: z.string().max(2000).optional(),
});
export type MeasurementEvidence = z.infer<typeof MeasurementEvidenceSchema>;
export type SourceMeasurement = { valueMm: number; sourceValue: number; sourceUnit: SourceUnit; field?: DimensionKey };
const numberPattern = "\\d+(?:[.,]\\d+)?";
const unitPattern = '(?:mm|cm|m|inches|inch|in|["″])';
const unitFactor: Record<SourceUnit, number> = { mm: 1, cm: 10, m: 1000, in: 25.4 };
function measurement(value: string, unit: string, field?: DimensionKey): SourceMeasurement {
  const sourceValue = Number(value.replace(",", "."));
  const sourceUnit: SourceUnit = /^(mm|cm|m)$/i.test(unit) ? unit.toLowerCase() as SourceUnit : "in";
  return { sourceValue, sourceUnit, valueMm: Number((sourceValue * unitFactor[sourceUnit]).toFixed(8)), ...(field ? { field } : {}) };
}
export function validDimension(value: number) { return Number.isFinite(value) && value > 0 && value <= 2000; }
export function sameMeasurement(a: number, b: number) { return Math.abs(a - b) <= Math.max(1e-7, Math.abs(b) * 1e-8); }

/** Explicit units only. A number embedded in another number is never evidence. */
export function sourceMeasurements(text: string): SourceMeasurement[] {
  const values: SourceMeasurement[] = [];
  const labels = "inner\\s+diameter|inside\\s+diameter|internal\\s+diameter|diam[eè]tre\\s+int[eé]rieur|outer\\s+diameter|outside\\s+diameter|external\\s+diameter|diam[eè]tre\\s+ext[eé]rieur|diameter|diam[eè]tre|[Øø]|length|longueur|width|largeur|height|hauteur|thickness|[eé]paisseur";
  const labelled = new RegExp(`(?<![\\p{L}\\d_])(${labels})\\s*[:=]?\\s*(${numberPattern})\\s*(${unitPattern})(?![\\p{L}\\d²³])`, "giu");
  for (const match of text.matchAll(labelled)) {
    const label = match[1].toLowerCase();
    const field: DimensionKey = /inner|inside|internal|int[eé]rieur/.test(label) ? "innerDiameter" : /diam|[Øø]/i.test(label) ? "diameter" : /length|longueur/.test(label) ? "length" : /width|largeur/.test(label) ? "width" : "height";
    values.push(measurement(match[2], match[3], field));
  }
  const tuple = new RegExp(`(?<![\\p{L}\\d.,+−-])(${numberPattern})\\s*[x×]\\s*(${numberPattern})\\s*[x×]\\s*(${numberPattern})\\s*(${unitPattern})(?![\\p{L}\\d²³])`, "giu");
  for (const match of text.matchAll(tuple)) {
    for (const [index, field] of ["length", "width", "height"].entries())
      values.push(measurement(match[index + 1], match[4], field as DimensionKey));
  }
  const single = new RegExp(`(?<![\\p{L}\\d.,+−-])(${numberPattern})\\s*(${unitPattern})(?![\\p{L}\\d²³])`, "giu");
  for (const match of text.matchAll(single)) {
    const value = measurement(match[1], match[2]);
    if (!values.some(existing => existing.field && sameMeasurement(existing.valueMm, value.valueMm) && existing.sourceUnit === value.sourceUnit)) values.push(value);
  }
  return values;
}

export function findMeasurementEvidence(valueMm: number, quote: string, field: DimensionKey) {
  const values = sourceMeasurements(quote);
  const labelled = values.filter(value => value.field === field);
  // When the quote explicitly names the dimension, a different named dimension
  // cannot be borrowed just because it happens to have the desired number.
  const candidates = labelled.length ? labelled : values.filter(value => !value.field);
  return candidates.find(value => sameMeasurement(valueMm, value.valueMm));
}
