import type { Profile } from "./model";
import type { PatentRecord } from "./providers/types";
const stop = new Set([
  "with",
  "that",
  "this",
  "from",
  "into",
  "using",
  "system",
  "between",
  "through",
  "their",
  "and",
  "the",
  "for",
  "you",
  "your",
  "ours",
  "them",
  "they",
  "what",
  "that",
  "this",
  "can",
  "are",
  "has",
  "have",
]);
export const tokens = (input: string) => {
  const text = input.normalize("NFKC").toLocaleLowerCase();
  const words = (text.match(/[\p{L}\p{N}]+/gu) || []).flatMap((word) => {
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(word)) {
      const chars = Array.from(word);
      return chars.length < 2
        ? []
        : chars.slice(0, -1).map((c, i) => c + chars[i + 1]);
    }
    return word.length >= (/\p{Script=Hangul}/u.test(word) ? 2 : 3)
      ? [word]
      : [];
  });
  return [...new Set(words)].filter((word) => !stop.has(word));
};
export function compare(profile: Profile, patent: PatentRecord) {
  const claims = patent.claims?.filter(Boolean) || [];
  const evidence = claims.length ? claims : [patent.abstract || patent.title];
  const indexedEvidence = evidence.map((excerpt) => ({
    excerpt,
    terms: new Set(tokens(excerpt)),
  }));
  const matches = profile.technicalFeatures.map((f) => {
    const words = tokens(f.name + " " + f.description);
    const best = indexedEvidence
      .map(({ excerpt, terms }) => ({
        excerpt,
        hits: words.filter((w) => terms.has(w)),
      }))
      .sort((a, b) => b.hits.length - a.hits.length)[0];
    return {
      feature: f.name,
      excerpt: best.excerpt.slice(0, 1200),
      terms: best.hits,
      strength:
        best.hits.length >= 3
          ? "Moderate"
          : best.hits.length
            ? "Weak"
            : "No lexical match",
      explanation: best.hits.length
        ? `Shared terminology: ${best.hits.join(", ")}. Functional equivalence requires expert review.`
        : "No shared terminology identified. This does not establish technical difference or clearance.",
    };
  });
  return {
    score: Math.round(
      (100 *
        matches.reduce((sum, m, i) => {
          const f = profile.technicalFeatures[i];
          const count = tokens(f.name + " " + f.description).length;
          return sum + (count ? m.terms.length / count : 0);
        }, 0)) /
        profile.technicalFeatures.length,
    ),
    matches,
    limitation: claims.length
      ? "Lexical claim comparison only; claim construction and legal status are not assessed."
      : "Comparison based on bibliographic information and abstract only.",
  };
}
export function queries(profile: Profile) {
  return [...new Set(profile.searchKeywords.filter(Boolean))].slice(0, 6);
}

export function triage(profile: Profile, patent: PatentRecord) {
  const c = compare(profile, patent);
  const terms = [...new Set(c.matches.flatMap((m) => m.terms))];
  const enough = terms.length >= 3;
  return {
    priority: enough
      ? "Technical review recommended"
      : terms.length
        ? "Weak signal — inspect before shortlisting"
        : "No meaningful lexical signal",
    basis: patent.claims?.length
      ? "Retrieved claim text"
      : "Title / abstract only",
    caution: enough
      ? "Shared technical vocabulary warrants closer review; it does not establish identical functionality or infringement."
      : "Evidence is insufficient to treat this result as a close technical match.",
    applicant: patent.applicants.length
      ? `Applicant to investigate: ${patent.applicants.join(", ")}. Competitor status is unconfirmed.`
      : "Applicant unavailable. No competitor can be identified from this record.",
    differences: c.matches
      .filter((m) => m.terms.length === 0)
      .map((m) => m.feature),
    terms,
  };
}
