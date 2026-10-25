import { z } from "zod";
import { request, invalidResponse } from "./http";
import { europePmcSearchUrl } from "./urls";
import { clean } from "./epo-publication";
import type { Paper } from "./types";
export function parseResearch(raw: unknown): Paper[] {
  const parsed = z
    .object({
      hitCount: z.number(),
      resultList: z.object({
        result: z
          .array(
            z.object({
              id: z.string(),
              source: z.string(),
              title: z.string(),
              doi: z.string().optional(),
              pubYear: z.union([z.string(), z.number()]).optional(),
            }),
          )
          .default([]),
      }),
    })
    .safeParse(raw);
  if (!parsed.success) return invalidResponse("europe-pmc-research");
  return parsed.data.resultList.result
    .filter((p) => ["MED", "PMC"].includes(p.source))
    .map((p) => ({
      id: `europepmc:${p.source}:${p.id}`,
      title: clean(p.title),
      year: /^\d{4}$/.test(String(p.pubYear)) ? Number(p.pubYear) : undefined,
      source: "Europe PMC scientific metadata",
      sourceUrl:
        p.doi && /^10\.\d{4,9}\/\S+$/.test(p.doi)
          ? "https://doi.org/" + p.doi
          : `https://europepmc.org/article/${p.source}/${encodeURIComponent(p.id)}`,
      retrievedAt: new Date().toISOString(),
    }));
}
export async function search(query: string, page = 1): Promise<Paper[]> {
  if (!Number.isInteger(page) || page < 1 || page > 10)
    throw new Error("Invalid Europe PMC page");
  const url = europePmcSearchUrl();
  url.searchParams.set("query", `(${query}) AND (SRC:MED OR SRC:PMC)`);
  url.searchParams.set("format", "json");
  url.searchParams.set("resultType", "core");
  url.searchParams.set("pageSize", "4");
  // Europe PMC uses a cursor, not an offset. Do not silently repeat page one.
  if (page !== 1)
    throw new Error(
      "Europe PMC cursor pagination is not exposed; use the first bounded page.",
    );
  return parseResearch(
    JSON.parse(await request("europe-pmc-research", url.toString())),
  );
}
