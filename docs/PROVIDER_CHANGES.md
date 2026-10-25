# Provider access and diagnostics

This update is limited to public data providers and their API/MCP access. CAD files and tools are unchanged.

- New MCP `query_source` and HTTP `POST /api/v1/sources/query` expose the implemented source operations already used by the source explorer, plus Crossref, OpenAlex, PubMed and exact EPO retrieval. They share one dispatcher.
- Calls require `consent: true` for the short public query. They return `HEALTHY` only after adapter parsing, or an explicit unavailable, unconfigured, unsupported or out-of-scope result. A successful empty query is not evidence of exhaustive coverage.
- NASA NTRS, DOE OSTI and INSPIRE join aggregate research search.
- Serverless searches no longer attempt an unconfigured SQLite index. Local-only requests report missing configuration.
- Aggregate search returns per-source outcomes and record counts, so results remain auditable across serverless processes.
- HAL uses its official `api.hal.science` hostname by default. The environment override remains available.
- Upstream HTTP errors retain their status in typed errors rather than becoming generic network failures.

The registry includes disabled adapters and placeholders; it is not a list of live verified integrations. USPTO, INPI, Lens, CNIPA and WIPO do not currently have implemented query adapters. EPO OPS and BigQuery require server-side credentials. Experimental adapters remain disabled by default. OpenAI is private document processing, not a public patent data source.

API example:

```json
{"provider":"ror","query":"Oxford","consent":true}
```

EPO example:

```json
{"provider":"epo-publication","query":"EP1000000A1","publicationDate":"20000517","consent":true}
```

HAL reference: https://api.hal.science/docs/search
