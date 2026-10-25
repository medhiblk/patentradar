import { europePmcSearchUrl } from "./urls";
import { z } from "zod";
import { request, invalidResponse } from "./http";
import { PatentSchema, type PatentRecord } from "./types";
import { clean } from "./epo-publication";
const RecordSchema = z.object({
  id: z.string(),
  source: z.literal("PAT"),
  title: z.string(),
  abstractText: z.string().optional(),
  patentDetails: z
    .object({
      typeCode: z.string().optional(),
      countryCode: z.string().optional(),
      application: z
        .object({ applicationNumber: z.string().optional() })
        .optional(),
    })
    .optional(),
  fullTextUrlList: z
    .object({ fullTextUrl: z.array(z.object({ url: z.string() })) })
    .optional(),
});
export function parsePatentSearch(raw: unknown, query: string): PatentRecord[] {
  const result = z
    .object({
      hitCount: z.number(),
      resultList: z.object({ result: z.array(RecordSchema).default([]) }),
    })
    .safeParse(raw);
  if (!result.success) return invalidResponse("europe-pmc");
  return result.data.resultList.result.flatMap((record) => {
    // Prefer a source-supplied full identifier. Europe PMC accession IDs can omit US zero padding.
    const link = record.fullTextUrlList?.fullTextUrl
      .map((x) => x.url)
      .find((u) => /surechembl\.org\/document\/[A-Z]{2}-\d+-[A-Z]\d?/.test(u));
    const identifier = link?.match(/\/document\/([A-Z]{2})-(\d+)-([A-Z]\d?)/);
    if (!identifier) return []; // Do not invent missing publication numbers or kind codes.
    const number = identifier[1] + identifier[2] + identifier[3];
    return [
      PatentSchema.parse({
        id: "epmc:" + record.id,
        publicationNumber: number,
        title: clean(record.title),
        abstract: record.abstractText ? clean(record.abstractText) : undefined,
        applicants: [],
        applicationNumber: record.patentDetails?.application?.applicationNumber,
        jurisdiction: record.patentDetails?.countryCode || identifier[1],
        source: "Europe PMC patent archive",
        sourceUrl:
          "https://europepmc.org/article/PAT/" + encodeURIComponent(record.id),
        retrievedAt: new Date().toISOString(),
        queries: [query],
      }),
    ];
  });
}
export async function search(query: string) {
  const terms = query.match(/[\p{L}\p{N}-]+/gu)?.slice(0, 12) || [];
  if (!terms.length) return [];
  // Search literal technical words; never allow the user's text to replace SRC:PAT.
  const expression =
    "SRC:PAT AND (" + terms.map((t) => '"' + t + '"').join(" OR ") + ")";
  const url = europePmcSearchUrl();
  for (const [key, value] of Object.entries({
    format: "json",
    resultType: "core",
    pageSize: "10",
    query: expression,
  }))
    url.searchParams.set(key, value);
  return parsePatentSearch(
    JSON.parse(await request("europe-pmc", url.toString())),
    query,
  );
}
