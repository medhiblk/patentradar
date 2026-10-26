"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNavigation } from "./app-navigation";
import { makeSpotDesignPages } from "@/lib/cad/spot-design";
import { readJsonLines } from "@/lib/search/read-stream";
import type { SpotExpansionEvent } from "@/lib/search/spot-expand";
import type { SourceRun } from "@/lib/search/audit";
import type { PatentRecord } from "@/lib/providers/types";
import type { SpotResult } from "@/lib/search/spot";
import { safeJsonResponse } from "@/lib/safe-json-response";
import "./spot.css";
type Result = SpotResult & { document: { sha256: string; pageCount: number; analyzedPages: number[]; truncated: boolean; inputKind: "pdf" | "description" } };
export function SpotWorkspace({ fromDesign = false }: { fromDesign?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"document" | "design">(fromDesign ? "design" : "document");
  const [file, setFile] = useState<File | null>(null), [text, setText] = useState("");
  const [consent, setConsent] = useState(true), [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState(""), [error, setError] = useState(""), [result, setResult] = useState<Result | null>(null);
  const [query, setQuery] = useState("");
  const [shareQuery, setShareQuery] = useState(false), [expanding, setExpanding] = useState(false);
  const [sources, setSources] = useState<SourceRun[]>([]);
  const [candidates, setCandidates] = useState<PatentRecord[]>([]);
  function clearEvidence() {
    setResult(null); setSources([]); setCandidates([]); setQuery(""); setShareQuery(false);
  }
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const frame = requestAnimationFrame(() => {
      if (fromDesign) {
        const draft = makeSpotDesignPages();
        if (draft) { setText(draft.designText); setNotice("Current component functions loaded. Review them before checking; dimensions alone do not establish patent similarity."); }
        else setNotice("Your design is no longer available in this tab. Paste its functions or reopen your saved assembly.");
      }

    });
    return () => { cancelAnimationFrame(frame); controller.abort(); request.current?.abort(); };
  }, [fromDesign]);
  function choose(candidate?: File) {
    if (!candidate) return;
    if (!candidate.size || candidate.size > 4 * 1024 * 1024 || (!/\.pdf$/i.test(candidate.name) && candidate.type !== "application/pdf")) {
      setError("Choose a non-empty PDF smaller than 4 MB."); return;
    }
    setFile(candidate); clearEvidence(); setError(""); setNotice("");
  }
  async function analyse() {
    setBusy(true); setError(""); clearEvidence();
    const controller = new AbortController(); request.current = controller;
    const deadline = setTimeout(() => controller.abort(), 60000);
    try {
      const form = new FormData();
      if (mode === "document" && file) form.set("file", file);
      else form.set("text", text);
      form.set("consent", String(consent));
      const response = await fetch("/api/spot", { method: "POST", body: form, signal: controller.signal });
      const data = await safeJsonResponse(response);
      setResult(data as Result); setQuery((data as Result).profile.searchKeywords.slice(0, 3).join(" ").slice(0, 150)); setNotice("");
    } catch (e) {
      setError(controller.signal.aborted ? "Check stopped or timed out. Your input is retained; retry or use a shorter excerpt." : e instanceof Error ? e.message : "The check could not complete. Your input is retained.");
    } finally { clearTimeout(deadline); setBusy(false); }
  }
  async function expandSearch() {
    if (!result || !shareQuery || query.trim().length < 3) return;
    setBusy(true); setExpanding(true); setError(""); setSources([]); setCandidates([]);
    const controller = new AbortController(); request.current = controller;
    const deadline = setTimeout(() => controller.abort(), 60000);
    let completed = false;
    try {
      const form = new FormData();
      if (mode === "document" && file) form.set("file", file);
      else form.set("text", text);
      form.set("query", query.trim()); form.set("searchConsent", "true"); form.set("consent", String(consent));
      const response = await fetch("/api/spot/expand", { method: "POST", body: form, signal: controller.signal });
      if (!response.ok) await safeJsonResponse(response);
      if (!response.body) throw Error("No search stream was returned. Your original evidence remains available.");
      await readJsonLines<SpotExpansionEvent & { result?: Result }>(response.body, event => {
        if (event.type === "initial" || event.type === "complete") {
          setResult(event.result as Result);
          if (event.type === "complete") completed = true;
        } else if (event.type === "source") {
          setSources(previous => [...previous.filter(source => source.id !== event.source.id), event.source]);
        } else if (event.type === "candidate") {
          setCandidates(previous => [...previous.filter(patent => patent.publicationNumber !== event.patent.publicationNumber), event.patent]);
        } else if (event.type === "error") throw Error(event.message);
      });
      if (!completed) throw Error("The extended search ended early. Original evidence and retrieved records were retained.");
    } catch (e) {
      setSources(previous => previous.map(source => source.status === "running" ? { ...source, status: "failed", message: "Search interrupted before this source finished." } : source));
      setError(controller.signal.aborted ? "Extended search stopped. Your original evidence and retrieved candidates remain visible." : e instanceof Error ? e.message : "Extended search unavailable. Your original evidence is retained.");
    } finally { clearTimeout(deadline); controller.abort(); setBusy(false); setExpanding(false); }
  }
  async function exportReport() {
    if (!result) return;
    setExporting(true); setError("");
    try {
      const response = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        profile: result.profile, mode: "PARTIAL", patents: result.matches.map(match => match.patent), papers: [],
        queries: result.liveSearch ? [result.liveSearch.query] : ["Local public reference index comparison of supplied document passages"],
        searchTrace: result.liveSearch?.trace,
        warnings: [...result.coverage.limitations, ...result.warnings, `Reference index: ${result.coverage.indexedPatentCount} public publications. Same-publication recognition is distinct from technical overlap.`],
      }) });
      if (!response.ok) await safeJsonResponse(response);
      const blob = await response.blob();
      if (!blob.type.includes("pdf")) throw Error("The report service returned an unexpected response.");
      const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = "formaproof-patent-evidence.pdf"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Report export unavailable; your evidence remains visible."); }
    finally { setExporting(false); }
  }
  return <div className="spot-app"><AppNavigation /><main id="main-content" className="spot-main">
    <header className="spot-intro"><p className="spot-eyebrow">FORMAPROOF / PATENT CHECK</p><h1>Spot it.<br /><span>Before you build it.</span></h1><p>Upload a document or describe a device. Find a known patent publication or inspect technical overlap with sourced records.</p><p className="spot-context">A design review before months of engineering work — preliminary evidence to investigate, not a legal clearance.</p></header>
    <section className="spot-input" aria-label="Patent document check">
      <div className="spot-modes" role="group" aria-label="Input type"><button type="button" aria-pressed={mode === "document"} disabled={busy} onClick={() => { setMode("document"); clearEvidence(); }}>Upload a document</button><button type="button" aria-pressed={mode === "design"} disabled={busy} onClick={() => { setMode("design"); clearEvidence(); }}>Describe a design</button></div>
      {mode === "document" ? <div className="spot-upload" onDragOver={e => { if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault(); }} onDrop={e => { if (!Array.from(e.dataTransfer.types).includes("Files")) return; e.preventDefault(); if (!busy && e.dataTransfer.files.length === 1) choose(e.dataTransfer.files[0]); }}><label htmlFor="spot-file">Your technical document</label><div className="spot-file-choice"><input id="spot-file" className="spot-file-native" aria-label="Technical document" type="file" accept=".pdf,application/pdf" disabled={busy} onChange={e => choose(e.target.files?.[0])} /><label className="spot-file-pick" htmlFor="spot-file">Choose PDF</label><span className="spot-file-name">{file ? file.name : "No PDF selected"}</span></div><p>{file ? "Ready to check. Press SPOT IT below." : "Drop a PDF with selectable text here. The check uses the contents, not the filename."}</p><small>4 MB · up to 80 pages; first 20 text pages analysed.</small></div> : <label className="spot-description">What does your device do?<textarea aria-label="Describe your design" value={text} maxLength={60000} disabled={busy} onChange={e => { setText(e.target.value); clearEvidence(); }} rows={6} placeholder="Describe the device, its components, operating functions and how they connect. Dimensions alone are not enough." /></label>}
      <section className="spot-options" aria-label="External verification and privacy"><label><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} />Verify detected publication numbers with EPO</label><p>When you run the check, only eligible EP publication numbers and dates are sent to EPO. Your PDF and full description are not sent to an external AI or patent service. Untick to use only the indexed public records.</p></section>
      <div className="spot-actions"><button type="button" className="spot-submit" disabled={busy || (mode === "document" ? !file : text.trim().length < 30)} onClick={analyse}>{busy ? expanding ? "Searching approved sources…" : "Reading and matching evidence…" : "SPOT IT"}</button>{busy && <button type="button" onClick={() => request.current?.abort()}>Stop</button>}<Link href="/files">My private projects ↗</Link></div>
      {notice && <p role="status" className="spot-notice">{notice}</p>}{error && <p role="alert" className="spot-error">{error}</p>}
    </section>
    {result && <section className="spot-results" aria-live="polite">
      {result.identity.primary ? <article className="spot-detected"><p className="spot-eyebrow">PUBLICATION IDENTIFIED IN YOUR DOCUMENT</p><h2>{result.identity.primary.publicationNumber}</h2><p>{result.identity.primary.title || "The publication identifier was read from the document itself."}</p><p>Identifier recognition is separate from independent technical similarity. {result.identity.limitation}</p>
        {result.identity.primary.evidence.slice(0, 2).map((item, i) => <blockquote key={i}>Page {item.page}: {item.quote}</blockquote>)}
        <a href={"https://patents.google.com/patent/" + encodeURIComponent(result.identity.primary.publicationNumber) + "/en"} target="_blank" rel="noreferrer">Open publication reference on Google Patents ↗</a>
        <p className="spot-limitation">This reference link is generated from the identifier. Only the independently sourced records below count as retrieved matches.</p></article> : <div className="spot-notice">No verified front-page publication identifier was required. The matches below come from document text and technical evidence.</div>}
      <details className="spot-options"><summary>Technical passages used in this check</summary>{result.profile.technicalFeatures.slice(0, 6).map((feature, i) => <blockquote key={i}>{feature.description}</blockquote>)}</details>
      <section className="spot-expansion" aria-label="Extended patent search">
        <p className="spot-eyebrow">GO BEYOND THE REFERENCE INDEX</p>
        <h2>Search more sources with a focused query</h2>
        <p>Review a short, non-confidential search phrase. Start with two or three technical terms. Only this phrase and eligible publication identifiers go to search providers; your document stays on this server.</p>
        <label htmlFor="spot-query">Search concepts to share</label>
        <input id="spot-query" value={query} maxLength={150} disabled={busy} onChange={e => { setQuery(e.target.value); setShareQuery(false); }} placeholder="For example: implantable stent radial expansion" />
        <label className="spot-search-consent"><input type="checkbox" checked={shareQuery} disabled={busy} onChange={e => setShareQuery(e.target.checked)} />I approve sharing this short query with the available public search providers.</label>
        <div className="spot-actions"><button type="button" className="spot-submit" disabled={busy || !shareQuery || query.trim().length < 3} onClick={expandSearch}>{expanding ? "Searching sources…" : "Search additional sources"}</button></div>
        <p className="spot-limitation">Coverage depends on configured providers. Scientific articles are separate from patents. A returned record is not automatically a similar patent.</p>
        {sources.length > 0 && <div className="spot-live-sources" role="status" aria-live="polite"><h3>Sources checked in this search</h3>{sources.map(source => <details key={source.id}><summary>{source.name} · {source.status} · {source.patentsRetrieved} patents · {source.papersRetrieved} papers</summary><p>{source.coverage}</p>{source.message && <p>{source.message}</p>}{source.requests.map((request, i) => <p key={i}><a href={request.endpoint} target="_blank" rel="noreferrer">Inspect query endpoint ↗</a> · HTTP {request.httpStatus ?? "not received"} · {request.servedFrom}</p>)}</details>)}<p>{candidates.length} distinct patent records received. {expanding ? "Evidence comparison follows as the search completes." : "Supported technical matches are shown below."}</p></div>}
        {result.liveSearch && <p className="spot-notice">Searched “{result.liveSearch.query}”: {result.liveSearch.patentsRetrieved} distinct patents and {result.liveSearch.papersRetrieved ?? "an unfinished count of"} scientific papers retrieved. Only evidence-supported overlaps appear in the comparison.</p>}
      </section>
      <div className="spot-result-heading"><h2>{result.matches.length ? "Evidence to investigate" : "No supported match in this search"}</h2><p>{result.matches.length ? "Start with the passages below. Each source is inspectable." : "This does not establish novelty or permission to manufacture. Try a more specific technical passage or broaden the source coverage."}</p></div>
      {result.matches.map((match, index) => <article className="spot-match" key={match.patent.publicationNumber}><div className="spot-match-top"><span className={match.matchType === "same-publication" ? "spot-badge spot-badge-red" : "spot-badge"}>{match.matchType === "same-publication" ? "Same publication / source-text match" : "Technical overlap to review"}</span><span>#{index + 1}</span></div><h3>{match.patent.title}</h3><p className="spot-publication">{match.patent.publicationNumber}{match.patent.applicants.length ? " · " + match.patent.applicants.join(", ") : ""}</p><p>{match.explanation}</p>
        {match.evidence.slice(0, 3).map((evidence, key) => <div className="spot-evidence" key={key}><div><small>{result.document.inputKind === "pdf" ? `Your document · page ${evidence.inputPage}` : "Your supplied description"}</small><blockquote>{evidence.inputExcerpt}</blockquote></div><div><small>{evidence.evidenceField === "claim" ? `Patent claim ${(evidence.claimIndex ?? 0) + 1}` : evidence.evidenceField === "publication-number" ? "Publication identifier evidence" : `Patent ${evidence.evidenceField}`}</small><blockquote>{evidence.sourceExcerpt}</blockquote><a href={evidence.sourceUrl} target="_blank" rel="noreferrer">Inspect original source ↗</a></div></div>)}
        <div className="spot-source"><a href={match.patent.sourceUrl} target="_blank" rel="noreferrer">{match.patent.source} ↗</a>{match.patent.pdfUrl && <a href={match.patent.pdfUrl} target="_blank" rel="noreferrer">Publication PDF ↗</a>}<span>Retrieved {match.patent.retrievedAt}</span></div>
        <p className="spot-limitation">{match.limitations.join(" ")} Legal status and enforceability have not been established. Do not treat this signal as infringement or clearance.</p>
      </article>)}
      {candidates.some(patent => !result.matches.some(match => match.patent.publicationNumber === patent.publicationNumber)) && <details className="spot-other-candidates"><summary>Other retrieved patent records — overlap not established</summary>{candidates.filter(patent => !result.matches.some(match => match.patent.publicationNumber === patent.publicationNumber)).map(patent => <article key={patent.publicationNumber}><h3>{patent.title}</h3><p>{patent.publicationNumber} · {patent.source}</p><a href={patent.sourceUrl} target="_blank" rel="noreferrer">Inspect source record ↗</a>{" · "}<a href={"https://patents.google.com/patent/" + encodeURIComponent(patent.publicationNumber) + "/en"} target="_blank" rel="noreferrer">Google Patents reference ↗</a><p className="spot-limitation">No sufficient passage overlap was established. This is a retrieval candidate, not a confirmed competitor or technical match.</p></article>)}</details>}
      <section className="spot-coverage" aria-label="Search coverage"><h3>Where we looked</h3><p><strong>{result.coverage.indexedPatentCount} indexed public patent publications</strong> · {result.coverage.mode === "reference-index-and-live-search" ? "plus an approved live search" : result.coverage.mode === "reference-index-and-live-lookup" ? "plus requested live publication verification" : "reference index comparison"}</p><ul>{result.coverage.queriedSources.map(source => <li key={source}>{source}</li>)}</ul><p>{result.coverage.limitations.join(" ")}</p><p>Pages analysed: {result.document.analyzedPages.join(", ")} of {result.document.pageCount}.{result.document.truncated ? " Partial document coverage." : ""}</p>{result.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</section>
      <div className="spot-actions"><button type="button" disabled={exporting || !result.matches.length} onClick={exportReport}>{exporting ? "Preparing report…" : "Download evidence PDF"}</button>{fromDesign && <button type="button" onClick={() => router.push("/engineering")}>Return to my design</button>}<button type="button" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "formaproof-evidence.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Export evidence JSON</button><Link href="/workspace?goal=design">Open 3D design tools ↗</Link></div>
    </section>}
  </main></div>;
}
