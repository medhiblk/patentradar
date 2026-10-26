import { beforeEach, afterEach, it, expect, vi } from "vitest";
vi.mock("../src/lib/providers/http", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/lib/providers/http")>();
  return { ...original, request: vi.fn() };
});
import {
  request,
  observations,
  ProviderRequestError,
} from "../src/lib/providers/http";
import { querySource } from "../src/lib/api/source-query";
import { SourceQueryInput, SourceQueryResult } from "@formaproof/contracts";
import { POST as http } from "../src/app/api/v1/sources/query/route";
import { POST as mcp } from "../src/app/api/mcp/route";
import { openapi } from "../src/lib/api/openapi";
import { currentSearchSignal } from "../src/lib/search/scope";
import { parseSearch } from "../src/lib/providers/lens";
const approved = { provider: "ror", query: "Oxford", consent: true } as const;
const ror = {
  items: [
    {
      id: "https://ror.org/052gg0110",
      names: [{ value: "University of Oxford", types: ["ror_display"] }],
    },
  ],
};
let counter = 0;
function req(body: unknown, origin?: string) {
  return new Request("http://localhost:3000/api/v1/sources/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `source-test-${++counter}`,
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function tool(args: object) {
  return mcp(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "x-forwarded-for": `source-mcp-${++counter}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "query_source", arguments: args },
      }),
    }),
  );
}
beforeEach(() => {
  observations.clear();
  vi.mocked(request).mockReset();
  vi.mocked(request).mockImplementation(async () => {
    throw new Error("Unexpected adapter request");
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValue(new Error("No live network in source-query tests")),
  );
  vi.stubEnv("LENS_API_TOKEN", "");
  vi.stubEnv("ENABLE_EXPERIMENTAL_VEYIP", "false");
});
afterEach(() => {
  expect(globalThis.fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it.each([undefined, false])(
  "requires explicit consent before any adapter call (%s)",
  async (consent) => {
    await expect(querySource({ ...approved, consent })).rejects.toThrow(
      "consent=true",
    );
    expect(request).not.toHaveBeenCalled();
    const response = await http(req({ ...approved, consent }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("CONSENT_REQUIRED");
  },
);
it("returns the same attributed source data over the dispatcher, HTTP and MCP", async () => {
  vi.mocked(request).mockResolvedValue(JSON.stringify(ror));
  const result = await querySource(approved);
  expect(SourceQueryResult.parse(result)).toMatchObject({
    status: "HEALTHY",
    category: "organization",
    records: [
      {
        name: "University of Oxford",
        source: "ROR / CC0",
        sourceUrl: "https://ror.org/052gg0110",
      },
    ],
  });
  const response = await http(req(approved));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect((await response.json()).records).toMatchObject([
    { name: "University of Oxford", sourceUrl: "https://ror.org/052gg0110" },
  ]);
  const rpc = await (await tool(approved)).json();
  expect(rpc.result.isError).not.toBe(true);
  expect(JSON.parse(rpc.result.content[0].text).records).toMatchObject([
    { name: "University of Oxford", sourceUrl: "https://ror.org/052gg0110" },
  ]);
});
it("retains an honest empty successful outcome", async () => {
  vi.mocked(request).mockResolvedValue(
    JSON.stringify({ message: { items: [] } }),
  );
  expect(
    await querySource({ ...approved, provider: "crossref" }),
  ).toMatchObject({
    status: "HEALTHY",
    records: [],
    warnings: [expect.stringContaining("Empty results")],
  });
});
it.each([
  { provider: "crossref", page: 2, status: "UNSUPPORTED_OPERATION" },
  { provider: "nasa", page: 2, status: "UNSUPPORTED_OPERATION" },
  { provider: "doe", page: 2, status: "UNSUPPORTED_OPERATION" },
  { provider: "ror", operation: "claims", status: "UNSUPPORTED_OPERATION" },
  { provider: "epo-publication", status: "INVALID_INPUT" },
  { provider: "wikidata", status: "INVALID_INPUT" },
  { provider: "opencitations", status: "INVALID_INPUT" },
  { provider: "rcsb", status: "INVALID_INPUT" },
  {
    provider: "pubchem",
    operation: "patent-references",
    status: "INVALID_INPUT",
  },
  { provider: "epo-linked", status: "INVALID_INPUT" },
  { provider: "veyip", status: "NOT_CONFIGURED" },
  { provider: "lens", status: "NOT_CONFIGURED" },
  { provider: "uspto", status: "NOT_IMPLEMENTED" },
  { provider: "patent-pages", status: "NOT_IMPLEMENTED" },
  { provider: "uspto-datasets", status: "NOT_IMPLEMENTED" },
  { provider: "openai", status: "OUT_OF_SCOPE" },
  { provider: "local-index", status: "OUT_OF_SCOPE" },
])(
  "does not query or change health for $provider / $status",
  async ({ status, ...input }) => {
    expect(await querySource({ ...approved, ...input })).toMatchObject({
      status,
    });
    expect(request).not.toHaveBeenCalled();
    expect(observations.size).toBe(0);
  },
);
it("paginates supported adapters using bounded input", async () => {
  vi.mocked(request).mockResolvedValue(JSON.stringify({ data: [] }));
  expect(
    await querySource({ ...approved, provider: "datacite", page: 3 }),
  ).toMatchObject({ status: "HEALTHY", page: 3 });
  expect(
    new URL(vi.mocked(request).mock.calls[0][1]).searchParams.get(
      "page[number]",
    ),
  ).toBe("3");
});
it.each([
  { query: "x".repeat(151) },
  { query: " " },
  { page: 11 },
  { provider: "https://attacker.example" },
  { url: "https://attacker.example" },
])(
  "rejects invalid or URL-injection input before dispatch: %j",
  async (input) => {
    const response = await http(req({ ...approved, ...input }));
    expect(response.status).toBe(400);
    expect(request).not.toHaveBeenCalled();
  },
);
it("does not mark malformed upstream records healthy or expose raw error data", async () => {
  vi.mocked(request).mockResolvedValue(
    '{"items":[{"credential":"do-not-leak"}]}',
  );
  const result = await querySource(approved);
  expect(result).toMatchObject({
    status: "UNAVAILABLE",
    code: "INVALID_RESPONSE",
  });
  expect(JSON.stringify(result)).not.toContain("do-not-leak");
  expect(observations.get("ror")?.status).toBe("UNAVAILABLE");
});
it("retains rate-limit diagnostics without leaking upstream messages", async () => {
  vi.mocked(request).mockRejectedValue(
    new ProviderRequestError("ror", "RATE_LIMITED", "do-not-leak", 12000),
  );
  const result = await querySource(approved);
  expect(result).toMatchObject({
    status: "UNAVAILABLE",
    code: "RATE_LIMITED",
    retryAfterMs: 12000,
  });
  expect(JSON.stringify(result)).not.toContain("do-not-leak");
});
it("propagates cancellation to the shared provider request scope", async () => {
  const controller = new AbortController();
  vi.mocked(request).mockImplementation(async () => {
    expect(currentSearchSignal()).toBe(controller.signal);
    controller.abort();
    return JSON.stringify(ror);
  });
  expect(await querySource(approved, controller.signal)).toMatchObject({
    status: "UNAVAILABLE",
    code: "ABORTED",
  });
  expect(observations.has("ror")).toBe(false);
});
it("rejects disallowed origins and oversized bodies before calling adapters", async () => {
  expect((await http(req(approved, "https://untrusted.example"))).status).toBe(
    403,
  );
  expect(
    (await http(req({ ...approved, query: "x".repeat(262144) }))).status,
  ).toBe(413);
  expect(request).not.toHaveBeenCalled();
});
it("marks MCP failures as errors without accessing private index or AI", async () => {
  for (const input of [
    { ...approved, consent: false },
    { ...approved, provider: "local-index" },
    { ...approved, provider: "openai" },
    { ...approved, provider: "uspto" },
  ]) {
    const rpc = await (await tool(input)).json();
    expect(rpc.result.isError).toBe(true);
  }
  expect(request).not.toHaveBeenCalled();
});
it("publishes the shared request and outcome contracts in OpenAPI", () => {
  const operation = openapi.paths["/api/v1/sources/query"].post;
  expect(operation.requestBody.content["application/json"].schema).toEqual(
    expect.objectContaining({
      properties: expect.objectContaining({
        query: expect.objectContaining({ maxLength: 150 }),
      }),
    }),
  );
  expect(operation.responses["200"]).toHaveProperty([
    "content",
    "application/json",
    "schema",
    "oneOf",
  ]);
  expect(SourceQueryInput.parse(approved).page).toBe(1);
});
it("ports a bounded Lens query with validated public provenance", async () => {
  vi.stubEnv("LENS_API_TOKEN", "fixture-not-a-real-secret");
  const record = {
    lens_id: "123",
    jurisdiction: "EP",
    doc_number: "1000000",
    kind: "A1",
    biblio: { invention_title: [{ text: "Fixture patent", lang: "en" }] },
  };
  vi.mocked(request).mockResolvedValue(JSON.stringify({ data: [record] }));
  expect(
    await querySource({ ...approved, provider: "lens", page: 2 }),
  ).toMatchObject({
    status: "HEALTHY",
    records: [
      {
        publicationNumber: "EP1000000A1",
        source: "The Lens",
        sourceUrl: "https://www.lens.org/lens/patent/123",
      },
    ],
  });
  const options = vi.mocked(request).mock.calls[0][2];
  expect(JSON.parse(String(options?.body))).toMatchObject({ size: 5, from: 5 });
  expect(
    parseSearch({ data: Array.from({ length: 8 }, () => record) }),
  ).toHaveLength(5);
  expect(() => parseSearch({ data: [{ ...record, biblio: {} }] })).toThrow();
});
