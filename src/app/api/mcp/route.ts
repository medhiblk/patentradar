import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { guard } from "@/lib/security";
import { user } from "@/lib/platform/auth";
import { db } from "@/lib/platform/db";
import { search } from "@/lib/providers/local-index";
import { registry } from "@/lib/providers/registry";
import {
  SearchInput,
  LookupInput,
  CompareInput,
  publicSearch,
  publicLookup,
  publicCompare,
} from "@/lib/api/public";
import { localExtract } from "@/lib/local-extract";
import { AssemblySchema } from "@/lib/cad/schema";
import { STARTER_PARTS, inspectAssembly } from "@/lib/cad/workbench";
export const runtime = "nodejs";
export const maxDuration = 60;
const output = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
});
export async function POST(req: Request) {
  try {
    guard(req);
  } catch {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: "Rate limit or origin rejected" },
      },
      { status: 429 },
    );
  }
  const server = new McpServer(
    { name: "patentradar", version: "1.2.0" },
    {
      instructions:
        "Patent intelligence with partial source coverage. Use only short non-confidential concepts for public search and obtain user approval to share queries. Never infer infringement or novelty from relevance or missing results.",
    },
  );
  server.registerTool(
    "component_library",
    {
      description:
        "List original editable geometry templates and linked manufacturer board footprints. No downloaded supplier CAD, live prices or patent clearance.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      output({
        parts: STARTER_PARTS,
        templateCodeLicense: "Apache-2.0",
        patentClearance: "NOT ESTABLISHED",
      }),
  );
  server.registerTool(
    "inspect_assembly",
    {
      description:
        "Inspect supplied assembly parameters: missing dimensions, spatial housing fit, known user-entered purchase costs and unverified rights evidence. No external calls, geometry build or legal clearance.",
      inputSchema: AssemblySchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => output(inspectAssembly(args)),
  );
  server.registerTool(
    "provider_status",
    {
      description:
        "Inspect configured capabilities and observed source health. UNTESTED is not healthy.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => output({ providers: registry() }),
  );
  server.registerTool(
    "search_patents",
    {
      description:
        "Search real patent metadata and scientific prior art. Only short non-confidential concepts; explicit shareQuery required for external calls. Partial coverage.",
      inputSchema: SearchInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return output(await publicSearch(args, req.signal));
      } catch {
        return {
          ...output({
            error:
              "Search unavailable. Review query-sharing consent, provider quotas and configuration.",
          }),
          isError: true,
        };
      }
    },
  );
  server.registerTool(
    "lookup_patent",
    {
      description:
        "Retrieve a real EP A/B publication using its number and YYYYMMDD publication date, including claims when provided by EPO.",
      inputSchema: LookupInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return output(await publicLookup(args));
      } catch {
        return {
          ...output({
            error:
              "Publication retrieval unavailable; check exact number/date and quota.",
          }),
          isError: true,
        };
      }
    },
  );
  server.registerTool(
    "compare_patent_features",
    {
      description:
        "Explain lexical feature overlap against supplied patent evidence. Does not verify the authenticity of caller-supplied records or produce legal conclusions.",
      inputSchema: CompareInput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => output(publicCompare(args)),
  );
  server.registerTool(
    "extract_technical_profile",
    {
      description:
        "Extract a literal technical profile locally from supplied text. No OpenAI or external processing. Submit only text approved for this server.",
      inputSchema: z.object({ text: z.string().min(30).max(12000) }).strict(),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) =>
      output({
        profile: localExtract(args.text),
        method: "local extractive rules; review before searching",
      }),
  );
  // Private tools are scoped to this request. An anonymous server never touches the account database.
  let account: ReturnType<typeof user> = null;
  if (req.headers.has("authorization") || req.headers.has("cookie")) {
    try {
      account = user(req);
    } catch {
      return Response.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32000, message: "Private storage unavailable" },
        },
        { status: 503 },
      );
    }
    if (!account)
      return Response.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32000, message: "Invalid or expired bearer token" },
        },
        { status: 401 },
      );
  }
  if (account) {
    const id = account.id;
    server.registerTool(
      "list_my_projects",
      {
        description:
          "List titles of the authenticated account’s projects and assemblies. No confidential document text.",
        inputSchema: z.object({}).strict(),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async () =>
        output(
          db()
            .prepare(
              "SELECT id,title,kind,updated FROM items WHERE userId=? AND kind IN ('project','assembly') LIMIT 30",
            )
            .all(id),
        ),
    );
    server.registerTool(
      "search_local_patents",
      {
        description:
          "Search this server’s cached public patent index. Partial coverage.",
        inputSchema: z.object({ query: z.string().min(1).max(150) }).strict(),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (args) => output(await search(args.query)),
    );
  }
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 262144,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(req);
  } finally {
    await server.close();
  }
}
export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
