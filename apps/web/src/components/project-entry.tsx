"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, FileUp } from "lucide-react";
import { WorkspaceShell } from "./shell/workspace-shell";
import { sourceFileError, SOURCE_ACCEPT } from "@/lib/cad/source-files";
import type { ProjectSource } from "@/lib/project-source";
const Dashboard = dynamic(() => import("./research-workspace"), { ssr: false, loading: () => <p role="status" className="workspace-loading">Opening your project…</p> });
export function ProjectEntry({ initialGoal }: { initialGoal: "patents" | "design" }) {
  const [goal, setGoal] = useState(initialGoal), [file, setFile] = useState<File | null>(null), [text, setText] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [source, setSource] = useState<ProjectSource | null>(null);
  function select(candidate?: File) {
    if (!candidate) return;
    const problem = /\.txt$/i.test(candidate.name) ? candidate.size > 4 * 1024 * 1024 || !candidate.size ? "Choose a non-empty text file smaller than 4 MB." : undefined : sourceFileError(candidate);
    if (problem) { setError(problem); return; } setFile(candidate); setError("");
  }
  async function start() {
    setBusy(true); setError("");
    try {
      let description = text.trim(), selected = file;
      if (selected && /\.txt$/i.test(selected.name)) { description = [description, await selected.text()].filter(Boolean).join("\n").slice(0, 60000); selected = null; }
      if (!selected && description.length < 30) throw new Error("Describe your idea in a few sentences, or add a document.");
      if (goal === "patents" && selected && !/\.pdf$/i.test(selected.name) && selected.type !== "application/pdf") throw new Error("For patent research, use a PDF or text. Choose design for an image or CAD file.");
      setSource({ goal, file: selected, text: description });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to open this document."); } finally { setBusy(false); }
  }
  if (source) return <Dashboard initialPage={source.goal === "design" ? "Engineering Studio" : "New Analysis"} initialSource={source} />;
  return <WorkspaceShell page="Workspace"><main id="main-content" className="mx-auto w-full max-w-3xl px-5 py-10 md:py-16">
    <p className="product-kicker">YOUR NEXT PROJECT</p>
    <h1 className="mt-4 text-3xl font-medium tracking-tight text-slate-950 md:text-5xl">Start with what you have.</h1>
    <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">An idea, a manual or a drawing. Review the interpretation, then investigate existing technologies or build a part.</p>
    <section className="mt-9 rounded-3xl bg-white p-5 shadow-sm md:p-8" aria-label="Create a project">
      <label className="block font-medium text-slate-900" htmlFor="project-description">What would you like to do?</label>
      <textarea id="project-description" value={text} onChange={e => setText(e.target.value)} maxLength={60000} rows={4} className="mt-3 w-full rounded-xl border border-slate-200 p-4 text-slate-900" placeholder="For example: I am designing a device that sorts samples using optical measurements…" />
      <div className="mt-4 min-w-0 rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-5 focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-blue-600" onDragOver={e => { if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault(); }} onDrop={e => { if (!Array.from(e.dataTransfer.types).includes("Files")) return; e.preventDefault(); if (e.dataTransfer.files.length !== 1) { setError("Add one document at a time."); return; } select(e.dataTransfer.files[0]); }}>
        <input id="project-source" aria-label="Project document" aria-describedby="project-source-help" type="file" accept={SOURCE_ACCEPT + ",.txt"} className="english-file-native" onChange={e => select(e.target.files?.[0])} />
        <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-blue-200 bg-white px-4 py-3 font-medium text-blue-950" htmlFor="project-source"><FileUp size={20} aria-hidden="true" />Choose document</label>
        <p className="mt-2 break-all text-sm text-slate-700" aria-live="polite">{file ? file.name : "No document selected. You can also drop a file here."}</p>
        <p id="project-source-help" className="mt-2 text-xs leading-5 text-slate-600">PDF or text for patent research. Images, STEP/STL and JSON are also supported for design. Maximum 4 MB.</p>
        {file && <button type="button" className="mt-2 text-sm text-blue-700 underline" onClick={() => setFile(null)}>Remove this document</button>}
      </div>
      <fieldset className="mt-7"><legend className="font-medium text-slate-900">What would you like to achieve?</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{([
        ["patents", "Find related patents", "Compare technical features and inspect the evidence."],
        ["design", "Design a part or assembly", "Review measurements, edit and export a 3D model."],
      ] as const).map(([value, title, description]) => <label key={value} className={"flex cursor-pointer gap-3 rounded-2xl border p-4 " + (goal === value ? "border-blue-500 bg-blue-50" : "border-slate-200")}><input type="radio" name="goal" value={value} checked={goal === value} onChange={() => { setGoal(value); setError(""); }} /><span><strong className="block text-sm text-slate-950">{title}</strong><span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span></span></label>)}</div></fieldset>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="button" disabled={busy || (!file && !text.trim())} onClick={start} className="mt-7 inline-flex items-center gap-3 rounded-full bg-blue-600 px-6 py-3 font-medium text-white disabled:opacity-40"><ArrowRight size={17} />{busy ? "Opening…" : "Continue"}</button>
      <p className="mt-4 text-xs leading-5 text-slate-500">Nothing is sent to an AI at this step. Analysis will request your approval. Unless you save it, this draft remains temporary in this tab.</p>
    </section>
    <p className="mt-6 text-sm text-slate-600">Already started? <Link prefetch={false} href="/#projects" className="font-medium text-blue-700 underline">Open my projects</Link></p>
  </main></WorkspaceShell>;
}
