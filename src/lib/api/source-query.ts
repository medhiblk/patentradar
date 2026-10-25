import { z } from "zod";
import { observations, ProviderRequestError } from "@/lib/providers/http";

import * as research from "@/lib/providers/new-research";
import * as organizations from "@/lib/providers/organizations";
import * as technical from "@/lib/providers/technical";
import * as openaire from "@/lib/providers/openaire";
import * as epo from "@/lib/providers/epo-linked";
import * as veyip from "@/lib/providers/veyip";
import * as crossref from "@/lib/providers/crossref";
import * as openalex from "@/lib/providers/openalex";
import * as pubmed from "@/lib/providers/pubmed";
import * as publication from "@/lib/providers/epo-publication";
import * as ops from "@/lib/providers/epo-ops";
import * as google from "@/lib/providers/google-patents";
import * as epmc from "@/lib/providers/europe-pmc";
import * as semantic from "@/lib/providers/semantic-scholar";
import * as local from "@/lib/providers/local-index";
import { registry } from "@/lib/providers/registry";
export const SourceInput = z
  .object({
    provider: z.enum([
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
      "crossref",
      "openalex",
      "pubmed",
      "epo-publication",
      "epo-ops",
      "google-patents",
      "europe-pmc",
      "semantic-scholar",
      "local-index",
      "patent-pages",
      "uspto",
      "inpi",
      "lens",
      "cnipa",
      "wipo",
      "openai",
    ]),
    query: z.string().trim().min(1).max(150),
    publicationDate: z
      .string()
      .regex(/^\d{8}$/)
      .optional(),
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
  })
  .strict();
export async function querySource(raw: unknown) {
  const i = SourceInput.parse(raw);
  if (!i.consent)
    throw new Error("External query sharing consent is required.");
  const provider = registry().find((p) => p.id === i.provider)!;
  if (!provider.configured)
    return {
      provider: i.provider,
      status: "NOT_CONFIGURED",
      error: provider.detail,
      authentication: provider.authentication,
      retrievedAt: new Date().toISOString(),
    };
  if (i.provider === "openai")
    return {
      provider: i.provider,
      status: "OUT_OF_SCOPE",
      error:
        "OpenAI is a private document-processing service, not a public data source.",
      retrievedAt: new Date().toISOString(),
    };
  const started = Date.now();
  try {
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
    } else if (i.provider === "veyip") {
      records =
        i.operation === "claims"
          ? await veyip.getClaims(i.query)
          : await veyip.search(i.query, i.page, "all");
      category = "experimental-patent";
    } else if (
      i.provider === "crossref" ||
      i.provider === "openalex" ||
      i.provider === "pubmed" ||
      i.provider === "semantic-scholar"
    ) {
      if (i.page !== 1)
        throw new Error("This adapter supports the first bounded page only.");
      records = await {
        crossref,
        openalex,
        pubmed,
        "semantic-scholar": semantic,
      }[i.provider].search(i.query);
      category = "research";
    } else if (i.provider === "epo-publication") {
      if (!i.publicationDate || !/^EP\s*\d+[AB]\d$/i.test(i.query))
        throw new Error(
          "Exact EP publication number and YYYYMMDD publicationDate required.",
        );
      records = await publication.lookup(i.query, i.publicationDate);
      category = "patent";
    } else if (i.provider === "epo-ops") {
      records = await ops.search(i.query);
      category = "patent";
    } else if (i.provider === "google-patents") {
      records = await google.retrieve(i.query, []);
      category = "patent";
    } else if (i.provider === "europe-pmc") {
      records = await epmc.search(i.query);
      category = "patent";
    } else if (i.provider === "local-index") {
      records = await local.search(i.query);
      category = "patent";
    } else if (i.provider === "patent-pages") {
      // Enrichment requires an existing sourced patent record, not an invented one.
      return {
        provider: i.provider,
        status: "UNSUPPORTED_OPERATION",
        error: "Use search_patents with sourced records for HTML enrichment.",
        retrievedAt: new Date().toISOString(),
      };
    } else {
      return {
        provider: i.provider,
        status: "NOT_IMPLEMENTED",
        error: "No query adapter implemented for this provider.",
        retrievedAt: new Date().toISOString(),
      };
    }
    observations.set(i.provider, {
      status: "HEALTHY",
      detail:
        "Adapter returned validated records; empty results do not prove exhaustive coverage.",
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    });
    return {
      provider: i.provider,
      status: "HEALTHY",
      category,
      records,
      page: i.page,
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      warnings: [
        "Partial coverage. Preserve source attribution. Name matching does not establish ownership.",
      ],
    };
  } catch (e) {
    const invalid =
      e instanceof Error && ["ZodError", "SyntaxError"].includes(e.name);
    const code = invalid
      ? "INVALID_RESPONSE"
      : e instanceof ProviderRequestError
        ? e.code
        : "INVALID_INPUT_OR_UNAVAILABLE";
    observations.set(i.provider, {
      status: "UNAVAILABLE",
      detail: code,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    });
    return {
      provider: i.provider,
      status: "UNAVAILABLE",
      code,
      error: invalid
        ? "Provider response failed schema validation."
        : e instanceof ProviderRequestError
          ? e.message
          : "Check the provider-specific identifier, operation and configuration.",
      retryAfterMs:
        e instanceof ProviderRequestError ? e.retryAfterMs : undefined,
      retrievedAt: new Date().toISOString(),
    };
  }
}
