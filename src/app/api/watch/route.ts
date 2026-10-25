import { z } from "zod";
import { guard } from "@/lib/security";
import { requireUser } from "@/lib/platform/auth";
import { db } from "@/lib/platform/db";
import { execute } from "@/lib/search/orchestrator";
import { ResearchSchema } from "@/lib/model";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    guard(req);
    const u = requireUser(req),
      b = await req.json(),
      id = z.uuid().parse(b.id);
    const row = db()
      .prepare("SELECT * FROM items WHERE id=? AND userId=? AND kind='watch'")
      .get(id, u.id);
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    const stored = JSON.parse(String(row.data));
    const input = ResearchSchema.parse(stored.input);
    if (b.consent !== true)
      return Response.json(
        { error: "Consent is required before sharing saved concepts again." },
        { status: 400 },
      );
    const result = await execute(input, undefined, req.signal),
      before = new Set(stored.publications || []);
    const discoveries = result.patents.filter(
      (p) => !before.has(p.publicationNumber),
    );
    db()
      .prepare("UPDATE items SET data=?,updated=? WHERE id=? AND userId=?")
      .run(
        JSON.stringify({
          ...stored,
          publications: result.patents.map((p) => p.publicationNumber),
          lastResult: result,
          lastChecked: new Date().toISOString(),
          discoveries: discoveries.map((p) => p.publicationNumber),
        }),
        new Date().toISOString(),
        id,
        u.id,
      );
    const newsletter = [
      "# PatentRadar research briefing",
      new Date().toISOString(),
      "Coverage is partial. Newly discovered records may be older publications.",
      "",
      ...result.patents.map(
        (p) =>
          `## ${p.publicationNumber}: ${p.title}\n${p.source}\n${p.sourceUrl}\nRetrieved ${p.retrievedAt}`,
      ),
      "",
      ...result.warnings,
    ].join("\n\n");
    return Response.json({
      result,
      newDiscoveries: discoveries.length,
      newsletter,
    });
  } catch {
    return Response.json(
      {
        error:
          "Watch check failed. Check account, consent and source availability.",
      },
      { status: 400 },
    );
  }
}
