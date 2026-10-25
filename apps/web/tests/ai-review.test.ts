import { it, expect, vi, beforeEach, afterEach } from "vitest";
const model = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse: model.parse };
  },
}));
import { POST } from "../src/app/api/intelligence/ai/route";
import { POST as vault } from "../src/app/api/vault/route";
import { realProfile } from "../src/lib/real-case";
let cookie = "";
beforeEach(async () => {
  vi.stubEnv("OPENAI_API_KEY", "fixture-not-a-real-key");
  const r = await vault(
    new Request("http://localhost:3000/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register",
        email: crypto.randomUUID() + "@example.test",
        password: "fixture-test-password",
      }),
    }),
  );
  cookie = r.headers.get("set-cookie")!.split(";")[0];
});
afterEach(() => vi.unstubAllEnvs());
const patent = {
  id: "EP1000000A1",
  publicationNumber: "EP1000000A1",
  title: "Fixture",
  applicants: [],
  claims: ["A shaft is supported by a bearing."],
  source: "Fixture only",
  sourceUrl: "https://example.test",
  retrievedAt: "2026-10-25",
};
const call = (body: object) =>
  POST(
    new Request("http://localhost:3000/api/intelligence/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        consent: true,
        profile: realProfile,
        patents: [patent],
        ...body,
      }),
    }),
  );
it("rejects an invented quote rather than showing an unverified AI claim", async () => {
  model.parse.mockResolvedValue({
    output_parsed: {
      matches: [
        {
          feature: 0,
          claim: 0,
          quote: "teleportation",
          explanation: "fabricated",
        },
      ],
      limitations: [],
    },
  });
  expect((await call({ operation: "compare" })).status).toBe(400);
});
it("returns offsets and provenance only for actual retrieved quote", async () => {
  model.parse.mockResolvedValue({
    output_parsed: {
      matches: [
        { feature: 0, claim: 0, quote: "shaft", explanation: "shared term" },
      ],
      limitations: [],
    },
  });
  const r = await call({ operation: "compare" });
  expect(r.status).toBe(200);
  expect((await r.json()).matches[0]).toMatchObject({
    start: 2,
    end: 7,
    publicationNumber: "EP1000000A1",
  });
});
it("rejects patent identifiers absent from candidates during reranking", async () => {
  model.parse.mockResolvedValue({
    output_parsed: {
      ranking: [{ publicationNumber: "INVENTED", reason: "invalid" }],
    },
  });
  expect((await call({ operation: "rerank" })).status).toBe(400);
});
it("labels translations and preserves original text", async () => {
  model.parse.mockResolvedValue({
    output_parsed: { translation: "Un arbre." },
  });
  const r = await call({
    operation: "translate",
    text: "A shaft.",
    language: "French",
  });
  expect(await r.json()).toMatchObject({
    original: "A shaft.",
    machineTranslation: true,
  });
});
