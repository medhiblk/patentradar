import type { SourceRun } from "./audit";
type Definition = [SourceRun["category"], SourceRun["method"], string, string];
const sources: Record<string, Definition> = {
  "Local sourced patent index": [
    "local",
    "local-index",
    "",
    "Previously cached or authorized imported records only; original providers remain attributed.",
  ],
  "OpenAIRE Graph": [
    "mixed",
    "keyword-search",
    "https://graph.openaire.eu/faq",
    "Literature-linked patent metadata and scientific works. This is a partial patent subset; claims may be absent.",
  ],
  DataCite: [
    "research",
    "keyword-search",
    "https://support.datacite.org/docs/api",
    "Research dataset and publication metadata; not a patent database.",
  ],
  HAL: [
    "research",
    "keyword-search",
    "https://api.archives-ouvertes.fr/docs",
    "French open research repository; not patent search.",
  ],
  arXiv: [
    "research",
    "keyword-search",
    "https://info.arxiv.org/help/api/index.html",
    "Scientific preprint metadata; not patent search.",
  ],
  Zenodo: [
    "research",
    "keyword-search",
    "https://developers.zenodo.org/",
    "Research records and datasets; not patent search.",
  ],
  Crossref: [
    "research",
    "keyword-search",
    "https://www.crossref.org/documentation/retrieve-metadata/rest-api/",
    "DOI metadata for scientific prior art; not patent search.",
  ],
  OpenAlex: [
    "research",
    "keyword-search",
    "https://docs.openalex.org/",
    "Scientific literature metadata; not patent search.",
  ],
  "Europe PMC scientific": [
    "research",
    "keyword-search",
    "https://europepmc.org/RestfulWebService",
    "MED/PMC scientific records only; not patent search.",
  ],
  PubMed: [
    "research",
    "keyword-search",
    "https://www.ncbi.nlm.nih.gov/books/NBK25501/",
    "Biomedical scientific literature; not patent search.",
  ],
  "Google Patents Public Data": [
    "patent",
    "keyword-search",
    "https://github.com/google/patents-public-data",
    "Authenticated BigQuery retrieval from patents-public-data.patents.publications. A Google Patents reference link alone does not mean this database was queried.",
  ],
  "EPO OPS": [
    "patent",
    "keyword-search",
    "https://www.epo.org/en/searching-for-patents/data/web-services/ops",
    "Authenticated international bibliographic search; fields depend on the response.",
  ],
  "Europe PMC": [
    "patent",
    "keyword-search",
    "https://europepmc.org/RestfulWebService",
    "Optional legacy patent archive; incomplete coverage.",
  ],
  "Semantic Scholar": [
    "research",
    "keyword-search",
    "https://api.semanticscholar.org/api-docs/graph",
    "Scientific paper metadata; not patent search.",
  ],
  "VeyIP MCP": [
    "patent",
    "keyword-search",
    "https://www.veyip.com/api/mcp",
    "Experimental provider enabled explicitly; access and coverage may vary.",
  ],
};
export function sourceRun(name: string, queries: string[]): SourceRun {
  const exactEpo = name.startsWith("EPO ") && name !== "EPO OPS";
  const [category, method, documentation, coverage] = exactEpo
    ? ([
        "patent",
        "publication-lookup",
        "https://data.epo.org/publication-server",
        "Exact EP publication lookup with a supplied publication date; not unrestricted keyword search.",
      ] as Definition)
    : sources[name] || [
        "mixed",
        "keyword-search",
        "",
        "Adapter execution; inspect the returned source records for coverage.",
      ];
  return {
    id: name,
    name,
    category,
    method,
    ...(documentation ? { documentation } : {}),
    coverage,
    queries: (exactEpo ? [name.slice(4)] : queries).slice(0, 12),
    status: "queued",
    patentsRetrieved: 0,
    papersRetrieved: 0,
    patentNumbers: [],
    requests: [],
  };
}
