import type { Research } from "../model";
import type { PatentRecord } from "../providers/types";
import type { Profile } from "../model";
import { compare } from "../compare";

export type PatentRankingEntry = { publicationNumber: string; reason: string };

export function rankPatentsLexically(profile: Profile, patents: PatentRecord[]) {
  const scored = patents.map((patent) => ({ patent, score: compare(profile, patent).score,
    quality: patent.claims?.some((claim) => claim.trim()) ? 2 : patent.abstract?.trim() ? 1 : 0 }));
  return scored.sort((a, b) => b.score - a.score || b.quality - a.quality || a.patent.publicationNumber.localeCompare(b.patent.publicationNumber)).map(({ patent }) => patent);
}

/** A reranker may change order, never add, remove or duplicate supplied records. */
export function validatePatentRanking(patents: PatentRecord[], entries: PatentRankingEntry[]) {
  const ids = new Set(patents.map((patent) => patent.publicationNumber));
  if (ids.size !== patents.length || entries.length !== ids.size || new Set(entries.map((entry) => entry.publicationNumber)).size !== entries.length ||
      entries.some((entry) => !ids.has(entry.publicationNumber) || !entry.reason.trim()))
    throw new Error("Ranking must include every supplied publication exactly once with an explanation.");
  return entries;
}

export function applyPatentRanking(report: Research, entries: PatentRankingEntry[], appliedAt = new Date().toISOString()): Research {
  validatePatentRanking(report.patents, entries);
  const byId = new Map(report.patents.map((patent) => [patent.publicationNumber, patent]));
  return {
    ...report,
    patents: entries.map((entry) => byId.get(entry.publicationNumber)!),
    ranking: { method: "ai-assisted", entries, appliedAt },
  };
}

/** Async AI results must never overwrite candidates/profile from a newer run. */
export function applyRankingIfCurrent(current: Research | null, expected: Research, entries: PatentRankingEntry[]): Research | null {
  if (!current) return current;
  const signature = (report: Research) => JSON.stringify({ profile: report.profile, searchId: report.searchTrace?.searchId,
    candidates: report.patents.map((patent) => [patent.publicationNumber, patent.retrievedAt]).sort((a, b) => a[0].localeCompare(b[0])) });
  if (signature(current) !== signature(expected)) return current;
  // Invalid server output also leaves existing evidence untouched rather than
  // throwing within a React functional state updater.
  try { return applyPatentRanking(current, entries); } catch { return current; }
}
