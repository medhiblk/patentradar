import { request } from "./http";
let token: { value: string; expires: number } | undefined;
export async function accessToken() {
  if (token && token.expires > Date.now() + 60000) return token.value;
  if (!process.env.EPO_OPS_KEY || !process.env.EPO_OPS_SECRET)
    throw new Error("EPO OPS is not configured");
  const raw = await request(
    "epo-ops",
    "https://ops.epo.org/3.2/auth/accesstoken",
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.EPO_OPS_KEY}:${process.env.EPO_OPS_SECRET}`,
          ).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    },
    false,
  );
  const data = JSON.parse(raw);
  if (
    typeof data.access_token !== "string" ||
    !Number.isFinite(Number(data.expires_in))
  )
    throw new Error("Invalid OAuth response");
  token = {
    value: data.access_token,
    expires: Date.now() + Number(data.expires_in) * 1000,
  };
  return token.value;
}
// Search response normalization remains pending; OAuth alone is not search readiness.

import { PatentSchema, type PatentRecord } from "./types";
export async function search(query: string): Promise<PatentRecord[]> {
  const bearer = await accessToken();
  const cql = 'ta all "' + query.replace(/["\\]/g, " ").slice(0, 250) + '"';
  const url =
    "https://ops.epo.org/3.2/rest-services/published-data/search?q=" +
    encodeURIComponent(cql);
  const raw = JSON.parse(
    await request(
      "epo-ops",
      url,
      {
        headers: {
          Authorization: "Bearer " + bearer,
          Accept: "application/json",
          Range: "1-10",
        },
      },
      false,
    ),
  );
  const root =
    raw["ops:world-patent-data"]?.["ops:biblio-search"]?.["ops:search-result"];
  if (!root) throw new Error("EPO OPS returned an unexpected search response");
  const docs = root["exchange-documents"];
  const list = Array.isArray(docs) ? docs : docs ? [docs] : [];
  const array = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v)
      ? v
      : v && typeof v === "object"
        ? [v as Record<string, unknown>]
        : [];
  const value = (v: unknown): string =>
    typeof v === "string"
      ? v
      : v && typeof v === "object" && "$" in v
        ? String((v as { $: unknown }).$)
        : "";
  return list.flatMap((group) =>
    array(group["exchange-document"]).flatMap((doc) => {
      const b = doc["bibliographic-data"] as
        Record<string, unknown> | undefined;
      if (!b) return [];
      const title =
        array(b["invention-title"]).find((t) => t["@lang"] === "en") ||
        array(b["invention-title"])[0];
      const country = String(doc["@country"] || "");
      const publicationNumber =
        country + String(doc["@doc-number"] || "") + String(doc["@kind"] || "");
      const reference = b["publication-reference"] as
        Record<string, unknown> | undefined;
      const id = array(reference?.["document-id"]).find(
        (x) => x["@document-id-type"] === "docdb",
      );
      const date = value(id?.date);
      const parties = b.parties as Record<string, unknown> | undefined;
      const applicants = parties?.applicants as
        Record<string, unknown> | undefined;
      const names = array(applicants?.applicant).flatMap((a) => {
        const name = (
          a["applicant-name"] as Record<string, unknown> | undefined
        )?.name;
        return value(name) ? [value(name)] : [];
      });
      const parsed = PatentSchema.safeParse({
        id: publicationNumber,
        publicationNumber,
        title: value(title),
        applicants: [...new Set(names)],
        jurisdiction: country,
        publicationDate: date
          ? date.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3")
          : undefined,
        source: "EPO OPS",
        sourceUrl:
          "https://worldwide.espacenet.com/publicationDetails/biblio?CC=" +
          country +
          "&NR=" +
          String(doc["@doc-number"]) +
          String(doc["@kind"]),
        retrievedAt: new Date().toISOString(),
        queries: [query],
      });
      return parsed.success ? [parsed.data] : [];
    }),
  );
}
