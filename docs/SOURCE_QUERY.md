# Query one public source

The application now offers the source-query workflow previously developed on `fix/source-query-plugin`, adapted to the current monorepo. It reuses current provider adapters and security rules; it does not merge the older website, branding or authentication code.

## Three entry points, one dispatcher

- HTTP: `POST /api/v1/sources/query`.
- MCP: `query_source` on the existing `/api/mcp` server.
- SDK: `FormaProofClient.querySource(input, signal?)`.

The request and response contracts are exported by `@formaproof/contracts`. The OpenAPI document includes the endpoint and its outcome schema. Public discovery advertises the tool alongside the existing research and engineering tools.

```json
{ "provider": "ror", "query": "Oxford", "consent": true }
```

```typescript
import { FormaProofClient } from "@formaproof/sdk";

// Use a host running this change. The SDK packages can be packed locally.
const client = new FormaProofClient({ baseUrl: "http://localhost:3000" });
const result = await client.querySource({
  provider: "ror",
  query: "Oxford",
  consent: true,
});
if (result.status === "HEALTHY") {
  console.log(result.records, result.warnings);
} else {
  console.log(result.status, result.error);
}
```

`consent=true` is required before any adapter executes. Queries are trimmed and limited to 150 characters; page numbers are integers from 1 to 10. Additional request properties, arbitrary provider URLs and unknown provider IDs are rejected. Use reviewed, non-confidential concepts or identifiers. Never put credentials in the request.

## Available operations

| Provider                                     | Input and operations                                                        | Pagination                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| DataCite, HAL, arXiv, Zenodo, INSPIRE        | `search`, short public concepts                                             | Bounded adapter pages 1–10                                     |
| NASA NTRS, DOE OSTI                          | `search`, short public concepts                                             | First page only                                                |
| OpenAIRE                                     | `search`, public concepts; separate patent and research output              | Bounded adapter pages 1–10                                     |
| Crossref, OpenAlex, PubMed, Semantic Scholar | `search`, public concepts                                                   | First page only                                                |
| Europe PMC research                          | `search`, public concepts                                                   | Bounded adapter pages 1–10                                     |
| Europe PMC patent archive                    | `search`, historical patent content                                         | First page only; opt-in configuration                          |
| ROR, GLEIF, French company search            | `search`, organization name                                                 | First page only                                                |
| Wikidata                                     | `search` or `relations`, actual Q identifier                                | First page only                                                |
| RCSB                                         | `search`, actual PDB identifier                                             | First page only                                                |
| PubChem                                      | `search` by compound name; `patent-references` by numeric CID               | First page only                                                |
| OpenCitations                                | `search`/`citations` or `references`, actual DOI                            | First page only                                                |
| EPO Publication Server                       | `search`, exact EP A/B publication and `publicationDate` in YYYYMMDD format | First page only                                                |
| EPO Linked Data                              | `search`/`application` or `rdf`, EP application digits                      | First page only; existing experimental restrictions apply      |
| EPO OPS                                      | `search`, public concepts                                                   | First bounded page; configured credentials required            |
| Google Patents Public Data                   | `search`, public concepts                                                   | Existing bounded BigQuery adapter; configured access required  |
| VeyIP                                        | `search`, public concepts; `claims`, publication identifier                 | Search pages 1–10; claims first page; experimental opt-in      |
| Lens                                         | `search`, public concepts                                                   | Five results per page, pages 1–10; approved API token required |

Configuration and usage restrictions in the existing registry remain authoritative. Listing an adapter does not establish live availability, data rights or exhaustive coverage. This port does not add these providers to aggregate research search automatically.

`patent-pages` is an enrichment adapter requiring an existing record, rather than a standalone query adapter. It returns `NOT_IMPLEMENTED` here. USPTO, INPI, CNIPA and WIPO also have no query adapter here. Dataset catalogue links remain available through `GET /api/v1/datasets`; this dispatcher does not download or search bulk patent datasets.

## Outcomes and errors

| Status                  | Meaning                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `HEALTHY`               | The selected adapter completed. Records may be empty; inspect category, provenance and warnings.                                       |
| `NOT_CONFIGURED`        | The adapter exists but is disabled or missing required server configuration.                                                           |
| `NOT_IMPLEMENTED`       | No standalone query adapter is exposed for this provider.                                                                              |
| `OUT_OF_SCOPE`          | The requested facility is not part of this public dispatcher.                                                                          |
| `UNSUPPORTED_OPERATION` | The operation or page is not supported by the selected adapter.                                                                        |
| `INVALID_INPUT`         | Provider-specific identifiers or required lookup details are missing or invalid.                                                       |
| `UNAVAILABLE`           | The adapter failed, was rate-limited, returned invalid data, or the request was cancelled. Inspect `code` and optional `retryAfterMs`. |

HTTP 200 represents a completed dispatch with one of these outcomes, not necessarily a successful provider call. Malformed requests and missing consent return HTTP 400; disallowed origins return 403; bodies over 256 KiB return 413; the application request quota returns 429. All endpoint responses use `Cache-Control: no-store`. MCP marks non-healthy outcomes with `isError=true`. The SDK returns validated outcome objects and rejects missing consent before sending a request.

Upstream error messages are sanitized. Invalid operations and disabled-source requests do not overwrite provider-health observations. Cancellation is passed through the existing request scope and is not recorded as provider failure.

## Privacy and compatibility

The public dispatcher never reads the local cached index or private account database. `local-index` returns `OUT_OF_SCOPE`; the existing authenticated `search_local_patents` MCP tool retains its access checks. `openai` also returns `OUT_OF_SCOPE`; document interpretation remains a separate workflow.

Existing same-origin HTTP checks and the narrow ChatGPT MCP origin exception are preserved. There are no new secrets in source or client configuration. Lens uses the existing `LENS_API_TOKEN` binding server-side; authenticated live Lens access remains unverified without an approved account.

## Validation

Regression tests exercise the real HTTP handler, MCP transport, shared dispatcher and provider parsers using deterministic upstream fixtures. They block live fetches and cover source attribution, empty results, consent, input bounds, unsupported operations, disabled sources, origin rejection, oversized bodies, malformed responses, rate limits, cancellation and bounded Lens parsing. SDK tests cover consent and response validation.

Verification on 26 October 2026:

- Type checking, ESLint and all 270 web/SDK tests passed.
- Production build, private-build exclusion check and isolated SDK package installation passed.
- A production-build smoke check exercised HTTP, the SDK and the official MCP client against a local ROR HTTP fixture. The server returned parsed, attributed records; nine public tools were discovered; local-index access through `query_source` was rejected. This was a real server/adapter/parser roundtrip with simulated upstream data, not a live ROR or Lens availability claim.

GitHub source publication and application deployment are separate. Verify tool discovery and the endpoint on the intended deployment before assuming the hosted application includes this feature.
