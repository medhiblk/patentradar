import { z } from "zod";
import { request } from "./http";
import { PatentSchema } from "./types";

const text = z.object({ text: z.string(), lang: z.string().optional() });
const response = z.object({
  data: z.array(
    z.object({
      lens_id: z.string(),
      jurisdiction: z.string(),
      doc_number: z.string(),
      kind: z.string(),
      date_published: z.string().optional(),
      abstract: z.array(text).optional(),
      biblio: z.object({
        invention_title: z.array(text),
        application_number: z.string().optional(),
      }),
    }),
  ),
});
const preferred = (items: { text: string; lang?: string }[]) =>
  (items.find((x) => x.lang === "en") || items[0])?.text;
export function parseSearch(raw: unknown) {
  return response
    .parse(raw)
    .data.slice(0, 5)
    .map((p) =>
      PatentSchema.parse({
        id: "lens:" + p.lens_id,
        publicationNumber: p.jurisdiction + p.doc_number + p.kind,
        title: preferred(p.biblio.invention_title) || p.lens_id,
        abstract: preferred(p.abstract || []),
        applicants: [],
        applicationNumber: p.biblio.application_number,
        jurisdiction: p.jurisdiction,
        publicationDate: p.date_published,
        source: "The Lens",
        sourceUrl:
          "https://www.lens.org/lens/patent/" + encodeURIComponent(p.lens_id),
        retrievedAt: new Date().toISOString(),
      }),
    );
}
export async function search(query: string, page = 1) {
  if (!process.env.LENS_API_TOKEN)
    throw new Error("LENS_API_TOKEN is required");
  return parseSearch(
    JSON.parse(
      await request("lens", "https://api.lens.org/patent/search", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + process.env.LENS_API_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          size: 5,
          from: (page - 1) * 5,
          include: [
            "lens_id",
            "jurisdiction",
            "doc_number",
            "kind",
            "date_published",
            "biblio.invention_title",
            "biblio.application_number",
            "abstract",
          ],
        }),
      }),
    ),
  );
}
