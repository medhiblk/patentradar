import {
  sharedConfigured,
  redis,
  reserve,
  publicCacheKey,
} from "../cache/shared";
import { currentSearchSignal } from "../search/scope";
import { createHash } from "node:crypto";
const cache = new Map<string, { until: number; body: string }>();
const inflight = new Map<string, Promise<string>>();
const nextAllowed = new Map<string, number>();
export const observations = new Map<
  string,
  {
    status: "HEALTHY" | "UNAVAILABLE";
    detail: string;
    checkedAt: string;
    latencyMs?: number;
    httpStatus?: number;
  }
>();
const gaps: Record<string, number> = {
  arxiv: 3100,
  openaire: 61000,
  crossref: 1100,
  pubmed: 400,
  "europe-pmc": 1100,
  ror: 1100,
  gleif: 1100,
  "fr-company": 1100,
  pubchem: 1100,
  veyip: 1100,
  "epo-linked": 2000,
};
export class ProviderRequestError extends Error {
  constructor(
    public provider: string,
    public code:
      "RATE_LIMITED" | "HTTP_ERROR" | "UNAVAILABLE" | "INVALID_RESPONSE",
    message: string,
    public retryAfterMs?: number,
  ) {
    super(`${provider}: ${message}`);
  }
}
async function pace(provider: string) {
  if (sharedConfigured()) {
    const delay = await reserve(provider, gaps[provider] || 1100);
    if (delay > 0)
      throw new ProviderRequestError(
        provider,
        "RATE_LIMITED",
        "Shared provider quota reserved",
        delay,
      );
    return;
  }
  const now = Date.now(),
    next = nextAllowed.get(provider) || 0,
    delay = Math.max(0, next - now);
  if (delay > 1500)
    throw new ProviderRequestError(
      provider,
      "RATE_LIMITED",
      "Rate limit: retry later",
      delay,
    );
  nextAllowed.set(provider, Math.max(now, next) + (gaps[provider] || 1100));
  if (delay) await new Promise((r) => setTimeout(r, delay));
}
async function readBounded(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  let total = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 8_000_000) {
      await reader.cancel();
      throw new Error("Response exceeds 8 MB limit");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function perform(provider: string, url: string, init: RequestInit) {
  let failure = "Network timeout or unavailable";
  let status: number | undefined;
  const started = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await pace(provider);
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.any([
          AbortSignal.timeout(10000),
          ...(init.signal ? [init.signal] : []),
          ...(currentSearchSignal() ? [currentSearchSignal()!] : []),
        ]),
        headers: {
          Accept: "application/json, application/xml, text/html;q=0.8",
          "User-Agent": "PatentRadar/1.0 (bounded preliminary research)",
          ...init.headers,
        },
      });
      status = response.status;
      if (!response.ok) {
        failure = status === 429 ? "Rate limited (429)" : `HTTP ${status}`;
        const retryRaw = response.headers.get("retry-after");
        const retry = retryRaw
          ? Number.isFinite(Number(retryRaw))
            ? Number(retryRaw)
            : Math.max(0, (Date.parse(retryRaw) - Date.now()) / 1000)
          : 0;
        if (status === 429 && retry > 1.5)
          throw new ProviderRequestError(
            provider,
            "RATE_LIMITED",
            failure,
            retry * 1000,
          );
        if ((status === 429 || status >= 500) && attempt === 0) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
          continue;
        }
        throw new ProviderRequestError(
          provider,
          status === 429 ? "RATE_LIMITED" : "HTTP_ERROR",
          failure,
        );
      }
      const body = await readBounded(response);
      observations.set(provider, {
        status: "HEALTHY",
        detail:
          "HTTP request succeeded; adapter validates the data format. This is not an uptime guarantee.",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        httpStatus: status,
      });
      return body;
    } catch (e) {
      currentSearchSignal()?.throwIfAborted();
      if (e instanceof ProviderRequestError && e.code === "RATE_LIMITED") {
        observations.set(provider, {
          status: "UNAVAILABLE",
          detail: e.message,
          checkedAt: new Date().toISOString(),
          httpStatus: status,
        });
        throw e;
      }
      failure =
        e instanceof ProviderRequestError ||
        (e instanceof Error &&
          /^HTTP|Rate limited|Response exceeds/.test(e.message))
          ? e.message
          : "Network timeout or unavailable";
      if (
        e instanceof ProviderRequestError &&
        e.code === "HTTP_ERROR" &&
        status &&
        status < 500
      )
        break;
    }
  }
  observations.set(provider, {
    status: "UNAVAILABLE",
    detail: failure,
    checkedAt: new Date().toISOString(),
    httpStatus: status,
    latencyMs: Date.now() - started,
  });
  console.warn(
    JSON.stringify({ event: "provider_failure", provider, reason: failure }),
  );
  throw new ProviderRequestError(
    provider,
    status && status >= 400 ? "HTTP_ERROR" : "UNAVAILABLE",
    failure,
  );
}
export async function request(
  provider: string,
  url: string,
  init: RequestInit = {},
  cached = true,
): Promise<string> {
  const hash = createHash("sha256")
    .update(JSON.stringify({ body: init.body, headers: init.headers }))
    .digest("hex");
  const key = provider + " " + (init.method || "GET") + " " + url + " " + hash;
  const hit = cache.get(key);
  if (cached && hit && hit.until > Date.now()) return hit.body;
  if (cached && inflight.has(key)) return inflight.get(key)!;
  const sharedKey = publicCacheKey(key);
  if (cached && sharedConfigured()) {
    const remote = await redis(["GET", sharedKey]);
    if (typeof remote === "string") return remote;
  }
  const pending = perform(provider, url, init)
    .then(async (body) => {
      if (cached) {
        if (sharedConfigured())
          await redis([
            "SET",
            sharedKey,
            body,
            "EX",
            provider === "openaire" || provider === "arxiv" ? 3600 : 300,
          ]);
        if (cache.size > 150) cache.delete(cache.keys().next().value!);
        cache.set(key, {
          body,
          until:
            Date.now() +
            (provider === "openaire" || provider === "arxiv"
              ? 3600000
              : 300000),
        });
      }
      return body;
    })
    .finally(() => inflight.delete(key));
  if (cached) inflight.set(key, pending);
  return pending;
}
export function invalidResponse(provider: string): never {
  for (const key of cache.keys())
    if (key.startsWith(provider + " ")) cache.delete(key);
  observations.set(provider, {
    status: "UNAVAILABLE",
    detail: "Unexpected response format",
    checkedAt: new Date().toISOString(),
  });
  throw new ProviderRequestError(
    provider,
    "INVALID_RESPONSE",
    "Unexpected response format",
  );
}
