import { it, expect, vi, afterEach } from "vitest";
import { reserve } from "../src/lib/cache/shared";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("two callers share a single atomic pacing slot and fail closed on backend error", async () => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fixture");
  let occupied = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const delay = occupied ? 61000 : 0;
      occupied = true;
      return Response.json({ result: delay });
    }),
  );
  const result = await Promise.all([
    reserve("openaire", 61000),
    reserve("openaire", 61000),
  ]);
  expect(result).toEqual([0, 61000]);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("", { status: 503 })),
  );
  await expect(reserve("openaire", 61000)).rejects.toThrow("unavailable");
});
