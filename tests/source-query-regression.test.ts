import { test, expect, vi, afterEach } from "vitest";
import { querySource } from "../src/lib/api/source-query";
import { plan } from "../src/lib/search/orchestrator";
import { toResearchInput } from "../src/lib/api/public";
import { observations, request } from "../src/lib/providers/http";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
test("no external request without explicit query consent", async () => {
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  await expect(querySource({ provider: "hal", query: "pump" })).rejects.toThrow(
    "consent",
  );
  expect(f).not.toHaveBeenCalled();
});
test("missing credentials return actionable disabled status without external requests", async () => {
  vi.stubEnv("LENS_API_TOKEN", "");
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  const r = await querySource({
    provider: "lens",
    query: "pump",
    consent: true,
  });
  expect(r.status).toBe("NOT_CONFIGURED");
  expect(r).toHaveProperty("authentication");
  expect(f).not.toHaveBeenCalled();
});
test("malformed source payload is not reported healthy", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ response: { docs: [{ bad: "record" }] } }),
        ),
      ),
  );
  const r = await querySource({
    provider: "hal",
    query: "malformed-test",
    consent: true,
  });
  expect(r.status).toBe("UNAVAILABLE");
  expect(r).toHaveProperty("code", "INVALID_RESPONSE");
  expect(observations.get("hal")?.status).toBe("UNAVAILABLE");
});
test("HAL uses official current API hostname and preserves source metadata", async () => {
  vi.stubEnv("HAL_API_URL", "");
  const f = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            docs: [
              {
                halId_s: "hal-123",
                title_s: ["Pump"],
                uri_s: "https://hal.science/hal-123",
                producedDateY_i: 2020,
              },
            ],
          },
        }),
      ),
    );
  vi.stubGlobal("fetch", f);
  const r = await querySource({
    provider: "hal",
    query: "valid-hal-test",
    consent: true,
  });
  expect(r.status).toBe("HEALTHY");
  expect(String(f.mock.calls[0][0])).toContain(
    "https://api.hal.science/search/",
  );
  expect(r).toHaveProperty(
    "records.0.sourceUrl",
    "https://hal.science/hal-123",
  );
});
test("cloud search excludes unavailable SQLite and includes implemented scientific sources", () => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("PATENTRADAR_DATA_DIR", "");
  const names = plan(
    toResearchInput({ query: "pump", shareQuery: true }),
  ).jobs.map((x) => x.name);
  expect(names).not.toContain("Local sourced patent index");
  expect(names).toEqual(
    expect.arrayContaining(["NASA NTRS", "DOE OSTI", "INSPIRE"]),
  );
  expect(() =>
    plan(toResearchInput({ query: "pump", sources: "local" })),
  ).toThrow("not configured");
});
test("upstream HTTP status is retained as a typed failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("denied", { status: 403 })),
  );
  await expect(
    request("fixture-denied", "https://example.org/denied", {}, false),
  ).rejects.toMatchObject({
    code: "HTTP_ERROR",
    message: expect.stringContaining("403"),
  });
});

test.each([undefined, "_vercel_jwt=preview-cookie; analytics=1"])("MCP advertises public tools with unrelated cookie %s", async (cookie) => {
  const { POST } = await import("../src/app/api/mcp/route");
  const response = await POST(
    new Request("https://patentradar.test/api/mcp/patents", {
      method: "POST",
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    }),
  );
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.result.tools.map((t: { name: string }) => t.name)).toContain(
    "query_source",
  );
  expect(
    body.result.tools
      .map((t: { name: string }) => t.name)
      .some((n: string) => /cad|3d|component_library|inspect_assembly|list_my_projects/i.test(n)),
  ).toBe(false);
});
test("aggregate response keeps successful data and identifies a failed source", async () => {
  const { execute } = await import("../src/lib/search/orchestrator");
  const result = await execute(
    toResearchInput({ query: "pump", shareQuery: true }),
    undefined,
    undefined,
    [
      {
        name: "good",
        run: async () => ({
          patents: [],
          papers: [
            {
              id: "doi:test",
              title: "Pump",
              source: "fixture",
              sourceUrl: "https://example.org/pump",
              retrievedAt: new Date().toISOString(),
            },
          ],
        }),
      },
      {
        name: "bad",
        run: async () => {
          throw new Error("network");
        },
      },
    ],
  );
  expect(result.papers).toHaveLength(1);
  expect(result.sourceResults).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        provider: "good",
        status: "HEALTHY",
        papers: 1,
      }),
      expect.objectContaining({ provider: "bad", status: "UNAVAILABLE" }),
    ]),
  );
});
