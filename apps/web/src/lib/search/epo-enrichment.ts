import { lookup } from "../providers/epo-publication";
import { deduplicate } from "../normalize";
import type { PatentRecord } from "../providers/types";
import type { SourceRun } from "./audit";
import { sourceRun } from "./source-runs";
import { withRequestTrace } from "./request-trace";
import { withSearchSignal } from "./scope";

function publicationDate(value?: string) {
  if (!value || !/^(?:\d{8}|\d{4}-\d{2}-\d{2})$/.test(value)) return;
  const compact = value.replaceAll("-", "");
  const iso = compact.slice(0, 4) + "-" + compact.slice(4, 6) + "-" + compact.slice(6, 8);
  const parsed = new Date(iso + "T00:00:00Z");
  if (!Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === iso) return compact;
}

/** Keyless exact retrieval from dates already present in source metadata, never guessed. */
export async function enrichEpoCandidates(records: PatentRecord[], options: {
  signal?: AbortSignal;
  onRun?: (run: SourceRun, event: "provider_started" | "provider_finished" | "provider_failed") => void;
  onPatent?: (patent: PatentRecord) => void;
} = {}) {
  const candidates = records.flatMap((patent) => {
    const date = publicationDate(patent.publicationDate);
    return !patent.synthetic && /^EP\d+[AB]\d$/.test(patent.publicationNumber) && date && !patent.claims?.some((claim) => claim.trim())
      ? [{ patent, date }] : [];
  }).slice(0, 2);
  if (!candidates.length) return { patents: records, warnings: [] as string[] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("EPO enrichment budget exhausted")), 12000);
  const signal = AbortSignal.any([controller.signal, ...(options.signal ? [options.signal] : [])]);
  const warnings: string[] = [];
  try {
    const settled = await Promise.allSettled(candidates.map(async ({ patent, date }) => {
      const run: SourceRun = { ...sourceRun("EPO Publication Server · " + patent.publicationNumber, [patent.publicationNumber]),
        id: "epo-enrichment:" + patent.publicationNumber, queries: [patent.publicationNumber],
        category: "patent", method: "publication-lookup", status: "running", startedAt: new Date().toISOString(),
        coverage: "Keyless exact EP XML retrieval using the publication date already supplied by retrieved metadata. Claims only where exposed; not a worldwide keyword search." };
      options.onRun?.(run, "provider_started");
      const began = Date.now();
      let abort: () => void = () => {};
      try {
        signal.throwIfAborted();
        const cancelled = new Promise<never>((_, reject) => {
          abort = () => reject(signal.reason || new Error("EPO enrichment cancelled"));
          signal.addEventListener("abort", abort, { once: true });
        });
        const returned = await Promise.race([
          withRequestTrace(run.requests, () => withSearchSignal(signal, () => lookup(patent.publicationNumber, date))),
          cancelled,
        ]);
        const matching = returned.filter((record) => record.publicationNumber === patent.publicationNumber);
        run.status = matching.length ? "succeeded" : "empty";
        run.patentsRetrieved = matching.length;
        run.patentNumbers = matching.map((record) => record.publicationNumber);
        const merged = deduplicate([patent, ...matching])[0];
        if (matching.length) options.onPatent?.(merged);
        return matching;
      } catch {
        run.status = "failed";
        run.message = "Exact EP document enrichment unavailable or timed out; original evidence retained.";
        warnings.push(patent.publicationNumber + ": EPO claim enrichment unavailable; original metadata retained.");
        return [];
      } finally {
        signal.removeEventListener("abort", abort);
        run.completedAt = new Date().toISOString();
        run.elapsedMs = Date.now() - began;
        options.onRun?.(run, run.status === "failed" ? "provider_failed" : "provider_finished");
      }
    }));
    const returned = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    return { patents: deduplicate([...records, ...returned]), warnings };
  } finally { clearTimeout(timer); }
}
