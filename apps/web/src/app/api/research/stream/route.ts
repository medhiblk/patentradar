import { guard, failure } from "@/lib/security";
import { ResearchSchema } from "@/lib/model";
import { execute, plan } from "@/lib/search/orchestrator";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    guard(req);
    const input = ResearchSchema.parse(await req.json());
    plan(input);
    const abort = new AbortController();
    const signal = AbortSignal.any([req.signal, abort.signal]);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        void execute(
          input,
          (event) =>
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")),
          signal,
        )
          .then(() => controller.close())
          .catch(() => {
            if (!signal.aborted) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "error",
                    message: "Search interrupted; partial evidence retained.",
                  }) + "\n",
                ),
              );
              controller.close();
            }
          });
      },
      cancel() {
        abort.abort();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
