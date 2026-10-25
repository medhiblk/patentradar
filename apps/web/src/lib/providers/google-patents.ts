import { redis, sharedConfigured } from "../cache/shared";
import { createHash } from "node:crypto";
import { BigQuery } from "@google-cloud/bigquery";
import { PatentSchema, type PatentRecord } from "./types";
import { patentSeed } from "../patent-seeds";
import { currentSearchSignal } from "../search/scope";
export const TABLE = "patents-public-data.patents.publications";
export const enabled = () =>
  process.env.ENABLE_BIGQUERY === "true" && !!process.env.GOOGLE_CLOUD_PROJECT;
const cache = new Map<string, { until: number; records: PatentRecord[] }>();
let client: BigQuery | undefined;
function connection() {
  if (!enabled())
    throw new Error(
      "BigQuery is disabled or missing GOOGLE_CLOUD_PROJECT. Configure authorized ADC/WIF.",
    );
  return (client ||= new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  }));
}
export function docdb(input: string) {
  const p = patentSeed(input);
  if (!p.kindCode) throw new Error("Kind code required for exact lookup");
  return `${p.jurisdiction}-${p.number}-${p.kindCode}`;
}
const date = (value: unknown) => {
  const s = String(value);
  if (!/^\d{8}$/.test(s) || s === "00000000") return undefined;
  const d = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}`;
  return Number.isNaN(Date.parse(d)) ? undefined : d;
};
type Row = Record<string, unknown>;
const localized = (v: unknown) => {
  const a = (Array.isArray(v) ? v : []) as {
    text?: string;
    language?: string;
  }[];
  return a.find((x) => x.language === "en")?.text || a[0]?.text;
};
export function normalizeRow(r: Row): PatentRecord {
  const publicationNumber = patentSeed(
    String(r.publication_number),
  ).publicationNumber;
  return PatentSchema.parse({
    id: publicationNumber,
    publicationNumber,
    title: localized(r.title_localized) || publicationNumber,
    abstract: localized(r.abstract_localized),
    applicants: Array.isArray(r.assignee) ? r.assignee : [],
    inventors: r.inventor,
    publicationDate: date(r.publication_date),
    priorityDate: date(r.priority_date),
    jurisdiction: r.country_code,
    familyId: r.family_id || undefined,
    familyNamespace: TABLE,
    cpcCodes: Array.isArray(r.cpc) ? r.cpc.map((x) => x.code) : undefined,
    ipcCodes: Array.isArray(r.ipc) ? r.ipc.map((x) => x.code) : undefined,
    citations: Array.isArray(r.citation)
      ? r.citation.flatMap((c) => {
          try {
            return [
              {
                from: publicationNumber,
                to: patentSeed(String(c.publication_number)).publicationNumber,
                source: "Google Patents Public Data",
                sourceUrl:
                  "https://console.cloud.google.com/bigquery?p=patents-public-data&d=patents&t=publications&page=table",
                retrievedAt: new Date().toISOString(),
              },
            ];
          } catch {
            return [];
          }
        })
      : undefined,
    claims: localized(r.claims_localized)
      ? [localized(r.claims_localized)!]
      : undefined,
    source: "Google Patents Public Data / IFI CLAIMS / CC BY 4.0",
    sourceUrl: `https://console.cloud.google.com/bigquery?p=patents-public-data&d=patents&t=publications&page=table`,
    additionalSources: [
      {
        name: "CC BY 4.0",
        url: "https://creativecommons.org/licenses/by/4.0/",
      },
    ],
    retrievedAt: new Date().toISOString(),
  });
}
export async function retrieve(
  query: string,
  seeds: string[],
): Promise<PatentRecord[]> {
  const bq = connection();
  const key = createHash("sha256")
    .update(JSON.stringify({ query, seeds, version: 1 }))
    .digest("hex");
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.records;
  const signal = currentSearchSignal();
  signal?.throwIfAborted();
  const [metadata] = await bq
    .dataset("patents", { projectId: "patents-public-data" })
    .table("publications")
    .getMetadata();
  const fields = new Set(
    (metadata.schema?.fields || []).map((f: { name: string }) => f.name),
  );
  for (const field of [
    "publication_number",
    "title_localized",
    "abstract_localized",
    "assignee",
    "family_id",
  ])
    if (!fields.has(field)) throw new Error("BigQuery schema mismatch");
  const columns = [
    "publication_number",
    "title_localized",
    "abstract_localized",
    "assignee",
    "inventor",
    "country_code",
    "publication_date",
    "priority_date",
    "family_id",
    "cpc",
    "ipc",
    ...(seeds.length ? ["claims_localized", "citation"] : []),
  ].filter((f) => fields.has(f));
  const where = seeds.length
    ? "publication_number IN UNNEST(@ids)"
    : "EXISTS (SELECT 1 FROM UNNEST(title_localized) t WHERE STRPOS(LOWER(t.text), LOWER(@term)) > 0)";
  const sql = `SELECT ${columns.join(", ")} FROM \`${TABLE}\` WHERE ${where} LIMIT 20`;
  const params = seeds.length ? { ids: seeds.map(docdb) } : { term: query };
  const cap = Number(process.env.BIGQUERY_MAX_BYTES || 1073741824);
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > 1073741824)
    throw new Error("BigQuery byte cap must be 1..1 GiB");
  const options = {
    query: sql,
    params,
    useLegacySql: false,
    location: metadata.location || "US",
    maximumBytesBilled: String(cap),
  };
  const [dry] = await bq.createQueryJob({ ...options, dryRun: true });
  const estimated = Number(
    dry.metadata.statistics?.query?.totalBytesProcessed ||
      dry.metadata.statistics?.totalBytesProcessed,
  );
  if (!Number.isFinite(estimated) || estimated > cap)
    throw new Error("BigQuery dry run exceeds configured byte budget");
  if (process.env.VERCEL && !sharedConfigured())
    throw new Error("Hosted BigQuery requires shared budget storage");
  if (sharedConfigured()) {
    const key = "patentradar:bq:bytes:" + new Date().toISOString().slice(0, 7);
    const reserved = Number(
      await redis([
        "EVAL",
        "local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n+tonumber(ARGV[1])>tonumber(ARGV[2]) then return -1 end; redis.call('INCRBY',KEYS[1],ARGV[1]); redis.call('EXPIRE',KEYS[1],2764800); return 1",
        1,
        key,
        Math.max(estimated, 1),
        879609302220,
      ]),
    );
    if (reserved < 0)
      throw new Error("Monthly BigQuery reservation limit reached");
  }
  signal?.throwIfAborted();
  const [job] = await bq.createQueryJob(options);
  let rejectStop: (reason: Error) => void = () => {};
  const stopped = new Promise<never>((_, reject) => {
    rejectStop = reject;
  });
  const cancel = () => {
    void job.cancel().catch(() => {});
    rejectStop(new Error("BigQuery cancelled or timed out"));
  };
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 30000);
  try {
    if (signal?.aborted) cancel();
    const [rows] = await Promise.race([
      job.getQueryResults({ maxResults: 20, timeoutMs: 30000 }),
      stopped,
    ]);
    signal?.throwIfAborted();
    const [m] = await job.getMetadata();
    console.info(
      JSON.stringify({
        event: "bigquery_job",
        jobId: job.id,
        location: options.location,
        estimatedBytes: estimated,
        processedBytes: m.statistics?.query?.totalBytesProcessed,
        cacheHit: m.statistics?.query?.cacheHit,
        tableModified: metadata.lastModifiedTime,
      }),
    );
    const records = rows.map(normalizeRow);
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
    cache.set(key, {
      records,
      until: Date.now() + (seeds.length ? 86400000 : 900000),
    });
    return records;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
