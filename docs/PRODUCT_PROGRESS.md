# Product progress — 26 October 2026

## Focus: the engineering-document → patent-evidence journey

The `/spot` page previously compared only the bounded public medtech corpus and optionally looked up an eligible detected EP number. The existing multi-provider retrieval engine was available elsewhere but not connected to this workflow.

### Implemented in this change

- Keep the first bounded PDF/text comparison and exact evidence/source links.
- After that check, review/edit a short query (3–150 characters) and separately approve external search. Editing the query revokes its previous approval.
- Reuse the existing search orchestrator and source-specific adapters. No mock data is added to production and no unauthenticated BigQuery substitute is invented.
- Stream source runs and patent candidates over NDJSON; retain the initial evidence while retrieval continues.
- Compare retrieved patent evidence against the actual supplied document passages, preserving source URLs, claim/abstract distinctions and page offsets.
- Show retrieved records lacking sufficient supported overlap separately from technical matches. Scientific papers never count as patents.
- Retain received evidence when sources fail or the bounded extended-search deadline is reached. The original PDF, request abort, size and page limits are preserved.
- Include approved queries and actual source audit traces in evidence PDF reports. Private project navigation now points directly to `/files`.

### Implementation boundaries

The browser sends the original source only to this application's ingestion endpoint. Search providers receive the approved short query and eligible publication identifiers. Extraction and comparison in this route do not call external AI. The anonymous public corpus stays a limited reference index, not a worldwide database. OpenAIRE coverage is a literature-linked subset; configured authenticated providers remain credential-dependent. A result's presence is not a legal opinion, a competitor finding, or manufacturing clearance.

Routes: `/api/spot` remains backward-compatible JSON. `/api/spot/expand` is separately rate-limited and returns progressive NDJSON. Both use the same server-side bounded ingestion helper.

### Retrieval defect found by real HTTP testing

An unfiltered `stent` search returned eight scientific records and zero patents on its first OpenAIRE page. The documented `instancetype=Patent` filter returned HTTP 200 and actual US/WO publication keys, including US9993329B2 and WO2012164292A1. The term is case-sensitive: lowercase `patent` returned an empty result. A second parser defect ignored patent instances directly nested under `children.instance`, incorrectly counting those records as papers; that nesting is now supported and regression-tested. The orchestrator now requests patent-filtered OpenAIRE pages; the adapter's default mixed behavior is preserved for existing independent callers.

Official parameter documentation: https://graph.openaire.eu/docs/11.0.0/apis/search-api/research-products/
Official vocabulary: https://api.openaire.eu/vocabularies/dnet:publication_resource

### Validation and remaining work

Validation completed locally: **73/73 targeted unit/integration tests**, **6/6 desktop/mobile browser scenarios**, lint on changed code and a production build. A real pre-parser-fix extended search returned seven patent publications; its raw records exposed the additional nesting defect described above. Final production verification is performed after deployment.

Automated checks cover original real PDF hashes and identities, genuine source excerpt offsets, consent rejection before retrieval, source-failure retention, and new stream events. External retrieval is mocked in automated expansion tests; live provider observations must be recorded separately. The responsive UI test uses real first-pass extraction and an explicitly mocked expansion transport.

Remaining priorities: broaden legally accessible patent coverage with measured recall; authenticated project attachment/history handoff; scanned-document interpretation with explicit processing consent. The 3D tools and existing integrations remain in place. Nothing in this change claims arbitrary drawing-to-CAD reconstruction or complete freedom-to-operate analysis.
