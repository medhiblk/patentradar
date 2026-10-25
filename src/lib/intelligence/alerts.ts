import { z } from "zod";
import { compare } from "../compare";
import { ReportSchema, type Profile } from "../model";
import type { PatentRecord } from "../providers/types";
const generic = new Set([
  "claim",
  "claims",
  "excerpt",
  "wherein",
  "comprising",
  "said",
  "least",
  "further",
  "module",
  "modules",
  "device",
  "devices",
  "apparatus",
  "method",
  "methods",
  "adapted",
  "provided",
  "feature",
]);
function publicLink(input: string) {
  try {
    const url = new URL(input);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export const SimilarityAlertSchema = z.object({
  id: z.string(),
  publicationNumber: z.string(),
  title: z.string(),
  source: z.string(),
  sourceUrl: z.string().url().refine(publicLink),
  retrievedAt: z.string(),
  evidenceBasis: z.enum(["claim text", "claim excerpts", "abstract"]),
  matches: z.array(
    z.object({
      feature: z.string(),
      excerpt: z.string(),
      terms: z.array(z.string()),
    }),
  ),
  legalStatusNotice: z.string().optional(),
  generatedAt: z.string(),
  acknowledged: z.boolean().default(false),
});
export type SimilarityAlert = z.infer<typeof SimilarityAlertSchema>;
function signature(input: string) {
  let n = 2166136261;
  for (const ch of input) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return (n >>> 0).toString(16);
}
/** Transparent lexical review signal. Never a probability of infringement or legal clearance. */
export function similarityAlerts(
  profile: Profile,
  patents: PatentRecord[],
  previous: SimilarityAlert[] = [],
  now = new Date().toISOString(),
): SimilarityAlert[] {
  const unique = new Map<string, SimilarityAlert>();
  for (const patent of patents) {
    const hasClaims = !!patent.claims?.some(
      (claim) => claim.trim().length >= 30,
    );
    if (
      patent.synthetic ||
      !publicLink(patent.sourceUrl) ||
      (!hasClaims && (patent.abstract || "").trim().length < 30)
    )
      continue;
    const comparison = compare(
      profile,
      hasClaims ? patent : { ...patent, claims: undefined },
    );
    const matches = comparison.matches
      .map((match) => ({
        feature: match.feature,
        excerpt: match.excerpt,
        terms: match.terms.filter(
          (term) => !generic.has(term) && !/^\d+$/.test(term),
        ),
      }))
      .filter((match) => match.terms.length >= 2);
    const meaningful = [...new Set(matches.flatMap((match) => match.terms))];
    if (matches.length < 2 || meaningful.length < 4) continue;
    const id =
      patent.publicationNumber + "-" + signature(JSON.stringify(matches));
    unique.set(patent.publicationNumber, {
      id,
      publicationNumber: patent.publicationNumber,
      title: patent.title,
      source: patent.source,
      sourceUrl: patent.sourceUrl,
      retrievedAt: patent.retrievedAt,
      evidenceBasis: hasClaims
        ? patent.claimsScope === "excerpts"
          ? "claim excerpts"
          : "claim text"
        : "abstract",
      matches,
      generatedAt: now,
      acknowledged: previous.some(
        (alert) => alert.id === id && alert.acknowledged,
      ),
      ...(patent.legalStatus
        ? {
            legalStatusNotice: `${patent.legalStatus.source} reports “${patent.legalStatus.label}” for this publication. Publisher-reported status is not independently verified; related rights require separate research.`,
          }
        : {}),
    });
  }
  return [...unique.values()];
}
export function savedAlerts(data: Record<string, unknown>): SimilarityAlert[] {
  const parsed = z
    .array(SimilarityAlertSchema)
    .max(50)
    .safeParse(data.similarityAlerts);
  return parsed.success ? parsed.data : [];
}
export function withResearchAlerts(
  data: Record<string, unknown>,
  old?: Record<string, unknown>,
) {
  const research = ReportSchema.safeParse(data.research);
  if (!research.success) return data;
  return {
    ...data,
    similarityAlerts: similarityAlerts(
      research.data.profile,
      research.data.patents,
      old ? savedAlerts(old) : [],
    ),
  };
}
