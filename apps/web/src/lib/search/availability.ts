import type { Research } from "../model";

/** Runtime observations, not the number of catalogued APIs or scientific results. */
export function searchAvailability(report: Research) {
  const runs = report.searchTrace?.providers || [];
  const patentSources = runs.filter((run) => ["patent", "mixed", "local"].includes(run.category));
  const remoteSources = patentSources.filter((run) => run.category !== "local");
  const relevantSources = remoteSources.length ? remoteSources : patentSources;
  const pending = relevantSources.some((run) => run.status === "running" || run.status === "queued");
  const successful = relevantSources.filter((run) => run.status === "succeeded" || run.status === "empty");
  const claimsAvailable = report.patents.filter((patent) => patent.claims?.some((claim) => claim.trim())).length;
  const abstractAvailable = report.patents.filter((patent) => patent.abstract?.trim()).length;
  const outcome = report.patents.length ? "patents-found" as const : pending ? "search-in-progress" as const :
    !patentSources.length ? "no-patent-source-planned" as const : !successful.length ? "patent-sources-unavailable" as const : "no-patents-in-returned-sample" as const;
  const messages = {
    "patents-found": `${report.patents.length} patent publications retrieved; ${claimsAvailable} with claim text or excerpts. Source coverage remains partial.`,
    "search-in-progress": "Patent sources are still being queried. Scientific results are shown separately.",
    "no-patent-source-planned": "No patent source was available for this search configuration. This is not a search of worldwide patents.",
    "patent-sources-unavailable": "The planned patent sources were unavailable. No conclusion about existing patents can be drawn.",
    "no-patents-in-returned-sample": "No patent records were returned by the searched subset. This does not establish novelty or permission to build.",
  };
  return { outcome, message: messages[outcome], patentSources, scientificSources: runs.filter((run) => run.category === "research"),
    claimsAvailable, abstractAvailable, titleOnly: report.patents.filter((patent) => !patent.abstract?.trim() && !patent.claims?.some((claim) => claim.trim())).length };
}
