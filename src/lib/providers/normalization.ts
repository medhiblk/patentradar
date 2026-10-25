import type { PatentRecord } from "./types";
export function normalizeMultilingual(s: string) {
  return s.normalize("NFKC").replace(/\s+/gu, " ").trim();
}
export function normalizeClassification(s: string) {
  return normalizeMultilingual(s).toUpperCase().replace(/\s+/g, "");
}
export function entityKey(s: string) {
  return normalizeMultilingual(s)
    .toLocaleLowerCase()
    .replace(/[.,，。]/gu, "");
}
export function familyGroups(records: PatentRecord[]) {
  const groups = new Map<string, PatentRecord[]>();
  for (const record of records) {
    const key = record.familyId
      ? "family:" +
        (record.familyNamespace || record.source) +
        ":" +
        record.familyId
      : "publication:" + record.publicationNumber;
    groups.set(key, [...(groups.get(key) || []), record]);
  }
  return [...groups.entries()].map(([id, members]) => ({ id, members }));
}
