import { request, invalidResponse } from "./http";
import { normalizePublication } from "../normalize";
import { PatentSchema, type PatentRecord } from "./types";
export const clean = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
export function parsePublication(xml: string, url: string): PatentRecord {
  const root = xml.match(/<ep-patent-document\s([^>]+)>/);
  if (!root) return invalidResponse("epo-publication");
  const attr = (n: string) => root[1].match(new RegExp(`${n}="([^"]+)"`))?.[1];
  const number = normalizePublication(
    `${attr("country")}${attr("doc-number")}${attr("kind")}`,
  );
  const title =
    xml.match(/<B541>en<\/B541>\s*<B542>([\s\S]*?)<\/B542>/)?.[1] ||
    xml.match(
      /<invention-title[^>]*lang="en"[^>]*>([\s\S]*?)<\/invention-title>/,
    )?.[1];
  if (!title) return invalidResponse("epo-publication");
  const applicantBlock =
    xml.match(/<B710>([\s\S]*?)<\/B710>/)?.[1] ||
    xml.match(/<applicants[^>]*>([\s\S]*?)<\/applicants>/)?.[1] ||
    "";
  const applicants = [
    ...applicantBlock.matchAll(/<(?:snm|name)>([\s\S]*?)<\/(?:snm|name)>/g),
  ].map((m) => clean(m[1]));
  const claimsBlock =
    xml.match(/<claims[^>]*lang="en"[^>]*>([\s\S]*?)<\/claims>/)?.[1] || "";
  const claims = [
    ...claimsBlock.matchAll(/<claim\s[^>]*>([\s\S]*?)<\/claim>/g),
  ].map((m) => clean(m[1]));
  const date = attr("date-publ");
  return PatentSchema.parse({
    id: number,
    publicationNumber: number,
    title: clean(title),
    abstract:
      clean(
        xml.match(/<abstract[^>]*lang="en"[^>]*>([\s\S]*?)<\/abstract>/)?.[1] ||
          "",
      ) || undefined,
    applicants,
    claims: claims.length ? claims : undefined,
    publicationDate: date?.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
    jurisdiction: attr("country"),
    source: "EPO Publication Server",
    sourceUrl: url,
    retrievedAt: new Date().toISOString(),
  });
}
export async function lookup(input: string, date?: string) {
  const number = normalizePublication(input);
  if (!/^EP\d+[AB]\d$/.test(number))
    throw new Error(
      "Public retrieval currently supports EP A/B publications only.",
    );
  if (!date || !/^\d{8}$/.test(date))
    throw new Error("EPO publication date (YYYYMMDD) is required.");
  const id = number.replace(/([AB]\d)$/, "NW$1");
  const url = `${process.env.EPO_PUBLICATION_URL || "https://data.epo.org/publication-server"}/rest/v1.2/publication-dates/${date}/patents/${id}/document.xml`;
  const record = parsePublication(await request("epo-publication", url), url);
  if (record.publicationNumber !== number)
    throw new Error("Publication identifier mismatch");
  return [{ ...record, pdfUrl: url.replace(/document\.xml$/, "document.pdf") }];
}
