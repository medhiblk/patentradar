import { guard } from "@/lib/security";
import { readSpotInput } from "@/lib/documents/spot-input";
import { documentErrorResponse } from "@/lib/documents/errors";
import { spotDocument } from "@/lib/search/spot";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  const began = Date.now();
  try {
    guard(req, "spot", 15);
    const { form, pages, document } = await readSpotInput(req);
    const result = await spotDocument({ pages, consentToPublicLookup: form.get("consent") === "true", signal: req.signal });
    console.info(JSON.stringify({ event: "spot_complete", elapsedMs: Date.now() - began, matches: result.matches.length, indexed: result.coverage.indexedPatentCount }));
    return Response.json({ ...result, document }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return documentErrorResponse(error); }
}
