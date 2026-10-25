"use client";
import { useEffect, useState } from "react";
import { WorkspaceAuthForm } from "./workspace-auth-form";
import { Button } from "./ui/button";
import type { Profile } from "@/lib/model";
import { clearPrivateSessionView } from "@/lib/private-session";
import type { WatchCheckSummary } from "@/lib/intelligence/watch";
import { safeJsonResponse } from "@/lib/safe-json-response";
type Item = {
  id: string;
  title: string;
  kind: string;
  updated: string;
  data: {
    lastChecked?: string;
    lastConfirmedCheckAt?: string;
    lastAttemptedAt?: string;
    checkSummary?: WatchCheckSummary;
    discoveries?: string[];
    description?: string;
    seedPublications?: { publicationNumber: string }[];
    query?: string;
  };
};
export function AccountMonitoring({
  profile,
  onOpenProject,
}: {
  profile: Profile;
  onOpenProject: (p: {
    title: string;
    description: string;
    seedPublications: { publicationNumber: string }[];
  }) => void;
}) {
  const [account, setAccount] = useState<{ email: string } | null>(null),
    [items, setItems] = useState<Item[]>([]),
    [usage, setUsage] = useState<{ calls: number; dailyLimit: number } | null>(
      null,
    ),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [consent, setConsent] = useState(false),
    [newsletter, setNewsletter] = useState(""),
    [token, setToken] = useState("");
  async function load() {
    const r = await fetch("/api/vault", { cache: "no-store" }),
      d = await safeJsonResponse(r);
    if (!r.ok) throw new Error(d.error);
    setAccount(d.user);
    if (!d.user) setToken("");
    setItems(d.items);
    setUsage(d.usage || null);
  }
  async function action(url: string, b: object) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(b),
        }),
        d = await safeJsonResponse(r);
      if (!r.ok) throw new Error(d.error);
      if ((b as { action?: string }).action === "logout") {
        clearPrivateSessionView();
        setToken("");
        setNewsletter("");
        setItems([]);
        setAccount(null);
      }
      if (d.newsletter) setNewsletter(d.newsletter);
      if (d.token) setToken(d.token);
      await load();
      const check = d.check as WatchCheckSummary | undefined;
      setMessage(check ? check.status === "failed"
        ? "Patent sources could not be checked. Previous results and review history were kept."
        : check.status === "cached"
          ? "Cached evidence reviewed. No fresh external patent check was confirmed."
          : check.status === "local-only"
            ? "Local records reviewed. No external patent source was queried."
            : check.status === "unknown"
              ? "Results reviewed; external patent freshness could not be confirmed."
              : check.baselineCreated
                ? `Initial baseline saved (${check.firstObserved} records). Existing publications are not new filings.`
                : `${check.newDiscoveries} newly observed records. ${check.sourcesFailed ? "Some patent sources failed; coverage is partial." : "Coverage remains limited to the queried sources."}`
        : "Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to complete request");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/vault", { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const d = await safeJsonResponse(r);
        if (!r.ok) throw Error(d.error || "Unable to load your account.");
        return d;
      })
      .then((d) => {
        setAccount(d.user);
        setItems(d.items || []);
        setUsage(d.usage || null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setMessage(e.message);
      });
    return () => controller.abort();
  }, []);
  return (
    <section className="panel">
      <span className="eyebrow">PRIVATE WORKSPACE</span>
      <h2>Account & intelligence monitoring</h2>
      <p>
        Accounts isolate projects, documents and component catalogs. Cloud
        hosting uses a private Blob store; local hosting can use a persistent
        server volume. No payment provider is connected.
      </p>
      <Button
        variant="outline"
        onClick={() => load().catch((e) => setMessage(e.message))}
      >
        Load account
      </Button>
      {account ? (
        <>
          <p>Signed in as {account.email}</p>
          <p>
            AI requests today: {usage?.calls || 0} / {usage?.dailyLimit || 20}.
            This is a request allowance, not purchased credits.
          </p>
          <Button
            variant="outline"
            onClick={() => action("/api/vault", { action: "logout" })}
          >
            Sign out
          </Button>
        </>
      ) : (
        <WorkspaceAuthForm onAuthenticated={load} />
      )}
      {account && (
        <>
          <h3>Private MCP connection</h3>
          <p>
            Tools at /api/mcp and authenticated operations at /api/v1/. Bearer
            tokens expire after 24 hours. Copy securely; they grant access to
            your portfolio titles.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              action("/api/vault", { action: "token", scope: "developer" })
            }
          >
            Create API / MCP access token
          </Button>
          {token && (
            <label>
              One-time displayed token
              <input readOnly value={token} />
            </label>
          )}
          <h3>Save a patent watch</h3>
          <p>
            Run a manual check of approved concepts against available sources.
            This does not start automatic monitoring or email delivery.
          </p>
          <p className="hint">Technical comparison uses: {profile.title}. Review the invention features before saving a watch.</p>
          <label>
            Approved search concepts
            <input
              value={query}
              maxLength={150}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Short technical concepts, no confidential document text"
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Share this query with the public research providers when checking
            the watch.
          </label>
          <Button
            disabled={query.trim().length < 3 || !consent || busy}
            onClick={() =>
              action("/api/vault", {
                action: "save",
                kind: "watch",
                title: query.trim(),
                data: {
                  input: { profile, query: query.trim(), mode: "LIVE", consent: true },
                  publications: [],
                },
              })
            }
          >
            Save watch
          </Button>
          <p className="hint">
            Checks run when requested. Scheduled delivery and email require
            deployment configuration; no background monitoring is implied.
          </p>
          <h3>Private portfolio & watches</h3>
          {items.map((i) => (
            <article className="saved-row" key={i.id}>
              <strong>{i.title}</strong>
              <small>
                {i.kind} ·{" "}
                {i.data.lastAttemptedAt
                  ? "Last attempt " + i.data.lastAttemptedAt
                  : i.data.lastChecked
                  ? "Last checked " + i.data.lastChecked
                  : "Saved " + i.updated}
              </small>
              {i.kind === "watch" && i.data.checkSummary && (
                <p className="hint">
                  {i.data.checkSummary.status} · {i.data.checkSummary.patentSourcesSucceeded}/{i.data.checkSummary.patentSourcesAttempted} patent/mixed sources returned · {i.data.checkSummary.cachedResponses} cached responses.
                  {i.data.lastConfirmedCheckAt ? ` Last confirmed network check: ${i.data.lastConfirmedCheckAt}.` : " No fresh external patent check confirmed yet."}
                  {" "}Newly observed records may be older publications.
                </p>
              )}
              {i.kind === "project" &&
                typeof i.data.description === "string" && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      onOpenProject({
                        title: i.title,
                        description: i.data.description!,
                        seedPublications: i.data.seedPublications || [],
                      })
                    }
                  >
                    Open project for research
                  </Button>
                )}
              {i.kind === "watch" && (
                <Button
                  disabled={busy || !consent}
                  onClick={() => action("/api/watch", { id: i.id, consent })}
                >
                  Check sources now & create briefing
                </Button>
              )}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  action("/api/vault", { action: "delete", id: i.id })
                }
              >
                Delete
              </Button>
            </article>
          ))}
          {newsletter && (
            <>
              <h3>Personalized research briefing</h3>
              <pre className="briefing">{newsletter}</pre>
              <Button
                variant="outline"
                onClick={() => {
                  const u = URL.createObjectURL(
                    new Blob([newsletter], { type: "text/markdown" }),
                  );
                  const a = document.createElement("a");
                  a.href = u;
                  a.download = "patentradar-briefing.md";
                  a.click();
                  URL.revokeObjectURL(u);
                }}
              >
                Download briefing
              </Button>
            </>
          )}
        </>
      )}
      {busy && <p role="status">Checking real sources…</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
