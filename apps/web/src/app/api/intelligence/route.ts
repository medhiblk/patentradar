import * as epmcResearch from "@/lib/providers/europe-pmc-research";
import { z } from "zod";
import { observations, ProviderRequestError } from "@/lib/providers/http";
import { guard, failure } from "@/lib/security";
import * as research from "@/lib/providers/new-research";
import * as organizations from "@/lib/providers/organizations";
import * as technical from "@/lib/providers/technical";
import * as openaire from "@/lib/providers/openaire";
import * as epo from "@/lib/providers/epo-linked";
import * as veyip from "@/lib/providers/veyip";
import {
  endpointCatalogue,
  eligibilitySummary,
} from "@/lib/providers/eligibility";
export const maxDuration = 60;
const Input = z.object({
  provider: z.enum([
    "europe-pmc-research",
    "datacite",
    "hal",
    "arxiv",
    "zenodo",
    "inspire",
    "nasa",
    "doe",
    "wikidata",
    "rcsb",
    "openaire",
    "ror",
    "gleif",
    "fr-company",
    "pubchem",
    "opencitations",
    "epo-linked",
    "veyip",
  ]),
  query: z.string().min(1).max(500),
  operation: z
    .enum([
      "search",
      "patent-references",
      "citations",
      "references",
      "application",
      "claims",
      "relations",
      "rdf",
    ])
    .default("search"),
  page: z.number().int().min(1).max(10).default(1),
  consent: z.boolean().default(false),
});
export async function GET() {
  return Response.json({
    summary: eligibilitySummary(),
    endpoints: endpointCatalogue,
    operations:
      "POST with provider, query, optional operation/page, and explicit consent=true. No arbitrary URLs or arbitrary MCP tools accepted.",
  });
}
export async function POST(req: Request) {
  let requestedProvider: string | undefined;
  try {
    guard(req);
    const i = Input.parse(await req.json());
    if (!i.consent)
      throw new Error("External query sharing consent is required.");
    requestedProvider = i.provider;
    let records: unknown;
    let category: string;
    const allowed =
      i.provider === "wikidata"
        ? ["search", "relations"]
        : i.provider === "pubchem"
          ? ["search", "patent-references"]
          : i.provider === "opencitations"
            ? ["search", "citations", "references"]
            : i.provider === "epo-linked"
              ? ["search", "application", "rdf"]
              : i.provider === "veyip"
                ? ["search", "claims"]
                : ["search"];
    if (!allowed.includes(i.operation))
      throw new Error("Unsupported operation for selected provider");
    if (
      ["datacite", "hal", "arxiv", "zenodo", "inspire", "nasa", "doe"].includes(
        i.provider,
      )
    ) {
      const fn = research[i.provider as keyof typeof research];
      if (
        ![
          "datacite",
          "hal",
          "arxiv",
          "zenodo",
          "inspire",
          "nasa",
          "doe",
        ].includes(i.provider)
      )
        throw new Error("Unsupported provider");
      records = await (fn as (q: string, p: number) => Promise<unknown>)(
        i.query,
        i.page,
      );
      category = "research";
    } else if (i.provider === "europe-pmc-research") {
      records = await epmcResearch.search(i.query, i.page);
      category = "research";
    } else if (i.provider === "wikidata") {
      records =
        i.operation === "relations"
          ? await organizations.wikidataRelations(i.query)
          : await organizations.wikidataEntity(i.query);
      category = "organization-entity";
    } else if (i.provider === "rcsb") {
      records = await technical.structure(i.query);
      category = "structure-metadata";
    } else if (i.provider === "openaire") {
      records = await openaire.search(i.query, i.page);
      category = "patents-and-research";
    } else if (
      i.provider === "ror" ||
      i.provider === "gleif" ||
      i.provider === "fr-company"
    ) {
      records = await (
        i.provider === "ror"
          ? organizations.ror
          : i.provider === "gleif"
            ? organizations.gleif
            : organizations.frenchCompanies
      )(i.query);
      category = "organization";
    } else if (i.provider === "pubchem") {
      records =
        i.operation === "patent-references"
          ? await technical.compoundPatents(i.query)
          : await technical.compoundProperties(i.query);
      category =
        i.operation === "patent-references"
          ? "patent-references-only"
          : "compound";
    } else if (i.provider === "opencitations") {
      records = await technical.citations(
        i.query,
        i.operation === "references" ? "references" : "citations",
      );
      category = "scientific-citations";
    } else if (i.provider === "epo-linked") {
      records =
        i.operation === "rdf"
          ? await epo.lookupApplicationRdf(i.query)
          : await epo.lookupApplication(i.query);
      category = "patent-graph-reference";
    } else {
      records =
        i.operation === "claims"
          ? await veyip.getClaims(i.query)
          : await veyip.search(i.query, i.page, "all");
      category = "experimental-patent";
    }
    return Response.json({
      provider: i.provider,
      category,
      records,
      page: i.page,
      retrievedAt: new Date().toISOString(),
      warnings: [
        "Results have source-specific coverage and rights. Name matching does not establish corporate ownership, inventorship or competitor status.",
      ],
    });
  } catch (e) {
    if (
      requestedProvider &&
      e instanceof Error &&
      ["ZodError", "SyntaxError"].includes(e.name)
    )
      observations.set(requestedProvider, {
        status: "UNAVAILABLE",
        detail: "Response validation failed",
        checkedAt: new Date().toISOString(),
      });
    return failure(
      requestedProvider &&
        e instanceof Error &&
        ["ZodError", "SyntaxError"].includes(e.name)
        ? new ProviderRequestError(
            requestedProvider,
            "INVALID_RESPONSE",
            "Response validation failed",
          )
        : e,
    );
  }
}
