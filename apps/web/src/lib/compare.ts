import type { Profile } from "./model";
import type { PatentRecord } from "./providers/types";
import { evidenceBasis } from "./intelligence/evidence";
import { passageSource } from "./intelligence/evidence";
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
/** Keep every displayed match within an exact, bounded passage of the original. */
function relevantPassage(text: string, words: string[], sourceTerms: Set<string>) {
  const available = words.filter((word) => sourceTerms.has(word));
  const wanted = new Set(available);
  const starts = new Set<number>([0]);
  const limit = 1200;
  const first = text.slice(0, limit), firstTerms = new Set(tokens(first));
  let best = { excerpt: first, start: 0, end: first.length, hits: available.filter((word) => firstTerms.has(word)) };
  if (best.hits.length === available.length) return best;
  const located = new Set<string>();
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const raw = match[0], normalized = raw.normalize("NFKC").toLocaleLowerCase();
    const shared = tokens(raw).filter((word) => wanted.has(word) && !located.has(word));
    for (const word of shared) {
      located.add(word);
      const relative = normalized.length === raw.length ? normalized.indexOf(word) : 0;
      const offset = match.index! + Math.max(0, relative);
      starts.add(Math.max(0, offset - 120));
      starts.add(Math.max(0, offset + word.length - limit));
    }
    // Anchor one original occurrence per term; repetitive claims cannot cause
    // hundreds of redundant window scans for every feature.
    if (located.size === wanted.size || starts.size >= 600) break;
  }
  for (const start of starts) {
    const excerpt = text.slice(start, start + limit);
    const visible = new Set(tokens(excerpt));
    const hits = words.filter((word) => visible.has(word));
    if (hits.length > best.hits.length) best = { excerpt, start, end: start + excerpt.length, hits };
    if (best.hits.length === available.length) break;
  }
  return best;
}
export function compare(profile: Profile, patent: PatentRecord) {
  const claims = (patent.claims || []).map((text, claimIndex) => ({ text, claimIndex, evidenceField: "claim" as const })).filter((claim) => claim.text.trim());
  const evidence = (claims.length ? claims : [{ text: patent.abstract?.trim() ? patent.abstract : patent.title, evidenceField: patent.abstract?.trim() ? "abstract" as const : "title" as const, claimIndex: undefined }])
    .map((entry) => ({ ...entry, sourceTerms: new Set(tokens(entry.text)) }));
  const matches = profile.technicalFeatures.map((f) => {
    const words = tokens(f.name + " " + f.description);
    const best = evidence
      .map(({ text, claimIndex, evidenceField, sourceTerms }) => ({ ...relevantPassage(text, words, sourceTerms), claimIndex, evidenceField }))
      .sort((a, b) => b.hits.length - a.hits.length)[0];
    return {
      feature: f.name,
      excerpt: best.excerpt,
      start: best.start,
      end: best.end,
      claimIndex: best.claimIndex,
      evidenceField: best.evidenceField,
      sourceUrl: passageSource(patent, best.excerpt).url,
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
      : patent.abstract?.trim()
        ? "Comparison based on bibliographic information and abstract only."
        : "Title-only comparison. Abstract and claims are unavailable; technical similarity cannot be established.",
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
    basis: evidenceBasis(patent),
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
