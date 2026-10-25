import { z } from "zod";
import { guard } from "@/lib/security";
import { requireUser } from "@/lib/platform/auth";
import { getItem, mutateItem } from "@/lib/platform/store";
import { Conflict } from "@/lib/platform/private-store";
import { execute } from "@/lib/search/orchestrator";
import { ResearchSchema } from "@/lib/model";
import { mergeWatchResult, type WatchCheckSummary } from "@/lib/intelligence/watch";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
export async function POST(req: Request) {
  try {
    guard(req, "watch-check", 10);
    const u = await requireUser(req);
    const b = z.object({ id: z.uuid(), consent: z.boolean() }).strict().parse(await req.json());
    const row = await getItem(u.id, b.id);
    if (!row || row.kind !== "watch")
      return Response.json({ error: "Watch not found." }, { status: 404, headers });
    const input = ResearchSchema.parse(row.data.input);
    if (input.mode !== "LIVE")
      return Response.json({ error: "Only live research can be watched." }, { status: 400, headers });
    if (input.sources !== "local" && !b.consent)
      return Response.json({ error: "Consent is required before sharing saved concepts again." }, { status: 400, headers });
    const fingerprint = JSON.stringify(input);
    const result = await execute({ ...input, consent: b.consent }, undefined, req.signal);
    const now = new Date().toISOString();
    const saved = await mutateItem(u.id, b.id, (current) => {
      if (current.kind !== "watch" || current.data._deleting) throw new Error("Not found");
      if (JSON.stringify(ResearchSchema.parse(current.data.input)) !== fingerprint)
        throw new Conflict("Watch concepts changed during the check; retry with the updated concepts.");
      return { ...current, updated: now, data: mergeWatchResult(current.data, result, now) };
    });
    const check = saved.data.checkSummary as WatchCheckSummary;
    const newsletter = [
      "# FormaProof research briefing", now,
      `Check status: ${check.status}. ${check.patentSourcesSucceeded}/${check.patentSourcesAttempted} configured patent/mixed sources returned successfully.`,
      `${check.newDiscoveries} newly observed records after the baseline; ${check.firstObserved} first observations in this check.`,
      `${check.recentPublications.length} returned records have a source-reported publication date since ${check.recentSince}.`,
      check.baselineCreated ? "Initial baseline created. Existing records are not announced as new publications." : "",
      "Coverage is partial. First observation does not mean a newly published patent. Cached evidence does not establish a fresh external check. Missing results do not establish freedom to operate.",
      "", ...result.patents.map((p) => `## ${p.publicationNumber}: ${p.title}\n${p.source}\n${p.sourceUrl}\nRetrieved ${p.retrievedAt}`),
      "", ...result.warnings,
    ].filter(Boolean).join("\n\n");
    return Response.json({ result, newDiscoveries: check.newDiscoveries, check, newsletter }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message.startsWith("Sign in") ? 401
      : error instanceof Conflict || /history|exceeds 3 MB/.test(message) ? 409
        : /Rate limit/.test(message) ? 429
          : message === "Not found" ? 404
            : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503;
    return Response.json({ error: status === 401 ? "Sign in to check a private watch."
      : status === 429 ? "Too many watch checks. Retry in one minute."
        : status === 409 ? message
          : status === 404 ? "Watch not found."
            : status === 400 ? "Check the watch identifier, saved concepts and consent."
              : "Watch check unavailable. Your previous results and review history were kept." },
    { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
  }
}
