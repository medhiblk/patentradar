import { createHash } from "node:crypto";
export const sharedConfigured = () =>
  !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
export async function redis(command: (string | number)[]) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) throw new Error("Shared cache unavailable");
  const data = await r.json();
  if (data.error) throw new Error("Shared cache command failed");
  return data.result;
}
export const publicCacheKey = (key: string) =>
  "patentradar:public:" + createHash("sha256").update(key).digest("hex");
export async function reserve(provider: string, gap: number) {
  if (!sharedConfigured()) return 0;
  // Atomic across instances; Redis clock avoids worker clock skew. A denied slot is not consumed.
  return Number(
    await redis([
      "EVAL",
      "local t=redis.call('TIME'); local now=t[1]*1000+math.floor(t[2]/1000); local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>now then return n-now end; redis.call('SET',KEYS[1],now+tonumber(ARGV[1]),'PX',ARGV[1]); return 0",
      1,
      "patentradar:pace:" + provider,
      gap,
    ]),
  );
}
