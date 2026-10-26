import { it, expect, vi } from "vitest";
import { POST as mcp, GET as mcpGet } from "../src/app/api/mcp/route";
import { POST as apiSearch } from "../src/app/api/v1/search/route";
import { GET as spec } from "../src/app/api/v1/openapi.json/route";
import { guard, OriginRejectedError } from "../src/lib/security";
const rpc = (method: string, params?: object) =>
  new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
it.each(["https://chatgpt.com", "https://chat.openai.com"])(
  "allows public MCP discovery from the trusted ChatGPT origin %s",
  async (origin) => {
    const request = rpc("tools/list");
    request.headers.set("origin", origin);
    expect((await mcp(request)).status).toBe(200);
    expect(() => guard(request, "account-origin-check")).toThrow(OriginRejectedError);
  },
);
it.each(["https://untrusted.example", "https://chatgpt.com.attacker.example", "null", "https://chatgpt.com/untrusted"])(
  "rejects an untrusted MCP origin %s without disguising it as a quota error",
  async (origin) => {
    const request = rpc("tools/list");
    request.headers.set("origin", origin);
    const response = await mcp(request);
    expect(response.status).toBe(403);
    expect(response.headers.has("Retry-After")).toBe(false);
    expect((await response.json()).error.message).toBe("Origin not permitted");
  },
);
it("official MCP transport lists anonymous public tools without exposing private projects", async () => {
  const r = await mcp(rpc("tools/list"));
  expect(r.status).toBe(200);
  const data = await r.json();
  const names = data.result.tools.map((t: { name: string }) => t.name);
  expect(names).toContain("search_patents");
  expect(names).toContain("query_source");
  expect(names).toContain("spot_patent_text");
  expect(names).toContain("lookup_patent");
  expect(names).toContain("component_library");
  expect(names).toContain("inspect_assembly");
  expect(names).not.toContain("list_my_projects");
  expect((await mcpGet()).status).toBe(405);
});
it("MCP extracts real supplied text with no external model", async () => {
  const text = "A rotating shaft drives a pump through a sealed bearing.";
  const r = await mcp(
    rpc("tools/call", {
      name: "extract_technical_profile",
      arguments: { text },
    }),
  );
  const d = await r.json();
  expect(d.result.isError).not.toBe(true);
  expect(d.result.content[0].text).toContain("shaft");
});
it("versioned search rejects external sharing without consent before network calls", async () => {
  const r = await apiSearch(
    new Request("http://localhost:3000/api/v1/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "microfluidic" }),
    }),
  );
  expect(r.status).toBe(400);
  expect((await r.json()).error.code).toBe("CONSENT_REQUIRED");
});
it("publishes the exact API route contracts as OpenAPI", async () => {
  const d = await (await spec()).json();
  expect(d.openapi).toBe("3.1.0");
  expect(
    d.paths["/api/v1/search"].post.requestBody.content["application/json"]
      .schema.properties.query.maxLength,
  ).toBe(150);
  expect(d.paths["/api/v1/cad/build"].post.security).toEqual([
    { DeveloperToken: [] },
  ]);
});
it("MCP rejects invalid and oversized tool arguments instead of executing", async () => {
  const r = await mcp(
    rpc("tools/call", {
      name: "search_patents",
      arguments: { query: "x".repeat(200), shareQuery: true },
    }),
  );
  const d = await r.json();
  expect(d.result?.isError || d.error).toBeTruthy();
});
it("MCP assembly inspection does not imply patent or manufacturing clearance", async () => {
  const { starterPart } = await import("../src/lib/cad/workbench");
  const r = await mcp(
    rpc("tools/call", {
      name: "inspect_assembly",
      arguments: {
        title: "Prototype",
        components: [starterPart("board")],
        limitations: [],
      },
    }),
  );
  const d = await r.json();
  expect(d.result.isError).not.toBe(true);
  const report = JSON.parse(d.result.content[0].text);
  expect(report.patentClearance).toBe("NOT ESTABLISHED");
  expect(report.measurementsRequired).toHaveLength(1);
});

it("MCP document matching requires explicit processing approval", async () => {
  const response = await mcp(rpc("tools/call", {
    name: "spot_patent_text",
    arguments: { text: "A rotating shaft drives a pump through a sealed bearing.", approveProcessing: false },
  }));
  const data = await response.json();
  expect(data.result?.isError || data.error).toBeTruthy();
});
it("MCP document matching returns indexed evidence without account access or external requests", async () => {
  const { publicReferencePatents } = await import("../src/lib/patents/reference-corpus");
  const reference = publicReferencePatents().find(record => (record.claims?.length || 0) >= 2)!;
  expect(reference).toBeDefined();
  const text = reference.claims!.slice(0, 3).join("\n");
  const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("External request not permitted by this test"));
  try {
    const response = await mcp(rpc("tools/call", { name: "spot_patent_text", arguments: { text, approveProcessing: true } }));
    const data = await response.json();
    expect(data.result.isError).not.toBe(true);
    const report = JSON.parse(data.result.content[0].text);
    expect(report.coverage.mode).toBe("reference-index");
    expect(report.coverage.indexedPatentCount).toBeGreaterThan(0);
    expect(report.matches.some((match: { patent: { publicationNumber: string }; evidence: unknown[] }) => match.patent.publicationNumber === reference.publicationNumber && match.evidence.length > 0)).toBe(true);
    expect(network).not.toHaveBeenCalled();
  } finally { network.mockRestore(); }
});
it("MCP document matching sanitizes processing errors", async () => {
  const response = await mcp(rpc("tools/call", { name: "spot_patent_text", arguments: { text: " ".repeat(40), approveProcessing: true } }));
  const data = await response.json();
  expect(data.result.isError).toBe(true);
  expect(JSON.parse(data.result.content[0].text).error).toBe("Document matching unavailable. Supply readable user-approved technical text and review coverage or verification limits.");
});
