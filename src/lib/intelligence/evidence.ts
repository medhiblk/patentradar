import type { Profile } from "../model";
import type { PatentRecord } from "../providers/types";
export function comparisonEvidence(
  profile: Profile,
  patent: PatentRecord,
  matches: {
    feature: number;
    claim: number;
    quote: string;
    explanation: string;
  }[],
) {
  return matches.map((m) => {
    const text = patent.claims?.[m.claim];
    if (
      !profile.technicalFeatures[m.feature] ||
      !text ||
      !m.quote ||
      !text.includes(m.quote)
    )
      throw new Error("AI evidence could not be verified");
    return {
      ...m,
      start: text.indexOf(m.quote),
      end: text.indexOf(m.quote) + m.quote.length,
      sourceUrl: patent.sourceUrl,
      publicationNumber: patent.publicationNumber,
    };
  });
}
