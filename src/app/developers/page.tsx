"use client";
import { BRAND } from "@/lib/brand";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
type Patent = {
  publicationNumber: string;
  title: string;
  source: string;
  sourceUrl: string;
};
export default function Developers() {
  const repository =
    process.env.NEXT_PUBLIC_REPOSITORY_URL ||
    "https://github.com/medhiblk/patentradar";
  const [query, setQuery] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [patents, setPatents] = useState<Patent[]>([]);
  async function search() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/v1/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, shareQuery: consent }),
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || "Search unavailable");
      setPatents(d.patents);
      if (!d.patents?.length)
        setError(
          "No patent records returned by the available sources. Coverage is partial.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="developer-page">
      <nav className="row between">
        <Link href="/">{BRAND.name}.</Link>
        <div className="row wrap">
          {repository && (
            <a href={repository} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          )}
          <Link href="/plugin">PatentRadar plugin ↗</Link>
          <a href="/api/v1/openapi.json">OpenAPI</a>
          <a href="/api/v1/health">Service health</a>
          <a href="/engineering">Try 3D Studio</a>
        </div>
      </nav>
      <header className="studio-intro">
        <span className="eyebrow">BUILD WITH PATENTRADAR</span>
        <h1>
          Patent evidence,
          <br />
          where you work.
        </h1>
        <p>
          Connect through HTTP or MCP. Inspect sources. Keep uncertainty
          visible.
        </p>
      </header>
      <div className="developer-grid">
        <section className="panel">
          <h2>HTTP API</h2>
          <p>
            Anonymous public research endpoints. Use reviewed, non-confidential
            technical concepts; provider coverage and quotas apply.
          </p>
          <pre>{`POST /api/v1/search\nContent-Type: application/json\n\n{"query":"microfluidic sample handling","shareQuery":true}`}</pre>
          <p>
            <a href="/api/v1/openapi.json">
              Download the OpenAPI 3.1 specification ↗
            </a>
          </p>
          <ul>
            <li>POST /api/v1/search/stream — progressive NDJSON</li>
            <li>POST /api/v1/patents/lookup — exact EP number + date</li>
            <li>POST /api/v1/compare — lexical evidence comparison</li>
            <li>GET /api/v1/providers — source capabilities</li>
            <li>
              <a href="/api/v1/cad/catalog">
                GET /api/v1/cad/catalog — starter parts and sources
              </a>
            </li>
            <li>POST /api/v1/cad/inspect — fit, costs and rights evidence</li>
          </ul>
        </section>
        <section className="panel">
          <h2>Connect an MCP client</h2>
          <p>
            Streamable HTTP at <code>/api/mcp</code>. Public tools need no
            account or API key. Use this deployment’s origin in your client.
          </p>
          <pre>{`{\n  "mcpServers": {\n    "patentradar": {\n      "url": "https://patentradar-puce.vercel.app/api/mcp"\n    }\n  }\n}`}</pre>
          <p>
            Search patents, retrieve exact EP publications, inspect provider
            health, extract literal technical features and compare supplied
            evidence. Inspect assembly envelopes, known purchase costs and the
            starter library with component_library and inspect_assembly.
          </p>
          <p>
            Private tools additionally accept scoped bearer tokens from Account.
            The hosted instance may have private storage or CAD disabled; check
            health before using them.
          </p>
        </section>
      </div>
      <section className="panel">
        <h2>Try a real public search</h2>
        <label>
          Approved technical concepts
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Short generic concepts, no confidential document details"
            maxLength={150}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Share this query with the public patent and research providers.
        </label>
        <Button
          disabled={!consent || query.trim().length < 3 || busy}
          onClick={search}
        >
          {busy ? "Retrieving source evidence…" : "Search through the API"}
        </Button>
        {error && <p role="alert">{error}</p>}
        {patents.map((p) => (
          <article className="saved-row" key={p.publicationNumber}>
            <strong>{p.publicationNumber}</strong>
            <span>{p.title}</span>
            <a href={p.sourceUrl} target="_blank" rel="noreferrer">
              {p.source} ↗
            </a>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Private engineering integrations</h2>
        <p>
          Self-host with the supplied Docker/native setup for persistent
          portfolios, scoped developer tokens and CAD exports. Public deployment
          does not imply a Python CAD runtime or a worldwide complete patent
          database. Scores are relevance signals, never infringement
          probabilities.
        </p>
        <p>
          <a href="/api/v1/guide">Integration guide ↗</a>
        </p>
      </section>
    </main>
  );
}
