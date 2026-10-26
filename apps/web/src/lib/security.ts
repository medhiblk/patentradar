import { ProviderRequestError } from "./providers/http";
const buckets = new Map<string, { count: number; reset: number }>();
export class OriginRejectedError extends Error {
  constructor() {
    super("Cross-origin request rejected");
  }
}
export function guard(
  request: Request,
  namespace = "public",
  limit = 20,
  allowedOrigins: readonly string[] = [],
) {
  const origin = request.headers.get("origin");
  if (origin) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new OriginRejectedError();
    }
    const sameHost = parsed.host ===
      (request.headers.get("host") || new URL(request.url).host);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin !== origin ||
      (!sameHost && !allowedOrigins.includes(origin))
    ) throw new OriginRejectedError();
  }
  const key =
    namespace +
    ":" +
    (request.headers.get("x-forwarded-for")?.split(",")[0] || "local");
  const now = Date.now();
  for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  const b = buckets.get(key) || { count: 0, reset: now + 60000 };
  if (++b.count > limit)
    throw new Error("Rate limit exceeded; retry in one minute");
  buckets.set(key, b);
  if (Number(request.headers.get("content-length") || 0) > 6 * 1024 * 1024)
    throw new Error("Request exceeds 6 MB");
}
export function failure(e: unknown) {
  if (e instanceof ProviderRequestError) {
    const headers: Record<string, string> = {};
    if (e.retryAfterMs && Number.isFinite(e.retryAfterMs))
      headers["Retry-After"] = String(
        Math.max(1, Math.ceil(e.retryAfterMs / 1000)),
      );
    return Response.json(
      {
        error:
          e.code === "RATE_LIMITED"
            ? "This public source is rate-limited. Please retry later."
            : "This public source is temporarily unavailable or returned an unexpected format. Other sources can still be used.",
        provider: e.provider,
        code: e.code,
      },
      { status: e.code === "RATE_LIMITED" ? 429 : 503, headers },
    );
  }

  const message = e instanceof Error ? e.message : "Request failed";
  const safe =
    /Rate limit|Cross-origin|exceeds|PDF|consent|publication|EP |No extractable|OpenAI|disabled|Invalid DOI|Invalid compound|Invalid PDB|Wikidata lookup|first bounded page/.test(
      message,
    )
      ? message
      : "Unable to process request. Check inputs and provider availability.";
  return Response.json(
    { error: safe },
    { status: /Rate limit/.test(safe) ? 429 : 400 },
  );
}
