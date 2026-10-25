"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, FileUp } from "lucide-react";
import { WorkspaceShell } from "./shell/workspace-shell";
import { sourceFileError, SOURCE_ACCEPT } from "@/lib/cad/source-files";
import type { ProjectSource } from "@/lib/project-source";
const Dashboard = dynamic(() => import("./research-workspace"), { ssr: false, loading: () => <p role="status" className="workspace-loading">Ouverture de votre projet…</p> });
export function ProjectEntry({ initialGoal }: { initialGoal: "patents" | "design" }) {
  const [goal, setGoal] = useState(initialGoal), [file, setFile] = useState<File | null>(null), [text, setText] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [source, setSource] = useState<ProjectSource | null>(null);
  function select(candidate?: File) {
    if (!candidate) return;
    const problem = /\.txt$/i.test(candidate.name) ? candidate.size > 4 * 1024 * 1024 || !candidate.size ? "Choisissez un texte non vide de moins de 4 Mo." : undefined : sourceFileError(candidate);
    if (problem) { setError(problem); return; } setFile(candidate); setError("");
  }
  async function start() {
    setBusy(true); setError("");
    try {
      let description = text.trim(), selected = file;
      if (selected && /\.txt$/i.test(selected.name)) { description = [description, await selected.text()].filter(Boolean).join("\n").slice(0, 60000); selected = null; }
      if (!selected && description.length < 30) throw new Error("Décrivez votre idée en quelques phrases, ou ajoutez un document.");
      if (goal === "patents" && selected && !/\.pdf$/i.test(selected.name) && selected.type !== "application/pdf") throw new Error("Pour les brevets, utilisez un PDF ou un texte. Choisissez la conception pour une image ou un fichier CAD.");
      setSource({ goal, file: selected, text: description });
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible d’ouvrir ce document."); } finally { setBusy(false); }
  }
  if (source) return <Dashboard initialPage={source.goal === "design" ? "Engineering Studio" : "New Analysis"} initialSource={source} />;
  return <WorkspaceShell page="Workspace"><main id="main-content" className="mx-auto w-full max-w-3xl px-5 py-10 md:py-16">
    <p className="product-kicker">VOTRE PROCHAIN PROJET</p>
    <h1 className="mt-4 text-3xl font-medium tracking-tight text-slate-950 md:text-5xl">Partez de ce que vous avez.</h1>
    <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">Une idée, un manuel ou un dessin. Vérifiez ce que nous en comprenons, puis explorez les technologies existantes ou construisez une pièce.</p>
    <section className="mt-9 rounded-3xl bg-white p-5 shadow-sm md:p-8" aria-label="Créer un projet">
      <label className="block font-medium text-slate-900" htmlFor="project-description">Que souhaitez-vous faire ?</label>
      <textarea id="project-description" value={text} onChange={e => setText(e.target.value)} maxLength={60000} rows={4} className="mt-3 w-full rounded-xl border border-slate-200 p-4 text-slate-900" placeholder="Ex. : je conçois un dispositif qui trie des échantillons grâce à une mesure optique…" />
      <div className="mt-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-5" onDragOver={e => { if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault(); }} onDrop={e => { if (!Array.from(e.dataTransfer.types).includes("Files")) return; e.preventDefault(); if (e.dataTransfer.files.length !== 1) { setError("Ajoutez un document à la fois."); return; } select(e.dataTransfer.files[0]); }}>
        <label className="flex cursor-pointer items-center gap-3 font-medium text-blue-950" htmlFor="project-source"><FileUp size={20} />{file ? file.name : "Ajouter un document, ou le déposer ici"}</label>
        <input id="project-source" aria-label="Document du projet" type="file" accept={SOURCE_ACCEPT + ",.txt"} className="mt-3 block w-full text-sm" onChange={e => select(e.target.files?.[0])} />
        <p className="mt-2 text-xs leading-5 text-slate-600">PDF ou texte pour les brevets. Images et STEP/STL également disponibles pour la conception. 4 Mo maximum.</p>
        {file && <button type="button" className="mt-2 text-sm text-blue-700 underline" onClick={() => setFile(null)}>Retirer ce document</button>}
      </div>
      <fieldset className="mt-7"><legend className="font-medium text-slate-900">Quel résultat souhaitez-vous obtenir ?</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{([
        ["patents", "Trouver les brevets proches", "Comparer les caractéristiques et consulter les preuves."],
        ["design", "Concevoir une pièce ou un assemblage", "Vérifier les mesures, modifier et exporter un modèle 3D."],
      ] as const).map(([value, title, description]) => <label key={value} className={"flex cursor-pointer gap-3 rounded-2xl border p-4 " + (goal === value ? "border-blue-500 bg-blue-50" : "border-slate-200")}><input type="radio" name="goal" value={value} checked={goal === value} onChange={() => { setGoal(value); setError(""); }} /><span><strong className="block text-sm text-slate-950">{title}</strong><span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span></span></label>)}</div></fieldset>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="button" disabled={busy || (!file && !text.trim())} onClick={start} className="mt-7 inline-flex items-center gap-3 rounded-full bg-blue-600 px-6 py-3 font-medium text-white disabled:opacity-40"><ArrowRight size={17} />{busy ? "Ouverture…" : "Continuer"}</button>
      <p className="mt-4 text-xs leading-5 text-slate-500">Aucun envoi à une IA à cette étape. L’analyse demandera votre autorisation. Sans sauvegarde explicite, ce brouillon reste temporaire dans cet onglet.</p>
    </section>
    <p className="mt-6 text-sm text-slate-600">Déjà commencé ? <Link prefetch={false} href="/#projects" className="font-medium text-blue-700 underline">Retrouver mes projets</Link></p>
  </main></WorkspaceShell>;
}
