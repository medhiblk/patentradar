"use client";
import { AlertTriangle, ExternalLink } from "lucide-react";
import type { SimilarityAlert } from "@/lib/intelligence/alerts";
export function SimilarityAlerts({
  alerts,
  onInspect,
}: {
  alerts: SimilarityAlert[];
  onInspect?: (publication: string) => void;
}) {
  if (!alerts.length)
    return (
      <p className="hint similarity-no-signal">
        No close lexical signal in the supplied evidence. This is not a
        clearance result; source coverage is incomplete.
      </p>
    );
  return (
    <section
      className="similarity-alerts"
      aria-label="Patent similarity alerts"
    >
      <div className="similarity-alert-heading" role="status">
        <AlertTriangle size={19} />
        <strong>
          {alerts.length === 1
            ? "A similar publication already exists"
            : `${alerts.length} publications share technical features`}
        </strong>
        <span>Technical review recommended</span>
      </div>
      {alerts.map((alert) => (
        <article className="similarity-alert-card" key={alert.id}>
          <div className="row between wrap">
            <div>
              <span className="similarity-badge">
                {alert.acknowledged ? "Reviewed" : "Review needed"} ·{" "}
                {alert.evidenceBasis}
              </span>
              <h3>
                {alert.publicationNumber} — {alert.title}
              </h3>
            </div>
            <a href={alert.sourceUrl} target="_blank" rel="noreferrer">
              Open publication <ExternalLink size={14} />
            </a>
          </div>
          <p>
            {alert.matches.length} of your features share technical terminology
            with this publication. Inspect the passages before deciding what the
            overlap means.
          </p>
          <details>
            <summary>View matching features and source passages</summary>
            {alert.matches.map((match) => (
              <div className="similarity-match" key={match.feature}>
                <strong>{match.feature}</strong>
                <p>Shared terms: {match.terms.join(", ")}</p>
                <blockquote>{match.excerpt}</blockquote>
              </div>
            ))}
          </details>
          {alert.legalStatusNotice && (
            <p className="status-context">{alert.legalStatusNotice}</p>
          )}
          <div className="similarity-alert-footer">
            <small>
              {alert.source} · retrieved{" "}
              {new Date(alert.retrievedAt).toLocaleDateString()}
            </small>
            {onInspect && (
              <button
                className="quiet-button"
                onClick={() => onInspect(alert.publicationNumber)}
              >
                Inspect comparison ↗
              </button>
            )}
          </div>
          <p className="similarity-limitation">
            Technical similarity is not a finding of infringement. Claim scope,
            related publications and current legal status require separate
            review.
          </p>
        </article>
      ))}
    </section>
  );
}
