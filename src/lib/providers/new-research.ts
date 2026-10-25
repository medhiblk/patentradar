import { z } from "zod";
import { load } from "cheerio";
import { request, invalidResponse } from "./http";
import type { Paper } from "./types";
const date = () => new Date().toISOString();
export async function datacite(query: string, page = 1): Promise<Paper[]> {
  const url = new URL(
    process.env.DATACITE_DOIS_URL || "https://api.datacite.org/dois",
  );
  url.searchParams.set("query", query);
  url.searchParams.set("page[size]", "4");
  url.searchParams.set("page[number]", String(page));
  const data = z
    .object({
      data: z.array(
        z.object({
          id: z.string(),
          attributes: z.object({
            titles: z.array(z.object({ title: z.string() })),
            publicationYear: z.number().optional(),
          }),
        }),
      ),
    })
    .parse(JSON.parse(await request("datacite", url.toString())));
  return data.data.map((r) => ({
    id: r.id,
    title: r.attributes.titles[0]?.title || "Untitled dataset",
    year: r.attributes.publicationYear,
    source: "DataCite (CC0 metadata)",
    sourceUrl: "https://doi.org/" + r.id,
    retrievedAt: date(),
  }));
}
export async function hal(query: string, page = 1): Promise<Paper[]> {
  const url = new URL(
    process.env.HAL_API_URL || "https://api.hal.science/search/",
  );
  Object.entries({
    q: query,
    wt: "json",
    rows: "4",
    start: String((page - 1) * 4),
    fl: "halId_s,title_s,producedDateY_i,uri_s",
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  const data = z
    .object({
      response: z.object({
        docs: z.array(
          z.object({
            halId_s: z.string(),
            title_s: z.array(z.string()),
            producedDateY_i: z.number().optional(),
            uri_s: z.string().url(),
          }),
        ),
      }),
    })
    .parse(JSON.parse(await request("hal", url.toString())));
  return data.response.docs.map((r) => ({
    id: r.halId_s,
    title: r.title_s[0] || "Untitled record",
    year: r.producedDateY_i,
    source: "HAL (CC0 metadata)",
    sourceUrl: r.uri_s,
    retrievedAt: date(),
  }));
}
export function parseArxiv(xml: string): Paper[] {
  const $ = load(xml, { xml: true });
  if (
    !$("feed").length ||
    $("entry id")
      .toArray()
      .some((e) => $(e).text().includes("/api/errors"))
  )
    return invalidResponse("arxiv");
  return $("entry")
    .toArray()
    .map((e) => {
      const id = $(e).find("id").first().text();
      if (!/^https?:\/\/arxiv\.org\/abs\//.test(id)) return null;
      return {
        id,
        title: $(e).find("title").first().text().replace(/\s+/g, " ").trim(),
        year: Number($(e).find("published").text().slice(0, 4)) || undefined,
        source: "arXiv (CC0 metadata)",
        sourceUrl: id.replace("http:", "https:"),
        retrievedAt: date(),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
}
export async function arxiv(query: string, page = 1) {
  const url = new URL(
    process.env.ARXIV_API_URL || "https://export.arxiv.org/api/query",
  );
  const literal = query.replace(/["\\]/g, " ").slice(0, 250);
  url.searchParams.set("search_query", 'all:"' + literal + '"');
  url.searchParams.set("start", String((page - 1) * 4));
  url.searchParams.set("max_results", "4");
  return parseArxiv(await request("arxiv", url.toString()));
}
export async function zenodo(query: string, page = 1): Promise<Paper[]> {
  const url = new URL(
    process.env.ZENODO_RECORDS_URL || "https://zenodo.org/api/records",
  );
  url.searchParams.set("q", query);
  url.searchParams.set("size", "4");
  url.searchParams.set("page", String(page));
  const data = z
    .object({
      hits: z.object({
        hits: z.array(
          z.object({
            id: z.union([z.number(), z.string()]),
            metadata: z.object({
              title: z.string(),
              publication_date: z.string().optional(),
            }),
            links: z.object({ self_html: z.string().url() }),
          }),
        ),
      }),
    })
    .parse(JSON.parse(await request("zenodo", url.toString())));
  return data.hits.hits.map((r) => ({
    id: "zenodo:" + r.id,
    title: r.metadata.title,
    year: Number(r.metadata.publication_date?.slice(0, 4)) || undefined,
    source: "Zenodo (CC0 metadata)",
    sourceUrl: r.links.self_html,
    retrievedAt: date(),
  }));
}
export async function inspire(query: string, page = 1): Promise<Paper[]> {
  const url = new URL("https://inspirehep.net/api/literature");
  url.searchParams.set("q", query);
  url.searchParams.set("size", "4");
  url.searchParams.set("page", String(page));
  const data = z
    .object({
      hits: z.object({
        hits: z.array(
          z.object({
            id: z.string(),
            metadata: z.object({
              titles: z.array(z.object({ title: z.string() })),
              preprint_date: z.string().optional(),
            }),
          }),
        ),
      }),
    })
    .parse(JSON.parse(await request("inspire", url.toString())));
  return data.hits.hits.map((r) => ({
    id: "inspire:" + r.id,
    title: r.metadata.titles[0]?.title || "Untitled record",
    year: Number(r.metadata.preprint_date?.slice(0, 4)) || undefined,
    source: "INSPIRE (CC0 metadata)",
    sourceUrl: "https://inspirehep.net/literature/" + r.id,
    retrievedAt: date(),
  }));
}
export async function nasa(query: string, page = 1): Promise<Paper[]> {
  if (page !== 1)
    throw new Error("NASA adapter supports the first bounded page only.");
  const url = new URL(
    process.env.NASA_NTRS_SEARCH_URL ||
      "https://ntrs.nasa.gov/api/citations/search",
  );
  url.searchParams.set("q", query);
  url.searchParams.set("page.size", "4");
  const data = z
    .object({
      results: z.array(
        z.object({ id: z.union([z.string(), z.number()]), title: z.string() }),
      ),
    })
    .parse(JSON.parse(await request("nasa", url.toString())));
  return data.results.map((r) => ({
    id: "nasa:" + r.id,
    title: r.title,
    source: "NASA NTRS metadata; document rights vary",
    sourceUrl: "https://ntrs.nasa.gov/citations/" + r.id,
    retrievedAt: date(),
  }));
}
export async function doe(query: string, page = 1): Promise<Paper[]> {
  if (page !== 1)
    throw new Error("DOE adapter supports the first bounded page only.");
  const url = new URL(
    process.env.DOE_OSTI_RECORDS_URL || "https://www.osti.gov/api/v1/records",
  );
  url.searchParams.set("search", query);
  url.searchParams.set("rows", "4");
  const data = z
    .array(
      z.object({
        osti_id: z.string(),
        title: z.string(),
        publication_date: z.string().optional(),
      }),
    )
    .parse(JSON.parse(await request("doe", url.toString())));
  return data.map((r) => ({
    id: "osti:" + r.osti_id,
    title: r.title,
    year: Number(r.publication_date?.slice(0, 4)) || undefined,
    source: "DOE OSTI metadata; full-text rights vary",
    sourceUrl: "https://www.osti.gov/biblio/" + r.osti_id,
    retrievedAt: date(),
  }));
}
