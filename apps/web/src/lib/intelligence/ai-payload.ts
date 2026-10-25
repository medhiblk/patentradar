import type { Profile } from "../model";
import type { PatentRecord } from "../providers/types";
import { compare } from "../compare";
import { evidenceBasis } from "./evidence";

/** Preserve original feature/claim indexes while sending only bounded relevant passages. */
export function aiEvidencePayload(operation: "compare" | "rerank", profile: Profile, patents: PatentRecord[]) {
  const selected = operation === "compare" ? patents.slice(0, 1) : patents;
  const evidence = selected.map((patent) => {
    const seen = new Set<number>();
    const passages = compare(profile, patent).matches.sort((a, b) => b.terms.length - a.terms.length)
      .flatMap((match) => {
        if (match.claimIndex === undefined || seen.has(match.claimIndex)) return [];
        seen.add(match.claimIndex);
        return [{ index: match.claimIndex, text: operation === "compare" ? match.excerpt : match.excerpt.slice(0, 400) }];
      }).slice(0, operation === "compare" ? 8 : 2);
    return { publicationNumber: patent.publicationNumber, title: patent.title.slice(0, 150), abstract: patent.abstract?.slice(0, 300),
      claims: passages, evidenceBasis: evidenceBasis(patent), passagesAreExcerpts: true };
  });
  return {
    profile: { title: profile.title, domain: profile.domain, operatingPrinciple: profile.operatingPrinciple.slice(0, 500),
      technicalFeatures: profile.technicalFeatures.map((feature, index) => ({ index, name: feature.name, description: feature.description.slice(0, 400) })) },
    evidence,
  };
}
