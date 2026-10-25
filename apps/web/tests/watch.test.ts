import { it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ReportSchema, ResearchSchema } from "../src/lib/model";
import { PatentSchema } from "../src/lib/providers/types";
import { localExtract } from "../src/lib/local-extract";
import reference from "../src/lib/examples/us20080003142a1.json";
import { mergeWatchResult } from "../src/lib/intelligence/watch";
import { savedAlerts, similarityAlerts } from "../src/lib/intelligence/alerts";
import { applicantActivity } from "../src/lib/intelligence/applicants";
import { POST as vault } from "../src/app/api/vault/route";
import { POST as acknowledge } from "../src/app/api/project-alerts/route";
import { getItem } from "../src/lib/platform/store";
const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../src/lib/search/orchestrator", () => ({ execute: mock.execute }));
import { POST as checkWatch } from "../src/app/api/watch/route";

const profile = localExtract("A microfluidic substrate uses an inlet channel to carry dispersed phase fluid into a continuous phase fluid. A flow focusing nozzle produces uniform monodisperse droplets. A coalescence apparatus uses electrodes to generate an electric field. A detection module evaluates droplet contents with an optical detector.");
const a = PatentSchema.parse(reference.patent);
// Deliberate fixture metadata; no request is made to a provider.
const b = { ...a, id: "fixture-b", publicationNumber: "EP1000000A1", title: "Fixture B", source: "Fixture source", sourceUrl: "https://example.test/fixture-b", publicationDate: "2000-05-17" };
const input = ResearchSchema.parse({ profile, query: "microfluidic droplets", mode: "LIVE", consent: true });
function report(patents = [a, b], freshness: "network" | "memory-cache" | "failed" = "network") {
  return ReportSchema.parse({ profile, mode: "PARTIAL", patents, papers: [], warnings: [], queries: ["microfluidic droplets"], searchTrace: {
    searchId: "fixture-search", context: "live-search", startedAt: "2026-10-25T00:00:00Z", notQueried: [],
    providers: [{ id: "fixture", name: "Fixture source, not a live provider", category: "patent", method: "keyword-search", coverage: "Test fixture only", queries: ["microfluidic droplets"], status: freshness === "failed" ? "failed" : patents.length ? "succeeded" : "empty", patentsRetrieved: patents.length, papersRetrieved: 0, patentNumbers: patents.map(p => p.publicationNumber), requests: [{ provider: "fixture", endpoint: "https://example.test/search", observedAt: "2026-10-25T00:00:00Z", servedFrom: freshness === "failed" ? "network" : freshness, httpStatus: freshness === "failed" ? 503 : 200, ...(freshness === "failed" ? { errorCode: "UNAVAILABLE" } : {}) }] }],
  } });
}
const one = "2026-10-25T10:00:00Z", two = "2026-10-25T11:00:00Z", three = "2026-10-25T12:00:00Z";
it("keeps a cumulative baseline through A/B -> A -> A/B without rediscoveries", () => {
  const baseline = mergeWatchResult({ input }, report(), one);
  expect(baseline.checkSummary).toMatchObject({ baselineCreated: true, firstObserved: 2, newDiscoveries: 0 });
  const missing = mergeWatchResult(baseline, report([a]), two);
  const restored = mergeWatchResult(missing, report(), three);
  expect(restored.publications).toEqual([a.publicationNumber, b.publicationNumber]);
  expect(restored.discoveries).toEqual([]);
  expect(restored.observations.find(row => row.publicationNumber === b.publicationNumber)).toMatchObject({ firstSeenAt: one, lastSeenAt: three });
});
it("preserves historic alerts, review state and successful freshness when all sources fail", () => {
  const baseline = mergeWatchResult({ input }, report(), one);
  baseline.similarityAlerts = baseline.similarityAlerts.map(alert => ({ ...alert, acknowledged: true }));
  const failed = mergeWatchResult(baseline, report([], "failed"), two);
  expect(failed.checkSummary.status).toBe("failed");
  expect(failed.lastChecked).toBe(one);
  expect(failed.lastConfirmedCheckAt).toBe(one);
  expect(failed.lastAttemptedAt).toBe(two);
  expect(failed.lastResult).toEqual(baseline.lastResult);
  expect(failed.publications).toEqual(baseline.publications);
  expect(failed.similarityAlerts).toEqual(baseline.similarityAlerts);
});
it("distinguishes cache reuse and a new observation from a recently published record", () => {
  const baseline = mergeWatchResult({ input }, report([a]), one);
  const cached = mergeWatchResult(baseline, report([a], "memory-cache"), two);
  expect(cached.checkSummary.status).toBe("cached");
  expect(cached.lastChecked).toBe(one);
  const observed = mergeWatchResult(cached, report(), three);
  expect(observed.checkSummary.newDiscoveries).toBe(1);
  expect(observed.checkSummary.recentPublications).toEqual([]);
  expect(observed.observations.find(row => row.publicationNumber === b.publicationNumber)?.firstSeenAt).toBe(three);
});
it("does not establish a baseline or freshness from a failed initial check", () => {
  const failed = mergeWatchResult({ input }, report([], "failed"), one);
  expect(failed.checkSummary.baselineCreated).toBe(false);
  expect(failed.baselineInitialized).toBe(false);
  expect(failed).not.toHaveProperty("lastChecked");
});
it("compares source-reported publication dates at day precision and rejects invalid dates", () => {
  const baseline = mergeWatchResult({ input }, report([a]), one);
  const recent = { ...b, publicationDate: "20261025" };
  expect(mergeWatchResult(baseline, report([a, recent]), two).checkSummary.recentPublications).toEqual([b.publicationNumber]);
  expect(mergeWatchResult(baseline, report([a, { ...b, publicationDate: "2026-02-30" }]), two).checkSummary.recentPublications).toEqual([]);
});
it("retains reviewed alerts when feature and term order change, with source offsets", () => {
  const original = similarityAlerts(profile, [a]);
  expect(original.length).toBeGreaterThan(0);
  const previous = original.map(alert => ({ ...alert, acknowledged: true, matches: [...alert.matches].reverse().map(match => ({ ...match, terms: [...match.terms].reverse() })) }));
  const reorderedProfile = { ...profile, technicalFeatures: [...profile.technicalFeatures].reverse() };
  const updated = similarityAlerts(reorderedProfile, [a], previous);
  expect(updated[0].id).toBe(original[0].id);
  expect(updated[0].acknowledged).toBe(true);
  expect(updated[0].matches[0]).toMatchObject({ evidenceField: "claim", start: expect.any(Number), end: expect.any(Number), sourceUrl: expect.any(String) });
});
it("normalizes applicant spelling without assuming subsidiaries are equivalent", () => {
  const patents = [{ ...a, applicants: ["ACME, Inc.", " acme inc "] }, { ...b, applicants: ["ACME INC", "Other Subsidiary"] }];
  const groups = applicantActivity(patents);
  expect(groups.find(group => group.name === "ACME, Inc.")?.count).toBe(2);
  expect(groups).toHaveLength(2);
  expect(applicantActivity(patents, [{ name: "Acme", aliases: ["ACME Inc", "Other Subsidiary"], confirmed: true }])).toHaveLength(1);
  expect(() => applicantActivity(patents, [{ name: "A", aliases: ["same"], confirmed: true }, { name: "B", aliases: ["same"], confirmed: true }])).toThrow("two confirmed groups");
});

const req = (path: string, body: object, cookie?: string) => new Request("http://localhost:3000" + path, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": randomUUID(), ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
async function createWatch() {
  const signed = await vault(req("/api/vault", { action: "register", email: `watch-${randomUUID()}@example.test`, password: `fixture-password-${randomUUID()}` }));
  const cookie = signed.headers.get("set-cookie")!.split(";")[0];
  const data = mergeWatchResult({ input }, report(), one);
  const saved = await vault(req("/api/vault", { action: "save", kind: "watch", title: "Fixture watch", data }, cookie));
  const id = (await saved.json()).id;
  return { cookie, id, data };
}
it("merges an in-flight watch against a concurrent review, preserving a temporarily missing patent", async () => {
  const { cookie, id, data } = await createWatch();
  const target = data.similarityAlerts.find(alert => alert.publicationNumber === b.publicationNumber)!;
  let start!: () => void, finish!: (result: ReturnType<typeof report>) => void;
  const started = new Promise<void>(resolve => { start = resolve; });
  const result = new Promise<ReturnType<typeof report>>(resolve => { finish = resolve; });
  mock.execute.mockImplementationOnce(() => { start(); return result; });
  const pending = checkWatch(req("/api/watch", { id, consent: true }, cookie));
  await started;
  const reviewed = await acknowledge(req("/api/project-alerts", { projectId: id, alertId: target.id, acknowledged: true }, cookie));
  expect(reviewed.status).toBe(200);
  finish(report([a]));
  const response = await pending;
  expect(response.status).toBe(200);
  const u = await (await import("../src/lib/platform/auth")).requireUser(req("/api/watch", {}, cookie));
  const stored = await getItem(u.id, id);
  expect(savedAlerts(stored!.data).find(alert => alert.id === target.id)?.acknowledged).toBe(true);
  expect(stored!.data.publications).toEqual([a.publicationNumber, b.publicationNumber]);
});
it("requires account and per-check sharing consent before any external retrieval", async () => {
  mock.execute.mockClear();
  const { cookie, id } = await createWatch();
  expect((await checkWatch(req("/api/watch", { id, consent: true }))).status).toBe(401);
  expect((await checkWatch(req("/api/watch", { id, consent: false }, cookie))).status).toBe(400);
  expect(mock.execute).not.toHaveBeenCalled();
});
