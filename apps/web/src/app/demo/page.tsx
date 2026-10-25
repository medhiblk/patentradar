"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowRight, FileText } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { ProductTour } from "@/components/demo/product-tour";
import "./demo.css";
import { Button } from "@/components/ui/button";
import { loadExampleDocument } from "@/lib/demo/example-document";
import { sourceFileError, SOURCE_ACCEPT } from "@/lib/cad/source-files";
const Studio = dynamic(
  () =>
    import("@/components/engineering-studio").then((m) => m.EngineeringStudio),
  {
    ssr: false,
    loading: () => <p role="status">Opening the example workspace…</p>,
  },
);
export default function Demo() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [opened, setOpened] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  function openSource(source: File | undefined) {
    if (!source || busy) return;
    const invalid = sourceFileError(source);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setFile(source);
    if (!opened) setRevision((v) => v + 1);
    setOpened(true);
  }
  const workspace = useRef<HTMLDivElement>(null);
  const consumed = useCallback(() => {
    setFile(null);
    requestAnimationFrame(() => {
      const action = workspace.current?.querySelector<HTMLButtonElement>(
        "#studio-read-source",
      );
      if (!action) return;
      action.focus({ preventScroll: true });
      action.scrollIntoView({ block: "center", behavior: "auto" });
    });
  }, []);
  const preloaded = useRef<Promise<File> | null>(null);
  const [preloadStatus, setPreloadStatus] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  useEffect(() => {
    const controller = new AbortController();
    const pending = loadExampleDocument(controller.signal);
    preloaded.current = pending;
    pending
      .then(() => {
        if (!controller.signal.aborted) setPreloadStatus("ready");
      })
      .catch(() => {
        if (preloaded.current === pending) preloaded.current = null;
        if (!controller.signal.aborted) setPreloadStatus("failed");
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!opened) return;
    const frame = requestAnimationFrame(() =>
      workspace.current?.scrollIntoView({ block: "start", behavior: "auto" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [opened, revision]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const pending = preloaded.current;
      // A failed speculative preload must not poison the user's actual click.
      const document = pending
        ? await pending.catch(() => loadExampleDocument())
        : await loadExampleDocument();
      preloaded.current = Promise.resolve(document);
      setPreloadStatus("ready");
      setFile(document);
      setRevision((v) => v + 1);
      setOpened(true);
    } catch (e) {
      preloaded.current = null;
      setPreloadStatus("failed");
      setError(e instanceof Error ? e.message : "Unable to open the example.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <AppNavigation page="Demo" />
      <main
        className={
          "developer-page demo-page" + (dragging ? " is-dragging" : "")
        }
        id="main-content"
        onDragOver={(event) => {
          if (Array.from(event.dataTransfer.types).includes("Files")) {
            event.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDropCapture={() => setDragging(false)}
        onDrop={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length !== 1) {
            setError("Drop one source document at a time.");
            return;
          }
          openSource(event.dataTransfer.files[0]);
        }}
      >
        <div className="demo-opening">
          <header className="demo-intro">
            <span className="product-kicker">
              GUIDED DEMO · SYNTHETIC DOCUMENT
            </span>
            <h1>
              See a page
              <br />
              become a part.
            </h1>
            <p>
              Follow one measured mounting plate from a technical PDF to an
              editable 3D solid. Change a dimension, export the result, then
              review concepts for patent research.
            </p>
            <div className="row wrap">
              <Button
                disabled={busy}
                onClick={start}
                aria-controls="demo-workspace"
                aria-expanded={opened}
              >
                {busy
                  ? "Opening document…"
                  : opened
                    ? "Restart the example"
                    : "Try the example document"}
                <ArrowRight size={15} />
              </Button>
              <a
                className="link-button"
                href="/examples/mechanical-assembly.pdf"
                download
              >
                <ArrowDownToLine size={14} />
                Download the source PDF
              </a>
            </div>
            <label className="demo-source-drop">
              <strong>Or drop the downloaded PDF here</strong>
              <span>Choose a PDF, drawing or CAD file · up to 4 MB</span>
              <span className="english-file-action">Choose document</span>
              <input
                className="english-file-native"
                aria-label="Demo source file"
                type="file"
                accept={SOURCE_ACCEPT}
                disabled={busy}
                onChange={(event) => {
                  openSource(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {error && (
              <p role="alert" className="notice error">
                {error}
              </p>
            )}
            <p className="demo-preload-status" role="status">
              {preloadStatus === "ready"
                ? "Example PDF preloaded · Ready to open"
                : preloadStatus === "failed"
                  ? "Preload unavailable · Click Try the example document to retry"
                  : "Preparing the example document…"}
            </p>
            <p className="hint">
              No account or API key needed for this CAD example. No external AI
              or patent search starts automatically.
            </p>
          </header>
          <ProductTour />
        </div>
        <a className="real-patent-demo-link" href="/demo/patent">
          <span>REAL PATENT EXAMPLE</span>
          <strong>What if a similar publication already exists?</strong>
          <p>
            Ingest US20080003142A1, save it to your private portfolio and
            inspect the evidence-linked alert.
          </p>
          <span>Try the microfluidic patent case ↗</span>
        </a>
        <section className="demo-guide" aria-label="Demo instructions">
          <article>
            <span>01</span>
            <h2>Read the document</h2>
            <p>
              Select “Read document & identify parts” to extract the plate’s
              actual measurements from the sample PDF.
            </p>
          </article>
          <article>
            <span>02</span>
            <h2>Build, then adjust</h2>
            <p>
              Select “Rebuild CAD”. Change a measurement, rebuild and export a
              real STEP or STL file.
            </p>
          </article>
          <article>
            <span>03</span>
            <h2>Follow the evidence</h2>
            <p>
              Select “Review features for patent research”. Review the concepts
              before allowing external searches.
            </p>
          </article>
        </section>
        {opened ? (
          <div
            className="demo-live-workspace"
            id="demo-workspace"
            ref={workspace}
            role="region"
            aria-label="Interactive example workspace"
          >
            <div className="demo-context">
              <FileText size={17} />
              <span>
                Example workspace · Synthetic measured source · Geometry is
                computed, not a prerecorded model
              </span>
            </div>
            <Studio
              key={revision}
              initialFile={file}
              onFileConsumed={consumed}
              restoreDraft={false}
              guidedNavigation
              onPatentResearch={(description) => {
                sessionStorage.setItem(
                  "patentradar-engineering-handoff",
                  description,
                );
                router.push("/");
              }}
            />
          </div>
        ) : (
          <section className="demo-preview">
            <FileText size={40} strokeWidth={1} />
            <h2>A small source. A complete workflow.</h2>
            <p>
              The example produces a measured plate. The viewer, editing and
              exports use the same engineering tools as your own projects.
            </p>
            <a className="quiet-button" href="/engineering">
              Prefer your own document? Open 3D Studio ↗
            </a>
          </section>
        )}
      </main>
    </>
  );
}
