import { load } from "cheerio";
import { request, invalidResponse } from "./http";
import { normalizePublication } from "../normalize";
import { PatentSchema, type PatentRecord } from "./types";
export function parsePatentPage(
  html: string,
  record: PatentRecord,
): PatentRecord {
  const $ = load(html);
  const number = $('meta[name="citation_patent_publication_number"]')
    .attr("content")
    ?.replace(/:/g, "");
  if (
    !number ||
    normalizePublication(number) !==
      normalizePublication(record.publicationNumber)
  )
    return invalidResponse("patent-pages");
  const applicants = $('meta[name="DC.contributor"][scheme="assignee"]')
    .map((_, e) => $(e).attr("content") || "")
    .get()
    .filter(
      (name) =>
        !!name &&
        !/^(individual|unknown|unassigned|not available)$/i.test(name),
    );
  const claims = $(".claim-text")
    .filter((_, e) => $(e).parents(".claim-text").length === 0)
    .map((_, e) => $(e).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean)
    .slice(0, 30);
  const pdf = $('meta[name="citation_pdf_url"]').attr("content");
  const pdfUrl =
    pdf &&
    /^https:\/\/patentimages\.storage\.googleapis\.com\/[\w/.-]+\.pdf$/.test(
      pdf,
    )
      ? pdf
      : undefined;
  const url =
    "https://patents.google.com/patent/" + record.publicationNumber + "/en";
  return PatentSchema.parse({
    ...record,
    applicants: applicants.length ? applicants : record.applicants,
    claims: claims.length ? claims : record.claims,
    pdfUrl,
    source: claims.length
      ? "Google Patents public publication page"
      : record.source,
    sourceUrl: claims.length ? url : record.sourceUrl,
    additionalSources: [
      { name: record.source, url: record.sourceUrl },
      { name: "Google Patents public publication page", url },
    ],
    retrievedAt: new Date().toISOString(),
  });
}
export async function enrich(record: PatentRecord) {
  const number = normalizePublication(record.publicationNumber);
  return parsePatentPage(
    await request(
      "patent-pages",
      "https://patents.google.com/patent/" + number + "/en",
    ),
    record,
  );
}

// Exact publication lookup; every returned field comes from the retrieved page.
export async function lookup(publication: string) {
  const number = normalizePublication(publication);
  const url = "https://patents.google.com/patent/" + number + "/en";
  const html = await request("patent-pages", url);
  const $ = load(html);
  const title = $('meta[name="DC.title"]').attr("content") ||
    $('meta[name="citation_title"]').attr("content");
  if (!title) return invalidResponse("patent-pages");
  const record = parsePatentPage(html, {
    id: number, publicationNumber: number, title: title.trim(), applicants: [],
    abstract: $('meta[name="DC.description"]').attr("content"),
    source: "Google Patents public publication page", sourceUrl: url,
    retrievedAt: new Date().toISOString(),
  });
  return [record];
}
