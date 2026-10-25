import { z } from "zod";
import source from "@/lib/examples/us20080003142a1.json";
import { PatentSchema } from "@/lib/providers/types";
import { localExtract } from "@/lib/local-extract";
import { similarityAlerts } from "@/lib/intelligence/alerts";
import { guard, failure } from "@/lib/security";
import type { SearchTrace } from "@/lib/search/audit";
export const runtime = "nodejs";
const patent = PatentSchema.parse(source.patent);
function referenceTrace(): SearchTrace {
  const now = new Date().toISOString();
  return {
    searchId: crypto.randomUUID(),
    context: "known-reference",
    startedAt: now,
    completedAt: now,
    providers: [
      {
        id: "user-selected-reference",
        name: "User-selected publication / Google Patents reference",
        category: "reference",
        method: "reference-snapshot",
        coverage:
          "Manually verified PDF snapshot retrieved " +
          patent.retrievedAt +
          ". Selected claim excerpts from original page 81; no live patent database search.",
        queries: [patent.publicationNumber],
        status: "succeeded",
        patentsRetrieved: 1,
        papersRetrieved: 0,
        patentNumbers: [patent.publicationNumber],
        requests: [],
      },
    ],
    notQueried: [
      {
        name: "Live patent and scientific databases",
        reason: "This exercise compares the preselected publication only.",
      },
      {
        name: "Google Patents Public Data / BigQuery",
        reason: "No BigQuery query was run for this reference case.",
      },
    ],
  };
}
export async function GET() {
  return Response.json(
    {
      ...source,
      patent,
      searchTrace: referenceTrace(),
      context: "KNOWN_REFERENCE_CASE",
      limitation:
        "One preselected, verified publication snapshot; not a new worldwide search. Claim excerpts and publisher-reported status require full-document and official-status review.",
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
export async function POST(req: Request) {
  try {
    guard(req, "reference-comparison", 20);
    const { description } = z
      .object({ description: z.string().trim().min(30).max(12000) })
      .strict()
      .parse(await req.json());
    const profile = localExtract(description);
    const research = {
      searchTrace: referenceTrace(),
      profile,
      mode: "PARTIAL",
      patents: [patent],
      papers: [],
      queries: [patent.publicationNumber],
      warnings: [
        "Known-reference exercise: this publication was supplied in advance, not discovered through a live worldwide search.",
        "Comparison uses selected claim excerpts. Published application status does not establish active enforceable rights or permission to manufacture.",
      ],
    };
    return Response.json(
      {
        research,
        alerts: similarityAlerts(profile, [patent]),
        sourceDocument: source.sourceDocument,
        method:
          "Local extractive feature review and lexical comparison against verified PDF excerpts; no external AI or provider query.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
