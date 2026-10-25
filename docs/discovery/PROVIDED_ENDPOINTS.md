# User-provided public source configuration

Real HTTP checks on 2026-10-25: [raw observations](PROVIDED_ENDPOINTS_2026-10-25.json). Seven metadata services returned understood XML, JSON, Atom or SPARQL JSON without credentials. Two catalogue URLs returned HTML, not patent-search responses. These checks do not replace the historical discovery matrix or inflate independent-provider counts.

| Variable | Implemented behavior | Real observation |
| --- | --- | --- |
| EPO_PUBLICATION_SERVER_URL | REST root alias, normalizes existing /rest/v1.2 suffix. Exact EP number + date XML/PDF references, not keyword search. | HTTP200 patent XML for EP1000000A1 / 20000517. |
| OPENALEX_API_URL | Root alias for works search. Explicit OPENALEX_WORKS_URL overrides both roots. | HTTP200 understood works JSON anonymously. |
| CROSSREF_API_URL | Existing keyword works search configuration. | HTTP200 works JSON. |
| EUROPE_PMC_API_URL | New scientific MED/PMC metadata adapter, streamed with other research sources and available in Source Explorer. Legacy patent archive remains separately disabled. | HTTP200 article core JSON. |
| HAL_API_URL | Existing French research search. | HTTP200 HAL JSON. |
| ARXIV_API_URL | Existing Atom research search, conservative >3-second pacing. | HTTP200 Atom entry. |
| WIKIDATA_SPARQL_URL | Alias for bounded company-relation queries; not a patent search engine. | HTTP200 SPARQL ASK JSON. |
| USPTO_DATASETS_URL | Public HTML catalogue linked from Sources and GET /api/v1/datasets. | HTTP200 catalogue HTML; individual file imports not tested. |
| PATENTSVIEW_DATA_URL | Legacy link retained with explicit transition/access caveat. | HTTP200 after redirect to https://data.uspto.gov/support/transition-guide/patentsview . JavaScript HTML landing page, not a downloaded dataset. |

New root aliases take precedence over EPO_PUBLICATION_URL, OPENALEX_BASE_URL and WIKIDATA_API_URL respectively. Existing deployments using only old names continue to work. Service URLs belong on the server and must not contain secrets. New defaults are in .env.example; the fuller registry retains the previous source audit and adds these aliases.

OpenAlex current official authentication documentation redirects from the old docs URL to https://help.openalex.org/api/authentication/ . It explicitly permits casual basic queries without a key, gives a free key a larger budget and lists 10 req/s keyless vs 30 req/s free-key/prepaid, with lower limits for some expensive operations. This app uses bounded keyword search and existing caching/pacing/partial-failure handling, not the higher-cost semantic endpoint or cursor paging. Successful small anonymous calls do not imply unlimited free access.

Europe PMC scientific results expose bibliographic identifiers/titles/years and DOI/article URLs. Abstracts and full text are not returned by the new adapter. The existing PAT archive remains experimental and is not enabled by this configuration. Its older Tier C observation in the global matrix is not silently relabeled as production patent search. Scientific calls and archive calls share provider pacing.

## Dataset ingestion

The two dataset values configure catalogue links, not an automatic downloader. Inspect each dataset's scope, schema, licence and download-access policy. The PatentsView redirect does not prove that its old anonymous bulk files or API still work, and no credentials or download paths are invented.

Once an authorized file has been downloaded and converted to normalized PatentRecord JSONL (including publicationNumber/title/applicants/source/sourceUrl/retrievedAt), use:

```sh
node scripts/index/import-patents.mjs /path/to/authorized-normalized-records.jsonl 'actual dataset licence and attribution'
```

The existing importer does not parse raw USPTO/PatentsView TSV/ZIP formats. It rejects invalid records and does not supply missing publication identifiers/kind codes, claims or a complete corpus. The local SQLite FTS index remains usable as a bounded BigQuery substitute with original source provenance. GET /api/v1/datasets lists these limitations and imports zero records.

## Implementation verification

Production build (including TypeScript), ESLint, 88 unit/integration tests and all 13 Playwright browser workflows passed after these changes. Automated provider calls are mocked, including the newly added scientific provider in the existing partial-failure integration test. Separate real HTTP observations are stored above; those are not inferred from mocks.
