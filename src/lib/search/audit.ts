import { z } from "zod";
export const PublicUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  });
export const RequestTraceSchema = z.object({
  provider: z.string(),
  endpoint: PublicUrl,
  observedAt: z.string(),
  servedFrom: z.enum(["network", "memory-cache", "shared-cache", "in-flight"]),
  httpStatus: z.number().int().min(100).max(599).optional(),
  errorCode: z
    .enum(["RATE_LIMITED", "HTTP_ERROR", "UNAVAILABLE", "INVALID_RESPONSE"])
    .optional(),
});
export type RequestTrace = z.infer<typeof RequestTraceSchema>;
export const SourceRunSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["patent", "research", "mixed", "local", "reference"]),
  method: z.enum([
    "keyword-search",
    "publication-lookup",
    "local-index",
    "reference-snapshot",
  ]),
  documentation: PublicUrl.optional(),
  coverage: z.string(),
  queries: z.array(z.string()).max(12),
  status: z.enum(["queued", "running", "succeeded", "empty", "failed"]),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  elapsedMs: z.number().nonnegative().optional(),
  patentsRetrieved: z.number().int().nonnegative(),
  papersRetrieved: z.number().int().nonnegative(),
  patentNumbers: z.array(z.string()).max(100),
  requests: z.array(RequestTraceSchema).max(20),
  message: z.string().optional(),
});
export type SourceRun = z.infer<typeof SourceRunSchema>;
export const SearchTraceSchema = z.object({
  searchId: z.string(),
  context: z.enum(["live-search", "known-reference"]),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  providers: z.array(SourceRunSchema).max(40),
  notQueried: z
    .array(z.object({ name: z.string(), reason: z.string() }))
    .max(20),
});
export type SearchTrace = z.infer<typeof SearchTraceSchema>;
