import { endpoint } from "./endpoints";
import { z } from "zod";
import { request, invalidResponse } from "./http";
import type { Paper } from "./types";
const Work = z.object({
  DOI: z.string(),
  title: z.array(z.string()).optional(),
  URL: z.string().optional(),
  published: z
    .object({ "date-parts": z.array(z.array(z.number())) })
    .optional(),
});
function paper(w: z.infer<typeof Work>): Paper {
  return {
    id: w.DOI,
    title: w.title?.[0] || "Untitled work",
    year: w.published?.["date-parts"][0]?.[0],
    source: "Crossref",
    sourceUrl: "https://doi.org/" + w.DOI,
    retrievedAt: new Date().toISOString(),
  };
}
export async function search(query: string) {
  const data = z
    .object({ message: z.object({ items: z.array(Work) }) })
    .safeParse(
      JSON.parse(
        await request(
          "crossref",
          `${endpoint(["CROSSREF_API_URL", "CROSSREF_URL", "CROSSREF_BASE_URL"], "https://api.crossref.org", "/works")}?query=${encodeURIComponent(query)}&rows=6`,
        ),
      ),
    );
  if (!data.success) return invalidResponse("crossref");
  return data.data.message.items.map(paper);
}
export async function resolveDoi(doi: string) {
  const data = z
    .object({ message: Work })
    .parse(
      JSON.parse(
        await request(
          "crossref",
          `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
        ),
      ),
    );
  return paper(data.message);
}
