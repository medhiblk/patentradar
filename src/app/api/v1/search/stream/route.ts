import { POST as stream } from "@/app/api/research/stream/route";
import { toResearchInput, apiError, readApiJson } from "@/lib/api/public";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    return stream(
      new Request(req.url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify(toResearchInput(await readApiJson(req))),
        signal: req.signal,
      }),
    );
  } catch (e) {
    return apiError(e);
  }
}
