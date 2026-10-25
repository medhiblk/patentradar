import { load } from "cheerio";
import { request, invalidResponse } from "./http";
import { endpoint } from "./endpoints";
export function parseCatalogue(html: string, base: string, query: string) {
  const $ = load(html);
  const main = $("main").length ? $("main") : $("article");
  if (!main.length) return invalidResponse("dataset-catalogue");
  const terms = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const seen = new Set<string>();
  return main.find("a[href]").toArray().flatMap(a => {
    const title = $(a).text().trim().replace(/\s+/g, " ");
    const url = new URL($(a).attr("href")!, base);
    if (url.protocol !== "https:" || !/^(www\.)?uspto\.gov$|^data\.uspto\.gov$/.test(url.hostname)) return [];
    if (!/dataset|data files|patent data|disambiguated|long text|sorted.*data|claims research/i.test(title)) return [];
    if (terms.length && !terms.some(t => title.toLowerCase().includes(t))) return [];
    if (seen.has(url.href)) return [];
    seen.add(url.href);
    return [{ title, sourceUrl: url.href, catalogueUrl: base,
      kind: "dataset-catalogue-entry", imported: false, retrievedAt: new Date().toISOString() }];
  }).slice(0, 30);
}
export async function search(provider: "uspto-datasets" | "patentsview-bulk", query: string) {
  const current = "https://www.uspto.gov/ip-policy/economic-research/patentsview";
  const configured = endpoint(["PATENTSVIEW_DOWNLOADS_URL", "PATENTSVIEW_DATA_URL"], current);
  const host = new URL(configured).hostname;
  const url = provider === "uspto-datasets"
    ? endpoint(["USPTO_DATASETS_URL"], "https://www.uspto.gov/ip-policy/economic-research/research-datasets")
    : (host === "patentsview.org" || host === "www.patentsview.org") ? current : configured;
  // The legacy PatentsView download host migrated to USPTO ODP in 2026.
  return parseCatalogue(await request(provider, url), url, query);
}
