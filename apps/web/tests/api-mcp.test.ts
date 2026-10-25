import { it, expect } from "vitest";
import { POST as mcp, GET as mcpGet } from "../src/app/api/mcp/route";
import { POST as apiSearch } from "../src/app/api/v1/search/route";
import { GET as spec } from "../src/app/api/v1/openapi.json/route";
const rpc = (method: string, params?: object) =>
  new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
it("official MCP transport lists anonymous public tools without exposing private projects", async () => {
  const r = await mcp(rpc("tools/list"));
  expect(r.status).toBe(200);
  const data = await r.json();
  const names = data.result.tools.map((t: { name: string }) => t.name);
  expect(names).toContain("search_patents");
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
