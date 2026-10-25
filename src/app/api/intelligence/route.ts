import { guard, failure } from "@/lib/security";
import { querySource } from "@/lib/api/source-query";
import { readApiJson } from "@/lib/api/public";
import {
  endpointCatalogue,
  eligibilitySummary,
} from "@/lib/providers/eligibility";
export const maxDuration = 60;
export async function GET() {
  return Response.json({
    summary: eligibilitySummary(),
    endpoints: endpointCatalogue,
    operations:
      "POST provider, query, operation, page and consent=true. No arbitrary URLs.",
  });
}
export async function POST(req: Request) {
  try {
    guard(req);
    const result = await querySource(await readApiJson(req));
    const retry = "retryAfterMs" in result ? result.retryAfterMs : undefined;
    return Response.json(result, {
      status:
        result.status === "HEALTHY"
          ? 200
          : result.status === "UNAVAILABLE"
            ? result.code === "RATE_LIMITED"
              ? 429
              : 503
            : 409,
      headers: {
        "Cache-Control": "no-store",
        ...(retry ? { "Retry-After": String(Math.ceil(retry / 1000)) } : {}),
      },
    });
  } catch (e) {
    return failure(e);
  }
}
