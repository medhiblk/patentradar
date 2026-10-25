/** New deployment names take precedence; existing configurations remain compatible. */
export function epoPublicationBase() {
  const configured = (
    process.env.EPO_PUBLICATION_SERVER_URL ||
    process.env.EPO_PUBLICATION_URL ||
    "https://data.epo.org/publication-server"
  ).replace(/\/+$/, "");
  return /\/rest\/v1\.2$/.test(configured)
    ? configured
    : configured + "/rest/v1.2";
}
export function openAlexWorksUrl() {
  const base =
    (
      process.env.OPENALEX_API_URL ||
      process.env.OPENALEX_BASE_URL ||
      "https://api.openalex.org"
    ).replace(/\/+$/, "") + "/";
  return new URL(process.env.OPENALEX_WORKS_URL || "works", base);
}
export function europePmcSearchUrl() {
  return new URL(
    process.env.EUROPE_PMC_API_URL ||
      "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
  );
}
export function wikidataSparqlUrl() {
  return new URL(
    process.env.WIKIDATA_SPARQL_URL ||
      process.env.WIKIDATA_API_URL ||
      "https://query.wikidata.org/sparql",
  );
}
function publicCatalogueUrl(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    if (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
      return url.toString();
  } catch {}
  return fallback; // Do not publish credentials or query tokens from misconfigured roots.
}
export function datasetCatalogues() {
  return [
    {
      id: "uspto-economic",
      name: "USPTO research datasets",
      variable: "USPTO_DATASETS_URL",
      url: publicCatalogueUrl(
        process.env.USPTO_DATASETS_URL,
        "https://www.uspto.gov/ip-policy/economic-research/research-datasets",
      ),
      kind: "download-catalogue",
      status: "MANUAL IMPORT",
      detail:
        "Public HTML catalogue. Dataset schema, coverage and redistribution terms must be checked per download; not a patent search API.",
    },
    {
      id: "patentsview-bulk",
      name: "PatentsView bulk data transition",
      variable: "PATENTSVIEW_DATA_URL",
      url: publicCatalogueUrl(
        process.env.PATENTSVIEW_DATA_URL,
        "https://patentsview.org/download/data-downloads",
      ),
      kind: "download-catalogue",
      status: "ACCESS TO VERIFY",
      detail:
        "Default legacy URL redirected to https://data.uspto.gov/support/transition-guide/patentsview on 2026-10-25. HTML/JavaScript landing page only; no bulk file, download authentication or licence verified. Not enabled for automatic imports.",
    },
  ];
}
