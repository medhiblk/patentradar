import { afterEach, expect, it, vi } from "vitest";
import { checkPublicMcp } from "../src/lib/mcp/check-connection";
import { mcpClientConfig, PUBLIC_MCP_TOOLS } from "../src/lib/mcp/connection";
afterEach(() => vi.unstubAllGlobals());
it("checks the actual MCP handshake without cookies or provider search", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: {
          protocolVersion: "2025-03-26",
          serverInfo: { name: "patentradar", version: "1.2.0" },
        },
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 202 }))
    .mockResolvedValueOnce(
      Response.json({
        jsonrpc: "2.0",
        id: 2,
        result: { tools: PUBLIC_MCP_TOOLS.map(({ name }) => ({ name })) },
      }),
    );
  vi.stubGlobal("fetch", request);
  const result = await checkPublicMcp(
    "https://example.test/api/mcp",
    new AbortController().signal,
  );
  expect(result.tools).toHaveLength(7);
  const calls = request.mock.calls.map(([, init]) => ({
    credentials: init.credentials,
    method: JSON.parse(init.body).method,
  }));
  expect(calls).toEqual([
    { credentials: "omit", method: "initialize" },
    { credentials: "omit", method: "notifications/initialized" },
    { credentials: "omit", method: "tools/list" },
  ]);
  expect(mcpClientConfig("https://example.test/anything")).toEqual({
    mcpServers: { patentradar: { url: "https://example.test/api/mcp" } },
  });
});
it("never treats HTTP 200 with an invalid MCP payload or rate limiting as success", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: { message: "not a usable protocol response" } }),
      ),
  );
  await expect(
    checkPublicMcp(
      "https://example.test/api/mcp",
      new AbortController().signal,
    ),
  ).rejects.toThrow("protocol discovery");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 429 })),
  );
  await expect(
    checkPublicMcp(
      "https://example.test/api/mcp",
      new AbortController().signal,
    ),
  ).rejects.toThrow("one minute");
});
