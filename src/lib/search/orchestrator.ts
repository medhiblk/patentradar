import { ResearchSchema, type Research } from "@/lib/model";
import { deduplicate, diversePapers } from "@/lib/normalize";
import { compare, tokens } from "@/lib/compare";
import * as crossref from "@/lib/providers/crossref";
import * as openalex from "@/lib/providers/openalex";
import * as epmcResearch from "@/lib/providers/europe-pmc-research";
import * as epo from "@/lib/providers/epo-publication";
import * as publicPatents from "@/lib/providers/europe-pmc";
import * as ops from "@/lib/providers/epo-ops";
import * as pages from "@/lib/providers/patent-pages";
import * as pubmed from "@/lib/providers/pubmed";
import * as semantic from "@/lib/providers/semantic-scholar";
import * as extra from "@/lib/providers/new-research";
import * as openaire from "@/lib/providers/openaire";
import * as veyip from "@/lib/providers/veyip";
import type { Paper, PatentRecord } from "@/lib/providers/types";
import * as localIndex from "../providers/local-index";
import { z } from "zod";
import { patentSeed } from "../patent-seeds";
import { familyGroups } from "../providers/normalization";
import * as google from "../providers/google-patents";
import { withSearchSignal } from "./scope";
export type SearchInput = z.infer<typeof ResearchSchema>;
export type SearchEvent = {
  schemaVersion: 1;
  searchId: string;
  sequence: number;
  timestamp: string;
  type: string;
  provider?: string;
  candidate?: PatentRecord;
  result?: Research;
  message?: string;
};
export type Job = {
  name: string;
  run: () => Promise<{ patents: PatentRecord[]; papers: Paper[] }>;
};
export function plan(input: SearchInput): {
  jobs: Job[];
  warnings: string[];
  queries: string[];
} {
  if (input.mode === "DEMO") throw new Error("Demo mode is disabled.");
  if (!input.consent && input.sources !== "local")
    throw new Error("Search concept sharing consent is required.");
  const query =
    input.query.trim() ||
    input.profile.searchKeywords.find((q) => q.trim())?.trim();
  if (!query)
    throw new Error(
      "Review and supply a short search concept before searching. Your description will not be used as a fallback.",
    );
  const warnings: string[] = [];
  const jobs: Job[] = [
    {
      name: "Local sourced patent index",
      run: async () => ({
        patents: deduplicate([
          ...(await localIndex.search(query)),
          ...(await localIndex.lookup([
            ...input.seedPublications.map(
              (s) => patentSeed(s.publicationNumber).publicationNumber,
            ),
            ...(input.publicationNumber
              ? [patentSeed(input.publicationNumber).publicationNumber]
              : []),
          ])),
        ]),
        papers: [],
      }),
    },
  ];
  if (input.sources === "local")
    return {
      jobs,
      warnings: [
        "Local index only: no external search requests. Coverage is limited to cached or authorized imported records.",
      ],
      queries: [query],
    };
  const paper = (name: string, fn: () => Promise<Paper[]>) =>
    jobs.push({ name, run: async () => ({ papers: await fn(), patents: [] }) });
  jobs.push({ name: "OpenAIRE Graph", run: () => openaire.search(query) });
  paper("DataCite", () => extra.datacite(query));
  paper("HAL", () => extra.hal(query));
  paper("arXiv", () => extra.arxiv(query));
  paper("Zenodo", () => extra.zenodo(query));
  paper("Crossref", () => crossref.search(query));
  paper("OpenAlex", () => openalex.search(query));
  paper("Europe PMC scientific", () => epmcResearch.search(query));
  paper("PubMed", () => pubmed.search(query));
  const seeds = [
    ...input.seedPublications,
    ...(input.publicationNumber
      ? [
          {
            publicationNumber: input.publicationNumber,
            publicationDate: input.publicationDate,
          },
        ]
      : []),
  ];
  if (seeds.length > 10) throw new Error("Use at most 10 seed publications.");
  const unique = [
    ...new Map(
      seeds.map((s) => {
        const p = patentSeed(s.publicationNumber);
        return [p.publicationNumber, { ...s, ...p }] as const;
      }),
    ).values(),
  ];
  for (const seed of unique) {
    if (!seed.kindCode) {
      warnings.push(
        `${seed.publicationNumber}: unresolved kind code; no kind code was guessed.`,
      );
      continue;
    }
    if (seed.jurisdiction === "EP" && seed.publicationDate)
      jobs.unshift({
        name: "EPO " + seed.publicationNumber,
        run: async () => ({
          patents: await epo.lookup(
            seed.publicationNumber,
            seed.publicationDate,
          ),
          papers: [],
        }),
      });
    else if (!google.enabled())
      warnings.push(
        `${seed.publicationNumber}: lookup unavailable; configure BigQuery or supply an EP publication date.`,
      );
  }
  if (google.enabled())
    jobs.unshift({
      name: "Google Patents Public Data",
      run: async () => ({
        patents: await google.retrieve(
          query,
          unique.filter((s) => s.kindCode).map((s) => s.publicationNumber),
        ),
        papers: [],
      }),
    });
  if (process.env.EPO_OPS_KEY && process.env.EPO_OPS_SECRET)
    jobs.push({
      name: "EPO OPS",
      run: async () => ({ patents: await ops.search(query), papers: [] }),
    });
  if (process.env.ENABLE_EPMC_PATENT_ARCHIVE === "true")
    jobs.push({
      name: "Europe PMC",
      run: async () => ({
        patents: await publicPatents.search(query),
        papers: [],
      }),
    });
  if (process.env.ENABLE_SEMANTIC_SCHOLAR === "true")
    paper("Semantic Scholar", () => semantic.search(query));
  if (process.env.ENABLE_EXPERIMENTAL_VEYIP === "true")
    jobs.push({
      name: "VeyIP MCP",
      run: async () => ({
        patents: await veyip.search(query, 1, "all"),
        papers: [],
      }),
    });
  return {
    jobs,
    warnings,
    queries: [query, ...unique.map((s) => s.publicationNumber)],
  };
}
export async function execute(
  input: SearchInput,
  emit: (event: SearchEvent) => void = () => {},
  signal?: AbortSignal,
  override?: Job[],
) {
  return withSearchSignal(signal, async () => {
    const planned = plan(input),
      jobs = override || planned.jobs;
    const searchId = crypto.randomUUID();
    let sequence = 0,
      index = 0;
    const send = (type: string, data: Partial<SearchEvent> = {}) => {
      if (!signal?.aborted)
        emit({
          schemaVersion: 1,
          searchId,
          sequence: ++sequence,
          timestamp: new Date().toISOString(),
          type,
          ...data,
        });
    };
    let patents: PatentRecord[] = [];
    const papers: Paper[] = [];
    const warnings = [...planned.warnings];
    send("started");
    await Promise.all(
      Array.from({ length: Math.min(4, jobs.length) }, async () => {
        while (index < jobs.length && !signal?.aborted) {
          const job = jobs[index++];
          send("provider_started", { provider: job.name });
          const began = Date.now();
          try {
            const records = await job.run();
            if (signal?.aborted) break;
            patents = deduplicate([...patents, ...records.patents]);
            localIndex.indexPatents(records.patents);
            papers.push(...records.papers);
            for (const candidate of deduplicate(records.patents).map(
              (p) =>
                patents.find(
                  (v) => v.publicationNumber === p.publicationNumber,
                )!,
            ))
              send("candidate_upsert", { provider: job.name, candidate });
            send("provider_finished", { provider: job.name });
            console.info(
              JSON.stringify({
                event: "search_provider_complete",
                searchId,
                provider: job.name,
                patents: records.patents.length,
                papers: records.papers.length,
                elapsedMs: Date.now() - began,
              }),
            );
          } catch {
            warnings.push(
              `${job.name} unavailable or rate-limited; other sources continue.`,
            );
            send("provider_failed", {
              provider: job.name,
              message: "Unavailable or rate-limited",
            });
          }
        }
      }),
    );
    signal?.throwIfAborted();
    patents.sort(
      (a, b) =>
        compare(input.profile, b).score - compare(input.profile, a).score,
    );
    if (
      input.sources !== "local" &&
      process.env.ENABLE_GOOGLE_PATENT_PAGES === "true"
    ) {
      const enriched = await Promise.allSettled(
        patents.slice(0, 3).map((p) => pages.enrich(p)),
      );
      enriched.forEach((r, i) => {
        if (r.status === "fulfilled") patents[i] = r.value;
        else
          warnings.push(
            "Optional enrichment unavailable; original evidence retained.",
          );
      });
    }
    warnings.push(
      "OpenAIRE patents cover a literature-linked subset, not a complete worldwide database. Ranking is lexical, not a legal opinion.",
      "Provider quotas apply. Local cache/limiter protects one process unless shared storage is configured.",
    );
    const seedIds = new Set([
      ...input.seedPublications.map(
        (s) => patentSeed(s.publicationNumber).publicationNumber,
      ),
      ...(input.publicationNumber
        ? [patentSeed(input.publicationNumber).publicationNumber]
        : []),
    ]);
    const seedRecords = patents.filter((p) => seedIds.has(p.publicationNumber));
    const counts = new Map<string, number>();
    for (const p of seedRecords)
      for (const c of new Set([...(p.cpcCodes || []), ...(p.ipcCodes || [])]))
        counts.set(c, (counts.get(c) || 0) + 1);
    const seedSuggestions = {
      terms: [...new Set(seedRecords.flatMap((p) => tokens(p.title)))].slice(
        0,
        12,
      ),
      classifications: [...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([c]) => c)
        .slice(0, 12),
    };
    const result: Research = {
      seedSuggestions,
      profile: input.profile,
      mode: "PARTIAL",
      patents: patents.slice(0, 20),
      papers: diversePapers(papers, 30),
      queries: planned.queries,
      warnings,
    };
    send("ranking_updated", { result });
    send("completed", { result });
    console.info(
      JSON.stringify({
        event: "search_complete",
        searchId,
        patents: patents.length,
        families: familyGroups(patents).length,
      }),
    );
    return result;
  });
}
