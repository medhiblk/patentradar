# PatentRadar API & MCP

Base URL (public deployment): `https://patentradar-puce.vercel.app`

- Developer portal: `/developers`
- OpenAPI 3.1: `/api/v1/openapi.json`
- MCP Streamable HTTP: `/api/mcp`
- Discovery descriptor: `/.well-known/mcp.json`
- Health: `/api/v1/health`; source configuration: `/api/v1/providers`

Public research tools are anonymous and use actual provider records. Coverage is partial; an empty response is not clearance. Queries are sent externally only when `shareQuery=true`. Send short, reviewed public concepts, not confidential descriptions. Provider quotas and the application rate limit apply; respect HTTP429 and Retry-After. No paid OpenAI tool is exposed anonymously. All server-side credentials stay server-side.

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

| Tool | Input | Behavior |
|---|---|---|
| `provider_status` | `{}` | Configuration and observed source health; UNTESTED is not healthy |
| `search_patents` | `{query,shareQuery,sources?,seeds?}` | Actual parallel patent/research retrieval; explicit external-query sharing |
| `lookup_patent` | `{publicationNumber,publicationDate}` | Real EP A/B XML retrieval and available claim text |
| `compare_patent_features` | `{profile,patents}` | Lexical, explained comparison of supplied records |
| `extract_technical_profile` | `{text}` | Local literal extraction, no OpenAI call or external document transmission |
| `component_library` | `{}` | Starter templates and manufacturer footprint references, no live supplier retrieval |
| `inspect_assembly` | Assembly schema | Missing geometry, housing-envelope checks, known user-entered costs and unverified rights evidence; no external calls or patent clearance |

Tool inputs are bounded and untrusted. No arbitrary SQL, URLs, Python, MCP tool forwarding or paid AI calls are accepted. The server supplies actual source provenance and avoids legal infringement conclusions.

### Private tools and API tokens

On a self-hosted instance with persistent account storage, create an account in Account, then create an API/MCP token. It is shown once, stored hashed, expires in 24 hours and must be kept secret. Send `Authorization: Bearer ...`. Developer tokens work at `/api/v1/*` and `/api/mcp`; they cannot use account-management endpoints. Existing MCP-only tokens remain scoped to `/api/mcp`.

Authenticated MCP clients additionally receive `list_my_projects` and `search_local_patents`. Anonymous requests never access the private account database. Invalid presented credentials are rejected instead of silently downgraded. Token-authentication does not change source licensing or expand data coverage.

`POST /api/v1/cad/build` accepts the documented assembly schema and requires a developer token (or a signed-in session), a native CAD runtime and complete measurements. It returns actual STEP/STL base64 and meshes. The public Vercel instance does not automatically have this Python/runtime or persistent SQLite configured; inspect health. Native build/setup instructions: [engineering delivery](engineering/DELIVERY.md).

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
- New MCP discovery exposes seven public tools. Earlier five-tool release observations above describe the older release.

See [component workbench](engineering/WORKBENCH.md) for reproduction and limitations.
