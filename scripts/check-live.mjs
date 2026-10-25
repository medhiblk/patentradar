// Run separately from mocked tests against the running local application.
import { writeFile } from "node:fs/promises";
const base = process.env.PATENTRADAR_URL || "http://localhost:3000";
const response = await fetch(`${base}/api/research`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    profile: {
      title: "Brick manufacturing apparatus",
      domain: "Industrial manufacturing",
      operatingPrinciple: "Transport and shape clay in mould containers.",
      technicalFeatures: [
        {
          name: "Mould container transport",
          description:
            "A conveyor transports mould containers and green bricks.",
        },
      ],
      searchKeywords: ["brick manufacturing mould conveyor"],
    },
    mode: "LIVE",
    consent: true,
    publicationNumber: "EP1000000A1",
    publicationDate: "20000517",
    query: "brick manufacturing mould conveyor",
  }),
  signal: AbortSignal.timeout(45000),
});
const data = await response.json();
const health = await (await fetch(`${base}/api/health/providers`)).json();
const summary = {
  checkedAt: new Date().toISOString(),
  httpStatus: response.status,
  mode: data.mode,
  patents: data.patents?.map((p) => ({
    publicationNumber: p.publicationNumber,
    title: p.title,
    claims: p.claims?.length,
    source: p.source,
    sourceUrl: p.sourceUrl,
    retrievedAt: p.retrievedAt,
  })),
  papers: data.papers?.map((p) => ({
    title: p.title,
    source: p.source,
    sourceUrl: p.sourceUrl,
    retrievedAt: p.retrievedAt,
  })),
  warnings: data.warnings,
  providers: health.providers.filter((p) =>
    ["epo-publication", "crossref", "openalex"].includes(p.id),
  ),
};
await writeFile(
  "artifacts/live-connectivity.json",
  JSON.stringify(summary, null, 2),
);
console.log(
  JSON.stringify(
    {
      httpStatus: response.status,
      mode: data.mode,
      patentCount: data.patents?.length,
      paperCount: data.papers?.length,
      providers: summary.providers.map((p) => ({ id: p.id, status: p.status })),
    },
    null,
    2,
  ),
);
if (!response.ok || !data.patents?.length || !data.papers?.length)
  process.exitCode = 1;
