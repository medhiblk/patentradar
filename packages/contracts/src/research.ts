import { z } from "zod";
import { PatentSchema } from "./patents.js";
import { SearchTraceSchema } from "./audit.js";
export const ProfileSchema = z.object({
  title: z.string().min(1).max(200),
  domain: z.string().max(200),
  operatingPrinciple: z.string().max(2000),
  technicalFeatures: z
    .array(
      z.object({
        name: z.string().min(1).max(150),
        description: z.string().min(1).max(1500),
      }),
    )
    .min(1)
    .max(20),
  searchKeywords: z.array(z.string().max(150)).max(12),
});
export type Profile = z.infer<typeof ProfileSchema>;
export const ResearchSchema = z.object({
  sources: z.enum(["all", "local"]).default("all"),
  profile: ProfileSchema,
  mode: z.enum(["LIVE", "DEMO"]),
  seedPublications: z
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
  publicationNumber: z.string().max(40).default(""),
  publicationDate: z
    .string()
    .regex(/^\d{8}$/)
    .or(z.literal(""))
    .default(""),
  query: z.string().max(300).default(""),
  consent: z.boolean().default(false),
});
export const ReportSchema = z.object({
  ranking: z.object({
    method: z.enum(["lexical", "ai-assisted"]),
    entries: z.array(z.object({ publicationNumber: z.string(), reason: z.string().max(500) })).max(50),
    appliedAt: z.string(),
  }).optional(),
  searchTrace: SearchTraceSchema.optional(),
  profile: ProfileSchema,
  mode: z.enum(["LIVE", "PARTIAL", "DEMO"]),
  patents: z.array(PatentSchema).max(50),
  papers: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        year: z.number().optional(),
        source: z.string(),
        sourceUrl: z.string().url(),
        retrievedAt: z.string(),
      }),
    )
    .max(30),
  seedSuggestions: z
    .object({
      terms: z.array(z.string()),
      classifications: z.array(z.string()),
    })
    .optional(),
  warnings: z.array(z.string()).max(30),
  queries: z.array(z.string()).max(30),
});
export type Research = z.infer<typeof ReportSchema>;
export const disclaimer =
  "Preliminary technical intelligence, not a legal opinion or formal freedom-to-operate assessment. Relevance is not infringement probability. Coverage is incomplete.";
