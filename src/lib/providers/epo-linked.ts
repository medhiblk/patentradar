import { z } from "zod";
import { request } from "./http";
import type { PatentGraphRecord } from "./contracts";
export function parseApplication(
  raw: unknown,
  sourceUrl: string,
): PatentGraphRecord {
  const data = z
    .object({
      result: z.object({
        primaryTopic: z
          .object({
            applicationNumber: z.string(),
            filingDate: z.string().optional(),
            family: z.object({ _about: z.string() }).optional(),
            publication: z
              .array(
                z.object({
                  label: z.string(),
                  _about: z.string(),
                  publicationDate: z.string().optional(),
                }),
              )
              .optional(),
          })
          .passthrough(),
      }),
    })
    .parse(raw);
  const p = data.result.primaryTopic;
  const iso = (s?: string) => {
    if (!s) return;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  };
  const labels = (v: unknown) => {
    const arr = Array.isArray(v) ? v : [v];
    return arr.flatMap((x) =>
      x && typeof x === "object" && "label" in x && typeof x.label === "string"
        ? [x.label]
        : [],
    );
  };
  return {
    applicationNumber: p.applicationNumber,
    filingDate: iso(p.filingDate),
    familyId: p.family?._about,
    publications: (p.publication || []).map((r) => ({
      number: r.label.replace(/\s+/g, ""),
      date: iso(r.publicationDate),
      url: r._about,
    })),
    classifications: [
      ...labels(p.classificationCPCAdditional),
      ...labels(p.classificationCPCInventive),
    ],
    source: "EPO Linked Open Data / CC BY 4.0; occasional reference use only",
    sourceUrl,
    retrievedAt: new Date().toISOString(),
  };
}
export async function lookupApplication(application: string) {
  if (process.env.ENABLE_EPO_LINKED_REFERENCE !== "true")
    throw new Error(
      "EPO linked reference adapter disabled: official fair use excludes production backend usage. Use bulk data for scale.",
    );
  if (!/^\d{8,12}$/.test(application))
    throw new Error("Invalid EP application number");
  const url =
    "https://data.epo.org/linked-data/doc/application/EP/" +
    application +
    ".json";
  return parseApplication(JSON.parse(await request("epo-linked", url)), url);
}

export async function parseApplicationRdf(text: string) {
  const { Parser } = await import("n3");
  const quads = new Parser({ format: "Turtle" }).parse(text);
  return {
    triples: quads
      .slice(0, 2000)
      .map((q) => ({
        subject: q.subject.value,
        predicate: q.predicate.value,
        object: q.object.value,
        objectType: q.object.termType,
      })),
    totalTriples: quads.length,
    truncated: quads.length > 2000,
  };
}
export async function lookupApplicationRdf(application: string) {
  if (process.env.ENABLE_EPO_LINKED_REFERENCE !== "true")
    throw new Error(
      "EPO linked reference adapter disabled: official fair use excludes production backend usage.",
    );
  if (!/^\d{8,12}$/.test(application))
    throw new Error("Invalid EP application number");
  const url =
    "https://data.epo.org/linked-data/doc/application/EP/" +
    application +
    ".ttl";
  return {
    ...(await parseApplicationRdf(
      await request("epo-linked", url, { headers: { Accept: "text/turtle" } }),
    )),
    source: "EPO Linked Open Data / CC BY 4.0; occasional reference use only",
    sourceUrl: url,
    retrievedAt: new Date().toISOString(),
  };
}
