"use client";
import type { SearchTrace } from "@/lib/search/audit";
import type { PatentRecord } from "@/lib/providers/types";
const statuses = {
  queued: "Queued",
  running: "Checking…",
  succeeded: "Results received",
  empty: "No records returned",
  failed: "Unavailable",
};
const methods = {
  "keyword-search": "Keyword search",
  "publication-lookup": "Publication lookup",
  "local-index": "Local index",
  "reference-snapshot": "Preselected reference",
};
export function SearchProvenance({
  trace,
  patents = [],
  onInspect,
  active = false,
}: {
  trace?: SearchTrace;
  patents?: PatentRecord[];
  onInspect?: (patent: PatentRecord) => void;
  active?: boolean;
}) {
  return (
    <section
      className="search-provenance"
      aria-label="Search sources and analysed patents"
    >
      <div className="evidence-section-heading">
        <div>
          <span className="product-kicker">FOLLOW THE RESEARCH</span>
          <h2>Where we searched</h2>
        </div>
        {trace && (
          <span className="evidence-pill">
            {trace.context === "known-reference"
              ? "Known reference · no database search"
              : trace.completedAt
                ? "Search completed"
                : active
                  ? "Search in progress"
                  : "Partial search history"}
          </span>
        )}
      </div>
      {!trace ? (
        <p className="hint">
          A database execution history was not recorded for this older analysis.
          Only the retrieved record sources below can be verified; no other
          database search is implied.
        </p>
      ) : (
        <>
          <p>
            {trace.context === "known-reference"
              ? "This case analyses the real publication selected in advance. Its PDF and claim excerpts are a verified snapshot; no worldwide search or BigQuery query was run."
              : "Sources below belong to this analysis. Patent databases and scientific literature are shown separately. A source can return no records or fail without stopping the others."}
          </p>
          <div className="source-run-list">
            {trace.providers.map((run) => (
              <article className="source-run" key={run.id}>
                <div className="source-run-heading">
                  <div>
                    <strong>{run.name}</strong>
                    <p>
                      {run.category === "research"
                        ? "Scientific prior art"
                        : run.category === "mixed"
                          ? "Patent metadata + literature"
                          : run.category === "local"
                            ? "Previously sourced records"
                            : run.category === "reference"
                              ? "Reference snapshot"
                              : "Patent data"}{" "}
                      · {methods[run.method]}
                    </p>
                  </div>
                  <span className={"source-run-status status-" + run.status}>
                    {!active && !trace.completedAt && run.status === "running"
                      ? "Interrupted"
                      : !active && !trace.completedAt && run.status === "queued"
                        ? "Not started"
                        : statuses[run.status]}
                  </span>
                </div>
                <div className="source-run-counts">
                  {run.patentsRetrieved} patent records · {run.papersRetrieved}{" "}
                  scientific records
                  {run.elapsedMs !== undefined && (
                    <> · {(run.elapsedMs / 1000).toFixed(1)} s</>
                  )}
                </div>
                {run.message && (
                  <p className="source-run-error">{run.message}</p>
                )}
                <details>
                  <summary>Queries, access and coverage</summary>
                  <p>{run.coverage}</p>
                  <p>
                    Reviewed queries:{" "}
                    {run.queries.join(" · ") || "No query recorded"}
                  </p>
                  {run.startedAt && (
                    <p>Checked {new Date(run.startedAt).toLocaleString()}</p>
                  )}
                  {run.requests.map((request, index) => (
                    <div className="source-request" key={index}>
                      <a
                        href={request.endpoint}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {request.endpoint} ↗
                      </a>
                      <span>
                        {request.servedFrom === "network"
                          ? "Network request"
                          : request.servedFrom === "in-flight"
                            ? "Shared in-flight request"
                            : request.servedFrom === "memory-cache"
                              ? "Memory cache reused"
                              : "Shared cache reused"}
                        {request.httpStatus
                          ? " · HTTP " + request.httpStatus
                          : " · no HTTP status recorded"}
                        {request.errorCode
                          ? " · " + request.errorCode.replaceAll("_", " ")
                          : ""}
                      </span>
                    </div>
                  ))}
                  {!run.requests.length && (
                    <p>
                      {run.category === "local"
                        ? "Local storage lookup; no external request."
                        : run.category === "reference"
                          ? "Cached reference PDF; source retrieval date is shown with its evidence."
                          : "No HTTP request observation recorded. This may use an SDK or fail before an HTTP call; no HTTP success is assumed."}
                    </p>
                  )}
                  {run.documentation && (
                    <a
                      href={run.documentation}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Provider documentation ↗
                    </a>
                  )}
                </details>
              </article>
            ))}
          </div>
          {!!trace.notQueried.length && (
            <details className="sources-not-queried">
              <summary>Sources not queried ({trace.notQueried.length})</summary>
              {trace.notQueried.map((source) => (
                <p key={source.name}>
                  <strong>{source.name}</strong> — {source.reason}
                </p>
              ))}
            </details>
          )}
        </>
      )}
      <div className="analysed-patents">
        <h3>
          Patents analysed <span className="count">{patents.length}</span>
        </h3>
        <p className="hint">
          These are the publications in the current comparison, after
          deduplication. Provider counts above describe returned records and can
          overlap.
        </p>
        {!patents.length ? (
          <p>No patent has been compared yet.</p>
        ) : (
          <ul>
            {patents.map((patent) => (
              <li key={patent.publicationNumber}>
                {onInspect ? (
                  <button
                    className="text-button"
                    onClick={() => onInspect(patent)}
                  >
                    {patent.publicationNumber} — {patent.title} ↗
                  </button>
                ) : (
                  <a href={patent.sourceUrl} target="_blank" rel="noreferrer">
                    {patent.publicationNumber} — {patent.title} ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
