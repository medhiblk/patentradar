"use client";
import { compare, tokens } from "@/lib/compare";
import { evidenceBasis, passageSource } from "@/lib/intelligence/evidence";
import type { Profile } from "@/lib/model";
import type { PatentRecord } from "@/lib/providers/types";
import type { SearchTrace } from "@/lib/search/audit";
export function EvidenceQuote({
  text,
  terms,
}: {
  text: string;
  terms: string[];
}) {
  const shared = new Set(terms);
  return (
    <blockquote>
      {text
        .split(/([\p{L}\p{N}]+)/gu)
        .map((part, index) =>
          tokens(part).some((term) => shared.has(term)) ? (
            <mark key={index}>{part}</mark>
          ) : (
            part
          ),
        )}
    </blockquote>
  );
}
export function PatentEvidence({
  patent,
  profile,
  trace,
  expanded = false,
}: {
  patent: PatentRecord;
  profile: Profile;
  trace?: SearchTrace;
  expanded?: boolean;
}) {
  const comparison = compare(profile, patent);
  const matches = [...comparison.matches].sort(
    (a, b) => b.terms.length - a.terms.length,
  );
  const providers = trace?.providers.filter((run) =>
    run.patentNumbers.includes(patent.publicationNumber),
  );
  const evidence = [
    ...new Map(
      (patent.evidence || []).map((row) => [row.sourceUrl + row.source, row]),
    ).values(),
  ];
  function passage(match: (typeof matches)[number], index: number) {
    const source = passageSource(patent, match.excerpt);
    return (
      <div className="patent-evidence-match" key={match.feature + index}>
        <div className="row between wrap">
          <strong>{match.feature}</strong>
          <span className="evidence-pill">{match.strength}</span>
        </div>
        <EvidenceQuote text={match.excerpt} terms={match.terms} />
        <p>{match.explanation}</p>
        <a href={source.url} target="_blank" rel="noreferrer">
          {source.verified
            ? "Verify passage source"
            : "Record source · passage attribution unavailable"}
          {source.page ? " · original PDF page " + source.page : ""} ↗
        </a>
        <small>
          {source.source} · retrieved{" "}
          {new Date(source.retrievedAt).toLocaleString()}
        </small>
      </div>
    );
  }
  return (
    <section
      className="patent-evidence"
      aria-label={"Evidence for " + patent.publicationNumber}
    >
      <div className="row between wrap">
        <h4>Evidence behind this result</h4>
        <span
          className={
            "evidence-pill " +
            (evidenceBasis(patent) === "Title only" ? "evidence-limited" : "")
          }
        >
          {evidenceBasis(patent)}
        </span>
      </div>
      <p className="evidence-origin">
        <a href={patent.sourceUrl} target="_blank" rel="noreferrer">
          {patent.source} ↗
        </a>
        <small>Retrieved {new Date(patent.retrievedAt).toLocaleString()}</small>
      </p>
      <p className="hint">{comparison.limitation}</p>
      {providers?.length ? (
        <p className="evidence-discovery">
          Returned by: {providers.map((provider) => provider.name).join(" · ")}
        </p>
      ) : null}
      {!!patent.queries?.length && (
        <p className="evidence-discovery">
          Source retrieval queries: {patent.queries.join(" · ")}
        </p>
      )}
      {matches[0] && passage(matches[0], 0)}
      <details open={expanded}>
        <summary>All compared features and source provenance</summary>
        {matches.slice(1).map((match, index) => passage(match, index + 1))}
        <div className="evidence-source-list">
          <strong>Retrieved source records</strong>
          {evidence.length ? (
            evidence.map((row) => (
              <p key={row.sourceUrl + row.source}>
                <a href={row.sourceUrl} target="_blank" rel="noreferrer">
                  {row.source} ↗
                </a>
                <small>
                  Retrieved {new Date(row.retrievedAt).toLocaleString()}
                </small>
              </p>
            ))
          ) : (
            <p>
              No additional source record was supplied. The primary source is
              shown above.
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
