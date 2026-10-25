import { afterEach, expect, it, vi } from "vitest";
import { execute, type SearchEvent } from "../src/lib/search/orchestrator";
import { ResearchSchema, ReportSchema } from "../src/lib/model";
import { realProfile } from "../src/lib/real-case";
import { request, ProviderRequestError } from "../src/lib/providers/http";
import { withRequestTrace } from "../src/lib/search/request-trace";
import type { RequestTrace } from "../src/lib/search/audit";
import { evidenceBasis, passageSource } from "../src/lib/intelligence/evidence";
import { deduplicate } from "../src/lib/normalize";
import { compare } from "../src/lib/compare";
import { reportSections } from "../src/lib/report";
import { POST as referenceComparison } from "../src/app/api/demo/patent-case/route";
import source from "../src/lib/examples/us20080003142a1.json";
import { PatentSchema } from "../src/lib/providers/types";
import * as localIndex from "../src/lib/providers/local-index";
const referencePatent = PatentSchema.parse(source.patent);
const input = () =>
  ResearchSchema.parse({
    profile: realProfile,
    mode: "LIVE",
    consent: true,
    query: "microfluidic",
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("records this execution's completed, empty and failed sources, queries and publications", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  const events: SearchEvent[] = [];
  const result = await execute(
    input(),
    (event) => events.push(event),
    undefined,
    [
      {
        name: "OpenAIRE Graph",
        run: async () => {
          await request(
            "evidence-fixture",
            "https://public.example/works?api_key=DO_NOT_EXPOSE&query=" +
              crypto.randomUUID(),
          );
          return { patents: [referencePatent, referencePatent], papers: [] };
        },
      },
      { name: "Crossref", run: async () => ({ patents: [], papers: [] }) },
      {
        name: "HAL",
        run: async () => {
          throw new ProviderRequestError(
            "hal",
            "RATE_LIMITED",
            "PRIVATE_SERVER_ERROR",
          );
        },
      },
    ],
  );
  const trace = result.searchTrace!;
  expect(trace.providers.map((run) => run.status)).toEqual([
    "succeeded",
    "empty",
    "failed",
  ]);
  expect(trace.providers[0].patentsRetrieved).toBe(1);
  expect(trace.providers[0].patentNumbers).toEqual(["US20080003142A1"]);
  expect(trace.providers[0].queries).toEqual(["microfluidic"]);
  expect(trace.providers[0].requests[0]).toMatchObject({
    endpoint: "https://public.example/works",
    httpStatus: 200,
    servedFrom: "network",
  });
  expect(JSON.stringify(trace)).not.toMatch(
    /DO_NOT_EXPOSE|PRIVATE_SERVER_ERROR/,
  );
  expect(trace.providers[2].message).toContain("Rate-limited");
  expect(
    events.find((event) => event.type === "started")?.searchTrace?.providers[0]
      .status,
  ).toBe("queued");
  expect(
    events.find(
      (event) =>
        event.type === "provider_finished" &&
        event.provider === "OpenAIRE Graph",
    )?.providerRun?.status,
  ).toBe("succeeded");
  expect(ReportSchema.parse(result).searchTrace).toEqual(trace);
});
it("distinguishes cache reuse from a new HTTP request without inventing a cached HTTP status", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("metadata"));
  vi.stubGlobal("fetch", fetch);
  const requests: RequestTrace[] = [],
    url = "https://public.example/cache/" + crypto.randomUUID();
  await withRequestTrace(requests, async () => {
    await request("audit-cache", url);
    await request("audit-cache", url);
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(requests[0]).toMatchObject({ servedFrom: "network", httpStatus: 200 });
  expect(requests[1].servedFrom).toBe("memory-cache");
  expect(requests[1].httpStatus).toBeUndefined();
});
it("retains actual quota failure evidence without exposing API key query parameters", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("Rate limited", {
          status: 429,
          headers: { "Retry-After": "30" },
        }),
      ),
  );
  const result = await execute(input(), undefined, undefined, [
    {
      name: "OpenAlex",
      run: async () => {
        await request(
          "audit-quota",
          "https://public.example/quota?api_key=SECRET",
        );
        return { patents: [], papers: [] };
      },
    },
  ]);
  const run = result.searchTrace!.providers[0];
  expect(run.status).toBe("failed");
  expect(run.patentsRetrieved).toBe(0);
  expect(run.requests[0]).toMatchObject({
    httpStatus: 429,
    errorCode: "RATE_LIMITED",
  });
  expect(JSON.stringify(result.searchTrace)).not.toContain("SECRET");
});
it("attributes a merged claim passage to the provider that supplied it", () => {
  const [patent] = deduplicate([
    {
      ...referencePatent,
      claims: undefined,
      evidence: undefined,
      source: "Metadata provider",
      sourceUrl: "https://example.org/metadata",
    },
    {
      ...referencePatent,
      evidence: undefined,
      source: "Claims provider",
      sourceUrl: "https://example.org/claims",
    },
  ]);
  const attribution = passageSource(patent, patent.claims![0]);
  expect(attribution.source).toBe("Claims provider");
  expect(attribution.verified).toBe(true);
  expect(attribution.url).toBe("https://example.org/claims");
});
it("does not invent passage-level attribution when merged sources do not support it", () => {
  const attribution = passageSource(
    {
      ...referencePatent,
      evidence: [
        {
          source: "One",
          sourceUrl: "https://example.org/one",
          retrievedAt: referencePatent.retrievedAt,
          fields: {},
        },
        {
          source: "Two",
          sourceUrl: "https://example.org/two",
          retrievedAt: referencePatent.retrievedAt,
          fields: {},
        },
      ],
    },
    referencePatent.claims![0],
  );
  expect(attribution.verified).toBe(false);
});
it("labels title-only and partial-claim evidence accurately", () => {
  const titleOnly = {
    ...referencePatent,
    claims: undefined,
    abstract: undefined,
  };
  expect(evidenceBasis(titleOnly)).toBe("Title only");
  expect(compare(realProfile, titleOnly).limitation).toContain("Title-only");
  expect(
    evidenceBasis(referencePatent as Parameters<typeof evidenceBasis>[0]),
  ).toBe("Claim excerpts");
});
it("keeps user search queries out of the shared sourced patent index", async () => {
  localIndex.indexPatents([
    { ...referencePatent, queries: ["Other owner's private research terms"] },
  ]);
  const records = await localIndex.lookup([referencePatent.publicationNumber]);
  expect(records).toHaveLength(1);
  expect(records[0].queries).toBeUndefined();
  const local = input();
  local.sources = "local";
  local.consent = false;
  const result = await execute(local);
  expect(JSON.stringify(result)).not.toContain(
    "Other owner's private research terms",
  );
});
it("exports the reference exercise's true methodology, sources and original PDF page", async () => {
  const response = await referenceComparison(
    new Request("https://app.example/api/demo/patent-case", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description:
          "An inlet channel carries dispersed phase fluid. A flow focusing nozzle creates uniform droplets. Optical detection measures droplet characteristics.",
      }),
    }),
  );
  const { research } = await response.json();
  const parsed = ReportSchema.parse(research);
  expect(parsed.searchTrace?.context).toBe("known-reference");
  expect(parsed.searchTrace?.providers[0].requests).toEqual([]);
  expect(
    passageSource(parsed.patents[0], parsed.patents[0].claims![0]).page,
  ).toBe(81);
  const sections = reportSections(parsed);
  expect(sections[2][1]).toContain(
    "No live worldwide search or BigQuery query was performed",
  );
  expect(sections[5][1]).toContain("original PDF page 81");
  expect(sections[5][1]).toContain("US20080003142A1.pdf#page=81");
});
