"use client";
import {
  ArrowUpRight,
  ArrowRight,
  FileText,
  Box,
  ScanLine,
  FolderOpen,
} from "lucide-react";
export function Home({
  go,
  demo,
  busy,
}: {
  go: (page: string) => void;
  demo: () => void;
  busy: boolean;
}) {
  return (
    <>
      <section className="product-hero">
        <div className="hero-story">
          <span className="product-kicker">
            <span className="live-dot" />
            FROM DOCUMENT TO DESIGN
          </span>
          <h1>
            Your next prototype
            <br />
            starts with <em>a page.</em>
          </h1>
          <p>
            Turn a manual, drawing or technical brief into editable parts. Build
            your assembly, explore alternatives, then investigate the patent
            evidence behind your design.
          </p>
          <div className="hero-actions">
            <button
              className="btn btn-primary"
              onClick={() => go("Engineering Studio")}
            >
              Start with a document <ArrowUpRight size={16} />
            </button>
            <button
              className="hero-secondary"
              onClick={() => go("New Analysis")}
            >
              Analyze an invention <ArrowRight size={15} />
            </button>
          </div>
          <span className="hero-note">
            No account needed to model. Save privately when you’re ready.
          </span>
        </div>
        <div
          className="design-scene"
          role="img"
          aria-label="Illustration of a technical drawing becoming an editable mechanical assembly; not a generated model"
        >
          <div className="scene-topline">
            <span>THE DESIGN WORKSPACE</span>
            <span>DOCUMENT → ASSEMBLY</span>
          </div>
          <div className="scene-document">
            <FileText size={19} strokeWidth={1.3} />
            <span>Technical specification</span>
            <div />
            <div />
            <div />
            <svg viewBox="0 0 120 85" aria-hidden="true">
              <path d="M20 50 60 28 104 48 64 72Z M20 50v-10l40-22 44 20v10 M64 72V62 M60 18v10" />
              <ellipse cx="62" cy="43" rx="14" ry="8" />
              <path d="M13 66 58 90 M111 57 70 82" strokeDasharray="2 3" />
            </svg>
            <small>SOURCE DIMENSIONS</small>
          </div>
          <div className="scene-assembly">
            <div className="assembly-layer layer-top" />
            <div className="assembly-pin pin-one" />
            <div className="assembly-pin pin-two" />
            <div className="assembly-layer layer-middle" />
            <div className="assembly-layer layer-base" />
          </div>
          <div className="scene-tag tag-one">
            <span />
            Editable components
          </div>
          <div className="scene-tag tag-two">
            <span />
            Measurements first
          </div>
          <div className="scene-caption">
            <span>01 / UNDERSTAND THE SYSTEM</span>
            <small>
              Concept illustration · Geometry requires source measurements
            </small>
          </div>
        </div>
      </section>
      <section className="journey-section" aria-label="How it works">
        <div className="journey-heading">
          <span className="product-kicker">ONE CONTINUOUS WORKFLOW</span>
          <h2>
            Bring the document.
            <br />
            Keep moving the design forward.
          </h2>
          <p>
            Each step builds on your work. You decide what to model and what to
            share.
          </p>
        </div>
        <div className="journey-steps">
          {[
            [
              "01",
              "Bring your source",
              "Upload a PDF, drawing or manual. Tell us which system or part you want to represent.",
            ],
            [
              "02",
              "Review the interpretation",
              "Check identified components and dimensions. Fill in missing measurements.",
            ],
            [
              "03",
              "Build & adjust in 3D",
              "Edit parts, assemble components and export STEP or STL for your next tool.",
            ],
            [
              "04",
              "Investigate the evidence",
              "Search related inventions, inspect source passages and return to refine your design.",
            ],
          ].map(([n, title, text]) => (
            <article key={n}>
              <span className="step-index">{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="workspace-shortcuts" aria-label="Choose a workspace">
        <button onClick={() => go("Engineering Studio")}>
          <Box size={21} strokeWidth={1.4} />
          <h3>Build a physical prototype</h3>
          <p>
            Parts, purchased components and custom housings in one assembly.
          </p>
          <span>
            Open 3D Studio <ArrowUpRight size={15} />
          </span>
        </button>
        <button onClick={() => go("New Analysis")}>
          <ScanLine size={21} strokeWidth={1.4} />
          <h3>Research an invention</h3>
          <p>
            Start with any idea: mechanical, digital, biological or a new
            process.
          </p>
          <span>
            Open patent research <ArrowUpRight size={15} />
          </span>
        </button>
        <a href="/files">
          <FolderOpen size={21} strokeWidth={1.4} />
          <h3>Pick up where you left off</h3>
          <p>
            Keep documents in private projects. Reopen them for design or
            research.
          </p>
          <span>
            Open private files <ArrowUpRight size={15} />
          </span>
        </a>
      </section>
      <footer className="product-footer">
        <span>Built around your engineering workflow.</span>
        <div>
          <button disabled={busy} onClick={demo}>
            Research a real patent
          </button>
          <button onClick={() => go("Physical Analysis")}>
            Physical inventions
          </button>
          <button onClick={() => go("API Providers")}>Data sources</button>
          <a
            href="https://github.com/medhiblk/patentradar"
            target="_blank"
            rel="noreferrer"
          >
            Open on GitHub ↗
          </a>
        </div>
        <p>
          Model only what the source supports. Patent research is preliminary
          technical intelligence, not legal clearance.
        </p>
      </footer>
    </>
  );
}
