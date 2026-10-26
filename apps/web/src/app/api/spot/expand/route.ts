import { guard } from "@/lib/security";
import { readSpotInput } from "@/lib/documents/spot-input";
import { DocumentError, documentErrorResponse } from "@/lib/documents/errors";
import { expandSpot } from "@/lib/search/spot-expand";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    guard(req, "spot-expand", 5);
    const { form, pages, document } = await readSpotInput(req);
    const query = String(form.get("query") || "").trim();
    if (form.get("searchConsent") !== "true")
      throw new DocumentError("SEARCH_CONSENT_REQUIRED", 400, "Approve sharing the short search query before extending the search.");
    if (query.length < 3 || query.length > 150)
      throw new DocumentError("SEARCH_QUERY_REQUIRED", 400, "Review a short search query between 3 and 150 characters.");
    const abort = new AbortController();
    const signal = AbortSignal.any([req.signal, abort.signal]);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: object) => {
          if (!signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };
        void expandSpot({ pages, query, consentToPublicLookup: form.get("consent") === "true", signal },
          event => send({ ...event, ...("result" in event ? { result: { ...event.result, document } } : {}) }))
          .catch(() => send({ type: "error", message: "Extended search could not complete. Your earlier evidence remains available." }))
          .finally(() => { if (!signal.aborted) controller.close(); });
      },
      cancel() { abort.abort(); },
    });
    return new Response(stream, { headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no",
    } });
  } catch (error) { return documentErrorResponse(error); }
}
