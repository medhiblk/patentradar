import { endpoint } from "./endpoints";
import { z } from "zod";
import { request, invalidResponse } from "./http";
import type { Paper } from "./types";
export async function search(query: string): Promise<Paper[]> {
  const url = new URL(
    endpoint(["OPENALEX_WORKS_URL", "OPENALEX_API_URL", "OPENALEX_URL", "OPENALEX_BASE_URL"], "https://api.openalex.org", "/works"),
  );
  url.searchParams.set("search", query);
  url.searchParams.set("per-page", "6");
  if (process.env.OPENALEX_API_KEY)
    url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
  const parsed = z
    .object({
      results: z.array(
        z.object({
          id: z.string(),
          display_name: z.string().nullable(),
          publication_year: z.number().nullable(),
          doi: z.string().nullable(),
        }),
      ),
    })
    .safeParse(JSON.parse(await request("openalex", url.toString())));
  if (!parsed.success) return invalidResponse("openalex");
  return parsed.data.results.map((w) => ({
    id: w.id,
    title: w.display_name || "Untitled work",
    year: w.publication_year || undefined,
    source: "OpenAlex",
    sourceUrl: w.doi || w.id,
    retrievedAt: new Date().toISOString(),
  }));
}
