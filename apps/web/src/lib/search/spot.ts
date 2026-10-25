import { ProfileSchema, type Profile } from "../model";
import type { PatentRecord } from "../providers/types";
import { identifyPatentDocument, type PatentDocumentIdentity, type PatentIdentityPage } from "../documents/patent-identification";
import { publicReferencePatents } from "../patents/reference-corpus";
import { compare, tokens } from "../compare";
import { passageSource } from "../intelligence/evidence";
import { deduplicate } from "../normalize";
import { lookup } from "../providers/epo-publication";
import { sourceRun } from "./source-runs";
import type { SourceRun } from "./audit";
import { withSearchSignal } from "./scope";
import { withRequestTrace } from "./request-trace";

export type SpotEvidence = {
  inputPage: number; inputExcerpt: string; inputStart: number; inputEnd: number;
  sourceExcerpt: string; sourceUrl: string; sourceRetrievedAt: string; sourceStart: number; sourceEnd: number;
  claimIndex?: number; evidenceField: "claim" | "abstract" | "title" | "publication-number";
  terms: string[]; kind: "verbatim" | "lexical";
};
export type SpotMatch = {
  patent: PatentRecord; matchType: "same-publication" | "technical-overlap"; relevance: number;
  evidence: SpotEvidence[]; explanation: string; limitations: string[];
};
export type SpotResult = {
  identity: PatentDocumentIdentity; profile: Profile; matches: SpotMatch[];
  coverage: { indexedPatentCount: number; queriedSources: string[]; mode: "reference-index" | "reference-index-and-live-lookup"; limitations: string[] };
  lookupTraces: SourceRun[]; warnings: string[];
};
export type SpotEvent = { type: "indexed-results" | "lookup-started" | "lookup-finished" | "completed"; matches?: SpotMatch[]; lookupTrace?: SourceRun };
export type SpotInput = { pages: PatentIdentityPage[]; profile?: Profile; consentToPublicLookup?: boolean; signal?: AbortSignal };

const generic = new Set("claim claims claimed wherein comprising comprises thereof therewith said present invention inventions description described according least first second third fourth apparatus device devices method methods system systems application publication patent document number figure figures drawing drawings feature features section reference references technical embodiment embodiments invention including includes include provided provides having plurality further respectively therefore thereby suitable used use such also well another each more may might should could would other only into onto example examples without within between shown means associated substantially particular particularly based relates relate consists consisting together through these those while whether about their which been being have after before under over during same than both either neither and the for with from that this are was were will can has its not any one two all our you your purpose following comprises provide form forms among accordance respectively".split(/\s+/));
const meaningful = (text: string) => tokens(text).filter(term => !generic.has(term) && !/\d/.test(term));
type Word = { value: string; start: number; end: number; normalizedStart: number };
function wordIndex(text: string) {
  const words: Word[] = [];
  let normalized = " ";
  for (const match of text.matchAll(/[\p{L}\p{N}]+(?:-\s*\n\s*[\p{L}\p{N}]+)*/gu)) {
    const value = match[0].replace(/-\s*\n\s*/g, "").normalize("NFKC").toLocaleLowerCase();
    words.push({ value, start: match.index, end: match.index + match[0].length, normalizedStart: normalized.length });
    normalized += value + " ";
  }
  return { words, normalized };
}
type PageIndex = ReturnType<typeof wordIndex> & PatentIdentityPage;
type Passage = { page: number; quote: string; start: number; end: number };

function documentPassages(pages: PatentIdentityPage[], vocabulary: Map<string, number>) {
  const passages: (Passage & { weight: number })[] = [];
  for (const page of pages) {
    for (let start = 0; start < page.text.length; start += 950) {
      const quote = page.text.slice(start, start + 1200);
      if (quote.trim().length < 30) continue;
      const words = meaningful(quote);
      const weight = words.reduce((sum, term) => sum + (vocabulary.has(term) ? 1 / (vocabulary.get(term)! + 1) : 0), 0);
      passages.push({ page: page.page, quote, start, end: start + quote.length, weight });
    }
  }
  return passages.sort((a, b) => b.weight - a.weight).slice(0, 8);
}

function phraseEvidence(patent: PatentRecord, pages: PageIndex[]): SpotEvidence[] {
  const fields = [
    ...(patent.claims || []).map((text, claimIndex) => ({ text, claimIndex, evidenceField: "claim" as const })),
    ...(patent.abstract ? [{ text: patent.abstract, claimIndex: undefined, evidenceField: "abstract" as const }] : []),
  ];
  const found: SpotEvidence[] = [];
  for (const field of fields) {
    const indexed = wordIndex(field.text);
    if (indexed.words.length < 12) continue;
    const length = Math.min(24, indexed.words.length);
    const offsets = [...new Set([0, Math.floor((indexed.words.length - length) / 2), indexed.words.length - length])];
    for (const offset of offsets) {
      const selected = indexed.words.slice(offset, offset + length);
      const sourceStart = selected[0].start, sourceEnd = selected.at(-1)!.end;
      const sourceExcerpt = field.text.slice(sourceStart, sourceEnd);
      const terms = meaningful(sourceExcerpt);
      if (terms.length < 5) continue;
      const needle = " " + selected.map(word => word.value).join(" ") + " ";
      for (const page of pages) {
        const match = page.normalized.indexOf(needle);
        if (match < 0) continue;
        const first = page.words.findIndex(word => word.normalizedStart === match + 1);
        if (first < 0) continue;
        const inputStart = page.words[first].start, inputEnd = page.words[first + selected.length - 1].end;
        const source = passageSource(patent, sourceExcerpt);
        found.push({ inputPage: page.page, inputExcerpt: page.text.slice(inputStart, inputEnd), inputStart, inputEnd,
          sourceExcerpt, sourceUrl: source.url, sourceRetrievedAt: source.retrievedAt, sourceStart, sourceEnd,
          claimIndex: field.claimIndex, evidenceField: field.evidenceField, terms, kind: "verbatim" });
        break;
      }
      if (found.length >= 6) return found;
    }
  }
  return found;
}

function rankReferences(records: PatentRecord[], pages: PatentIdentityPage[], identity: PatentDocumentIdentity) {
  const vocabulary = new Map<string, number>();
  for (const record of records) for (const term of meaningful([record.title, record.abstract || "", ...(record.claims || [])].join(" ")))
    vocabulary.set(term, (vocabulary.get(term) || 0) + 1);
  const passages = documentPassages(pages, vocabulary);
  if (!passages.length) throw new Error("No substantive technical passage could be read from this document.");
  const comparisonProfile: Profile = { title: "Uploaded technical source", domain: "Source-text comparison", operatingPrinciple: "Literal source passages, not inferred technical facts.",
    technicalFeatures: passages.map((passage, index) => ({ name: "Source passage " + (index + 1), description: passage.quote })), searchKeywords: [] };
  const indexedPages = pages.map(page => ({ ...page, ...wordIndex(page.text) }));
  const queryTerms = new Set(passages.flatMap(passage => meaningful(passage.quote)));
  const weight = (term: string) => 1 + Math.log(1 + records.length / (1 + (vocabulary.get(term) || 0)));
  const queryWeight = [...queryTerms].reduce((sum, term) => sum + weight(term), 0) || 1;
  const matches: SpotMatch[] = [];
  for (const patent of records) {
    const verbatim = phraseEvidence(patent, indexedPages);
    const distinctFields = new Set(verbatim.map(evidence => evidence.evidenceField + ":" + (evidence.claimIndex ?? "abstract")));
    const fromHeader = identity.primary?.publicationNumber === patent.publicationNumber;
    const recognizedText = distinctFields.size >= 2 && new Set(verbatim.flatMap(evidence => evidence.terms)).size >= 10;
    const comparison = compare(comparisonProfile, patent);
    const lexical: SpotEvidence[] = comparison.matches.flatMap((match, index) => {
      const terms = match.terms.filter(term => !generic.has(term) && !/\d/.test(term));
      if (terms.length < 2) return [];
      const input = passages[index];
      return [{ inputPage: input.page, inputExcerpt: input.quote, inputStart: input.start, inputEnd: input.end,
        sourceExcerpt: match.excerpt, sourceUrl: match.sourceUrl, sourceRetrievedAt: passageSource(patent, match.excerpt).retrievedAt,
        sourceStart: match.start, sourceEnd: match.end, claimIndex: match.claimIndex, evidenceField: match.evidenceField, terms, kind: "lexical" as const }];
    }).sort((a, b) => b.terms.reduce((sum, term) => sum + weight(term), 0) - a.terms.reduce((sum, term) => sum + weight(term), 0)).slice(0, 3);
    const shared = new Set(lexical.flatMap(evidence => evidence.terms));
    const distinctive = [...shared].filter(term => (vocabulary.get(term) || 0) <= Math.max(2, Math.ceil(records.length * 0.65)));
    if (!fromHeader && !recognizedText && (shared.size < 4 || distinctive.length < 2)) continue;
    const technicalScore = Math.round(Math.min(100, 100 * [...shared].reduce((sum, term) => sum + weight(term), 0) / queryWeight));
    const evidence = fromHeader && identity.primary ? [...verbatim, ...lexical].slice(0, 6) : recognizedText ? verbatim : lexical;
    if (fromHeader && identity.primary) {
      const header = identity.primary.evidence[0];
      const page = pages.find(page => page.page === header.page);
      const start = page?.text.indexOf(header.quote) ?? -1;
      if (page && start >= 0) evidence.unshift({ inputPage: header.page, inputExcerpt: header.quote, inputStart: start, inputEnd: start + header.quote.length,
        sourceExcerpt: patent.publicationNumber, sourceUrl: patent.sourceUrl, sourceRetrievedAt: patent.retrievedAt, sourceStart: 0, sourceEnd: patent.publicationNumber.length,
        evidenceField: "publication-number", terms: [patent.publicationNumber], kind: "verbatim" });
    }
    matches.push({ patent, matchType: fromHeader || recognizedText ? "same-publication" : "technical-overlap", relevance: fromHeader || recognizedText ? 100 : technicalScore,
      evidence, explanation: fromHeader ? "A publication number read from the actual front page matches a retrieved or indexed public patent record. This identifies the document; it is not a technical conflict score."
        : recognizedText ? "Multiple substantial source passages reproduce wording from distinct indexed abstract/claim sections. This recognizes existing publication text, not semantic novelty or infringement."
          : "Shared technical terms occur in the uploaded passages and the indexed patent evidence. Ranking is lexical, not semantic or a legal conclusion.",
      limitations: ["This is a bounded reference-corpus comparison, not a complete worldwide prior-art or freedom-to-operate search.",
        ...(fromHeader ? ["Publication identity is extracted metadata; an exact-file or complete-document identity check was not performed."] : []),
        ...(patent.claims?.length ? [patent.claimsScope === "excerpts" ? "Only indexed claim excerpts were compared." : "Claims must be interpreted and legal status checked separately."] : ["Claims unavailable: comparison uses abstract or title only."])] });
  }
  return { matches: matches.sort((a, b) => Number(b.matchType === "same-publication") - Number(a.matchType === "same-publication") || b.relevance - a.relevance).slice(0, 10), passages, vocabulary };
}

/** Immediate public-index evidence first; optional exact lookup never invokes literature jobs. */
export async function spotDocument(input: SpotInput, onUpdate?: (event: SpotEvent) => void): Promise<SpotResult> {
  input.signal?.throwIfAborted();
  const eligible = input.pages.filter(page => Number.isInteger(page.page) && page.page >= 1 && page.page <= 80 && typeof page.text === "string" && page.text.trim());
  let remaining = 60000;
  const pages = eligible.slice(0, 20).flatMap(page => {
    if (remaining <= 0) return [];
    const text = page.text.slice(0, remaining);
    remaining -= text.length;
    return [{ ...page, text }];
  });
  const truncated = eligible.length > 20 || eligible.slice(0, 20).reduce((sum, page) => sum + page.text.length, 0) > 60000;
  if (!pages.length || pages.reduce((sum, page) => sum + page.text.trim().length, 0) < 30) throw new Error("No readable technical source text. Add text or use OCR for a scanned document.");
  const identity = identifyPatentDocument(pages);
  let records = deduplicate(publicReferencePatents().filter(record => !record.synthetic));
  const indexedPatentCount = records.length;
  let ranked = rankReferences(records, pages, identity);
  const profile = input.profile ? ProfileSchema.parse(input.profile) : ProfileSchema.parse({ title: (identity.primary?.title || "Uploaded technical document").slice(0, 200),
    domain: "Review required — extracted source passages", operatingPrinciple: ranked.passages[0]?.quote.slice(0, 1500) || pages[0].text.slice(0, 1500),
    technicalFeatures: ranked.passages.map((passage, index) => ({ name: "Source passage " + (index + 1), description: passage.quote })),
    searchKeywords: [...new Set(ranked.passages.flatMap(passage => meaningful(passage.quote)))].filter(term => ranked.vocabulary.has(term)).slice(0, 8) });
  const lookupTraces: SourceRun[] = [], warnings: string[] = truncated ? ["Only the first 20 supplied pages and 60,000 source characters were compared; later content was not analysed."] : [];
  onUpdate?.({ type: "indexed-results", matches: ranked.matches });
  const primary = identity.primary;
  if (input.consentToPublicLookup && primary?.jurisdiction === "EP" && /^[AB]\d$/.test(primary.kindCode || "") && primary.publicationDate && !records.some(record => record.publicationNumber === primary.publicationNumber && record.claims?.length)) {
    const run: SourceRun = { ...sourceRun("EPO " + primary.publicationNumber, [primary.publicationNumber]), status: "running", startedAt: new Date().toISOString() };
    lookupTraces.push(run); onUpdate?.({ type: "lookup-started", lookupTrace: structuredClone(run) });
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    const signal = AbortSignal.any([controller.signal, ...(input.signal ? [input.signal] : [])]);
    let abort: () => void = () => {};
    try {
      const cancelled = new Promise<never>((_, reject) => { abort = () => reject(new Error("Exact lookup timed out or was cancelled.")); signal.addEventListener("abort", abort, { once: true }); });
      const returned = await Promise.race([withRequestTrace(run.requests, () => withSearchSignal(signal, () => lookup(primary.publicationNumber, primary.publicationDate))), cancelled]);
      records = deduplicate([...records, ...returned]);
      run.status = returned.length ? "succeeded" : "empty"; run.patentsRetrieved = returned.length; run.patentNumbers = returned.map(record => record.publicationNumber);
      ranked = rankReferences(records, pages, identity);
    } catch { run.status = "failed"; run.message = "Exact EPO lookup unavailable; indexed results retained."; warnings.push(run.message); }
    finally { clearTimeout(timer); signal.removeEventListener("abort", abort); run.completedAt = new Date().toISOString(); onUpdate?.({ type: "lookup-finished", lookupTrace: structuredClone(run), matches: ranked.matches }); }
  }
  input.signal?.throwIfAborted();
  if (pages.some(page => page.basis === "visual-unverified")) warnings.push("OCR-derived source text requires visual validation against the uploaded pages.");
  if (!ranked.matches.length) warnings.push("No substantial match in this limited public index. This does not mean the invention is new or free to manufacture.");
  const result: SpotResult = { identity, profile, matches: ranked.matches, lookupTraces, warnings,
    coverage: { indexedPatentCount, queriedSources: ["Indexed public medtech reference corpus", ...new Set(lookupTraces.map(run => run.name))],
      mode: lookupTraces.length ? "reference-index-and-live-lookup" : "reference-index",
      limitations: ["Publicly sourced indexed patent records only; this is not a live worldwide patent keyword search.", "Same-publication recognition is separate from technical overlap. Scores are lexical/index-recognition signals, never infringement probabilities.",
        "No uploaded document text was sent to a third-party AI or scientific service."] } };
  onUpdate?.({ type: "completed", matches: result.matches });
  return result;
}
