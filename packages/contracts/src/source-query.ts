import { z } from "zod";

export const SourceQueryInput = z
  .object({
    provider: z.enum([
      "datacite",
      "hal",
      "arxiv",
      "zenodo",
      "inspire",
      "nasa",
      "doe",
      "wikidata",
      "rcsb",
      "openaire",
      "ror",
      "gleif",
      "fr-company",
      "pubchem",
      "opencitations",
      "epo-linked",
      "veyip",
      "crossref",
      "openalex",
      "pubmed",
      "epo-publication",
      "epo-ops",
      "google-patents",
      "europe-pmc",
      "europe-pmc-research",
      "semantic-scholar",
      "local-index",
      "patent-pages",
      "uspto",
      "inpi",
      "lens",
      "cnipa",
      "wipo",
      "openai",
      "uspto-datasets",
      "patentsview-bulk",
    ]),
    query: z.string().trim().min(1).max(150),
    publicationDate: z
      .string()
      .regex(/^\d{8}$/)
      .optional(),
    operation: z
      .enum([
        "search",
        "patent-references",
        "citations",
        "references",
        "application",
        "claims",
        "relations",
        "rdf",
      ])
      .default("search"),
    page: z.number().int().min(1).max(10).default(1),
    consent: z.boolean().default(false),
  })
  .strict();

const common = {
  provider: SourceQueryInput.shape.provider,
  retrievedAt: z.string().datetime(),
};
export const SourceQueryResult = z.discriminatedUnion("status", [
  z.object({
    ...common,
    status: z.literal("HEALTHY"),
    category: z.string(),
    records: z
      .unknown()
      .refine((value) => value !== undefined, "Records are required"),
    page: z.number().int().min(1).max(10),
    latencyMs: z.number().nonnegative(),
    warnings: z.array(z.string()),
  }),
  z.object({
    ...common,
    status: z.enum([
      "NOT_CONFIGURED",
      "NOT_IMPLEMENTED",
      "OUT_OF_SCOPE",
      "UNSUPPORTED_OPERATION",
      "INVALID_INPUT",
      "UNAVAILABLE",
    ]),
    error: z.string(),
    code: z.string().optional(),
    retryAfterMs: z.number().nonnegative().optional(),
  }),
]);
export type SourceQuery = z.input<typeof SourceQueryInput>;
export type SourceQueryResponse = z.infer<typeof SourceQueryResult>;
