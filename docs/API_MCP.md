# PatentRadar API & MCP

## Connect in ChatGPT

The public connection page is [/connect](https://patentradar-puce.vercel.app/connect). It provides the endpoint, a clipboard action, a link to ChatGPT Plugins, setup steps, a client-config download and an actual anonymous protocol check. Current setup follows [OpenAI's custom MCP guide](https://developers.openai.com/api/docs/guides/custom-mcp-server): Plugins → add a custom MCP server → enter the URL/name/authentication → review → create the plugin. No approved directory listing or automatic installation is claimed. Private token workflows remain separate.

A bounded, read-only SDK connectivity check that performs no third-party patent search:

```bash
PATENTRADAR_URL=https://patentradar-puce.vercel.app node --use-env-proxy scripts/verify-mcp-connection.mjs
```

Base URL (public deployment): `https://patentradar-puce.vercel.app`

- Developer portal: `/developers`
- OpenAPI 3.1: `/api/v1/openapi.json`
- MCP Streamable HTTP: `/api/mcp`
- Discovery descriptor: `/.well-known/mcp.json`
- Health: `/api/v1/health`; source configuration: `/api/v1/providers`

Public research tools are anonymous and use actual provider records. Coverage is partial; an empty response is not clearance. Keyword search queries are sent externally only when `shareQuery=true`. The document-matching tool has a separate, opt-in exact-publication verification flag described below. Send short, reviewed public concepts, not confidential descriptions. Provider quotas and the application rate limit apply; respect HTTP429 and Retry-After. No paid OpenAI tool is exposed anonymously. All server-side credentials stay server-side.

## Query one public source

`POST /api/v1/sources/query`, MCP `query_source` and SDK `querySource()` share one dispatcher and input contract. Set `consent=true` only for approved short public concepts. Inspect the returned `status` even on HTTP 200; unconfigured, unsupported and unavailable sources return explicit outcomes. This public dispatcher does not query the local account/index database or perform AI document processing.

```bash
curl -X POST https://patentradar-puce.vercel.app/api/v1/sources/query \
  -H 'Content-Type: application/json' \
  --data '{"provider":"ror","query":"Oxford","consent":true}'
```

Use the origin of a deployment containing this change. Publishing source to GitHub alone does not prove that the hosted endpoint has been deployed. See [the source-query guide](SOURCE_QUERY.md) for provider operations, response states and SDK examples.

## HTTP examples

```bash
curl https://patentradar-puce.vercel.app/api/v1/health

curl -X POST https://patentradar-puce.vercel.app/api/v1/search \
  -H 'Content-Type: application/json' \
  --data '{"query":"microfluidic","shareQuery":true}'

curl -N -X POST https://patentradar-puce.vercel.app/api/v1/search/stream \
  -H 'Content-Type: application/json' \
  --data '{"query":"microfluidic","shareQuery":true}'

curl -X POST https://patentradar-puce.vercel.app/api/v1/patents/lookup \
  -H 'Content-Type: application/json' \
  --data '{"publicationNumber":"EP1000000A1","publicationDate":"20000517"}'
```

`search` returns distinct patents and scientific-paper arrays, source URLs, retrieval times and coverage warnings. `search/stream` returns NDJSON events; `completed.result` is the final JSON result. Retain partial candidates if the connection drops. Scores are lexical unless explicitly labeled otherwise.

`compare` accepts `{profile,patents}` as defined by OpenAPI. Its records are caller-supplied and are explicitly not certified as server-retrieved. The response includes evidence excerpts, feature overlaps, source links and limitations. Use lookup/search first when sourced records are required.

Public JSON request bodies are limited to 256 KiB. Error envelope: `{ "error": { "code": "INVALID_INPUT|INVALID_JSON|CONSENT_REQUIRED|PAYLOAD_TOO_LARGE|RATE_LIMITED|UNAVAILABLE", "message": "..." } }`. Public API endpoints support server-to-server HTTP; cross-origin browser submissions are rejected by the origin guard. Same-origin developer playground works directly.

## MCP clients

For a client supporting remote HTTP MCP, connect to:

```text
https://patentradar-puce.vercel.app/api/mcp
```

Choose no authentication for public tools. Cursor-style configuration:

```json
{
  "mcpServers": {
    "patentradar": {
      "url": "https://patentradar-puce.vercel.app/api/mcp"
    }
  }
}
```

VS Code configuration uses `servers` instead of `mcpServers`, and `{ "type": "http", "url": "..." }`. Local stdio-only clients need an HTTP bridge supplied by their client; this repository does not claim a native stdio server or OAuth registration.

Official SDK transport, stateless JSON responses, protocol negotiation and validated tool schemas. GET/DELETE return405 because there is no independent event stream/session. Clients must send `Accept: application/json, text/event-stream` on POST and perform the normal initialize handshake. No persistent session ID or replay is promised.

### Public tools

| Tool                        | Input                                                    | Behavior                                                                                                                                  |
| --------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `provider_status`           | `{}`                                                     | Configuration and observed source health; UNTESTED is not healthy                                                                         |
| `search_patents`            | `{query,shareQuery,sources?,seeds?}`                     | Actual parallel patent/research retrieval; explicit external-query sharing                                                                |
| `spot_patent_text`          | `{text,approveProcessing:true,verifyPublication?:false}` | Match approved text against the actual indexed public corpus; optional detected EP-number verification, no external AI                    |
| `lookup_patent`             | `{publicationNumber,publicationDate}`                    | Real EP A/B XML retrieval and available claim text                                                                                        |
| `compare_patent_features`   | `{profile,patents}`                                      | Lexical, explained comparison of supplied records                                                                                         |
| `extract_technical_profile` | `{text}`                                                 | Local literal extraction, no OpenAI call or external document transmission                                                                |
| `component_library`         | `{}`                                                     | Starter templates and manufacturer footprint references, no live supplier retrieval                                                       |
| `inspect_assembly`          | Assembly schema                                          | Missing geometry, housing-envelope checks, known user-entered costs and unverified rights evidence; no external calls or patent clearance |

Tool inputs are bounded and untrusted. No arbitrary SQL, URLs, Python, MCP tool forwarding or paid AI calls are accepted. The server supplies actual source provenance and avoids legal infringement conclusions.

### Private tools and API tokens

On an instance with configured private Blob or persistent local account storage, create an account in Account, then create an API/MCP token. It is shown once, stored hashed, expires in 24 hours and must be kept secret. Send `Authorization: Bearer ...`. Developer tokens work at `/api/v1/*` and `/api/mcp`; they cannot use account-management endpoints. Existing MCP-only tokens remain scoped to `/api/mcp`.

Authenticated MCP clients additionally receive `list_my_projects`. The `search_local_patents` tool is offered only where the local index has a persistent server volume. Anonymous requests never access the private account database. Invalid presented credentials are rejected instead of silently downgraded. Token-authentication does not change source licensing or expand data coverage.

`POST /api/v1/cad/build` accepts the documented assembly schema and requires a developer token (or a signed-in session), a native CAD runtime and complete measurements. It returns actual STEP/STL base64 and meshes. The public Vercel instance does not automatically have this Python/runtime configured; inspect health. Native build/setup instructions: [engineering delivery](engineering/DELIVERY.md).

## Self-host

```bash
npm ci
python3 -m venv .venv-cad
.venv-cad/bin/pip install -r cad/requirements.txt
npm run build
CAD_PYTHON="$PWD/.venv-cad/bin/python" npm run start
```

Use a persistent private volume for PATENTRADAR_DATA_DIR. No cloud patent account is needed for available public providers or local index search. Dockerfile is supplied; native setup has been tested, container build status is recorded separately. Public deployment is not a certificate of production account-auth hardening, complete worldwide coverage or manufacturing-ready CAD.

## Verify with a real MCP client

```bash
PATENTRADAR_URL=http://localhost:3000 node scripts/verify-api-mcp.mjs
```

This initializes the official MCP client, lists tools, extracts supplied text, performs a real exact EPO lookup and a real versioned patent search. It does not use mocked connectivity responses. Automated unit/browser tests remain separately mocked where appropriate. Dated deployment checks are in `docs/API_MCP_RELEASE.json` after publication.

## Deployed verification — 2026-10-25

Production deployment READY at the base URL above. Official SDK client initialization, five-tool discovery, local extraction and actual EP1000000A1 lookup succeeded remotely. Versioned public search returned 12 patent records and 30 scientific records. A separate remote NDJSON check returned 13 patents (including exact EP lookup), first patent at 1.284s, completed at 20.985s; the slower provider did not delay initial patent display. See API_MCP_RELEASE.json and API_STREAM_RELEASE.json. GitHub source is now published at https://github.com/medhiblk/patentradar; see GITHUB_PUBLICATION.md.

## Engineering workbench API (v1.2)

- `GET /api/v1/cad/catalog`: ten starter entries. Two entries link manufacturer board specifications; remaining entries are original editable geometry templates or incomplete envelopes. This is not ten external providers or a live supplier catalogue.
- `POST /api/v1/cad/inspect`: validated assembly JSON. Returns missing measurements, computed pocket-envelope fit, per-currency known purchase subtotals and unverified rights declarations. It never searches patents or builds geometry. Its `patentClearance` is always `NOT ESTABLISHED`. Submit only data approved for processing by this server; no confidential request data is logged or forwarded externally by this operation.
- Optional component metadata: `sourceName`, `referenceUrl`, `templateId`, `role`, `commerce` (HTTP(S) URL, nullable user-entered unit price, currency, recordedAt, basis), `rights` (status, evidenceUrl, note), and `pocket` (wall, floor, targetId). Unknown required dimensions remain null. Native build now supports the same open-top pocket cut, where the native runtime is configured.
- Browser-only CAD also combines STEP-imported solids with parametric parts and can explicitly fuse touching/overlapping solids into one solid. Those operations run in the WASM worker; the public inspection API/MCP tools do not execute CAD. Native API does not accept STEP files mixed into its JSON build contract or perform the browser fusion option.
- New MCP discovery exposes eight public tools, including `spot_patent_text`. Earlier five/seven-tool observations describe older releases.

See [component workbench](engineering/WORKBENCH.md) for reproduction and limitations.

## Public source configuration and dataset catalogues

`EPO_PUBLICATION_SERVER_URL`, `OPENALEX_API_URL` and `WIKIDATA_SPARQL_URL` are compatible server-side aliases. Europe PMC scientific discovery is enabled for MED/PMC article metadata in the parallel search flow and Source Explorer, using `EUROPE_PMC_API_URL`. The legacy PAT archive remains disabled. Scientific titles/identifiers/year links are returned; abstracts/full text are not redistributed by the new adapter.

`GET /api/v1/datasets` lists the USPTO research-dataset catalogue and the legacy PatentsView transition link, plus manual import limitations. It does not download data, search patents or change the local index. PatentsView’s current redirect does not certify anonymous file access. [Verification and import contract](discovery/PROVIDED_ENDPOINTS.md).

## Private document attachments

Open `/files` for private accounts, durable projects and attached originals. Full browser sessions use HttpOnly/SameSite cookies. Developer/MCP tokens intentionally cannot access `/api/attachments` or `/api/vault`; public MCP tools do not receive file contents.

- `GET /api/attachments?projectId=UUID`: owner metadata, SHA-256, pending/ready/deleting state and file quota.
- `POST /api/attachments`: authenticated multipart `projectId` and `file`, up to 4 MB, inspected extension/signature, bounded request body. No automatic AI processing.
- `GET /api/attachments/UUID?projectId=UUID`: original bytes, `Content-Disposition: attachment`, `private, no-store`; requires full owner session. No object-store URLs returned.
- `DELETE /api/attachments/UUID?projectId=UUID`: owner delete, quota released after object removal.
- `/api/vault` account/project sessions now persist in private Blob on Vercel or SQLite on a configured local volume. Existing password hashes/token scopes are preserved. Deleting a project first marks it as deleting, blocks new attachments and removes its stored files.

See [storage setup and limits](PRIVATE_STORAGE.md). Native CAD, the sourced SQLite patent index, and billing are separate capabilities; adding private Blob does not provide those runtimes or complete user-account recovery workflows.

### Search provenance

Search results include optional `searchTrace` with per-run provider states/counts/queries, observed network or cache access, sanitized endpoint paths and actually observed HTTP statuses. Streaming search also emits `searchTrace` on `started` and `providerRun` updates on provider events. These fields are additive; existing publication/source fields remain unchanged. No secret-bearing query strings or headers are exposed. See [search and evidence semantics](SEARCH_EVIDENCE.md).

## Document-to-patent matching: HTTP and MCP

`POST /api/spot` is the anonymous document-matching endpoint used by `/spot`. It accepts **multipart/form-data** with either `file` (an actual PDF, up to 4 MB/80 pages) or `text` (a technical description of at least 30 characters, bounded to 60000 characters). Up to the first 20 PDF text pages are read; scanned PDFs without a usable text layer return a typed error rather than an invented result. `consent=true` optionally permits eligible publication numbers and dates detected in the document to be verified with EPO. The default performs no external lookup and does not send the document to an AI service.

```bash
curl -X POST https://patentradar-puce.vercel.app/api/spot \
  -F 'file=@technical-document.pdf' \
  -F 'consent=false'
```

The JSON response contains `identity`, `profile`, `matches`, `coverage`, `lookupTraces`, `warnings` and `document`. Each match includes its actual patent record, match type, evidence passages and limitations. `document` records the input SHA-256, page count, analysed pages, truncation and input kind. Exact-publication recognition is kept distinct from lexical technical overlap. Coverage is a bounded, attributed reference corpus plus any explicitly requested exact EPO lookup; it is not a worldwide keyword search or a novelty/FTO opinion. Inspect the reported analysed coverage before interpreting a missing match.

MCP clients use **`spot_patent_text`** for approved text, not a PDF upload:

```json
{
  "name": "spot_patent_text",
  "arguments": {
    "text": "User-approved technical text describing components and their operating functions...",
    "approveProcessing": true,
    "verifyPublication": false
  }
}
```

`approveProcessing` must be literal `true`; clients must obtain the user's approval before submitting their text to this server. The schema accepts 30–60000 characters, matching the engine’s bounded total text budget. The tool returns the same core matching evidence and coverage fields as the HTTP matcher, without a PDF-file manifest. `verifyPublication` defaults to `false`. When enabled, only eligible detected EP publication numbers and dates are shared with EPO; the full technical text is not forwarded. No account, paid model, arbitrary URL or expected result identifier is accepted. Tool processing failures return a sanitized `isError` response.
