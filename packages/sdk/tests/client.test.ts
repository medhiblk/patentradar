import { it, expect, vi } from "vitest";
import { FormaProofClient, mcpClientConfig } from "../src/index.js";
it("requires explicit public-query consent before a request", async () => {
  const fetch = vi.fn(); const client = new FormaProofClient({ fetch });
  await expect(client.search({ query: "microfluidics" })).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
  expect(fetch).not.toHaveBeenCalled();
});
it("returns validated publication provenance and keeps credentials out of serialization", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ patents: [{ id: "EP1000000A1", publicationNumber: "EP1000000A1", title: "Test record", applicants: [], source: "Fixture source", sourceUrl: "https://example.org/patent", retrievedAt: "2026-10-25T00:00:00Z" }], coverage: "Fixture, not a live provider" })));
  const client = new FormaProofClient({ baseUrl: "https://api.example.org/", fetch, token: "fixture-only-token" });
  const result = await client.lookupPatent({ publicationNumber: "EP1000000A1", publicationDate: "20000517" });
  expect(result.patents[0].sourceUrl).toBe("https://example.org/patent");
  expect(JSON.stringify(client)).not.toContain("fixture-only-token");
  expect(client.mcpUrl).toBe("https://api.example.org/api/mcp");
});
it("retains progressive events but rejects an incomplete search stream", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{"type":"provider_started","provider":"fixture"}\n', { headers: { "content-type": "application/x-ndjson" } }));
  const client = new FormaProofClient({ fetch }); const received = [];
  await expect((async () => { for await (const event of client.streamSearch({ query: "microfluidics", shareQuery: true })) received.push(event); })()).rejects.toMatchObject({ code: "INTERRUPTED" });
  expect(received).toHaveLength(1);
  expect(mcpClientConfig("https://api.example.org").mcpServers.patentradar.url).toBe(client.mcpUrl.replace("patentradar-puce.vercel.app", "api.example.org"));
});
it("decodes split UTF-8 frames progressively and validates completion", async () => {
  const result = { profile: { title: "Mécanisme", domain: "Engineering", operatingPrinciple: "Optical sensing", technicalFeatures: [{ name: "Optics", description: "Optical sensing" }], searchKeywords: ["optics"] }, mode: "PARTIAL", patents: [], papers: [], warnings: ["Fixture coverage only"], queries: ["optics"] };
  const frames = new TextEncoder().encode(JSON.stringify({ type: "provider_started", provider: "Mécanique" }) + "\n" + JSON.stringify({ type: "completed", result }));
  const accented = frames.indexOf(0xc3);
  let chunk = 0;
  const chunks = [frames.slice(0, accented + 1), frames.slice(accented + 1, accented + 9), frames.slice(accented + 9)];
  const body = new ReadableStream({ pull(controller) { if (chunk < chunks.length) controller.enqueue(chunks[chunk++]); else controller.close(); } });
  const fetch = vi.fn().mockResolvedValue(new Response(body));
  const received = [];
  for await (const event of new FormaProofClient({ fetch }).streamSearch({ query: "optical sensor", shareQuery: true })) received.push(event);
  expect(received[0].provider).toBe("Mécanique");
  expect(received[1].result?.profile.title).toBe("Mécanisme");
});
it("does not treat a completed marker without evidence as success", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{"type":"completed"}\n'));
  await expect((async () => { for await (const event of new FormaProofClient({ fetch }).streamSearch({ query: "optics", shareQuery: true })) void event; })()).rejects.toThrow("validated result");
});
it("validates source-query consent before sending and decodes explicit source outcomes", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ provider: "lens", status: "NOT_CONFIGURED", error: "Provider disabled", retrievedAt: "2026-10-26T00:00:00Z" })));
  const client = new FormaProofClient({ fetch });
  await expect(client.querySource({ provider: "lens", query: "optical sensor" })).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
  expect(fetch).not.toHaveBeenCalled();
  expect(await client.querySource({ provider: "lens", query: "optical sensor", consent: true })).toMatchObject({ status: "NOT_CONFIGURED" });
  expect(String(fetch.mock.calls[0][0])).toContain("/api/v1/sources/query");
});
it("rejects source results claiming success without records", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ provider: "ror", status: "HEALTHY", retrievedAt: "2026-10-26T00:00:00Z", page: 1, category: "organization", latencyMs: 1, warnings: [] })));
  await expect(new FormaProofClient({ fetch }).querySource({ provider: "ror", query: "Oxford", consent: true })).rejects.toThrow();
});
