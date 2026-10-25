"use client";
import { useState } from "react";
import type { Profile } from "@/lib/model";
import type { PatentRecord } from "@/lib/providers/types";
import { Button } from "./ui/button";
import { z } from "zod";
import { validatePatentRanking, type PatentRankingEntry } from "@/lib/search/ranking";
export function AIEvidence({
  profile,
  patents,
  rankingCandidates = patents,
  onRerank,
}: {
  profile: Profile;
  patents: PatentRecord[];
  rankingCandidates?: PatentRecord[];
  onRerank?: (ranking: PatentRankingEntry[]) => void;
}) {
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [output, setOutput] = useState<{
    matches?: {
      feature: number;
      claim: number;
      quote: string;
      explanation: string;
      sourceUrl: string;
    }[];
    ranking?: { publicationNumber: string; reason: string }[];
    translation?: string;
    machineTranslation?: boolean;
  } | null>(null);
  async function run(operation: string) {
    setBusy(true);
    setError("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
      const selected = (operation === "rerank" ? rankingCandidates : patents).slice(0, 20);
      const r = await fetch("/api/intelligence/ai", {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          consent,
          profile,
          patents: selected,
          text: patents[0]?.claims?.[0] || patents[0]?.abstract || "",
          language: "French",
        }),
      });
      let d;
      try { d = JSON.parse(await r.text()); }
      catch { throw new Error(`AI service returned an unreadable response (HTTP ${r.status}). Your evidence is retained.`); }
      if (!r.ok) throw new Error(typeof d?.error === "string" ? d.error : `AI analysis unavailable (HTTP ${r.status}).`);
      if (operation === "rerank") {
        const ranked = z.object({ ranking: z.array(z.object({ publicationNumber: z.string(), reason: z.string().min(1).max(500) })).max(20) }).parse(d);
        validatePatentRanking(selected, ranked.ranking);
        onRerank?.(ranked.ranking);
        d = ranked;
      }
      setOutput(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI unavailable");
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h3>Evidence-assisted AI review</h3>
      <p>
        AI receives the reviewed technical features and selected public
        passages. Requires a signed-in account and configured OpenAI access.
      </p>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        Share these features and evidence with OpenAI.
      </label>
      <div className="row wrap">
        <Button
          disabled={!consent || busy || !rankingCandidates.length || rankingCandidates.length > 20}
          onClick={() => run("rerank")}
        >
          Rank selected patents
        </Button>
        <Button
          disabled={!consent || busy || !patents[0]?.claims?.length}
          onClick={() => run("compare")}
        >
          Compare retrieved claims
        </Button>
        <Button
          disabled={!consent || busy || !patents.length}
          onClick={() => run("translate")}
        >
          Translate first passage to French
        </Button>
      </div>
      {busy && <p role="status">Analyzing bounded evidence…</p>}
      {error && <p role="alert">{error}</p>}
      {output?.matches?.map((m, k) => (
        <article key={k}>
          <h4>{profile.technicalFeatures[m.feature]?.name}</h4>
          <blockquote>
            <mark>{m.quote}</mark>
          </blockquote>
          <p>{m.explanation}</p>
          <a href={m.sourceUrl} target="_blank" rel="noreferrer">
            Original claim evidence ↗
          </a>
        </article>
      ))}
      {output?.ranking?.map((m, k) => (
        <p key={m.publicationNumber}>
          {k + 1}. {m.publicationNumber} — {m.reason}
        </p>
      ))}
      {output?.translation && (
        <article>
          <small>Machine translation — retain original for review</small>
          <blockquote>{output.translation}</blockquote>
          <p>Original: {patents[0]?.claims?.[0] || patents[0]?.abstract}</p>
        </article>
      )}
    </section>
  );
}
