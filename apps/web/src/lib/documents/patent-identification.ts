import { patentSeed } from "../patent-seeds";

export type PatentIdentityEvidence = {
  page: number;
  quote: string;
  label?: string;
  basis: "source-text" | "visual-unverified";
};
export type PatentPublicationCandidate = {
  publicationNumber: string;
  jurisdiction: string;
  kindCode?: string;
  role: "document-publication" | "mentioned-reference";
  confidence: "high" | "medium" | "low";
  evidence: PatentIdentityEvidence[];
  publicationDate?: string;
  publicationDateEvidence?: PatentIdentityEvidence;
  title?: string;
  titleEvidence?: PatentIdentityEvidence;
};
export type PatentDocumentIdentity = {
  kind: "patent-publication" | "references-only" | "undetermined";
  basis: "source-text" | "visual-unverified";
  confidence: "high" | "medium" | "low";
  candidatePublications: PatentPublicationCandidate[];
  primary?: PatentPublicationCandidate;
  limitation: string;
};
export type PatentIdentityPage = { page: number; text: string; basis?: PatentIdentityEvidence["basis"] };

const references = /\(\s*56\s*\)|\[\s*56\s*\]|references\s+cited|(?:u\.?s\.?|foreign)\s+patent\s+documents|patent\s+documents\s+cited|cited\s+patent\s+(?:publications|references)/ig;
const patentHeader = /patent\s+application\s+publication|european\s+patent\s+(?:application|specification)|united\s+states\s+patent|patent\s+specification|brevet\s+europ[ée]en|offenlegungsschrift|专利申请|发明专利|特許公報|공개특허/i;
const ownNumberLabel = /(?:\(\s*(?:10|11)\s*\)\s*(?:(?:pub(?:lication)?\.?|patent)\s*(?:no\.?|number)\s*[:：]?\s*)?|(?:pub(?:lication)?\.?|patent)\s*(?:no\.?|number)\s*[:：]?\s*|num[ée]ro\s+de\s+publication\s*[:：]?\s*)$/i;
const publicationDateLabel = /\(\s*(43|45)\s*\)|\b(?:pub(?:lication)?\.?\s*date|date\s+of\s+(?:publication|patent)|date\s+de\s+publication|ver[öo]ffentlichungstag)\s*[:：]?/ig;
const titleLabel = /\(\s*54\s*\)\s*(?:(?:title|titre|bezeichnung)\s*[:：]?\s*)?/i;
const nextField = /\(\s*\d{2}\s*\)|\[\s*\d{2}\s*\]|\b(?:priority\s+date|date\s+of\s+priority|filing\s+date|application\s+date)\b/i;
const publicationPattern = /\b(EP|US|CN|JP|WO|KR|GB|DE|FR|CA|AU)\s*(\d(?:[\d \t,./-]|\r?\n(?=\s*\d)){3,44}\d)\s*([A-Z]\s*\d{0,2})?(?![a-zA-Z\d])/g;

function validDate(year: number, month: number, day: number) {
  const value = new Date(Date.UTC(year, month - 1, day));
  return year >= 1700 && year <= 2999 && value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day
    ? String(year).padStart(4, "0") + String(month).padStart(2, "0") + String(day).padStart(2, "0") : undefined;
}

function readDate(text: string): { value: string; end: number } | undefined {
  const iso = /(?<!\d)([12]\d{3})(?:[-./]?)([01]\d)(?:[-./]?)([0-3]\d)(?!\d)/g;
  for (const match of text.matchAll(iso)) {
    const value = validDate(Number(match[1]), Number(match[2]), Number(match[3]));
    if (value) return { value, end: match.index + match[0].length };
  }
  for (const match of text.matchAll(/(?<!\d)(\d{1,2})[./-](\d{1,2})[./-]([12]\d{3})(?!\d)/g)) {
    const value = validDate(Number(match[3]), Number(match[2]), Number(match[1]));
    if (value) return { value, end: match.index + match[0].length };
  }
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  for (const match of text.matchAll(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s*(\d{1,2}),?\s*([12]\d{3})\b/gi)) {
    const value = validDate(Number(match[3]), months.indexOf(match[1].slice(0, 3).toLowerCase()) + 1, Number(match[2]));
    if (value) return { value, end: match.index + match[0].length };
  }
}

function publicationDate(page: PatentIdentityPage, kindCode?: string) {
  const dates: { value: string; code: string; evidence: PatentIdentityEvidence }[] = [];
  for (const match of page.text.matchAll(publicationDateLabel)) {
    const start = match.index + match[0].length;
    let field = page.text.slice(start, start + 240);
    const following = field.search(nextField);
    if (following >= 0) field = field.slice(0, following);
    const parsed = readDate(field);
    if (parsed) dates.push({ value: parsed.value, code: match[1] || "publication-date", evidence: { page: page.page, quote: page.text.slice(match.index, start + parsed.end), label: match[0], basis: page.basis || "source-text" } });
  }
  if (!kindCode && new Set(dates.map(date => date.value)).size > 1) return;
  const preferred = dates.filter(date => date.code === (kindCode?.startsWith("B") || kindCode?.startsWith("C") ? "45" : "43"));
  const selected = preferred.length ? preferred : dates;
  return new Set(selected.map(date => date.value)).size === 1 ? selected[0] : undefined;
}

function publicationTitle(page: PatentIdentityPage) {
  const match = titleLabel.exec(page.text);
  if (!match) return;
  const start = match.index + match[0].length;
  const remainder = page.text.slice(start, start + 500);
  // Some PDF text layers emit a column of standalone INID markers before the
  // title and inventor text. Preserve the exact source, rather than guessing a title.
  const stacked = /^(?:\s*\(\s*\d{2}\s*\)\s*)+/.exec(remainder);
  if (stacked) {
    const afterLabels = remainder.slice(stacked[0].length);
    const boundary = afterLabels.search(/\b(?:inventors?|applicants?|assignees?|appl(?:ication)?\.?\s*no\.?|filed|related\s+u\.?s|publication\s+classification)\s*[:：]?/i);
    if (boundary > 0) {
      const rawTitle = afterLabels.slice(0, boundary);
      const title = rawTitle.replace(/\s+/g, " ").trim();
      if (title.length >= 3 && title.length <= 350) return { title, evidence: {
        page: page.page, quote: page.text.slice(match.index, start + stacked[0].length + rawTitle.length), label: match[0], basis: page.basis || "source-text",
      } satisfies PatentIdentityEvidence };
    }
    return;
  }
  const following = remainder.search(nextField);
  const raw = (following < 0 ? remainder.split(/\n\s*\n/)[0] : remainder.slice(0, following));
  const title = raw.replace(/\s+/g, " ").trim();
  // Without a field boundary, long prose is not a dependable title extraction.
  if (title.length < 3 || title.length > 350) return;
  return { title, evidence: { page: page.page, quote: page.text.slice(match.index, start + raw.length), label: match[0], basis: page.basis || "source-text" } satisfies PatentIdentityEvidence };
}

/** Identify a publication from its actual page text, never from the filename.
 * Numbers in bibliography/body text are discovery references, not this document's identity.
 * No kind code, date, title, retrieval or legal status is synthesized.
 */
export function identifyPatentDocument(input: PatentIdentityPage[]): PatentDocumentIdentity {
  const pages = input.filter(page => Number.isInteger(page.page) && page.page >= 1 && page.page <= 80 && typeof page.text === "string")
    .slice(0, 20).map(page => ({ ...page, text: page.text.slice(0, 8000) }));
  const candidates = new Map<string, PatentPublicationCandidate>();
  for (const page of pages) {
    const referenceStart = [...page.text.matchAll(references)][0]?.index ?? Infinity;
    const hasHeader = patentHeader.test(page.text);
    const hasTitle = titleLabel.test(page.text);
    const hasDate = [...page.text.matchAll(publicationDateLabel)].length > 0;
    for (const match of page.text.matchAll(publicationPattern)) {
      // EPO front pages also print a starred, zero-padded machine barcode.
      // It is not a second independently declared publication identifier.
      if (page.text[match.index - 1] === "*" && /^\s*\*/.test(page.text.slice(match.index + match[0].length))) continue;
      const digits = match[2].replace(/\D/g, "");
      if (digits.length < 5 || digits.length > 14) continue;
      const prefix = page.text.slice(Math.max(0, match.index - 180), match.index);
      if (/(?:\(\s*21\s*\)\s*(?:appl(?:ication)?\.?\s*(?:no\.?|number)\s*[:：]?\s*)?|appl(?:ication)?\.?\s*(?:no\.?|number)\s*[:：]?\s*)$/i.test(prefix)) continue;
      let parsed: ReturnType<typeof patentSeed>;
      try { parsed = patentSeed(match[1] + digits + (match[3] || "")); } catch { continue; }
      const field = [...prefix.matchAll(/\(\s*(\d{2})\s*\)/g)].at(-1)?.[1];
      const relatedField = field !== undefined && ["21", "22", "30", "31", "32", "33", "56", "60", "62", "63", "66", "86", "87"].includes(field);
      const relatedLabel = /(?:international|related|foreign|family)\s+(?:patent\s+)?publication\s*(?:no\.?|number)\s*[:：]?\s*$/i.test(prefix);
      const explicitOwn = ownNumberLabel.test(prefix) && !relatedField && !relatedLabel;
      const isReference = relatedField || relatedLabel || match.index >= referenceStart || /(?:cited|reference(?:d)?)\s+(?:(?:patent\s+)?pub(?:lication)?\.?\s*)?(?:no\.?|number)?\s*[:：]?\s*$/i.test(prefix);
      // A short cover/index may precede the actual patent front page. Multiple
      // different front-page identities remain ambiguous and never become primary.
      const frontPage = page.page <= 3;
      const frontNumber = frontPage && match.index < 120;
      const own = frontPage && !isReference && ((explicitOwn && (hasHeader || hasDate && hasTitle)) || frontNumber && hasHeader && hasDate && hasTitle);
      const basis = page.basis || "source-text";
      const confidence = own ? basis === "source-text" ? "high" : "medium" : explicitOwn && !isReference ? "medium" : "low";
      const evidence: PatentIdentityEvidence = { page: page.page, quote: page.text.slice(Math.max(0, match.index - (explicitOwn ? Math.min(prefix.length, 40) : 0)), match.index + match[0].length), basis, ...(explicitOwn ? { label: "publication-number" } : {}) };
      const candidate: PatentPublicationCandidate = { publicationNumber: parsed.publicationNumber, jurisdiction: parsed.jurisdiction,
        ...(parsed.kindCode ? { kindCode: parsed.kindCode } : {}), role: own ? "document-publication" : "mentioned-reference", confidence, evidence: [evidence] };
      if (own) {
        const date = publicationDate(page, parsed.kindCode || undefined);
        if (date) { candidate.publicationDate = date.value; candidate.publicationDateEvidence = date.evidence; }
        const title = publicationTitle(page);
        if (title) { candidate.title = title.title; candidate.titleEvidence = title.evidence; }
      }
      const existing = candidates.get(candidate.publicationNumber);
      if (!existing) {
        if (candidates.size < 50 || candidate.confidence === "high") candidates.set(candidate.publicationNumber, candidate);
      }
      else {
        const rank = { high: 3, medium: 2, low: 1 };
        const best = rank[candidate.confidence] > rank[existing.confidence] ? candidate : existing;
        const other = best === candidate ? existing : candidate;
        const merged = { ...best, evidence: [...best.evidence, ...other.evidence].slice(0, 8) };
        if (existing.confidence === "high" && candidate.confidence === "high" && existing.publicationDate && candidate.publicationDate && existing.publicationDate !== candidate.publicationDate) {
          delete merged.publicationDate; delete merged.publicationDateEvidence;
        }
        candidates.set(candidate.publicationNumber, merged);
      }
    }
  }
  const rank = { high: 3, medium: 2, low: 1 };
  const candidatePublications = [...candidates.values()].sort((a, b) => rank[b.confidence] - rank[a.confidence] || a.evidence[0].page - b.evidence[0].page).slice(0, 50);
  const primaryCandidates = candidatePublications.filter(candidate => candidate.role === "document-publication" && candidate.confidence === "high");
  const primary = primaryCandidates.length === 1 ? primaryCandidates[0] : undefined;
  const likelyOwn = candidatePublications.some(candidate => candidate.role === "document-publication");
  return {
    kind: primary || likelyOwn ? "patent-publication" : candidatePublications.length ? "references-only" : "undetermined",
    basis: primary ? "source-text" : pages.some(page => page.basis === "visual-unverified") ? "visual-unverified" : "source-text",
    confidence: primary ? "high" : likelyOwn ? "medium" : "low", candidatePublications, ...(primary ? { primary } : {}),
    limitation: primary ? "Identity extracted from the document front page; it does not establish official retrieval, legal status or ownership. Referenced publications are not automatically similar patents."
      : likelyOwn ? "Possible patent front page; its identity is ambiguous or visually unverified. Confirm the publication before using it as a search seed."
        : candidatePublications.length ? "Publication numbers were mentioned, but a unique source-document publication was not established. References are not proof of identity, similarity or infringement."
          : "No dependable publication identifier was found in the analyzed text. No filename, missing kind code or publication date was used to invent one.",
  };
}
