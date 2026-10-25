import { z } from "zod";
import { request } from "./http";
import type { Paper } from "./types";
export async function search(query: string): Promise<Paper[]> {
  const data = z
    .object({
      data: z.array(
        z.object({
          paperId: z.string(),
          title: z.string(),
          year: z.number().nullable(),
          url: z.string(),
        }),
      ),
    })
    .parse(
      JSON.parse(
        await request(
          "semantic-scholar",
          "https://api.semanticscholar.org/graph/v1/paper/search?limit=4&fields=title,year,url&query=" +
            encodeURIComponent(query),
          {
            headers: process.env.SEMANTIC_SCHOLAR_API_KEY
              ? { "x-api-key": process.env.SEMANTIC_SCHOLAR_API_KEY }
              : {},
          },
        ),
      ),
    );
  return data.data.map((p) => ({
    id: p.paperId,
    title: p.title,
    year: p.year || undefined,
    source: "Semantic Scholar",
    sourceUrl: p.url,
    retrievedAt: new Date().toISOString(),
  }));
}
