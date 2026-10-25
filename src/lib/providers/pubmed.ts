import { z } from "zod";
import { request } from "./http";
import type { Paper } from "./types";
export async function search(query: string): Promise<Paper[]> {
  const base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
  const key = process.env.NCBI_API_KEY
    ? "&api_key=" + encodeURIComponent(process.env.NCBI_API_KEY)
    : "";
  const ids = z
    .object({ esearchresult: z.object({ idlist: z.array(z.string()) }) })
    .parse(
      JSON.parse(
        await request(
          "pubmed",
          base +
            "/esearch.fcgi?db=pubmed&retmode=json&retmax=4&term=" +
            encodeURIComponent(query) +
            key,
        ),
      ),
    ).esearchresult.idlist;
  if (!ids.length) return [];
  await new Promise((r) => setTimeout(r, 400));
  const data = JSON.parse(
    await request(
      "pubmed",
      base + "/esummary.fcgi?db=pubmed&retmode=json&id=" + ids.join(",") + key,
    ),
  );
  return ids.flatMap((id) => {
    const p = z
      .object({ title: z.string(), pubdate: z.string().optional() })
      .safeParse(data.result?.[id]);
    return p.success
      ? [
          {
            id: "pubmed:" + id,
            title: p.data.title,
            year: Number(p.data.pubdate?.slice(0, 4)) || undefined,
            source: "PubMed / NCBI",
            sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/" + id + "/",
            retrievedAt: new Date().toISOString(),
          },
        ]
      : [];
  });
}
