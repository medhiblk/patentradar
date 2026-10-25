import { z } from "zod";
import { guard } from "@/lib/security";
import { requireUser } from "@/lib/platform/auth";
import { getItem, saveItem } from "@/lib/platform/store";
import { execute } from "@/lib/search/orchestrator";
import { ResearchSchema } from "@/lib/model";
import { similarityAlerts, savedAlerts } from "@/lib/intelligence/alerts";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    guard(req);
    const u = await requireUser(req),
      b = await req.json(),
      id = z.uuid().parse(b.id);
    const row = await getItem(u.id, id);
    if (!row || row.kind !== "watch")
      return Response.json({ error: "Not found" }, { status: 404 });
    const stored = row.data;
    const input = ResearchSchema.parse(stored.input);
    if (b.consent !== true)
      return Response.json(
        { error: "Consent is required before sharing saved concepts again." },
        { status: 400 },
      );
    const result = await execute(input, undefined, req.signal),
      before = new Set(
        Array.isArray(stored.publications) ? stored.publications : [],
      );
    const discoveries = result.patents.filter(
      (p) => !before.has(p.publicationNumber),
    );
    await saveItem(
      u.id,
      {
        ...row,
        updated: new Date().toISOString(),
        data: {
          ...stored,
          publications: result.patents.map((p) => p.publicationNumber),
          lastResult: result,
          similarityAlerts: similarityAlerts(
            result.profile,
            result.patents,
            savedAlerts(stored),
          ),
          lastChecked: new Date().toISOString(),
          discoveries: discoveries.map((p) => p.publicationNumber),
        },
      },
      true,
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
