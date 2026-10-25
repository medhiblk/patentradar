import { db } from "../platform/db";
import { PatentSchema, type PatentRecord } from "./types";
export const enabled = () => !process.env.VERCEL || !!process.env.PATENTRADAR_DATA_DIR;
export function indexPatents(records: PatentRecord[]) {
  if (!enabled() || !records.length) return;
  try {
    const d = db();
    for (const p of records) {
      if (p.synthetic) continue;
      const parsed = PatentSchema.safeParse(p);
      if (!parsed.success) continue;
      d.prepare("DELETE FROM patents WHERE publication=?").run(
        p.publicationNumber,
      );
      d.prepare("INSERT INTO patents VALUES(?,?,?,?)").run(
        p.publicationNumber,
        p.title,
        p.abstract || "",
        JSON.stringify(p),
      );
    }
  } catch {
    /* Local persistence is optional; public searches continue. */
  }
}
export async function search(query: string) {
  const terms = query.match(/[\p{L}\p{N}]+/gu)?.slice(0, 10) || [];
  if (!terms.length) return [];
  const rows = db()
    .prepare(
      "SELECT record FROM patents WHERE patents MATCH ? ORDER BY rank LIMIT 20",
    )
    .all(terms.map((t) => '"' + t + '"').join(" OR "));
  return rows.flatMap((r) => {
    const p = PatentSchema.safeParse(JSON.parse(String(r.record)));
    return p.success ? [p.data] : [];
  });
}

export async function lookup(publications: string[]) {
  if (!publications.length) return [];
  return db()
    .prepare(
      `SELECT record FROM patents WHERE publication IN (${publications.map(() => "?").join(",")}) LIMIT 10`,
    )
    .all(...publications)
    .flatMap((r) => {
      const p = PatentSchema.safeParse(JSON.parse(String(r.record)));
      return p.success ? [p.data] : [];
    });
}
