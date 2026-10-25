# PatentRadar implementation audit

Audit: 2026-10-25. Scope: actual `/workspace/patentradar` source, tests and selected HTTP observations. Planning only; no application changes. This workspace has no `.git`, so no commit identity can be certified. The most recent invention-workspace changes were previously reported as not deployed; do not equate local source with production.

## Evidence standard

WORKING means the bounded behavior has evidence, not complete product readiness. PARTIALLY WORKING includes working subsets and coded paths lacking live proof. BLOCKED means an external prerequisite prevents validation. NOT IMPLEMENTED means the behavior is absent, even if types or UI labels exist.

Fresh validation: `npm test` passed **45/45** (core 21, discovery 21, seeds 3). These are predominantly fixture/mock tests, not certification of provider availability. No browser suite rerun in this audit. Existing `tests/e2e/workflow.spec.ts` still references the removed label `Or describe your technical design` in two scenarios: the earlier seven-scenario pass does not certify the latest UI. Earlier build success is historical, not rerun here.

Fresh HTTP: production `/api/health/providers` returned 200; BigQuery `GET https://bigquery.googleapis.com/bigquery/v2/projects/patents-public-data/datasets/patents/tables/publications` without credentials returned **401**. No SQL query was executed. Production registry reports Google/OPS NOT CONFIGURED and Google HTML enrichment disabled. Runtime UNTESTED is not a successful connectivity probe.

Historical real evidence: `docs/discovery/evidence/adapter-smoke.json` records 17 successful local source operations; `production-smoke.json` records 16/17 initial successes, 12 patent metadata records, 30 papers and PDF output. HAL subsequently returned 503 (`production-followup.json`). Treat these as dated observations, not present uptime promises.

## Feature matrix

| Feature | Verdict | Actual evidence / limitation |
|---|---|---|
| Free-text submission | WORKING | `src/app/page.tsx` → `/api/extract`; actual local extraction tested in `tests/core.test.ts`. Minimum 30 characters. |
| PDF technical uploads | WORKING | `src/app/api/extract/route.ts`: MIME, extension, magic bytes, 4 MB, 80 pages, bounded 60k text, pdfjs server extraction; actual PDF test. One PDF replaces free-text description rather than merging it. |
| Scans, drawings, diagrams, CAD/OCR | NOT IMPLEMENTED | No image/OCR ingestion; scanned PDFs rejected for insufficient text. |
| AI profile extraction | PARTIALLY WORKING | `src/lib/extract.ts` uses Responses structured output, consent and literal quote validation. No local OpenAI key, no fresh live AI call. Local fallback is real input, not synthetic. |
| Editable interpretation | WORKING | `page.tsx` feature and keyword fields before research; existing UI tests cover extraction/review. Classification candidates are absent from `ProfileSchema`. |
| Confidentiality | PARTIALLY WORKING | Separate AI and search consent, in-memory uploads, no source query uses full profile by design. Research fallback can use profile title; prompt-only anonymization is insufficient. No authenticated tenant boundary. |
| Multiple seed input / normalization | PARTIALLY WORKING | `patent-seeds.ts` + 3 tests; local project links work. Callback `onAnalyze(description)` drops title and seeds. Normalizer differs from strict `normalizePublication`; historical JP/US formats need tests. |
| Exact seed retrieval | PARTIALLY WORKING | Research schema accepts only one `publicationNumber`; EPO lookup requires EP A/B kind and YYYYMMDD date. XML parser extracts English title, abstract, claims where present. |
| Seed expansion / common classifications / related inventors | NOT IMPLEMENTED | No seed resolver or expansion orchestration. `familyGroups` helper is not a retrieval path. |
| Parallel sources | WORKING | `api/research/route.ts` creates promises then `Promise.allSettled`; isolated errors retained as warnings. Mostly scientific sources; default patent discovery is OpenAIRE's literature-linked subset. |
| Progressive / streamed results | NOT IMPLEMENTED | Server waits for all jobs and optional enrichment; client `json()` reads whole response text. Motion/spinner is not streaming. |
| Cross-provider patent dedup | PARTIALLY WORKING | `normalize.ts` combines queries by normalized publication number but keeps first record, losing later claims, fields and source attribution. One malformed ID can throw during aggregate dedup. |
| Research dedup | PARTIALLY WORKING | `diversePapers` compares lowercased URLs, not DOI identity. Same paper through different source URLs can duplicate. |
| Hybrid matching / AI reranking | NOT IMPLEMENTED | `compare.ts` is lexical token overlap. No embeddings, semantic retrieval or rerank call in research route. CJK bigrams do not translate concepts. |
| Feature-to-claim display | PARTIALLY WORKING | `compare.ts` chooses claim with most overlapping words; falls back to abstract/title. No stable claim IDs, element mapping, entailment validation or AI comparison. Excerpt truncated to 1200 characters. |
| Legal status / patent citations | NOT IMPLEMENTED | Interfaces exist in `providers/contracts.ts`, but normalized record has neither status nor citation edges and no end-to-end retrieval. Scientific citations from OpenCitations are not patent citation graphs. |
| Translation | NOT IMPLEMENTED | No translation route, original/translated passage model or source alignment. |
| Families | PARTIALLY WORKING | Optional familyId and explicit grouping helper; no complete family lookup/expansion, no namespace on IDs. |
| Competitor intelligence | PARTIALLY WORKING | Applicant aggregation and organization lookup candidates; no verified competitor relationships, portfolio completeness or scheduled watches. |
| Projects/history | PARTIALLY WORKING | `invention-workspace.tsx` localStorage projects, open/delete and description handoff; `page.tsx` up to eight local reports. No project update-in-place or attachment persistence. Storage parsing lacks schema validation; hydration needs browser test. |
| Account privacy / credits / billing | NOT IMPLEMENTED | No auth, database, tenant checks, usage ledger or payment flows/dependencies. |
| Alerts / newsletters / saved scheduled searches | NOT IMPLEMENTED | No scheduler, subscription model or email implementation. |
| Reports | WORKING | `api/report/route.ts`, `lib/report.ts`, PDF tests and historical real PDF. Basic-font multilingual output remains limited. |
| Responsive UX | PARTIALLY WORKING | Existing responsive CSS/mobile tests; latest label changes break old selectors. Full requested navigation/account/monitoring structure not finished. |
| Google reference links | PARTIALLY WORKING | Generated in `patent-seeds.ts` and result cards, correctly separate from source. Destination existence is not checked. |
| Google BigQuery | BLOCKED | `providers/google-patents.ts` only returns registry status. No SDK, SQL or adapter execution. Missing local project/ADC; production registry NOT CONFIGURED. Coding work also required. |
| Google HTML | BLOCKED | `patent-pages.ts` contains parser/enrichment, but policy opt-in disabled. Do not enable as a substitute for BigQuery. |
| Rate limits/cache | PARTIALLY WORKING | `providers/http.ts`: timeout, retry/backoff, Retry-After, bounded reads, in-flight coalescing and process-local maps. Vercel instances do not share budgets/cache; OpenAIRE pacing may reject second uncached query. |
| Health/observability | PARTIALLY WORKING | Process-local observations and dated eligibility catalogue; no shared metrics or query cost ledger. All research responses currently hardcode PARTIAL. |
| MCP | PARTIALLY WORKING | Read-only VeyIP MCP client tested historically; experimental and disabled. No PatentRadar MCP server or tenant-scoped tools. |

## Provider inventory: implementation is not live verification

- Default automatic: OpenAIRE patent/research subset; Crossref, OpenAlex, PubMed, DataCite, HAL, arXiv and Zenodo research. Real historical smoke evidence exists; current availability varies.
- EPO Publication Server: real exact XML/PDF retrieval, not worldwide keyword search.
- Additional `/api/intelligence` operations: INSPIRE, NASA, DOE, ROR, GLEIF, French companies, Wikidata, PubChem, RCSB, OpenCitations. They are not interchangeable patent search providers.
- OPS OAuth and bibliographic parser are coded; live authentication/search not established here. An obsolete comment says normalization pending despite implementation: use behavior/tests, not comments.
- VeyIP, EPO Linked reference, Europe PMC archive, Semantic Scholar and Google HTML require policy flags. Preserve disabled defaults.
- USPTO, INPI, Lens, CNIPA, WIPO and Google BigQuery status wrappers are not functioning adapters. Registry's 80 endpoints / 26 families are an audit catalogue, not 80 operational patent searches.

## Highest-impact defects

1. Seed data is lost before the server request.
2. Default patent coverage is narrow; Google adapter has no implementation or credentials.
3. Dedup discards complementary evidence, undermining claim comparison.
4. No partial display; slowest provider dictates perceived response time.
5. Semantic/claim-level product expectations exceed lexical implementation.
6. Public AI endpoints and process-local limits need shared cost protection before exposing paid retrieval.
