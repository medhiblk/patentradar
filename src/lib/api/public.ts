import { z } from "zod";
import { ResearchSchema, ProfileSchema } from "../model";
import { execute } from "../search/orchestrator";
import { compare } from "../compare";
import { PatentSchema } from "../providers/types";
import { lookup } from "../providers/epo-publication";
export const SearchInput = z
  .object({
    query: z.string().trim().min(3).max(150),
    shareQuery: z.boolean().default(false),
    sources: z.enum(["all", "local"]).default("all"),
    seeds: z
      .array(
        z.object({
          publicationNumber: z.string().max(40),
          publicationDate: z
            .string()
            .regex(/^\d{8}$/)
            .optional(),
        }),
      )
      .max(10)
      .default([]),
  })
  .strict();
export const LookupInput = z
  .object({
    publicationNumber: z.string().regex(/^EP\s*\d+[AB]\d$/i),
    publicationDate: z.string().regex(/^\d{8}$/),
  })
  .strict();
export const CompareInput = z
  .object({
    profile: ProfileSchema,
    patents: z.array(PatentSchema).min(1).max(10),
  })
  .strict();
export function toResearchInput(raw: unknown) {
  const i = SearchInput.parse(raw);
  if (i.sources !== "local" && !i.shareQuery)
    throw new Error(
      "Set shareQuery=true to share short non-confidential concepts with public providers.",
    );
  return ResearchSchema.parse({
    profile: {
      title: "Public concept search",
      domain: "User-selected technical concepts",
      operatingPrinciple: i.query,
      technicalFeatures: [{ name: i.query, description: i.query }],
      searchKeywords: [i.query],
    },
    query: i.query,
    mode: "LIVE",
    sources: i.sources,
    seedPublications: i.seeds,
    consent: i.shareQuery,
  });
}
export async function publicSearch(raw: unknown, signal?: AbortSignal) {
  return execute(toResearchInput(raw), undefined, signal);
}
export async function publicLookup(raw: unknown) {
  const i = LookupInput.parse(raw);
  return {
    patents: await lookup(i.publicationNumber, i.publicationDate),
    coverage:
      "Exact EP A/B publication retrieval; date required. Not worldwide lookup.",
  };
}
export function publicCompare(raw: unknown) {
  const i = CompareInput.parse(raw);
  return {
    basis:
      "Lexical comparison against client-supplied records; this endpoint does not verify their retrieval or authenticity.",
    comparisons: i.patents.map((p) => ({
      publicationNumber: p.publicationNumber,
      source: p.source,
      sourceUrl: p.sourceUrl,
      ...compare(i.profile, p),
    })),
    limitation:
      "Technical relevance is not infringement probability or a freedom-to-operate conclusion.",
  };
}
export function apiError(e: unknown) {
  const validation = e instanceof z.ZodError;
  const message = e instanceof Error ? e.message : "";
  const rate = /rate.?limit/i.test(message);
  const consent = /shareQuery/.test(message);
  const size = /exceeds 256 KiB/.test(message);
  const invalid = /Invalid JSON body/.test(message);
  return Response.json(
    {
      error: {
        code: size
          ? "PAYLOAD_TOO_LARGE"
          : invalid
            ? "INVALID_JSON"
            : validation
              ? "INVALID_INPUT"
              : rate
                ? "RATE_LIMITED"
                : consent
                  ? "CONSENT_REQUIRED"
                  : "UNAVAILABLE",
        message: size
          ? "Request body exceeds 256 KiB."
          : invalid
            ? "Invalid JSON body."
            : validation
              ? "Input did not match the documented schema."
              : consent
                ? message
                : rate
                  ? "Rate limit reached; retry later."
                  : "Operation unavailable. Check capabilities and configuration.",
      },
    },
    {
      status: size
        ? 413
        : invalid || validation || consent
          ? 400
          : rate
            ? 429
            : 503,
      headers: {
        "Cache-Control": "no-store",
        ...(rate ? { "Retry-After": "60" } : {}),
      },
    },
  );
}

export async function readApiJson(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Invalid JSON body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 262144) {
        await reader.cancel();
        throw new Error("Request body exceeds 256 KiB");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Invalid JSON body");
  }
}
