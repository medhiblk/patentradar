// Public configuration guidance: variable NAMES only, never credential values.
export const providerSetup: Record<string, { required: string[]; url: string; note: string }> = {
  veyip: { required: ["ENABLE_EXPERIMENTAL_VEYIP"], url: "https://veyip.com", note: "Experimental third-party patent service; partial coverage." },
  "patent-pages": { required: ["ENABLE_GOOGLE_PATENT_PAGES"], url: "https://patents.google.com", note: "Exact publication identifier required, e.g. EP1000000A1; no keyword search." },
  "europe-pmc": { required: ["ENABLE_EPMC_PATENT_ARCHIVE"], url: "https://europepmc.org/RestfulWebService", note: "Historical patent archive; not a current worldwide patent collection." },
  "epo-linked": { required: ["ENABLE_EPO_LINKED_REFERENCE"], url: "https://www.epo.org/en/searching-for-patents/data/linked-open-data", note: "Occasional reference lookups only. Bulk data required for a production database." },
  "epo-ops": { required: ["EPO_OPS_KEY", "EPO_OPS_SECRET"], url: "https://developers.epo.org/", note: "Register an OPS application and supply its consumer key and secret." },
  uspto: { required: ["USPTO_API_KEY"], url: "https://data.uspto.gov/apis/getting-started", note: "ODP account and API key required; query adapter still pending. A key alone does not implement an adapter." },
  inpi: { required: ["INPI_API_USERNAME", "INPI_API_PASSWORD"], url: "https://data.inpi.fr/espace_personnel/acces", note: "Activate the API PI patent subscription and technical account. Cookie/XSRF login adapter still pending; INPI_API_KEY is not sufficient." },
  "google-patents": { required: ["ENABLE_BIGQUERY", "GOOGLE_CLOUD_PROJECT", "GOOGLE_APPLICATION_CREDENTIALS"], url: "https://github.com/google/patents-public-data", note: "Authorized ADC/WIF and BigQuery job permissions required. Keep the byte limit enabled. GOOGLE_APPLICATION_CREDENTIALS names a server-side credential file, not raw JSON." },
  lens: { required: ["LENS_API_TOKEN"], url: "https://www.lens.org/lens/user/subscriptions", note: "Approved patent API plan and token required; adapter implemented, authenticated live validation pending." },
  cnipa: { required: [], url: "https://english.cnipa.gov.cn/", note: "No verified unrestricted query API. Obtain an authorized data feed and its technical contract before integration." },
  wipo: { required: [], url: "https://patentscope.wipo.int/", note: "No verified unrestricted query API. An authorized data service and technical contract are required; a website login alone is insufficient." },
  "semantic-scholar": { required: ["ENABLE_SEMANTIC_SCHOLAR", "SEMANTIC_SCHOLAR_API_KEY"], url: "https://www.semanticscholar.org/product/api", note: "Anonymous requests may return 429. Obtain an API key and the appropriate usage license for commercial deployment." },
  "local-index": { required: ["PATENTRADAR_DATA_DIR"], url: "https://www.sqlite.org/fts5.html", note: "Requires a writable persistent volume. Vercel /tmp is ephemeral and must not be presented as durable storage." },
};
