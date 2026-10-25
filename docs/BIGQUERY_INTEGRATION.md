# Google Patents / BigQuery integration decision

Audit date: 2026-10-25. **NOT OPERATIONAL. No successful SQL query.** Anonymous tables.get returned 401. Local GOOGLE_CLOUD_PROJECT, GOOGLE_APPLICATION_CREDENTIALS and standard ADC file are absent; only example env files exist. Production health reports NOT CONFIGURED. Remote secret values were neither requested nor inspected.

## Authoritative references and verification limits

- Official dataset repository: https://github.com/google/patents-public-data
- Documented schema: https://github.com/google/patents-public-data/blob/master/tables/dataset_Google%20Patents%20Public%20Datasets.md
- Catalogue: https://github.com/google/patents-public-data/blob/master/tables/index.md
- Sandbox: https://docs.cloud.google.com/bigquery/docs/sandbox
- Authentication: https://docs.cloud.google.com/bigquery/docs/authentication
- Pricing: https://cloud.google.com/bigquery/pricing
- Cost controls: https://docs.cloud.google.com/bigquery/docs/best-practices-costs
- REST table metadata: https://docs.cloud.google.com/bigquery/docs/reference/rest/v2/tables/get
- Parameterized queries: https://docs.cloud.google.com/bigquery/docs/parameterized-queries
- Cached results: https://docs.cloud.google.com/bigquery/docs/cached-results

The official repository is archived (April 18, 2026); its schema report contains 2018 statistics. Those dates are NOT the current table refresh date. Authenticated tables.get and dataset table enumeration must establish live schema, location, lastModifiedTime, partitioning and clustering. Current schema/freshness/row coverage remain UNVERIFIED; do not invent a 2026 snapshot name.

## Exact documented tables and fields

Primary target: `patents-public-data.patents.publications`. Secondary optional targets: `patents-public-data.google_patents_research.publications` (research enrichments, not a substitute for publication evidence) and `patents-public-data.cpc.definitions` (classification vocabulary). Verify all three independently before enabling; do not query wildcards of historical snapshots.

Documented publication fields to verify with tables.get:

| Fields | Types / intended mapping |
|---|---|
| publication_number, application_number, country_code, kind_code | STRING; publication number DOCDB form e.g. US-7650331-B1; preserve raw and canonical IDs |
| family_id | STRING, simple family; namespace with dataset/provider |
| title_localized, abstract_localized | REPEATED RECORD with text STRING and language STRING |
| claims_localized, description_localized | Same localized structure; documented US full text, not guaranteed global claims; description historically capped at 9 MB |
| publication_date, filing_date, grant_date, priority_date | INTEGER date values; validate YYYYMMDD, treat zero/invalid as missing |
| inventor, assignee | REPEATED STRING; retain original names |
| inventor_harmonized, assignee_harmonized | REPEATED RECORD with name/country_code; not proof of entity identity |
| ipc, cpc | REPEATED RECORD; code, inventive, first, tree in documented schema |
| citation | REPEATED RECORD; patent publication/application references and NPL text, type/category; validate actual subfields before codegen |
| priority_claim | REPEATED RECORD; separate from citations and family equivalence |

Retrieve backward patent citations from citation.publication_number; forward citations require reverse search/index and can be expensive. Family expansion uses nonempty family_id, never title similarity. No comprehensive current legal status, drawings binary or guaranteed worldwide claims follows from these fields. Localized text is supplied data; do not label it human translation without evidence. Retain CC BY 4.0 credit to IFI CLAIMS Patent Services and Google for this dataset. Other tables have their own licences; source-code licence and website access terms are separate.

## Sandbox, identity and cost

Sandbox can evaluate SELECT queries against public datasets without a credit card/billing account. It still needs a Google identity, Cloud project and permission to create query jobs. Current Sandbox docs specify 1 TiB processed/month, a lifetime 10 GiB storage allocation, 60-day table/view/partition expiration, and no DML, streaming ingestion or Data Transfer Service. These restrictions do not prohibit HTTP response streaming in PatentRadar. It is sufficient for a bounded validation query if its scan fits the remaining quota; it is not evidence that broad interactive full-text search will fit.

For paid on-demand US pricing, use the current regional SKU (commonly $6.25/TiB beyond the first 1 TiB/month); verify deployment region/currency before activation. An illustrative 10 GiB billable scan is about $0.061, 100 GiB about $0.61 at that rate, excluding free allocation and other charges. Actual cost is UNKNOWN until dry run/job statistics. LIMIT limits returned rows, not scanned bytes. Narrow WHERE filters are not a cost guarantee absent verified partition/cluster pruning. Full-text global scans may exhaust free quota in very few searches.

## Exact user/admin prerequisites

1. Sign in to BigQuery Studio, create/select a project and accept required Cloud terms. Start in Sandbox without billing if desired. Supply only the project ID to the operator, never paste private keys into chat.
2. Enable BigQuery API if not already enabled. Grant the runtime principal `roles/bigquery.jobUser` on the query project. Public table read access must be checked; private derived datasets additionally need scoped dataViewer (and writer only for the separate indexing job). Do not grant Owner.
3. Local verification: use `gcloud auth application-default login` with the authorized account and configure its quota project. A plain gcloud login is not necessarily ADC. Set GOOGLE_CLOUD_PROJECT. The ADC file stays outside the repo.
4. Hosted verification: configure workload identity federation for the Vercel server runtime and Google service account; if unavailable, provision a narrowly scoped service-account credential through deployment secrets, never NEXT_PUBLIC. GOOGLE_APPLICATION_CREDENTIALS denotes an actual runtime file/config path, not raw JSON. Implement auth resolution that supports ADC/WIF; the current registry requiring that env variable rejects valid non-file auth.
5. Authorize a maximum scan budget. Do not enable billing or increase a hard cap automatically. If Sandbox refuses a legitimate bounded query, capture the exact error and decide whether billing is needed; do not assume billing is universally mandatory for SELECT.

## First real validation, before claiming integration

Use tables.get on the primary table; record only metadata/schema, not secrets. Verify region, table version/etag and last modification. Dry-run a parameterized exact-seed lookup with one known DOCDB ID and selected metadata columns. Set maximumBytesBilled, then execute only if within the approved cap. Record job ID, location, cacheHit, totalBytesProcessed, totalBytesBilled, elapsed time and actual returned publication. A dry run, SELECT 1 or HTTP200 metadata response alone is not patent retrieval proof. Claims retrieval needs a separate real US example and an empty/non-US example; leave unsupported fields absent.

## Architecture and proposed limits (configuration, not measured capacity)

Server-only `@google-cloud/bigquery` adapter behind the existing registry. No browser SQL/credentials. Fixed allowlisted tables and parameterized values; no LLM-generated SQL. Batch up to 10 normalized seed IDs into one lookup with `IN UNNEST(@publicationNumbers)`. Select metadata first; top 5 selected patents may request claims separately. Never SELECT * or fetch descriptions for every candidate.

Start conservative: 1 GiB maximumBytesBilled/job, 2 jobs/request, 30-second deadline, 20 result candidates; dry run first. A cap rejection is a visible provider outcome, not a reason to silently raise the cap. Exact ID lookup can still exceed this bound if source layout scans too much: use other providers and evaluate a limited, authorized derived index. Shared monthly reservation ledger should stop before 0.8 TiB in a sandbox experiment, accounting for concurrent jobs and external usage; GCP project quotas are the hard backstop.

Public-record cache: normalized ID + language + table version, 24h TTL; query cache: normalized approved concepts/filters + query-template version, 15min. Cache negative results briefly and errors only as backoff signals. Private profiles/rerank outputs must use tenant/session-scoped keys. BigQuery's own cache is opportunistic; don't assume every normalized app request is a BigQuery cache hit. Cancel query jobs on timeout/disconnect where feasible; cancellation can still incur bytes already processed. Never log invention descriptions or query parameter payloads.

Incremental sync is optional after cost measurement: compare source table metadata, stage bounded authorized extracts, upsert by publication/version in owned storage. Publication-date watermark alone misses corrections/backfills; use overlap/reconciliation and record snapshot identity. No confirmed row-level change feed is available from this audit. Sandbox DML/expiry restrictions make it unsuitable for a permanent full-corpus mirror. Do not automatically create one.

## Implementation follow-up

A feature-flagged SDK adapter now exists. See IMPLEMENTATION_STATUS.md for tested behavior and remaining constraints. The original audit's lack of credentials and real SQL proof remains unresolved; implementation does not establish live operational status.
