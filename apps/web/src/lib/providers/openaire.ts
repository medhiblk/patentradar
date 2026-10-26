import { z } from "zod";
import { request } from "./http";
import { PatentSchema, type PatentRecord, type Paper } from "./types";
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : v ? [v] : []);
const val = (v: unknown): string =>
  typeof v === "string"
    ? v
    : typeof obj(v).$ === "string"
      ? String(obj(v).$)
      : "";
export function parseOpenaire(raw: unknown, query: string) {
  const envelope = z
    .object({
      response: z.object({
        results: z.unknown().nullable().optional(),
        header: z.unknown().optional(),
      }),
    })
    .parse(raw);
  const patents: PatentRecord[] = [];
  const papers: Paper[] = [];
  for (const rawRow of array(obj(envelope.response.results).result)) {
    const row = obj(rawRow);
    const entity = obj(obj(obj(row.metadata)["oaf:entity"])["oaf:result"]);
    const upstream = String(
      obj(entity.collectedfrom)["@name"] || "upstream source",
    );
    const title = array(entity.title).map(val).find(Boolean);
    if (!title) continue;
    const children = [
      ...array(obj(entity.children).result),
      ...array(obj(entity.children).instance).map((instance) => ({ instance })),
      ...array(entity.instance).map((instance) => ({ instance })),
    ];
    const patentChildren = children.filter(
      (c) => obj(obj(obj(c).instance).instancetype)["@classname"] === "Patent",
    );
    const id = val(obj(row.header)["dri:objIdentifier"]);
    if (!id) continue;
    const sourceUrl =
      "https://explore.openaire.eu/search/publication?articleId=" +
      encodeURIComponent(id);
    if (patentChildren.length) {
      // Original document keys explicitly contain authority, number, kind and publication date.
      // Do not assign the aggregate's earliest date to every grant/publication.
      for (const key of array(entity.originalId).map(val)) {
        const m = key.match(
          /^([A-Z]{2})_(\d+)_([A-Z]\d?)_(\d{4})(\d{2})(\d{2})$/,
        );
        if (!m) continue;
        patents.push(
          PatentSchema.parse({
            id: "openaire:" + key,
            publicationNumber: m[1] + m[2] + m[3],
            title,
            applicants: [],
            inventors:
              upstream === "Lens"
                ? array(entity.creator).map(val).filter(Boolean)
                : undefined,
            publicationDate: `${m[4]}-${m[5]}-${m[6]}`,
            jurisdiction: m[1],
            source:
              "OpenAIRE Graph / " +
              (upstream === "Lens" ? "Lens-derived" : upstream) +
              " patent metadata (CC-BY)",
            sourceUrl,
            retrievedAt: new Date().toISOString(),
            queries: [query],
            additionalSources: [
              {
                name: "OpenAIRE Graph metadata, normalized by PatentRadar; CC-BY licence and upstream Lens attribution",
                url: "https://graph.openaire.eu/faq",
              },
            ],
          }),
        );
      }
    } else {
      const pid = array(entity.pid).find((p) => obj(p)["@classid"] === "doi");
      const doi = val(pid);
      papers.push({
        id: doi || id,
        title,
        year: Number(val(entity.dateofacceptance).slice(0, 4)) || undefined,
        source: "OpenAIRE Graph (CC-BY metadata)",
        sourceUrl: doi ? "https://doi.org/" + doi : sourceUrl,
        retrievedAt: new Date().toISOString(),
      });
    }
  }
  return { patents, papers };
}
export async function search(query: string, page = 1, patentsOnly = false) {
  const url = new URL(
    process.env.OPENAIRE_PUBLICATIONS_URL ||
      "https://api.openaire.eu/search/publications",
  );
  Object.entries({
    keywords: query,
    format: "json",
    size: "8",
    page: String(page),
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  // The official publication-type vocabulary uses the case-sensitive term Patent.
  if (patentsOnly) url.searchParams.set("instancetype", "Patent");
  return parseOpenaire(
    JSON.parse(await request("openaire", url.toString())),
    query,
  );
}
