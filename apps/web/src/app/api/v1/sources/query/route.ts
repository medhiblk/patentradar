import { guard, OriginRejectedError } from "@/lib/security";
import { apiError, readApiJson } from "@/lib/api/public";
import { querySource, SourceConsentError } from "@/lib/api/source-query";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    guard(req, "source-query");
    return Response.json(
      await querySource(await readApiJson(req), req.signal),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof OriginRejectedError)
      return Response.json(
        {
          error: { code: "ORIGIN_REJECTED", message: "Origin not permitted." },
        },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    if (error instanceof SourceConsentError)
      return Response.json(
        { error: { code: "CONSENT_REQUIRED", message: error.message } },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    return apiError(error);
  }
}
