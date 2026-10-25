import { describe, it, expect } from "vitest";
import {
  execute,
  plan,
  type SearchEvent,
} from "../src/lib/search/orchestrator";
import { ResearchSchema } from "../src/lib/model";
import { realProfile } from "../src/lib/real-case";
import { deduplicate } from "../src/lib/normalize";
import { familyGroups } from "../src/lib/providers/normalization";
import { readSearchStream } from "../src/lib/search/read-stream";
const input = () =>
  ResearchSchema.parse({
    profile: realProfile,
    mode: "LIVE",
    consent: true,
    query: "microfluidic",
  });
const patent = {
  id: "EP1000000A1",
  publicationNumber: "EP1000000A1",
  title: "Instrument",
  applicants: ["Example Co"],
  source: "one",
  sourceUrl: "https://example.org/patent",
  retrievedAt: new Date().toISOString(),
};
describe("search engine", () => {
  it("keeps three seeds, reports unresolved lookup and never uses a private title fallback", () => {
    const i = input();
    i.seedPublications = ["EP2345898B1", "CN102299288B", "JP1234567B2"].map(
      (publicationNumber) => ({ publicationNumber }),
    );
    expect(plan(i).queries).toHaveLength(4);
    expect(plan(i).warnings).toHaveLength(3);
    i.query = "";
    i.profile = { ...i.profile, searchKeywords: [] };
    expect(() => plan(i)).toThrow("short search concept");
  });
  it("merges claims, preserves conflicting fields and isolates invalid identifiers", () => {
    const rows = deduplicate([
      patent,
      {
        ...patent,
        source: "two",
        title: "Different title",
        claims: ["A mechanical instrument."],
        familyId: "42",
      },
      { ...patent, publicationNumber: "BAD" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].claims).toHaveLength(1);
    expect(rows[0].evidence).toHaveLength(2);
    expect(rows[0].title).toBe("Instrument");
    expect(rows[0].evidence?.[1].fields.title).toBe("Different title");
  });
  it("groups only namespaced explicit families, preserving publication members", () => {
    expect(
      familyGroups([
        { ...patent, familyId: "1" },
        { ...patent, source: "two", familyId: "1" },
      ]),
    ).toHaveLength(2);
  });
  it("emits a candidate before a slow provider settles and retains partial failures", async () => {
    let release!: () => void;
    const slow = new Promise<void>((r) => {
      release = r;
    });
    const events: SearchEvent[] = [];
    const pending = execute(input(), (e) => events.push(e), undefined, [
      { name: "fast", run: async () => ({ patents: [patent], papers: [] }) },
      {
        name: "slow",
        run: async () => {
          await slow;
          throw new Error("secret payload");
        },
      },
    ]);
    await new Promise((r) => setTimeout(r, 10));
    expect(events.some((e) => e.type === "candidate_upsert")).toBe(true);
    expect(events.some((e) => e.type === "completed")).toBe(false);
    release();
    const result = await pending;
    expect(result.patents).toHaveLength(1);
    expect(result.warnings.join()).not.toContain("secret payload");
    expect(events.at(-1)?.type).toBe("completed");
  });
  it("parses fragmented UTF-8 frames", async () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ type: "candidate_upsert", message: "专利" }) + "\n",
    );
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (const byte of bytes) c.enqueue(Uint8Array.of(byte));
        c.close();
      },
    });
    const out: SearchEvent[] = [];
    await readSearchStream(stream, (e) => out.push(e));
    expect(out[0].message).toBe("专利");
  });
  it("stops a cancelled search", async () => {
    const c = new AbortController();
    c.abort();
    await expect(execute(input(), () => {}, c.signal, [])).rejects.toThrow();
  });
});

import { citationGraph } from "../src/lib/search/citations";
it("traverses only sourced citation edges with bounded hops", () => {
  const edge = (from: string, to: string) => ({
    from,
    to,
    source: "fixture",
    sourceUrl: "https://example.org",
    retrievedAt: new Date().toISOString(),
  });
  const records = [
    { ...patent, citations: [edge("A", "B"), edge("B", "C"), edge("C", "D")] },
  ];
  expect(citationGraph(records, ["A"], 1).nodes).toEqual(["A", "B"]);
  expect(citationGraph(records, ["A"], 2).nodes).toEqual(["A", "B", "C"]);
});

it("local-only search plans no external requests and does not require sharing consent", () => {
  const i = input();
  i.sources = "local";
  i.consent = false;
  const p = plan(i);
  expect(p.jobs.map((j) => j.name)).toEqual(["Local sourced patent index"]);
});
