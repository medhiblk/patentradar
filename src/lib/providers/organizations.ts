import { endpoint } from "./endpoints";
import { z } from "zod";
import { request } from "./http";
import type { OrganizationRecord } from "./contracts";
export async function ror(query: string): Promise<OrganizationRecord[]> {
  const url = new URL(
    process.env.ROR_ORGANIZATIONS_URL || "https://api.ror.org/v2/organizations",
  );
  url.searchParams.set("query", query);
  const data = z
    .object({
      items: z.array(
        z.object({
          id: z.string().url(),
          names: z.array(
            z.object({ value: z.string(), types: z.array(z.string()) }),
          ),
          locations: z
            .array(
              z.object({
                geonames_details: z.object({
                  country_code: z.string().optional(),
                }),
              }),
            )
            .optional(),
          relationships: z
            .array(
              z.object({
                type: z.string(),
                id: z.string(),
                label: z.string().optional(),
              }),
            )
            .optional(),
        }),
      ),
    })
    .parse(JSON.parse(await request("ror", url.toString())));
  return data.items.slice(0, 6).map((r) => ({
    id: r.id,
    name:
      r.names.find((n) => n.types.includes("ror_display"))?.value ||
      r.names[0]?.value ||
      r.id,
    country: r.locations?.[0]?.geonames_details.country_code,
    aliases: r.names.map((n) => n.value),
    source: "ROR / CC0",
    sourceUrl: r.id,
    retrievedAt: new Date().toISOString(),
    relationships: r.relationships?.map((v) => ({
      type: v.type,
      id: v.id,
      name: v.label,
    })),
  }));
}
export async function frenchCompanies(
  query: string,
): Promise<OrganizationRecord[]> {
  const url = new URL(
    process.env.FR_COMPANY_SEARCH_URL ||
      "https://recherche-entreprises.api.gouv.fr/search",
  );
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", "5");
  const data = z
    .object({
      results: z.array(
        z.object({ siren: z.string(), nom_complet: z.string() }),
      ),
    })
    .parse(JSON.parse(await request("fr-company", url.toString())));
  return data.results.map((r) => ({
    id: "siren:" + r.siren,
    name: r.nom_complet,
    country: "FR",
    aliases: [],
    source: "Annuaire des Entreprises / Licence Ouverte",
    sourceUrl:
      "https://annuaire-entreprises.data.gouv.fr/entreprise/" + r.siren,
    retrievedAt: new Date().toISOString(),
  }));
}
export async function gleif(query: string): Promise<OrganizationRecord[]> {
  const url = new URL(
    process.env.GLEIF_LEI_SEARCH_URL ||
      "https://api.gleif.org/api/v1/lei-records",
  );
  url.searchParams.set("filter[entity.legalName]", query);
  url.searchParams.set("page[size]", "5");
  const data = z
    .object({
      data: z.array(
        z.object({
          id: z.string(),
          attributes: z.object({
            lei: z.string(),
            entity: z.object({
              legalName: z.object({ name: z.string() }),
              legalAddress: z
                .object({ country: z.string().optional() })
                .optional(),
            }),
          }),
        }),
      ),
    })
    .parse(JSON.parse(await request("gleif", url.toString())));
  return data.data.map((r) => ({
    id: r.attributes.lei,
    name: r.attributes.entity.legalName.name,
    country: r.attributes.entity.legalAddress?.country,
    aliases: [],
    source: "GLEIF / CC0",
    sourceUrl: "https://search.gleif.org/#/record/" + r.attributes.lei,
    retrievedAt: new Date().toISOString(),
  }));
}
export async function wikidataEntity(
  qid: string,
): Promise<OrganizationRecord[]> {
  if (!/^Q[1-9]\d{0,12}$/.test(qid))
    throw new Error("Wikidata lookup requires a Q identifier.");
  const url =
    "https://www.wikidata.org/wiki/Special:EntityData/" + qid + ".json";
  const raw = z
    .object({
      entities: z.record(
        z.string(),
        z.object({
          id: z.string(),
          labels: z.record(z.string(), z.object({ value: z.string() })),
          aliases: z
            .record(z.string(), z.array(z.object({ value: z.string() })))
            .optional(),
        }),
      ),
    })
    .parse(JSON.parse(await request("wikidata", url)));
  const r = raw.entities[qid];
  if (!r) return [];
  return [
    {
      id: qid,
      name: r.labels.en?.value || Object.values(r.labels)[0]?.value || qid,
      aliases: Object.values(r.aliases || {})
        .flat()
        .map((a) => a.value)
        .slice(0, 100),
      source: "Wikidata / CC0; entity identity must be reviewed",
      sourceUrl: "https://www.wikidata.org/wiki/" + qid,
      retrievedAt: new Date().toISOString(),
    },
  ];
}
export async function wikidataRelations(qid: string) {
  if (!/^Q[1-9]\d{0,12}$/.test(qid))
    throw new Error("Wikidata lookup requires a Q identifier.");
  const query = `PREFIX wd: <http://www.wikidata.org/entity/> PREFIX wdt: <http://www.wikidata.org/prop/direct/> PREFIX wikibase: <http://wikiba.se/ontology#> PREFIX bd: <http://www.bigdata.com/rdf#> SELECT ?property ?target ?targetLabel WHERE { VALUES ?property {wdt:P749 wdt:P127 wdt:P355} wd:${qid} ?property ?target . SERVICE wikibase:label {bd:serviceParam wikibase:language "en".} } LIMIT 20`;
  const url = new URL(
    endpoint(["WIKIDATA_SPARQL_URL", "WIKIDATA_API_URL"], "https://query.wikidata.org/sparql"),
  );
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  const data = z
    .object({
      results: z.object({
        bindings: z.array(
          z.object({
            property: z.object({ value: z.string() }),
            target: z.object({ value: z.string() }),
            targetLabel: z.object({ value: z.string() }).optional(),
          }),
        ),
      }),
    })
    .parse(JSON.parse(await request("wikidata", url.toString())));
  return data.results.bindings.map((r) => ({
    id: r.target.value,
    name: r.targetLabel?.value || r.target.value,
    aliases: [],
    source: "Wikidata SPARQL / CC0; relationship assertion requires review",
    sourceUrl: "https://www.wikidata.org/wiki/" + qid,
    retrievedAt: new Date().toISOString(),
    relationships: [{ type: r.property.value, id: r.target.value }],
  }));
}
