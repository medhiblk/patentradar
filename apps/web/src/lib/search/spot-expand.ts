import { ResearchSchema } from "../model";
import { deduplicate } from "../normalize";
import { execute } from "./orchestrator";
import { spotDocument, type SpotInput, type SpotResult } from "./spot";
import type { PatentRecord } from "../providers/types";
import type { SourceRun, SearchTrace } from "./audit";

export type SpotExpansionEvent =
  | { type: "initial" | "complete"; result: SpotResult }
  | { type: "source"; source: SourceRun }
  | { type: "candidate"; patent: PatentRecord }
  | { type: "error"; message: string };

/** Uses the existing retrieval engine; only the approved query goes to providers. */
export async function expandSpot(
  input: SpotInput & { query: string },
  emit: (event: SpotExpansionEvent) => void,
): Promise<SpotResult> {
  const base = await spotDocument(input);
  emit({ type: "initial", result: base });
  const records: PatentRecord[] = [];
  const startedAt = new Date().toISOString();
  let trace: SearchTrace = { searchId: crypto.randomUUID(), context: "live-search", startedAt, providers: [], notQueried: [] };
  let papersRetrieved: number | null = 0;
  let warnings: string[] = [];
  const primary = base.identity.primary;
  const seeds = primary ? [{ publicationNumber: primary.publicationNumber,
    ...(primary.publicationDate ? { publicationDate: primary.publicationDate } : {}) }] : [];
  try {
    const research = await execute(ResearchSchema.parse({
      profile: base.profile, query: input.query, mode: "LIVE", consent: true,
      seedPublications: seeds,
    }), (event) => {
      if (event.searchTrace) trace = event.searchTrace;
      if (event.providerRun) {
        const index = trace.providers.findIndex(run => run.id === event.providerRun!.id);
        if (index >= 0) trace.providers[index] = event.providerRun;
        else trace.providers.push(event.providerRun);
        emit({ type: "source", source: event.providerRun });
      }
      if (event.candidate && !event.candidate.synthetic) {
        records.push(event.candidate);
        emit({ type: "candidate", patent: event.candidate });
      }
    }, AbortSignal.any([AbortSignal.timeout(40000), ...(input.signal ? [input.signal] : [])]));
    records.push(...research.patents);
    papersRetrieved = research.papers.length;
    warnings = research.warnings;
    if (research.searchTrace) trace = research.searchTrace;
  } catch {
    // A provider timeout must not discard the already visible evidence.
    input.signal?.throwIfAborted();
    papersRetrieved = null;
    warnings.push("Extended search interrupted or timed out. Retrieved evidence and the original index matches were retained.");
    for (const source of trace.providers) if (source.status === "running" || source.status === "queued") {
      source.status = "failed";
      source.message = "Search deadline reached before this source completed.";
      source.completedAt = new Date().toISOString();
      emit({ type: "source", source });
    }
  }
  const retrieved = deduplicate(records);
  const compared = await spotDocument({ ...input, consentToPublicLookup: false,
    additionalRecords: deduplicate([...base.matches.map(match => match.patent), ...retrieved]) });
  const queried = trace.providers.filter(run => run.startedAt);
  const result: SpotResult = {
    ...compared,
    lookupTraces: base.lookupTraces,
    liveSearch: { query: input.query, patentsRetrieved: retrieved.length, papersRetrieved,
      trace: { ...trace, completedAt: trace.completedAt || new Date().toISOString() } },
    warnings: [...new Set([...base.warnings.filter(w => !w.startsWith("No substantial match")), ...warnings,
      ...(!compared.matches.length ? ["No supported technical match in the retrieved evidence. This does not establish novelty or patent clearance."] : [])])],
    coverage: { indexedPatentCount: base.coverage.indexedPatentCount,
      queriedSources: [...new Set([...base.coverage.queriedSources, ...queried.map(run => run.name)])],
      mode: "reference-index-and-live-search",
      limitations: [
        "Extended search used the approved short query. Public source coverage is partial, including OpenAIRE’s literature-linked patent subset; this is not a complete worldwide search.",
        "Scientific publications are counted separately from patents. Retrieved candidates become technical matches only when available passages support an overlap.",
        "Ranking and comparisons are lexical, not an infringement probability or legal opinion. No full uploaded document text was sent to an external AI or public search provider.",
      ] },
  };
  emit({ type: "complete", result });
  return result;
}
