import { z } from "zod";
export type ProviderCapability =
  | "patent-search"
  | "patent-lookup"
  | "full-text"
  | "claims"
  | "families"
  | "citations"
  | "legal-status"
  | "scientific-search"
  | "organization-search"
  | "compound-lookup"
  | "citation-search"
  | "reference-lookup";
export const PatentSchema = z.object({
  id: z.string(),
  publicationNumber: z.string(),
  applicationNumber: z.string().optional(),
  title: z.string(),
  abstract: z.string().optional(),
  applicants: z.array(z.string()),
  inventors: z.array(z.string()).optional(),
  priorityDate: z.string().optional(),
  publicationDate: z.string().optional(),
  jurisdiction: z.string().optional(),
  ipcCodes: z.array(z.string()).optional(),
  cpcCodes: z.array(z.string()).optional(),
  familyId: z.string().optional(),
  claims: z.array(z.string()).optional(),
  claimsScope: z.enum(["full", "excerpts"]).optional(),
  legalStatus: z
    .object({
      label: z.string(),
      source: z.string(),
      sourceUrl: z.string().url(),
      retrievedAt: z.string(),
      verification: z.literal("publisher-reported"),
    })
    .optional(),
  familyNamespace: z.string().optional(),
  citations: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        source: z.string(),
        sourceUrl: z.string().url(),
        retrievedAt: z.string(),
      }),
    )
    .optional(),
  evidence: z
    .array(
      z.object({
        source: z.string(),
        sourceUrl: z.string().url(),
        retrievedAt: z.string(),
        fields: z.record(z.string(), z.unknown()),
      }),
    )
    .optional(),
  pdfUrl: z.string().url().optional(),
  additionalSources: z
    .array(z.object({ name: z.string(), url: z.string().url() }))
    .optional(),
  source: z.string(),
  sourceUrl: z.string().url(),
  retrievedAt: z.string(),
  synthetic: z.boolean().optional(),
  queries: z.array(z.string()).optional(),
});
export type PatentRecord = z.infer<typeof PatentSchema>;
export type Paper = {
  id: string;
  title: string;
  year?: number;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
};
export type Provider = {
  id: string;
  name: string;
  capabilities: ProviderCapability[];
  authentication: string;
  configured: boolean;
  status: "UNTESTED" | "HEALTHY" | "UNAVAILABLE" | "NOT CONFIGURED" | "PENDING";
  detail: string;
  documentation: string;
  rateLimit: string;
  checkedAt?: string;
  tier?: "A" | "B" | "C" | "D";
  license?: string;
  category?: "patent" | "research" | "organization" | "technical" | "graph";
  enabledByDefault?: boolean;
};
export interface PatentLookup {
  lookup(number: string, date?: string): Promise<PatentRecord[]>;
}
export interface PatentSearch {
  search(query: string): Promise<PatentRecord[]>;
}
export interface ScientificSearch {
  search(query: string): Promise<Paper[]>;
}
