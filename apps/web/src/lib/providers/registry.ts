import type { Provider, ProviderCapability } from "./types";
import { endpointCatalogue } from "./eligibility";
import { observations } from "./http";
const entry = (
  id: string,
  name: string,
  capabilities: ProviderCapability[],
  authentication: string,
  documentation: string,
  detail: string,
  implemented = false,
  configured = true,
): Provider => ({
  id,
  name,
  capabilities,
  authentication,
  documentation,
  detail,
  configured,
  status: !configured ? "NOT CONFIGURED" : implemented ? "UNTESTED" : "PENDING",
  rateLimit:
    "Bounded requests; 10s timeout; one backoff retry; five-minute cache. Provider quotas still apply.",
});
export function registry(): Provider[] {
  const list = [
    ...[
      [
        "openaire",
        "OpenAIRE Graph",
        ["patent-search", "scientific-search"],
        "Patent metadata linked to scientific literature; not a complete patent database. CC-BY attribution required.",
      ],
      [
        "datacite",
        "DataCite",
        ["scientific-search"],
        "Research datasets and DOI metadata. CC0 metadata only.",
      ],
      [
        "hal",
        "HAL",
        ["scientific-search"],
        "French academic metadata; CC0, full-text rights separate.",
      ],
      [
        "arxiv",
        "arXiv",
        ["scientific-search"],
        "Preprint metadata; CC0. One connection, at least three seconds between calls.",
      ],
      [
        "zenodo",
        "Zenodo",
        ["scientific-search"],
        "Research outputs and technical datasets; CC0 metadata, file licences separate.",
      ],
      [
        "wikidata",
        "Wikidata",
        ["organization-search"],
        "CC0 structured entity lookup by Q identifier.",
      ],
      [
        "rcsb",
        "RCSB PDB",
        ["reference-lookup"],
        "CC0 molecular structure metadata lookup; not patent search.",
      ],
      [
        "nasa",
        "NASA NTRS",
        ["scientific-search"],
        "Aerospace technical-report metadata; full-text rights vary.",
      ],
      [
        "doe",
        "DOE OSTI",
        ["scientific-search"],
        "Energy research-report metadata; full-text rights vary.",
      ],
      [
        "inspire",
        "INSPIRE",
        ["scientific-search"],
        "Physics literature metadata; CC0.",
      ],
      [
        "ror",
        "ROR",
        ["organization-search"],
        "Research-organization matching; CC0. Matches are candidates, not proof of ownership.",
      ],
      [
        "gleif",
        "GLEIF",
        ["organization-search"],
        "Legal entities with LEIs; CC0. Not a universal company register.",
      ],
      [
        "fr-company",
        "French company search",
        ["organization-search"],
        "French legal entities; Licence Ouverte source data.",
      ],
      [
        "pubchem",
        "PubChem",
        ["compound-lookup", "reference-lookup"],
        "Chemical properties and patent references; references are not complete patent records.",
      ],
      [
        "opencitations",
        "OpenCitations",
        ["citation-search"],
        "Scientific citation graph; CC0, not patent citations.",
      ],
      [
        "veyip",
        "VeyIP MCP",
        ["patent-search", "claims"],
        "Anonymous MCP search and claims verified; third-party PatentHub commercial rights uncertain. Disabled by default.",
      ],
    ].map(([id, name, capabilities, detail]) => {
      const key = id as string;
      const catalogueKey = key === "inspire" ? "cern" : key;
      const evidence = endpointCatalogue.find(
        (e) => e.provider === catalogueKey,
      );
      const experimental = key === "veyip";
      const p = entry(
        key,
        name as string,
        capabilities as ProviderCapability[],
        experimental ? "Anonymous; experimental" : "Public metadata, no key",
        evidence?.documentation ||
          "https://inspirehep.net/help/knowledge-base/rest-api/",
        detail as string,
        true,
        !experimental || process.env.ENABLE_EXPERIMENTAL_VEYIP === "true",
      );
      return {
        ...p,
        tier: experimental ? ("C" as const) : ("A" as const),
        license: evidence?.license,
        enabledByDefault: !experimental,
      };
    }),
    entry(
      "patent-pages",
      "Google Patents publication pages",
      ["patent-lookup", "claims", "full-text"],
      "Public HTML pages; not a search API",
      "https://patents.google.com",
      "Experimental public HTML enrichment. Commercial-reuse terms require review; disabled by default.",
      true,
      process.env.ENABLE_GOOGLE_PATENT_PAGES === "true",
    ),
    entry(
      "europe-pmc",
      "Europe PMC patent archive",
      ["patent-search"],
      "Public REST; no API key",
      "https://www.ebi.ac.uk/europepmc/webservices/rest/",
      "Legacy historical archive; patent-content commercial rights require review. Disabled unless explicitly enabled.",
      true,
      process.env.ENABLE_EPMC_PATENT_ARCHIVE === "true",
    ),
    {
      ...entry(
        "europe-pmc-research",
        "Europe PMC scientific",
        ["scientific-search"],
        "Public REST; anonymous request verified",
        "https://europepmc.org/RestfulWebService",
        "MED/PMC article metadata only; no patent claims or full-text redistribution. Separate from disabled historical patent archive.",
        true,
      ),
      tier: "A" as const,
      license:
        "Public bibliographic metadata; abstracts and article files retain source-specific rights. Only title/identifier/year links returned.",
      enabledByDefault: true,
    },
    entry(
      "epo-publication",
      "EPO Publication Server",
      ["patent-lookup", "full-text", "claims"],
      "Public",
      "https://data.epo.org/publication-server/rest/v1.2",
      "EP publication number + publication date required; XML retrieval, not keyword search.",
      true,
    ),
    entry(
      "epo-linked",
      "EPO Linked Open Data",
      [],
      "Public permitted light use",
      "https://data.epo.org/linked-data",
      "Application JSON and Turtle verified. CC BY 4.0; official fair use prohibits production backend use. Reference adapter disabled unless explicitly enabled.",
      true,
      process.env.ENABLE_EPO_LINKED_REFERENCE === "true",
    ),
    entry(
      "epo-ops",
      "EPO OPS",
      ["patent-search"],
      "OAuth client credentials",
      "https://www.epo.org/en/searching-for-patents/data/web-services/ops",
      "OAuth token acquisition and bibliographic keyword search implemented; requires valid credentials.",
      false,
      !!(process.env.EPO_OPS_KEY && process.env.EPO_OPS_SECRET),
    ),
    entry(
      "crossref",
      "Crossref",
      ["scientific-search"],
      "Public polite REST",
      "https://www.crossref.org/documentation/retrieve-metadata/rest-api/",
      "Keyword search and DOI resolution.",
      true,
    ),
    entry(
      "openalex",
      "OpenAlex",
      ["scientific-search"],
      "API key supported; anonymous availability may change",
      "https://docs.openalex.org",
      "Anonymous request verified in this environment; runtime failures handled.",
      true,
    ),
    entry(
      "uspto",
      "USPTO Open Data Portal",
      [],
      "API key",
      "https://data.uspto.gov/",
      "Pending authenticated adapter verification.",
      false,
      !!process.env.USPTO_API_KEY,
    ),
    entry(
      "inpi",
      "INPI Industrial Property",
      [],
      "Authorized industrial property API access",
      "https://data.inpi.fr/",
      "Industrial-property authentication and adapter verification pending.",
      false,
      !!process.env.INPI_API_KEY,
    ),
    entry(
      "google-patents",
      "Google Patents Public Data",
      ["patent-search", "patent-lookup"],
      "Google Cloud BigQuery credentials",
      "https://github.com/google/patents-public-data",
      "Authenticated bounded BigQuery adapter; real query verification required. ADC/WIF supported. No anonymous search API.",
      true,
      process.env.ENABLE_BIGQUERY === "true" &&
        !!process.env.GOOGLE_CLOUD_PROJECT,
    ),
    entry(
      "lens",
      "Lens",
      ["patent-search"],
      "Approved API token",
      "https://docs.api.lens.org/",
      "Bounded search adapter; approved token required. Authenticated live availability is not established by configuration.",
      true,
      !!process.env.LENS_API_TOKEN,
    ),
    entry(
      "cnipa",
      "CNIPA",
      [],
      "Authorized access required",
      "https://english.cnipa.gov.cn/",
      "No verified public API configured.",
      false,
      false,
    ),
    entry(
      "wipo",
      "WIPO PATENTSCOPE",
      [],
      "Authorized access required",
      "https://patentscope.wipo.int/",
      "No unrestricted anonymous search API configured.",
      false,
      false,
    ),
    entry(
      "semantic-scholar",
      "Semantic Scholar",
      ["scientific-search"],
      "API key / restricted anonymous access",
      "https://api.semanticscholar.org/api-docs/graph",
      "Anonymous access is rate-limited; API commercial rights require review. Disabled unless explicitly approved.",
      true,
      process.env.ENABLE_SEMANTIC_SCHOLAR === "true",
    ),
    entry(
      "pubmed",
      "PubMed / NCBI",
      ["scientific-search"],
      "Optional NCBI API key",
      "https://www.ncbi.nlm.nih.gov/books/NBK25501/",
      "Public ESearch and ESummary literature discovery.",
      true,
    ),
    entry(
      "local-index",
      "Local sourced patent index",
      ["patent-search"],
      "Local SQLite; no API key",
      "https://www.sqlite.org/fts5.html",
      "Searches retrieved or authorized imported public records. Source provenance retained; partial coverage.",
      true,
      !process.env.VERCEL || !!process.env.PATENTRADAR_DATA_DIR,
    ),
    entry(
      "openai",
      "OpenAI Responses API",
      [],
      "Server-side API key",
      "https://platform.openai.com/docs/api-reference/responses",
      "Structured extraction; explicit document-processing consent required.",
      true,
      !!process.env.OPENAI_API_KEY,
    ),
  ];
  return list.map((p) => {
    const aliases: Record<string, string> = {
      "europe-pmc": "epmc",
      "semantic-scholar": "semantic",
    };
    const evidence =
      p.id === "epo-publication"
        ? endpointCatalogue.find(
            (e) => e.variable === "EPO_PUBLICATION_XML_URL",
          )
        : endpointCatalogue.find((e) => e.provider === (aliases[p.id] || p.id));
    return {
      ...p,
      tier:
        p.tier ||
        (p.id === "patent-pages" ? "C" : (evidence?.tier as Provider["tier"])),
      license: p.license || evidence?.license,
      enabledByDefault: p.enabledByDefault ?? p.configured,
      ...(p.configured ? observations.get(p.id) : undefined),
    };
  });
}
