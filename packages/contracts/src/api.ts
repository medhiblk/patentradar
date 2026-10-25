import { z } from "zod";
import { ProfileSchema } from "./research.js";
import { PatentSchema } from "./patents.js";
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
