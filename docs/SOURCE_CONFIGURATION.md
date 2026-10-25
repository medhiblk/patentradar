# Remaining source configuration

Public diagnostics now include `setup.required`, `setup.url`, and `setup.note`. These contain variable names only, never secrets. Configured does not mean a successful live query.

| Source | Configuration / remaining dependency |
|---|---|
| VeyIP | `ENABLE_EXPERIMENTAL_VEYIP=true`; experimental third-party service |
| Google Patents pages | `ENABLE_GOOGLE_PATENT_PAGES=true`; direct exact publication lookup (e.g. EP1000000A1), not keyword search |
| Europe PMC patents | `ENABLE_EPMC_PATENT_ARCHIVE=true`; historical archive |
| EPO Linked Data | `ENABLE_EPO_LINKED_REFERENCE=true`; occasional application-number reference lookups only; never included as an aggregate production database |
| Semantic Scholar | `ENABLE_SEMANTIC_SCHOLAR=true`; anonymous access may return 429; add `SEMANTIC_SCHOLAR_API_KEY` and obtain appropriate usage rights |
| EPO OPS | Supply `EPO_OPS_KEY` and `EPO_OPS_SECRET` from https://developers.epo.org/ |
| Lens | Supply `LENS_API_TOKEN` for an approved patent API plan. Bounded adapter implemented and contract-tested; authenticated live test pending |
| BigQuery patents | `ENABLE_BIGQUERY=true`, `GOOGLE_CLOUD_PROJECT`, server-side ADC/WIF with job permissions. `GOOGLE_APPLICATION_CREDENTIALS` is a file path, not JSON. Keep `BIGQUERY_MAX_BYTES` bounded |
| USPTO | API key from https://data.uspto.gov/apis/getting-started plus adapter implementation/validation; not completed by setting a flag |
| INPI | Activate patent access at https://data.inpi.fr/espace_personnel/acces. Technical account uses cookie/XSRF authentication, not the placeholder `INPI_API_KEY`. Login/search adapter still pending |
| CNIPA | Authorized data service and technical documentation required. No verified unrestricted query API configured |
| WIPO | Authorized data service and technical documentation required. PATENTSCOPE web login is not a query API |
| Local index | Durable writable server volume via `PATENTRADAR_DATA_DIR`, or a separately implemented managed index. Vercel `/tmp` is not persistent |

Store credentials in server-side Vercel environment settings; never paste them into source code, public configuration or issue comments. Redeploy after changing environment variables, then run a real bounded query to verify access.

## CI regression

The existing partial-results integration test mocked four supplementary adapters but not newly added NASA/DOE/INSPIRE. It unexpectedly called live services and returned 13 papers instead of the expected one. All seven adapters are now mocked, with an assertion that this integration test never calls the network. Live diagnostics remain opt-in.
