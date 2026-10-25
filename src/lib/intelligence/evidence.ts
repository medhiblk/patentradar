import type { PatentRecord } from "../providers/types";
import type { Profile } from "../model";
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
  return matches.map((match) => {
    const text = patent.claims?.[match.claim];
    if (
      !profile.technicalFeatures[match.feature] ||
      !text ||
      !match.quote ||
      !text.includes(match.quote)
    )
      throw new Error("AI evidence could not be verified");
    return {
      ...match,
      start: text.indexOf(match.quote),
      end: text.indexOf(match.quote) + match.quote.length,
      sourceUrl: passageSource(patent, match.quote).url,
      publicationNumber: patent.publicationNumber,
    };
  });
}
export function evidenceBasis(patent: PatentRecord) {
  return patent.claims?.some((claim) => claim.trim())
    ? patent.claimsScope === "excerpts"
      ? "Claim excerpts"
      : "Retrieved claim text"
    : patent.abstract?.trim()
      ? "Abstract only"
      : "Title only";
}
export function passageSource(patent: PatentRecord, excerpt: string) {
  const rows = patent.evidence || [];
  const exact = rows.find((row) => {
    const candidates = [
      row.fields.abstract,
      row.fields.title,
      ...(Array.isArray(row.fields.claims) ? row.fields.claims : []),
    ];
    return candidates.some(
      (value) => typeof value === "string" && value.includes(excerpt),
    );
  });
  // A single, explicitly marked reference excerpt has original PDF page provenance.
  const reference =
    rows.length === 1 && rows[0].fields.claimsScope === "excerpts"
      ? rows[0]
      : undefined;
  const match = exact || reference;
  if (match)
    return {
      source: match.source,
      url: match.sourceUrl,
      retrievedAt: match.retrievedAt,
      page:
        typeof match.fields.originalPage === "number"
          ? match.fields.originalPage
          : undefined,
      verified: true,
    };
  return {
    source: patent.source,
    url: patent.sourceUrl,
    retrievedAt: patent.retrievedAt,
    page: undefined,
    verified: !rows.length,
  };
}
