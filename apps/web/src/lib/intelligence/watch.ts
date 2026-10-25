import { z } from "zod";
import type { Research } from "../model";
import { normalizePublication } from "../normalize";
import { mergeSimilarityAlerts, savedAlerts, similarityAlerts } from "./alerts";

export const WatchObservationSchema = z.object({
  publicationNumber: z.string(),
  firstSeenAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  publicationDate: z.string().optional(),
});
export type WatchObservation = z.infer<typeof WatchObservationSchema>;
export type WatchCheckSummary = {
  status: "fresh" | "partial" | "cached" | "failed" | "local-only" | "unknown";
  patentSourcesAttempted: number;
  patentSourcesSucceeded: number;
  sourcesFailed: number;
  networkResponses: number;
  cachedResponses: number;
  firstObserved: number;
  newDiscoveries: number;
  recentPublications: string[];
  recentSince: string;
  baselineCreated: boolean;
};
function normalized(value: unknown) {
  if (typeof value !== "string") return null;
  try { return normalizePublication(value); } catch { return null; }
}
function publicationTime(value?: string) {
  const iso = value?.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return NaN;
  const time = Date.parse(iso + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === iso ? time : NaN;
}

export function watchCoverage(result: Research) {
  const providers = result.searchTrace?.providers;
  const patentSources = providers?.filter(source => ["patent", "mixed"].includes(source.category)) || [];
  const successful = patentSources.filter(source => ["succeeded", "empty"].includes(source.status));
  const requests = successful.flatMap(source => source.requests);
  const networkResponses = requests.filter(request => request.servedFrom === "network" && !request.errorCode && (request.httpStatus || 0) >= 200 && (request.httpStatus || 0) < 400).length;
  const cachedResponses = requests.filter(request => request.servedFrom !== "network").length;
  const sourcesFailed = patentSources.filter(source => source.status === "failed").length;
  const status: WatchCheckSummary["status"] = !providers ? "unknown"
    : !patentSources.length ? "local-only"
      : !successful.length ? "failed"
        : networkResponses ? successful.length < patentSources.length ? "partial" : "fresh"
          : cachedResponses ? "cached" : "unknown";
  return { status, patentSourcesAttempted: patentSources.length, patentSourcesSucceeded: successful.length, sourcesFailed, networkResponses, cachedResponses };
}

/** Merge against the latest stored item, never the pre-search snapshot. */
export function mergeWatchResult(stored: Record<string, unknown>, result: Research, now = new Date().toISOString()) {
  const known = new Map<string, WatchObservation>();
  const parsed = z.array(WatchObservationSchema).max(2000).safeParse(stored.observations);
  for (const observation of parsed.success ? parsed.data : []) {
    const number = normalized(observation.publicationNumber);
    if (number) known.set(number, { ...observation, publicationNumber: number });
  }
  for (const number of Array.isArray(stored.publications) ? stored.publications : []) {
    const publicationNumber = normalized(number);
    if (publicationNumber && !known.has(publicationNumber))
      known.set(publicationNumber, { publicationNumber, firstSeenAt: null, lastSeenAt: null });
  }
  const initialBaseline = stored.baselineInitialized !== true && known.size === 0;
  const discovered = new Set<string>();
  const previousCheck = typeof stored.lastChecked === "string" ? Date.parse(stored.lastChecked) : NaN;
  // Publication metadata usually has day precision; do not invent a publication time.
  const recentAfter = Number.isFinite(previousCheck)
    ? Date.parse(new Date(previousCheck).toISOString().slice(0, 10) + "T00:00:00Z")
    : Date.parse(now.slice(0, 10) + "T00:00:00Z") - 7 * 86400000;
  const recentPublications = new Set<string>();
  for (const patent of result.patents) {
    const publicationNumber = normalized(patent.publicationNumber);
    if (!publicationNumber || patent.synthetic) continue;
    const previous = known.get(publicationNumber);
    if (!previous) discovered.add(publicationNumber);
    known.set(publicationNumber, {
      publicationNumber,
      firstSeenAt: previous ? previous.firstSeenAt : now,
      lastSeenAt: now,
      ...(patent.publicationDate ? { publicationDate: patent.publicationDate } : previous?.publicationDate ? { publicationDate: previous.publicationDate } : {}),
    });
    const publicationDate = publicationTime(patent.publicationDate);
    if (publicationDate >= recentAfter && publicationDate <= Date.parse(now)) recentPublications.add(publicationNumber);
  }
  if (known.size > 2000) throw new Error("Watch publication history reached 2000 entries. Export and start another watch.");
  const coverage = watchCoverage(result);
  const newDiscoveries = initialBaseline ? [] : [...discovered];
  const checkSummary: WatchCheckSummary = {
    ...coverage, firstObserved: discovered.size, newDiscoveries: newDiscoveries.length,
    recentPublications: [...recentPublications], recentSince: new Date(recentAfter).toISOString(),
    baselineCreated: initialBaseline && (known.size > 0 || coverage.patentSourcesSucceeded > 0),
  };
  const previousAlerts = savedAlerts(stored);
  return {
    ...stored,
    publications: [...known.keys()],
    observations: [...known.values()],
    baselineInitialized: stored.baselineInitialized === true || known.size > 0 || coverage.patentSourcesSucceeded > 0,
    ...(coverage.status !== "failed" ? { lastResult: result } : {}),
    similarityAlerts: mergeSimilarityAlerts(previousAlerts, similarityAlerts(result.profile, result.patents, previousAlerts, now)),
    lastAttemptedAt: now,
    ...(coverage.networkResponses > 0 ? { lastChecked: now, lastConfirmedCheckAt: now } : {}),
    checkSummary,
    discoveries: newDiscoveries,
  };
}
