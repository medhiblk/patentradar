"use client";
import { useState } from "react";
import { FileText, ArrowUpRight, Check, AlertTriangle } from "lucide-react";
import type { Research } from "@/lib/model";
import type { PatentRecord } from "@/lib/providers/types";
import type { SimilarityAlert } from "@/lib/intelligence/alerts";
import { SimilarityAlerts } from "../intelligence/similarity-alerts";
import { ResearchPortfolioSave } from "../intelligence/research-portfolio-save";
type Source = {
  patent: PatentRecord;
  sourceDocument: {
    url: string;
    name: string;
    sha256: string;
    originalPageCount: number;
    excerptPageCount: number;
    selectedOriginalPages: number[];
  };
  limitation: string;
};
const initialDesign =
  "A proposed microfluidic substrate has an inlet channel carrying a dispersed phase fluid into a main channel with a continuous phase fluid. A flow focusing nozzle forms uniform monodisperse droplets in the main channel. A coalescence module uses electrodes to generate an electric field. A detection module evaluates droplet contents using an optical detector.";
export function PatentAwarenessCase() {
  const [source, setSource] = useState<Source | null>(null),
    [description, setDescription] = useState(initialDesign),
    [research, setResearch] = useState<Research | null>(null),
    [alerts, setAlerts] = useState<SimilarityAlert[]>([]),
    [saved, setSaved] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function run(label: string, operation: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to complete this step.",
      );
    } finally {
      setBusy("");
    }
  }
  async function ingest() {
    const response = await fetch("/api/demo/patent-case");
    if (!response.ok) throw Error("Source snapshot unavailable.");
    const data: Source = await response.json();
    const pdf = await fetch(data.sourceDocument.url);
    if (!pdf.ok) throw Error("Source PDF excerpt unavailable.");
    const bytes = await pdf.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== data.sourceDocument.sha256)
      throw Error("The excerpt checksum did not match the verified source.");
    setSource(data);
  }
  async function compare() {
    const response = await fetch("/api/demo/patent-case", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Comparison unavailable.");
    setResearch(data.research);
    setAlerts(data.alerts);
    setSaved("");
  }
  return (
    <div className="patent-case">
      <div className="case-context">
        <FileText size={19} />
        <div>
          <strong>
            Real publication · Illustrative design · Preselected reference
          </strong>
          <p>
            This exercise compares an editable example concept against a known
            publication. It is not a fresh worldwide search or a claim of a new
            discovery.
          </p>
        </div>
      </div>
      <section className="panel case-step">
        <span className="product-kicker">01 / INGEST THE SOURCE</span>
        <h2>Start with a real publication.</h2>
        <p>
          <strong>US20080003142A1 — Microfluidic devices</strong>, published 3
          January 2008.
        </p>
        <p>
          The original has 83 pages and is 8.5 MB. This exercise imports a
          4-page excerpt containing a provenance cover and original pages 1, 2
          and 81, within the application’s upload limit.
        </p>
        <div className="row wrap">
          <button
            className="btn btn-primary"
            disabled={!!busy || !!source}
            onClick={() => run("Checking source PDF and checksum", ingest)}
          >
            {source ? (
              <>
                <Check size={15} />
                Source ingested
              </>
            ) : (
              "Ingest the real patent excerpt"
            )}
          </button>
          <a
            href="https://patents.google.com/patent/US20080003142A1/en"
            target="_blank"
            rel="noreferrer"
          >
            View original on Google Patents <ArrowUpRight size={14} />
          </a>
        </div>
        {source && (
          <p role="status">
            Verified excerpt loaded · SHA-256 checked · source retrieved{" "}
            {new Date(source.patent.retrievedAt).toLocaleDateString()}.{" "}
            <a href={source.sourceDocument.url} download>
              Download the excerpt ↗
            </a>
          </p>
        )}
      </section>
      {source && (
        <section className="panel case-step">
          <span className="product-kicker">
            02 / REVIEW THE PROPOSED DESIGN
          </span>
          <h2>What do you want to build?</h2>
          <p>
            The initial description is an illustrative concept chosen to
            resemble this reference. Edit it and the comparison will use your
            actual text.
          </p>
          <label>
            Example invention description
            <textarea
              value={description}
              maxLength={12000}
              rows={6}
              onChange={(e) => {
                setDescription(e.target.value);
                setResearch(null);
                setAlerts([]);
                setSaved("");
              }}
            />
          </label>
          <button
            className="btn btn-primary"
            disabled={!!busy || description.trim().length < 30}
            onClick={() =>
              run("Comparing features with verified claim excerpts", compare)
            }
          >
            Compare this design with the publication
          </button>
        </section>
      )}
      {research && source && (
        <section className="case-step">
          <span className="product-kicker">
            03 / KEEP THE EVIDENCE WITH YOUR DESIGN
          </span>
          <h2>Save the source and the comparison.</h2>
          <p>
            {research.profile.technicalFeatures.length} technical passages
            extracted from your text. Comparison uses excerpts of claims 1, 5, 9
            and 10 from original PDF page 81.
          </p>
          <ResearchPortfolioSave
            key={description}
            research={research}
            description={description}
            document={source.sourceDocument}
            onSaved={setSaved}
          />
          {!saved && (
            <details className="case-preview">
              <summary>Preview the similarity signal before saving</summary>
              <SimilarityAlerts alerts={alerts} />
            </details>
          )}
        </section>
      )}
      {saved && (
        <section
          className="case-final"
          aria-label="Saved patent similarity result"
        >
          <div className="case-final-title">
            <AlertTriangle size={23} />
            <h2>
              {alerts.length
                ? "A similar publication already exists."
                : "Review the available evidence."}
            </h2>
          </div>
          <p>
            Your project, source excerpt and comparison are now in your private
            portfolio.{" "}
            {alerts.length
              ? "The similarity alert is linked to that project."
              : "This description did not meet the lexical alert threshold; this does not establish clearance."}
          </p>
          <SimilarityAlerts alerts={alerts} />
          <a className="btn btn-primary" href="/alerts">
            Open my saved alerts ↗
          </a>
        </section>
      )}
      {busy && (
        <p role="status" className="notice">
          {busy}…
        </p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <p className="case-legal-note">
        Google Patents reports “Abandoned” for this application. That is
        publisher-reported, not independently verified. This example
        demonstrates technical similarity and prior publication; it does not
        establish active rights, infringement or permission to manufacture.
      </p>
    </div>
  );
}
