"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { ExternalLink, Search } from "lucide-react";
const choices = [
  ["europe-pmc-research", "Europe PMC — scientific articles", "search"],
  ["datacite", "DataCite — research datasets", "search"],
  ["hal", "HAL — French research", "search"],
  ["arxiv", "arXiv — preprint metadata", "search"],
  ["zenodo", "Zenodo — technical datasets", "search"],
  ["inspire", "INSPIRE — physics literature", "search"],
  ["nasa", "NASA — aerospace reports", "search"],
  ["doe", "DOE OSTI — energy research", "search"],
  ["wikidata", "Wikidata — entity by Q identifier", "search"],
  [
    "wikidata-relations",
    "Wikidata — company relations by Q identifier",
    "relations",
  ],
  ["rcsb", "RCSB PDB — structure metadata by ID", "search"],
  ["openaire", "OpenAIRE — patents and research", "search"],
  ["ror", "ROR — research organizations", "search"],
  ["gleif", "GLEIF — legal entities", "search"],
  ["fr-company", "France — company names / SIREN", "search"],
  ["pubchem", "PubChem — compound properties", "search"],
  [
    "pubchem-patents",
    "PubChem — patent references by CID",
    "patent-references",
  ],
  ["opencitations", "OpenCitations — citations by DOI", "citations"],
  [
    "opencitations-references",
    "OpenCitations — references by DOI",
    "references",
  ],
];
type Display = { title: string; detail: string; url?: string };
function href(value: unknown) {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return;
  }
}
function display(input: unknown): Display[] {
  const outer =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const records = outer.records;
  const obj =
    records && typeof records === "object" && !Array.isArray(records)
      ? (records as Record<string, unknown>)
      : {};
  const list = Array.isArray(records)
    ? records
    : Array.isArray(obj.patents)
      ? [...obj.patents, ...(Array.isArray(obj.papers) ? obj.papers : [])]
      : Array.isArray(obj.properties)
        ? obj.properties
        : [];
  return list.slice(0, 100).map((item, index) => {
    const row = item as Record<string, unknown>;
    return {
      title: String(
        row.title ||
          row.name ||
          row.publicationNumber ||
          row.citing ||
          row.MolecularFormula ||
          `Record ${row.id || row.CID || index + 1}`,
      ),
      detail: [
        row.source,
        row.country,
        row.year,
        row.cited,
        row.MolecularWeight,
      ]
        .filter((v) => typeof v === "string" || typeof v === "number")
        .join(" · ")
        .slice(0, 500),
      url: href(row.sourceUrl) || href(obj.sourceUrl),
    };
  });
}
export function SourceExplorer() {
  const [catalogues, setCatalogues] = useState<
    { id: string; name: string; url: string; detail: string }[]
  >([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/datasets", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.catalogues))
          setCatalogues(
            data.catalogues.filter((r: { url?: unknown }) => href(r.url)),
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const [choice, setChoice] = useState("datacite"),
    [query, setQuery] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [results, setResults] = useState<Display[] | null>(null);
  async function search() {
    setBusy(true);
    setError("");
    setResults(null);
    try {
      const selected = choices.find((v) => v[0] === choice)!;
      const provider = choice.startsWith("wikidata")
        ? "wikidata"
        : choice.startsWith("pubchem")
          ? "pubchem"
          : choice.startsWith("opencitations")
            ? "opencitations"
            : choice;
      const r = await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          query,
          operation: selected[2],
          consent,
        }),
      });
      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Unexpected server response. Please retry.");
      }
      if (!r.ok)
        throw new Error(data.error || "Source unavailable or rate-limited.");
      setResults(display(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Explore a public source</h3>
        <Search size={17} />
      </div>
      <p>
        Look up research, patent references or organizations. Organization name
        matches are candidates to verify; they do not prove ownership or
        competition.
      </p>
      <div className="field-row">
        <label>
          Public data source
          <select
            aria-label="Public data source"
            value={choice}
            onChange={(e) => {
              setChoice(e.target.value);
              setResults(null);
            }}
          >
            {choices.map((c) => (
              <option key={c[0]} value={c[0]}>
                {c[1]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search terms or identifier
          <input
            value={query}
            maxLength={250}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              choice.includes("opencitations")
                ? "10.1038/nphys1170"
                : choice === "pubchem-patents"
                  ? "Compound CID, e.g. 123"
                  : choice === "pubchem"
                    ? "Compound name, e.g. aspirin"
                    : "Reviewed public keywords or organization name"
            }
          />
        </label>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        Share this query with the selected public data service.
      </label>
      <Button disabled={busy || !consent || !query.trim()} onClick={search}>
        {busy ? "Searching…" : "Search this source"}
      </Button>
      <p className="hint">
        Public quotas apply. OpenAIRE anonymous access is limited; repeat
        queries are cached. Experimental sources are not offered here.
      </p>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      {results && (
        <div aria-live="polite">
          {results.length ? (
            <>
              <p className="hint">
                {results.length} records in this bounded response.
              </p>
              {results.map((r, i) => (
                <article className="paper" key={i}>
                  <div>
                    <strong>{r.title}</strong>
                    <small>{r.detail}</small>
                  </div>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={"Source for " + r.title}
                    >
                      <ExternalLink size={15} />
                    </a>
                  )}
                </article>
              ))}
            </>
          ) : (
            <p>
              No matching records in this response. This does not establish
              absence of prior art.
            </p>
          )}
        </div>
      )}
      <details>
        <summary>Patent datasets for manual import</summary>
        <p className="hint">
          These are catalogue pages, not live search APIs. Check file access,
          schema and reuse terms before downloading and normalizing records for
          the offline importer. No files are imported automatically.
        </p>
        {catalogues.map((c) => (
          <article className="paper" key={c.id}>
            <div>
              <a href={c.url} target="_blank" rel="noreferrer">
                {c.name} ↗
              </a>
              <small>{c.detail}</small>
            </div>
          </article>
        ))}
      </details>
    </section>
  );
}
