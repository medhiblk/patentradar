import { z } from "zod";
import { PatentSchema, type PatentRecord } from "@/lib/providers/types";
import dataset from "./data/public-medtech-patents.json";

// This is an attributed, bounded index of real public documents, not a live
// worldwide patent provider. Unknown legal status is deliberately not inferred.
const records = z.array(PatentSchema).max(50).parse(dataset.records);
export const publicReferenceCorpus = {
  id: dataset.id,
  label: dataset.label,
  coverage: dataset.coverage,
  recordCount: records.length,
  importedAt: dataset.importedAt,
  retrievedAt: dataset.observations.map(row => row.retrievedAt).sort().at(-1) || dataset.importedAt,
  discoveryUrl: dataset.discoveryUrl,
  samples: dataset.samples,
} as const;
export function publicReferencePatents(): PatentRecord[] {
  return structuredClone(records);
}
export function publicReferenceText(publicationNumber: string) {
  const record = records.find(item => item.publicationNumber === publicationNumber);
  return record ? [record.title, record.abstract || "", ...(record.claims || []), ...((record.evidence || []).map(row => typeof row.fields.descriptionExcerpt === "string" ? row.fields.descriptionExcerpt : ""))].join("\n") : "";
}
// Stable case IDs are UX download selectors only; never ranking seeds.
export { MEDTECH_CASES } from "@/lib/demo/medtech-cases";
