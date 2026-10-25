import type { PatentRecord } from "./providers/types";
export function normalizePublication(input: string) {
  const n = input
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s.-]/g, "");
  if (!/^[A-Z]{2}\d{4,14}[A-Z]\d?$/.test(n))
    throw new Error(
      "Use a publication number with kind code, e.g. EP1000000A1.",
    );
  return n;
}
export function normalizeApplicant(s: string) {
  return s.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
}
export function deduplicate(records: PatentRecord[]) {
  const seen = new Map<string, PatentRecord>();
  for (const r of records) {
    let key: string;
    try {
      key = r.synthetic ? r.id : normalizePublication(r.publicationNumber);
    } catch {
      continue;
    }
    const evidence = r.evidence || [
      {
        source: r.source,
        sourceUrl: r.sourceUrl,
        retrievedAt: r.retrievedAt,
        fields: {
          title: r.title,
          abstract: r.abstract,
          claims: r.claims,
          publicationDate: r.publicationDate,
          applicants: r.applicants,
          familyId: r.familyId,
        },
      },
    ];
    const old = seen.get(key);
    const merged = old
      ? {
          ...r,
          ...Object.fromEntries(
            Object.entries(old).filter(([, v]) => v !== undefined),
          ),
          abstract: old.abstract || r.abstract,
          familyId: old.familyId || r.familyId,
          familyNamespace:
            old.familyNamespace ||
            (old.familyId ? old.source : r.familyNamespace || r.source),
          claims: [...new Set([...(old.claims || []), ...(r.claims || [])])],
          ipcCodes: [
            ...new Set([...(old.ipcCodes || []), ...(r.ipcCodes || [])]),
          ],
          cpcCodes: [
            ...new Set([...(old.cpcCodes || []), ...(r.cpcCodes || [])]),
          ],
          applicants: [...new Set([...old.applicants, ...r.applicants])],
          citations: [...(old.citations || []), ...(r.citations || [])],
          evidence: [...(old.evidence || []), ...evidence],
          additionalSources: [
            ...(old.additionalSources || []),
            { name: r.source, url: r.sourceUrl },
            ...(r.additionalSources || []),
          ],
          queries: [...new Set([...(old.queries || []), ...(r.queries || [])])],
        }
      : {
          ...r,
          publicationNumber: key,
          evidence,
          familyNamespace: r.familyNamespace || r.source,
        };
    seen.set(key, merged);
  }
  return [...seen.values()];
}

export function diversePapers<T extends { source: string; sourceUrl: string }>(
  records: T[],
  limit = 30,
): T[] {
  const groups = new Map<string, T[]>();
  for (const r of records)
    groups.set(r.source, [...(groups.get(r.source) || []), r]);
  const seen = new Set<string>(),
    out: T[] = [];
  while (out.length < limit && [...groups.values()].some((g) => g.length)) {
    for (const group of groups.values()) {
      while (group.length && out.length < limit) {
        const row = group.shift()!;
        const key = row.sourceUrl.replace("http:", "https:").toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(row);
          break;
        }
      }
    }
  }
  return out;
}
