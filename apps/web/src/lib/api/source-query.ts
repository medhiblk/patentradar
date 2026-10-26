import {
  SourceQueryInput,
  type SourceQueryResponse,
} from "@formaproof/contracts";
import { observations, ProviderRequestError } from "../providers/http";
import { registry } from "../providers/registry";
import { withSearchSignal } from "../search/scope";
import * as research from "../providers/new-research";
import * as organizations from "../providers/organizations";
import * as technical from "../providers/technical";
import * as openaire from "../providers/openaire";
import * as epo from "../providers/epo-linked";
import * as veyip from "../providers/veyip";
import * as crossref from "../providers/crossref";
import * as openalex from "../providers/openalex";
import * as pubmed from "../providers/pubmed";
import * as publication from "../providers/epo-publication";
import * as ops from "../providers/epo-ops";
import * as google from "../providers/google-patents";
import * as epmcResearch from "../providers/europe-pmc-research";
import * as epmc from "../providers/europe-pmc";
import * as lens from "../providers/lens";
import * as semantic from "../providers/semantic-scholar";

export { SourceQueryInput };
export class SourceConsentError extends Error {
  constructor() {
    super(
      "Set consent=true to share short non-confidential concepts with the selected public provider.",
    );
  }
}

// Only existing reviewed adapters are callable. The request never accepts a URL,
// credentials, or private database selector from the caller.
const adapters = {
  datacite: { category: "research", run: research.datacite, paginated: true },
  hal: { category: "research", run: research.hal, paginated: true },
  arxiv: { category: "research", run: research.arxiv, paginated: true },
  zenodo: { category: "research", run: research.zenodo, paginated: true },
  inspire: { category: "research", run: research.inspire, paginated: true },
  nasa: { category: "research", run: research.nasa },
  doe: { category: "research", run: research.doe },
  openaire: {
    category: "patents-and-research",
    run: openaire.search,
    paginated: true,
  },
  ror: { category: "organization", run: organizations.ror },
  gleif: { category: "organization", run: organizations.gleif },
  "fr-company": {
    category: "organization",
    run: organizations.frenchCompanies,
  },
  rcsb: { category: "structure-metadata", run: technical.structure },
  crossref: { category: "research", run: crossref.search },
  openalex: { category: "research", run: openalex.search },
  pubmed: { category: "research", run: pubmed.search },
  "semantic-scholar": { category: "research", run: semantic.search },
  "europe-pmc-research": {
    category: "research",
    run: epmcResearch.search,
    paginated: true,
  },
  "europe-pmc": { category: "patent", run: epmc.search },
  lens: { category: "patent", run: lens.search, paginated: true },
  "epo-ops": { category: "patent", run: ops.search },
} satisfies Record<
  string,
  {
    category: string;
    run: (query: string, page: number) => Promise<unknown>;
    paginated?: boolean;
  }
>;
const special = [
  "wikidata",
  "pubchem",
  "opencitations",
  "epo-linked",
  "veyip",
  "epo-publication",
  "google-patents",
];
const operations: Record<string, string[]> = {
  wikidata: ["search", "relations"],
  pubchem: ["search", "patent-references"],
  opencitations: ["search", "citations", "references"],
  "epo-linked": ["search", "application", "rdf"],
  veyip: ["search", "claims"],
};

export async function querySource(
  raw: unknown,
  signal?: AbortSignal,
): Promise<SourceQueryResponse> {
  const i = SourceQueryInput.parse(raw);
  if (!i.consent) throw new SourceConsentError();
  const base = { provider: i.provider, retrievedAt: new Date().toISOString() };
  const failure = (
    status: Exclude<SourceQueryResponse["status"], "HEALTHY">,
    error: string,
  ): SourceQueryResponse => ({ ...base, status, error });
  if (i.provider === "local-index")
    return failure(
      "OUT_OF_SCOPE",
      "Use the authenticated search_local_patents tool for this server's cached public index.",
    );
  if (i.provider === "openai")
    return failure(
      "OUT_OF_SCOPE",
      "OpenAI is private document processing, not a public data source.",
    );
  const adapter = adapters[i.provider as keyof typeof adapters] as
    | {
        category: string;
        run: (query: string, page: number) => Promise<unknown>;
        paginated?: boolean;
      }
    | undefined;
  if (!adapter && !special.includes(i.provider))
    return failure(
      "NOT_IMPLEMENTED",
      "No public query adapter is exposed for this provider. Dataset catalogues are available separately at /api/v1/datasets.",
    );
  if (!(operations[i.provider] || ["search"]).includes(i.operation))
    return failure(
      "UNSUPPORTED_OPERATION",
      "This operation is not supported by the selected provider.",
    );
  if (
    i.page !== 1 &&
    !adapter?.paginated &&
    !(i.provider === "veyip" && i.operation === "search")
  )
    return failure(
      "UNSUPPORTED_OPERATION",
      "This adapter supports only the first bounded page.",
    );
  if (
    i.provider === "epo-publication" &&
    (!i.publicationDate || !/^EP\s*\d+[AB]\d$/i.test(i.query))
  )
    return failure(
      "INVALID_INPUT",
      "Exact EP A/B publication number and YYYYMMDD publicationDate are required.",
    );
  const invalidIdentifier =
    (i.provider === "wikidata" && !/^Q[1-9]\d{0,12}$/.test(i.query)) ||
    (i.provider === "rcsb" && !/^[0-9][a-zA-Z0-9]{3}$/.test(i.query)) ||
    (i.provider === "pubchem" &&
      i.operation === "patent-references" &&
      !/^\d{1,10}$/.test(i.query)) ||
    (i.provider === "epo-linked" && !/^\d{8,12}$/.test(i.query)) ||
    (i.provider === "opencitations" &&
      !/^10\.\d{4,9}\/.{1,200}$/.test(i.query)) ||
    (i.provider === "veyip" &&
      i.operation === "claims" &&
      !/^[A-Z]{2}\s*\d+[A-Z]\d?$/i.test(i.query));
  if (invalidIdentifier)
    return failure(
      "INVALID_INPUT",
      "A provider-specific identifier is required: Wikidata Q ID, PDB ID, compound CID or EP application number.",
    );
  const provider = registry().find((p) => p.id === i.provider);
  if (!provider?.configured)
    return failure(
      "NOT_CONFIGURED",
      "Selected provider is disabled or lacks required server configuration. Inspect /api/v1/providers for capabilities.",
    );
  const started = Date.now();
  try {
    signal?.throwIfAborted();
    const result = await withSearchSignal(signal, async () => {
      if (adapter)
        return {
          records: await adapter.run(i.query, i.page),
          category: adapter.category,
        };
      switch (i.provider) {
        case "wikidata":
          return {
            category: "organization-entity",
            records: await (i.operation === "relations"
              ? organizations.wikidataRelations(i.query)
              : organizations.wikidataEntity(i.query)),
          };
        case "pubchem":
          return {
            category:
              i.operation === "patent-references"
                ? "patent-references-only"
                : "compound",
            records: await (i.operation === "patent-references"
              ? technical.compoundPatents(i.query)
              : technical.compoundProperties(i.query)),
          };
        case "opencitations":
          return {
            category: "scientific-citations",
            records: await technical.citations(
              i.query,
              i.operation === "references" ? "references" : "citations",
            ),
          };
        case "epo-linked":
          return {
            category: "patent-graph-reference",
            records: await (i.operation === "rdf"
              ? epo.lookupApplicationRdf(i.query)
              : epo.lookupApplication(i.query)),
          };
        case "veyip":
          return {
            category: "experimental-patent",
            records: await (i.operation === "claims"
              ? veyip.getClaims(i.query)
              : veyip.search(i.query, i.page, "all")),
          };
        case "epo-publication":
          return {
            category: "patent",
            records: await publication.lookup(i.query, i.publicationDate!),
          };
        case "google-patents":
          return {
            category: "patent",
            records: await google.retrieve(i.query, []),
          };
        default:
          throw new Error("No dispatcher for selected provider");
      }
    });
    signal?.throwIfAborted();
    const records = result.records;
    if (records === undefined) throw new SyntaxError("Missing adapter records");
    const latencyMs = Date.now() - started;
    observations.set(i.provider, {
      status: "HEALTHY",
      detail:
        "Adapter completed; an empty result does not establish exhaustive coverage.",
      checkedAt: new Date().toISOString(),
      latencyMs,
    });
    return {
      ...base,
      ...result,
      records,
      status: "HEALTHY",
      latencyMs,
      page: i.page,
      warnings: [
        "Partial source coverage. Empty results do not establish absence of patents. Preserve source attribution; similarity and name matching are not legal conclusions.",
      ],
    };
  } catch (error) {
    const code = signal?.aborted
      ? "ABORTED"
      : error instanceof ProviderRequestError
        ? error.code
        : error instanceof Error &&
            ["ZodError", "SyntaxError"].includes(error.name)
          ? "INVALID_RESPONSE"
          : "UNAVAILABLE";
    // A cancelled client request is not evidence that the provider is unhealthy.
    if (code !== "ABORTED")
      observations.set(i.provider, {
        status: "UNAVAILABLE",
        detail: code,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
      });
    return {
      ...base,
      status: "UNAVAILABLE",
      code,
      error:
        code === "INVALID_RESPONSE"
          ? "Provider response failed validation."
          : "Source query did not complete. Check provider availability and configuration.",
      ...(error instanceof ProviderRequestError &&
      error.retryAfterMs !== undefined
        ? { retryAfterMs: error.retryAfterMs }
        : {}),
    };
  }
}
