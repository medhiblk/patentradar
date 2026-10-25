import { attachmentPaths } from "./attachment-contract";
import { z } from "zod";
import { SearchInput, LookupInput, CompareInput } from "./public";
import { AssemblySchema } from "../cad/schema";
const post = (
  operationId: string,
  summary: string,
  schema: z.ZodType,
  extra: object = {},
) => ({
  post: {
    operationId,
    summary,
    requestBody: {
      required: true,
      content: { "application/json": { schema: z.toJSONSchema(schema) } },
    },
    responses: {
      "200": {
        description: "Operation result; evidence retains source attribution.",
      },
      "400": { description: "Invalid input or sharing consent missing." },
      "429": { description: "Rate limited; inspect Retry-After." },
      "503": { description: "Provider or configured runtime unavailable." },
    },
    ...extra,
  },
});
export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "PatentRadar API",
    version: "1.4.0",
    description:
      "Real patent intelligence with partial coverage, source attribution and explicit query sharing. Public read tools require no key. Native CAD requires its configured runtime and account access. Original private files require full owner sessions and configured private Blob/local storage. No legal FTO conclusions.",
  },
  servers: [{ url: "/", description: "Current host" }],
  paths: {
    "/api/spot": {
      post: {
        operationId: "spotPatentDocument",
        summary: "Recognize an uploaded patent and compare document passages against the attributed public MedTech reference index.",
        requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary", description: "Optional text-based PDF, max4MiB/80pages; first20 textpages." }, text: { type: "string", maxLength: 60000, description: "Alternative technical description; minimum30characters. Ignored whenPDFsupplied." }, consent: { type: "string", enum: ["true", "false"], default: "false", description: "Allow exactEPlookup using detectedpublicationnumber/date only. Never sendsfulldocumenttoEPO." } } } } } },
        responses: { "200": { description: "Identity candidates, sourced matches and passages, corpus/live-lookup coverage and actual inputSHA/pagecoverage. Identifier recognition is separate from technical overlap; not global/FTOclearance." }, "400": { description: "Invalid document." }, "413": { description: "Upload too large." }, "415": { description: "Unsupportedformat." }, "422": { description: "Unreadable/scannedPDF or insufficienttechnicaltext." }, "429": { description: "Rate limited." }, "503": { description: "Temporaryprocessingfailure." } },
      },
    },
    ...attachmentPaths,
    "/api/v1/datasets": {
      get: {
        operationId: "getDatasetCatalogues",
        summary:
          "HTML catalogue links and manual import limitations; no patent search or download",
        responses: {
          "200": {
            description:
              "Dataset landing pages, access caveats and offline importer contract",
          },
        },
      },
    },
    "/api/v1/cad/catalog": {
      get: {
        operationId: "getComponentLibrary",
        summary:
          "Read starter templates and manufacturer footprint sources; no clearance or live pricing",
        responses: {
          "200": {
            description:
              "Original template metadata with external source references",
          },
        },
      },
    },
    "/api/v1/cad/inspect": post(
      "inspectAssembly",
      "Check supplied parameters, envelope fit, known purchase costs and unverified rights; no legal clearance",
      AssemblySchema,
    ),
    "/api/v1/health": {
      get: {
        operationId: "getHealth",
        responses: {
          "200": {
            description:
              "Configuration and public capability status, not a live external probe.",
          },
        },
      },
    },
    "/api/v1/providers": {
      get: {
        operationId: "getProviders",
        responses: {
          "200": { description: "Provider registry and dated observations." },
        },
      },
    },
    "/api/v1/search": post(
      "searchPatents",
      "Search public patent and research sources using approved concepts",
      SearchInput,
    ),
    "/api/v1/search/stream": post(
      "streamSearch",
      "Stream source progress and patent upserts as newline-delimited JSON",
      SearchInput,
      {
        responses: {
          "200": {
            description:
              "NDJSON events; terminal completed includes the final result.",
            content: { "application/x-ndjson": { schema: { type: "string" } } },
          },
          "400": { description: "Invalid input or missing sharing consent" },
          "429": { description: "Rate limited" },
        },
      },
    ),
    "/api/v1/patents/lookup": post(
      "lookupPatent",
      "Retrieve exact EP A/B publication metadata and available claims",
      LookupInput,
    ),
    "/api/v1/compare": post(
      "compareFeatures",
      "Explain lexical overlap in client-supplied patent evidence",
      CompareInput,
    ),
    "/api/v1/cad/build": post(
      "buildAssembly",
      "Generate real solids and STEP/STL; authenticated, native runtime required",
      AssemblySchema,
      {
        security: [{ DeveloperToken: [] }],
        responses: {
          "200": {
            description:
              "Real CadQuery geometry with base64 STEP/STL and mesh parts",
          },
          "401": {
            description: "Developer token or signed-in session required",
          },
          "422": { description: "Required measurements missing" },
          "503": { description: "Native CAD runtime unavailable" },
        },
      },
    ),
  },
  components: {
    securitySchemes: {
      SessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "pr_session",
        description:
          "HttpOnly full session from /api/vault login. Scoped developer/MCP tokens do not grant original-file access.",
      },
      DeveloperToken: {
        type: "http",
        scheme: "bearer",
        description:
          "24-hour scoped token created in Account. Private accounts require configured private Blob or persistent local storage. Never put a token in a URL.",
      },
    },
  },
};
