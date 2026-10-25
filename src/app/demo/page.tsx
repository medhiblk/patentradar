"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowRight, FileText } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { ProductTour } from "@/components/demo/product-tour";
import "./demo.css";
import { Button } from "@/components/ui/button";
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
  const consumed = useCallback(() => setFile(null), []);
  const preloaded = useRef<Promise<File> | null>(null);
  const [ready, setReady] = useState(false);
  async function loadExample(signal?: AbortSignal) {
    const response = await fetch("/examples/mechanical-assembly.pdf", {
      signal: signal || AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw Error("The example document could not be loaded. Please retry.");
    return new File([await response.blob()], "example-mounting-plate.pdf", {
      type: "application/pdf",
    });
  }
  useEffect(() => {
    const controller = new AbortController();
    const pending = loadExample(controller.signal);
    preloaded.current = pending;
    pending
      .then(() => {
        if (!controller.signal.aborted) setReady(true);
      })
      .catch(() => {
        if (preloaded.current === pending) preloaded.current = null;
      });
    return () => controller.abort();
  }, []);
  async function start() {
    setBusy(true);
    setError("");
    try {
      setFile(await (preloaded.current || loadExample()));
      setRevision((v) => v + 1);
      setOpened(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open the example.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <AppNavigation page="Demo" />
      <main className="developer-page demo-page" id="main-content">
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
              <Button disabled={busy} onClick={start}>
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
            <p className="hint">
              No account or API key needed for this CAD example. No external AI
              or patent search starts automatically.
            </p>
          </header>
          <ProductTour />
        </div>
        <p className="demo-preload-status" role="status">
          {ready
            ? "Example PDF preloaded · Ready to open"
            : "Preparing the example document…"}
        </p>
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
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {opened ? (
          <div className="demo-live-workspace">
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
