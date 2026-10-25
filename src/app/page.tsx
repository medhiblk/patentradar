"use client";
import {BRAND} from "@/lib/brand";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { readSearchStream } from "@/lib/search/read-stream";
import { citationGraph } from "@/lib/search/citations";
import { familyGroups } from "@/lib/providers/normalization";
import { deduplicate } from "@/lib/normalize";
import { patentSeed, parseSeeds } from "@/lib/patent-seeds";
import { InventionWorkspace } from "@/components/invention-workspace";
import { AccountMonitoring } from "@/components/account-monitoring";
import { EngineeringStudio } from "@/components/engineering-studio";
import { AIEvidence } from "@/components/ai-evidence";
import { SourceExplorer } from "@/components/source-explorer";
import { Home } from "@/components/home";
import {
  Radar,
  Plus,
  Files,
  GitCompareArrows,
  Building2,
  Plug,
  ArrowUpRight,
  ArrowRight,
  Upload,
  Check,
  Download,
  ExternalLink,
  FlaskConical,
  LoaderCircle,
  Menu,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { realProfile, realText } from "@/lib/real-case";
import { compare, triage } from "@/lib/compare";
import {
  ReportSchema,
  disclaimer,
  type Profile,
  type Research,
} from "@/lib/model";
import type { PatentRecord, Provider } from "@/lib/providers/types";
export default function Dashboard() {
  const [analysisModule, setAnalysisModule] = useState<"general" | "physical">(
    "general",
  );
  const [physical, setPhysical] = useState({
    components: "",
    function: "",
    relationships: "",
  });
  const [page, setPage] = useState("Overview");
  const [profile, setProfile] = useState<Profile>(realProfile);
  const [result, setResult] = useState<Research | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [mode, setMode] = useState<"LIVE" | "DEMO">("LIVE");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [aiConsent, setAiConsent] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const [searchConsent, setSearchConsent] = useState(false);
  const searchAbort = useRef<AbortController | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [seedText, setSeedText] = useState("");
  const [seedPublications, setSeedPublications] = useState<
    { publicationNumber: string }[]
  >([]);
  const [searchUpdates, setSearchUpdates] = useState<string[]>([]);
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PatentRecord | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [saved, setSaved] = useState<Research[]>([]);
  const [mobile, setMobile] = useState(false);
  const [competitor, setCompetitor] = useState("");
  const [dragging, setDragging] = useState(false);
  const [designReturn, setDesignReturn] = useState(false);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    fetch("/api/health/providers")
      .then((r) => r.json())
      .then((d) => setProviders(d.providers))
      .catch(() => {});
    const timer = setTimeout(() => {
      try {
        const handoff = sessionStorage.getItem(
          "patentradar-engineering-handoff",
        );
        if (handoff) {
          sessionStorage.removeItem("patentradar-engineering-handoff");
          setText(handoff);
          setDesignReturn(true);
          setReviewed(false);
          setPage("New Analysis");
        }
        const stored = JSON.parse(
          localStorage.getItem("patentradar-reports-v1") || "[]",
        );
        setSaved(
          Array.isArray(stored)
            ? stored.filter((r) => ReportSchema.safeParse(r).success)
            : [],
        );
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const go = (p: string) => {
    if (p === "Engineering Studio") setDesignReturn(false);
    if (p === "Physical Analysis") {
      setAnalysisModule("physical");
      setReviewed(false);
      setPage("New Analysis");
    } else {
      if (p === "New Analysis") setAnalysisModule("general");
      setPage(p);
    }
    setMobile(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? /expected pattern|did not match|SyntaxError/i.test(e.message)
            ? "The browser could not read the server response. Please retry. Your design text has been kept."
            : e.message
          : "Request failed",
      );
    } finally {
      setBusy("");
      fetch("/api/health/providers")
        .then((r) => r.json())
        .then((d) => setProviders(d.providers))
        .catch(() => {});
    }
  }
  async function json(url: string, body: FormData | object) {
    const r = await fetch(url, {
      method: "POST",
      ...(body instanceof FormData
        ? { body }
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    const raw = await r.text();
    let d;
    try {
      d = JSON.parse(raw);
    } catch {
      throw new Error(
        r.status === 413
          ? "This PDF is too large for the hosted upload limit. Use a PDF smaller than 4 MB."
          : `The server returned an unexpected response (HTTP ${r.status}). Please retry; your description is still here.`,
      );
    }
    if (!r.ok) throw new Error(d.error || `Request failed (HTTP ${r.status})`);
    return d;
  }
  const extract = () =>
    run("Reading your document", async () => {
      const form = new FormData();
      if (file) form.set("file", file);
      form.set("text", text);
      if (analysisModule === "physical")
        form.set(
          "context",
          Object.entries(physical)
            .filter(([, v]) => v.trim())
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n"),
        );
      form.set("consent", String(aiConsent));
      const d = await json("/api/extract", form);
      setProfile({
        ...d.profile,
        ...(projectTitle ? { title: projectTitle } : {}),
      });
      setMode(d.mode);
      setNotice(d.notice);
      setReviewed(true);
    });
  const research = (demo = false) =>
    run("Retrieving and comparing evidence", async () => {
      searchAbort.current = new AbortController();
      const currentProfile = demo ? realProfile : profile;
      setSearchUpdates([]);
      setSelected(null);
      setResult({
        profile: currentProfile,
        mode: "PARTIAL",
        patents: [],
        papers: [],
        warnings: [],
        queries: [],
      });
      go("Patent Results");
      const response = await fetch("/api/research/stream", {
        signal: searchAbort.current.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: currentProfile,
          mode: "LIVE",
          seedPublications: seedText.trim()
            ? parseSeeds(seedText).map((s) => ({
                publicationNumber: s.publicationNumber,
              }))
            : seedPublications,
          publicationNumber: demo ? "EP1000000A1" : number,
          publicationDate: demo ? "20000517" : date,
          query: demo ? realProfile.searchKeywords[0] : query,
          consent: demo || searchConsent,
          sources: localOnly && !demo ? "local" : "all",
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Search failed");
      }
      if (!response.body) throw new Error("Search stream unavailable");
      let complete = false;
      await readSearchStream(response.body, (event) => {
        if (event.provider)
          setSearchUpdates((old) => [
            ...old.slice(-11),
            `${event.provider}: ${event.type.replaceAll("_", " ")}`,
          ]);
        if (event.type === "candidate_upsert" && event.candidate)
          setResult((old) =>
            old
              ? {
                  ...old,
                  patents: deduplicate([...old.patents, event.candidate!]),
                }
              : old,
          );
        if (event.result) setResult(event.result);
        if (event.type === "completed") complete = true;
      });
      if (!complete)
        throw new Error(
          "Search interrupted. Retrieved evidence is retained; retry when ready.",
        );
    });
  const download = () =>
    run("Generating report", async () => {
      if (!result) return;
      const r = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!r.ok) throw new Error("Report generation failed");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "patentradar-report.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  const save = () => {
    if (!result) return;
    const next = [result, ...saved].slice(0, 8);
    try {
      localStorage.setItem("patentradar-reports-v1", JSON.stringify(next));
      setSaved(next);
      setNotice(
        "Saved in this browser. Contains your reviewed technical profile.",
      );
    } catch {
      setError("Browser storage is unavailable or full.");
    }
  };
  const patents = result?.patents || [];
  const applicants = Object.entries(
    patents
      .flatMap((p) => p.applicants)
      .reduce<
        Record<string, number>
      >((a, n) => ({ ...a, [n]: (a[n] || 0) + 1 }), {}),
  ).map(([name, count]) => ({ name, count }));
  const timeline = Object.entries(
    patents
      .filter((p) => p.publicationDate)
      .reduce<Record<string, number>>((a, p) => {
        const y = p.publicationDate!.slice(0, 4);
        return { ...a, [y]: (a[y] || 0) + 1 };
      }, {}),
  ).map(([year, count]) => ({ year, count }));
  const card = (p: PatentRecord) => (
    <article className="patent-card" key={p.id}>
      <div className="row between">
        <span className="publication">{p.publicationNumber}</span>
        <span className={"badge " + (p.synthetic ? "amber" : "blue")}>
          {p.synthetic ? "SYNTHETIC DEMO" : p.jurisdiction || "Patent"}
        </span>
      </div>
      <h3>
        <button
          className="text-button"
          onClick={() => {
            setSelected(p);
            go("Patent Detail");
          }}
        >
          {p.title}
        </button>
      </h3>
      <p>{p.abstract?.slice(0, 240) || "Abstract unavailable."}</p>
      <div className="triage-note">
        <strong>{triage(result?.profile || profile, p).priority}</strong>
        <p>{triage(result?.profile || profile, p).caution}</p>
        <small>{triage(result?.profile || profile, p).basis}</small>
      </div>
      <div className="patent-meta">
        <Building2 size={14} />
        {p.applicants.join(", ") || "Applicant unavailable"}
      </div>
      <div className="card-bottom">
        <span>
          {compare(result?.profile || profile, p).score}% lexical feature
          coverage
        </span>
        <button
          onClick={() => {
            setSelected(p);
            go("Claim Comparison");
          }}
        >
          Compare evidence <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="row wrap" style={{ marginTop: 14 }}>
        {(() => {
          try {
            const seed = patentSeed(p.publicationNumber);
            return (
              <a
                className="evidence-link"
                href={seed.referenceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Google Patents reference ↗
              </a>
            );
          } catch {
            return null;
          }
        })()}
        {p.pdfUrl && (
          <a
            className="evidence-link"
            href={p.pdfUrl}
            target="_blank"
            rel="noreferrer"
          >
            Patent PDF <Download size={13} />
          </a>
        )}
        {p.additionalSources?.map((source) => (
          <a
            key={source.url}
            className="evidence-link"
            href={source.url}
            target="_blank"
            rel="noreferrer"
          >
            {source.name}
            <ExternalLink size={12} />
          </a>
        ))}
      </div>
      <div className="source-evidence">
        <small>
          {p.source} · Retrieved {new Date(p.retrievedAt).toLocaleDateString()}
        </small>
        {!p.synthetic && (
          <a href={p.sourceUrl} target="_blank" rel="noreferrer">
            Original source <ExternalLink size={12} />
          </a>
        )}
      </div>
    </article>
  );
  return (
    <div className="app">
      <header className="site-header">
        <button
          className="wordmark"
          onClick={() => go("Overview")}
          aria-label="FormaProof home"
        >
          <span className="wordmark-symbol">
            <span />
            <span />
            <span />
          </span>
          {BRAND.name}<span className="wordmark-period">.</span>
        </button>
        <nav
          className={mobile ? "main-nav is-open" : "main-nav"}
          aria-label="Main navigation"
        >
          <button
            className={page === "Patent Search" ? "current" : ""}
            onClick={() => go("Patent Search")}
          >
            Patent Explorer
          </button>
          <button
            className={page === "New Analysis" ? "current" : ""}
            onClick={() => go("My Inventions")}
          >
            My Inventions
          </button>
          <button
            className={page === "Reports" ? "current" : ""}
            onClick={() => go("Reports")}
          >
            Reports
          </button>
          <button onClick={() => go("Engineering Studio")}>
            Engineering Studio
          </button>
          <button onClick={() => go("Account & Monitoring")}>Account</button>
          <a className="nav-api-link" href="/plugin">Plugin ↗</a>
          <a className="nav-api-link" href="/developers">
            API &amp; MCP ↗
          </a>
        </nav>
        <div className="header-right">
          <span className="edition">RESEARCH, REIMAGINED</span>
          <button className="header-start" onClick={() => go("New Analysis")}>
            Start exploring <ArrowUpRight size={14} />
          </button>
          <button
            className="mobile-toggle"
            aria-label="Toggle menu"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      <main>
        <div
          className={
            "content " +
            (page === "Overview" ? "home-content" : "workspace-content")
          }
        >
          {page !== "Overview" && (
            <>
              <div className="workspace-topline">
                <button onClick={() => go("Overview")}>Home</button>
                <span>/</span>
                <span>{page === "New Analysis" ? "Analyze" : page}</span>
                <span className="badge">
                  {result?.mode || "RESEARCH WORKSPACE"}
                </span>
              </div>
              <div className="page-top">
                <div>
                  <span className="eyebrow">
                    PATENT INTELLIGENCE, WITH PERSPECTIVE
                  </span>
                  <h1>
                    {page === "New Analysis"
                      ? "Begin with your idea."
                      : page === "Patent Search"
                        ? "Find the thinking before yours."
                        : page === "Patent Results"
                          ? "The evidence, in focus."
                          : page === "Claim Comparison"
                            ? "A closer look at the overlap."
                            : page === "Reports"
                              ? "Clarity, ready to share."
                              : page === "Competitor Intelligence"
                                ? "Know who’s moving forward."
                                : page === "Technology Landscape"
                                  ? "See how the pieces connect."
                                  : page === "API Providers"
                                    ? "Good intelligence starts at the source."
                                    : page}
                  </h1>
                  <p className="muted">
                    {page === "New Analysis"
                      ? "Bring a document. Refine the features. Follow the evidence."
                      : "Traceable evidence for informed technical decisions."}
                  </p>
                </div>
                {page !== "New Analysis" && (
                  <Button variant="outline" onClick={() => go("New Analysis")}>
                    New analysis <Plus size={14} />
                  </Button>
                )}
              </div>
              <nav className="workspace-nav" aria-label="Research sections">
                {[
                  "Engineering Studio",
                  "Account & Monitoring",
                  "My Inventions",
                  "New Analysis",
                  "Patent Search",
                  "Patent Results",
                  "Claim Comparison",
                  "Competitor Intelligence",
                  "Technology Landscape",
                  "Reports",
                  "API Providers",
                ].map((p) => (
                  <button
                    key={p}
                    className={page === p ? "selected" : ""}
                    onClick={() => {
                      if (p === "Claim Comparison") setSelected(null);
                      go(p);
                    }}
                  >
                    {p === "New Analysis"
                      ? "New analysis"
                      : p === "Claim Comparison"
                        ? "AI Comparison"
                        : p === "Competitor Intelligence"
                          ? "Competitors"
                          : p === "Technology Landscape"
                            ? "Landscape"
                            : p === "API Providers"
                              ? "Sources"
                              : p}
                  </button>
                ))}
              </nav>
            </>
          )}
          {page === "Engineering Studio" && (
            <EngineeringStudio
              onPatentResearch={(description) => {
                setText(description);
                setDesignReturn(true);
                setReviewed(false);
                go("New Analysis");
              }}
            />
          )}
          {page === "Account & Monitoring" && (
            <AccountMonitoring
              profile={profile}
              onOpenProject={(p) => {
                setText(p.description);
                setProjectTitle(p.title);
                setSeedPublications(p.seedPublications);
                setSeedText(
                  p.seedPublications.map((s) => s.publicationNumber).join("\n"),
                );
                setReviewed(false);
                go("New Analysis");
              }}
            />
          )}
          {page === "My Inventions" && (
            <InventionWorkspace
              onAnalyze={(project) => {
                setText(project.description);
                setProjectTitle(project.title);
                setSeedText(
                  project.seedPublications
                    .map((s) => s.publicationNumber)
                    .join("\n"),
                );
                setSeedPublications(project.seedPublications);
                if (project.title)
                  setProfile({ ...profile, title: project.title });
                setReviewed(false);
                go("New Analysis");
              }}
            />
          )}
          {busy && searchUpdates.length > 0 && (
            <section className="notice" role="status" aria-live="polite">
              <strong>Searching public sources</strong>
              <Button
                variant="outline"
                onClick={() => searchAbort.current?.abort()}
              >
                Stop search
              </Button>
              <p>{searchUpdates[searchUpdates.length - 1]}</p>
            </section>
          )}
          {page === "Claim Comparison" && result && (
            <AIEvidence
              profile={result.profile}
              patents={selected ? [selected] : result.patents}
            />
          )}
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          {designReturn && page !== "Engineering Studio" && (
            <section className="notice" aria-label="Design iteration">
              <strong>Investigate, then iterate.</strong>
              <p>
                Review the technical concepts before sharing search queries.
                Your assembly parameters are retained in this tab so you can
                explore another design. Original files and imported geometry
                are not retained.
              </p>
              <Button variant="outline" onClick={() => go("Engineering Studio")}>
                Return to design iteration
              </Button>
            </section>
          )}
          <AnimatePresence>
            {busy && (
              <motion.div
                role="status"
                className="notice progress-notice"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <LoaderCircle className="spin" size={16} />
                {busy}
                <span className="progress-dots">···</span>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            key={page}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {page === "Overview" && (
              <Home go={go} demo={() => research(true)} busy={!!busy} />
            )}
            {(page === "New Analysis" || page === "Patent Search") && (
              <>
                <section
                  className="module-picker"
                  aria-label="Invention module"
                >
                  <div>
                    <span className="eyebrow">
                      CHOOSE YOUR RESEARCH CONTEXT
                    </span>
                    <p>
                      Patents first. A dedicated path for physical inventions
                      when you need it.
                    </p>
                  </div>
                  <div className="row wrap">
                    <Button
                      variant={
                        analysisModule === "general" ? "default" : "outline"
                      }
                      onClick={() => {
                        setAnalysisModule("general");
                        setReviewed(false);
                      }}
                    >
                      General patent research
                    </Button>
                    <Button
                      variant={
                        analysisModule === "physical" ? "default" : "outline"
                      }
                      onClick={() => {
                        setAnalysisModule("physical");
                        setReviewed(false);
                      }}
                    >
                      Physical invention module
                    </Button>
                  </div>
                </section>
                {analysisModule === "physical" && (
                  <section className="panel physical-brief">
                    <h3>Describe the part or assembly</h3>
                    <p>
                      Use a technical PDF or describe the mechanism. For
                      measured 3D reconstruction, open Engineering Studio.
                    </p>
                    <a className="link-button" href="/engineering">
                      Open 3D Engineering Studio ↗
                    </a>
                    <div className="physical-fields">
                      <label>
                        Parts, components and materials
                        <textarea
                          value={physical.components}
                          maxLength={1500}
                          onChange={(e) =>
                            setPhysical({
                              ...physical,
                              components: e.target.value,
                            })
                          }
                          placeholder="For example: housing, drive shaft, bearing and seal. Only describe your actual design."
                        />
                      </label>
                      <label>
                        Function and operating principle
                        <textarea
                          value={physical.function}
                          maxLength={1500}
                          onChange={(e) =>
                            setPhysical({
                              ...physical,
                              function: e.target.value,
                            })
                          }
                          placeholder="What does the part do? What moves, senses or controls?"
                        />
                      </label>
                      <label>
                        Interfaces and relationships
                        <textarea
                          value={physical.relationships}
                          maxLength={1500}
                          onChange={(e) =>
                            setPhysical({
                              ...physical,
                              relationships: e.target.value,
                            })
                          }
                          placeholder="How are parts connected? Describe load transfer, motion or fluid paths."
                        />
                      </label>
                    </div>
                    <p className="hint">
                      These details are included in the extracted profile and
                      patent comparison. They are not assumed to be novel.
                    </p>
                  </section>
                )}
                <div className="stage-strip">
                  <span className={reviewed ? "complete" : "active"}>
                    <i>01</i> Bring your idea
                  </span>
                  <span className="stage-line" />
                  <span className={reviewed ? "active" : ""}>
                    <i>02</i> Refine the features
                  </span>
                  <span className="stage-line" />
                  <span>
                    <i>03</i> Follow the evidence
                  </span>
                </div>
                <div className="analysis-grid">
                  <section className="panel">
                    <div className="panel-heading">
                      <h3>
                        01 /{" "}
                        {page === "New Analysis"
                          ? "Describe your invention"
                          : "Choose your search"}
                      </h3>
                      <Upload size={19} />
                    </div>
                    <label
                      className={"dropzone " + (dragging ? "is-dragging" : "")}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        const dropped = e.dataTransfer.files[0];
                        if (dropped) {
                          if (
                            dropped.type !== "application/pdf" ||
                            dropped.size > 4 * 1024 * 1024
                          ) {
                            setError("Choose a PDF smaller than 4 MB.");
                            return;
                          }
                          setFile(dropped);
                          setReviewed(false);
                          setError("");
                        }
                      }}
                    >
                      <span className="upload-art">
                        <span />
                        <Upload size={24} />
                      </span>
                      <strong>
                        {file ? file.name : "Drop your next idea here"}
                      </strong>
                      <span>Drag a PDF here, or choose a file below</span>
                      <small>Text-based PDF · up to 4 MB · 80 pages</small>
                      <input
                        aria-label="Technical PDF"
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          setFile(e.target.files?.[0] || null);
                          setReviewed(false);
                        }}
                      />
                    </label>
                    <label>
                      Describe your invention. We’ll find the closest existing
                      technologies.
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Describe the components, operating principles and technical functions…"
                        rows={5}
                      />
                    </label>
                    <div className="row wrap">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setText(realText);
                          setFile(null);
                        }}
                      >
                        Use public patent research brief
                      </Button>
                      <a
                        className="link-button"
                        href="https://data.epo.org/publication-server/rest/v1.2/publication-dates/20000517/patents/EP1000000NWA1/document.xml"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open source patent <Download size={14} />
                      </a>
                    </div>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={aiConsent}
                        onChange={(e) => setAiConsent(e.target.checked)}
                      />
                      I consent to sending document text to OpenAI for
                      extraction if configured.
                    </label>
                    <p className="hint">
                      Your actual text is extracted locally when OpenAI is
                      unavailable. With your consent and a configured key,
                      OpenAI performs structured analysis. Uploaded files are
                      processed in memory and are not retained.
                    </p>
                    <Button
                      disabled={
                        !!busy ||
                        (!file &&
                          text.length +
                            (analysisModule === "physical"
                              ? Object.values(physical).join(" ").length
                              : 0) <
                            30)
                      }
                      onClick={extract}
                    >
                      Extract technical features <ArrowRight size={16} />
                    </Button>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h3>02 / Review & retrieve</h3>
                      <span className="badge amber">{mode}</span>
                    </div>
                    {notice && <div className="notice">{notice}</div>}
                    {!reviewed ? (
                      <div className="empty">
                        <GitCompareArrows size={35} />
                        <h3>Your technical profile starts here</h3>
                        <p>
                          Extract a document or load the sourced public research
                          profile to edit features before comparison.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setProfile(realProfile);
                            setMode("LIVE");
                            setNumber("EP1000000A1");
                            setDate("20000517");
                            setReviewed(true);
                            setNotice(
                              "Human-authored research profile grounded in EP1000000A1. Review the features against the source; this is not AI extraction.",
                            );
                          }}
                        >
                          Load real patent case
                        </Button>
                      </div>
                    ) : (
                      <motion.div
                        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                      >
                        <label>
                          Invention title
                          <input
                            value={profile.title}
                            onChange={(e) =>
                              setProfile({ ...profile, title: e.target.value })
                            }
                          />
                        </label>
                        <div className="features">
                          {profile.technicalFeatures.map((f, i) => (
                            <div className="feature" key={i}>
                              <Check size={17} />
                              <div>
                                <input
                                  aria-label={`Feature ${i + 1} name`}
                                  value={f.name}
                                  onChange={(e) =>
                                    setProfile({
                                      ...profile,
                                      technicalFeatures:
                                        profile.technicalFeatures.map((v, j) =>
                                          j === i
                                            ? { ...v, name: e.target.value }
                                            : v,
                                        ),
                                    })
                                  }
                                />
                                <textarea
                                  aria-label={`Feature ${i + 1} description`}
                                  value={f.description}
                                  onChange={(e) =>
                                    setProfile({
                                      ...profile,
                                      technicalFeatures:
                                        profile.technicalFeatures.map((v, j) =>
                                          j === i
                                            ? {
                                                ...v,
                                                description: e.target.value,
                                              }
                                            : v,
                                        ),
                                    })
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        <label>
                          Execution mode
                          <select
                            value={mode}
                            onChange={(e) =>
                              setMode(e.target.value as "LIVE" | "DEMO")
                            }
                          >
                            <option value="LIVE">
                              LIVE request — available public sources
                            </option>
                          </select>
                        </label>
                        {mode === "LIVE" && (
                          <>
                            <label>
                              Reviewed public search concepts
                              <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={profile.searchKeywords[0]}
                              />
                            </label>
                            <label>
                              Reference patents (up to 10, one per line)
                              <textarea
                                value={seedText}
                                onChange={(e) => setSeedText(e.target.value)}
                                placeholder="EP2345898B1"
                              />
                            </label>
                            <div className="field-row">
                              <label>
                                EP publication number
                                <input
                                  value={number}
                                  onChange={(e) => setNumber(e.target.value)}
                                  placeholder="EP1000000A1"
                                />
                              </label>
                              <label>
                                Publication date
                                <input
                                  value={date}
                                  onChange={(e) =>
                                    setDate(e.target.value.replace(/\D/g, ""))
                                  }
                                  placeholder="20000517"
                                  maxLength={8}
                                />
                              </label>
                            </div>
                            <p className="hint">
                              Exact EP lookup requires the publication date.
                              Keyword queries search OpenAIRE’s
                              literature-linked patent metadata and scientific
                              sources. Coverage is partial.{" "}
                              <button
                                className="inline-link"
                                onClick={() => {
                                  setNumber("EP1000000A1");
                                  setDate("20000517");
                                }}
                              >
                                Use verified retrieval example
                              </button>{" "}
                              (brick manufacturing, unrelated to the demo).
                            </p>
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={localOnly}
                                onChange={(e) => setLocalOnly(e.target.checked)}
                              />
                              Search only my server’s sourced public index; no
                              external requests.
                            </label>
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={searchConsent}
                                onChange={(e) =>
                                  setSearchConsent(e.target.checked)
                                }
                              />
                              Share the reviewed search concepts with literature
                              providers and the publication identifier with EPO.
                            </label>
                          </>
                        )}
                        <Button
                          disabled={
                            !!busy ||
                            (mode === "LIVE" && !searchConsent && !localOnly)
                          }
                          onClick={() => research()}
                        >
                          Retrieve & compare <ArrowRight size={16} />
                        </Button>
                      </motion.div>
                    )}
                  </section>
                </div>
              </>
            )}
            {page === "Patent Results" && (
              <>
                <div className="notice">
                  {result?.mode === "DEMO"
                    ? "SYNTHETIC DEMO — illustrative records, not real patents."
                    : "Results include only successfully retrieved evidence. Literature results are not patents."}
                </div>
                <div className="row between section-title">
                  <h2>
                    Patent shortlist{" "}
                    <span className="count">{patents.length}</span>
                  </h2>
                  <Button
                    variant="outline"
                    onClick={() => go("Claim Comparison")}
                  >
                    Compare features <GitCompareArrows size={16} />
                  </Button>
                </div>
                <div className="results-grid">{patents.map(card)}</div>
                {!patents.length && (
                  <div className="panel empty">
                    <Files size={32} />
                    <h3>No patent evidence yet</h3>
                    <p>
                      Try a different reviewed concept or an exact EP
                      publication lookup.
                    </p>
                    <Button onClick={() => go("Patent Search")}>
                      Search evidence
                    </Button>
                  </div>
                )}
                {result && result.patents.some((p) => p.citations?.length) && (
                  <section className="panel">
                    <h3>Retrieved citation relationships</h3>
                    {citationGraph(
                      result.patents,
                      result.patents.map((p) => p.publicationNumber),
                    ).edges.map((e) => (
                      <p key={e.from + e.to}>
                        <a href={e.sourceUrl} target="_blank" rel="noreferrer">
                          {e.from} → {e.to}
                        </a>{" "}
                        · {e.source}
                      </p>
                    ))}
                    <small>
                      Citations support exploration, not technical equivalence.
                      Only retrieved edges are shown.
                    </small>
                  </section>
                )}
                {result && result.patents.some((p) => p.familyId) && (
                  <section className="panel">
                    <h3>Retrieved patent families</h3>
                    {familyGroups(result.patents).map((g) => (
                      <p key={g.id}>
                        {g.id}:{" "}
                        {g.members.map((p) => p.publicationNumber).join(", ")}
                      </p>
                    ))}
                    <small>
                      Only explicit family identifiers are grouped; publications
                      are retained.
                    </small>
                  </section>
                )}
                {result?.seedSuggestions &&
                  result.seedSuggestions.terms.length > 0 && (
                    <section className="panel">
                      <h3>Explore terminology from your reference patents</h3>
                      <p>{result.seedSuggestions.terms.join(", ")}</p>
                      <p>{result.seedSuggestions.classifications.join(", ")}</p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setQuery(
                            result.seedSuggestions!.terms.slice(0, 3).join(" "),
                          );
                          go("Patent Search");
                        }}
                      >
                        Review a related search
                      </Button>
                    </section>
                  )}
                <h2 className="section-title">Related scientific literature</h2>
                <div className="panel">
                  {result?.papers.length ? (
                    result.papers.map((p) => (
                      <a
                        className="paper"
                        key={p.id}
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FlaskConical size={20} />
                        <div>
                          <strong>{p.title}</strong>
                          <small>
                            {p.source} · {p.year || "Year unavailable"} ·
                            Retrieved{" "}
                            {new Date(p.retrievedAt).toLocaleDateString()}
                          </small>
                        </div>
                        <ExternalLink size={16} />
                      </a>
                    ))
                  ) : (
                    <p className="muted">
                      No scientific records in this analysis.
                    </p>
                  )}
                </div>
                {result?.warnings.map((w) => (
                  <p className="hint" key={w}>
                    {w}
                  </p>
                ))}
              </>
            )}
            {page === "Patent Detail" && selected && (
              <section className="panel">
                <span className="badge">
                  {selected.synthetic
                    ? "SYNTHETIC DEMO"
                    : selected.publicationNumber}
                </span>
                <h2>{selected.title}</h2>
                <p>{selected.abstract || "Abstract unavailable."}</p>
                <p>
                  Applicants: {selected.applicants.join(", ") || "Unavailable"}
                </p>
                <p>
                  Publication: {selected.publicationDate || "Unavailable"} ·
                  Family: {selected.familyId || "Unavailable"} · Legal status:
                  not assessed
                </p>
                {!selected.synthetic && (
                  <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                    Open original source <ExternalLink size={15} />
                  </a>
                )}
                <h3>Research triage</h3>
                <p>
                  {triage(result?.profile || profile, selected).priority}.{" "}
                  {triage(result?.profile || profile, selected).applicant}
                </p>
                <p>{triage(result?.profile || profile, selected).caution}</p>
                {selected.pdfUrl && (
                  <a href={selected.pdfUrl} target="_blank" rel="noreferrer">
                    Read original patent PDF <Download size={14} />
                  </a>
                )}
                <h3>Available claims</h3>
                {selected.claims?.map((c, i) => (
                  <blockquote key={i}>{c}</blockquote>
                )) || <p>Claims unavailable.</p>}
                <small>
                  {selected.source} · Retrieved {selected.retrievedAt}
                </small>
              </section>
            )}
            {page === "Claim Comparison" && (
              <>
                <div className="notice">
                  Explainable lexical relevance, not infringement probability.
                  Semantic similarity and claim construction are not assessed.
                </div>
                {!patents.length && (
                  <div className="panel empty">
                    Run an analysis to compare evidence.
                  </div>
                )}
                {(selected && patents.some((p) => p.id === selected.id)
                  ? [selected]
                  : patents
                ).map((p) => {
                  const c = compare(result?.profile || profile, p);
                  return (
                    <section className="panel comparison" key={p.id}>
                      <div className="panel-heading">
                        <h3>
                          {p.publicationNumber}{" "}
                          {p.synthetic && "· SYNTHETIC DEMO"}
                        </h3>
                        <span className="badge blue">
                          {c.score}% lexical relevance
                        </span>
                      </div>
                      <p>{c.limitation}</p>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Technical feature</th>
                              <th>Evidence excerpt</th>
                              <th>Assessment</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.matches.map((m) => (
                              <tr key={m.feature}>
                                <td>
                                  <strong>{m.feature}</strong>
                                </td>
                                <td>
                                  <blockquote>{m.excerpt}</blockquote>
                                  <small>{p.source}</small>
                                  {!p.synthetic && (
                                    <a
                                      className="evidence-link"
                                      href={p.sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Verify source <ExternalLink size={12} />
                                    </a>
                                  )}
                                </td>
                                <td>
                                  <span className="badge">{m.strength}</span>
                                  <p>{m.explanation}</p>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  );
                })}
              </>
            )}
            {(page === "Competitor Intelligence" ||
              page === "Technology Landscape") && (
              <>
                <div className="notice">
                  {result?.mode === "DEMO" ? "SYNTHETIC DEMO. " : ""}Only the
                  retrieved sample is represented. This is not a complete
                  competitive landscape or applicant search.
                </div>
                {!patents.length && (
                  <section className="panel empty">
                    <h3>A landscape starts with evidence.</h3>
                    <p>
                      Run an analysis to see relationships across your retrieved
                      records, or try the sourced public patent case.
                    </p>
                    <div
                      className="row wrap"
                      style={{ justifyContent: "center" }}
                    >
                      <Button onClick={() => go("New Analysis")}>
                        Start an analysis <ArrowUpRight size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        disabled={!!busy}
                        onClick={() => research(true)}
                      >
                        Research the public patent
                      </Button>
                    </div>
                  </section>
                )}
                {page === "Technology Landscape" && patents.length > 0 && (
                  <section className="panel">
                    <div className="panel-heading">
                      <h3>Technical feature landscape</h3>
                      <span className="badge">
                        {result?.mode} · LEXICAL MATCHES
                      </span>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Reviewed feature</th>
                            {patents.map((p) => (
                              <th key={p.id}>{p.publicationNumber}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(result?.profile || profile).technicalFeatures.map(
                            (f, i) => (
                              <tr key={i}>
                                <td>{f.name}</td>
                                {patents.map((p) => (
                                  <td key={p.id}>
                                    <button
                                      className="matrix-cell"
                                      onClick={() => {
                                        setSelected(p);
                                        go("Claim Comparison");
                                      }}
                                    >
                                      {
                                        compare(result?.profile || profile, p)
                                          .matches[i].strength
                                      }
                                      <ArrowUpRight size={12} />
                                    </button>
                                  </td>
                                ))}
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                    <p className="hint">
                      Shared vocabulary only. Select a cell to inspect the
                      underlying evidence.
                    </p>
                  </section>
                )}
                <label className="filter">
                  Filter applicants in retrieved records
                  <input
                    value={competitor}
                    onChange={(e) => setCompetitor(e.target.value)}
                    placeholder="Applicant name"
                  />
                </label>
                <div className="two-col">
                  <section className="panel">
                    <h3>Applicant activity</h3>
                    {applicants.length ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={applicants.filter((a) =>
                            a.name
                              .toLowerCase()
                              .includes(competitor.toLowerCase()),
                          )}
                          layout="vertical"
                          margin={{ left: 10, right: 20 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            horizontal={false}
                          />
                          <XAxis type="number" allowDecimals={false} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={130}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip />
                          <Bar
                            dataKey="count"
                            fill="#3975ed"
                            radius={[0, 5, 5, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p>
                        No applicant evidence retrieved. Sources without
                        assignees cannot establish competitors.
                      </p>
                    )}
                  </section>
                  <section className="panel">
                    <h3>Publication activity</h3>
                    {timeline.length ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={timeline}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis dataKey="year" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar
                            dataKey="count"
                            fill="#42b7ad"
                            radius={[5, 5, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p>No dated records retrieved.</p>
                    )}
                  </section>
                </div>
                <section className="panel">
                  <h3>Jurisdiction distribution</h3>
                  {[
                    ...new Set(patents.map((p) => p.jurisdiction || "Unknown")),
                  ].map((j) => (
                    <p key={j}>
                      {j}:{" "}
                      {
                        patents.filter(
                          (p) => (p.jurisdiction || "Unknown") === j,
                        ).length
                      }{" "}
                      records
                    </p>
                  ))}
                </section>
              </>
            )}
            {page === "Reports" && (
              <>
                <section className="panel report-preview">
                  <div className="report-mark">
                    <Radar size={32} /> {BRAND.name}
                  </div>
                  <span className="eyebrow">PATENT INTELLIGENCE REPORT</span>
                  <h2>
                    {result?.profile.title ||
                      "Your next decision starts with evidence."}
                  </h2>
                  <p>
                    {result
                      ? `${result.mode} · ${patents.length} patent records · ${result.papers.length} scientific references`
                      : "Complete an analysis to generate your report."}
                  </p>
                  <div className="report-chapters">
                    {[
                      "Executive summary",
                      "Technical invention profile",
                      "Search methodology & data sources",
                      "Patent shortlist & technical comparison",
                      "Competitor landscape",
                      "Limitations & follow-up research",
                      "Source references",
                    ].map((s, i) => (
                      <div key={s}>
                        <span>0{i + 1}</span>
                        {s}
                        <Check size={15} />
                      </div>
                    ))}
                  </div>
                  <div className="row wrap">
                    <Button disabled={!result || !!busy} onClick={download}>
                      <Download size={16} /> Download PDF report
                    </Button>
                    <Button variant="outline" disabled={!result} onClick={save}>
                      Save in this browser
                    </Button>
                  </div>
                  {notice && <p className="hint">{notice}</p>}
                  <p className="hint">{disclaimer}</p>
                </section>
                {saved.length > 0 && (
                  <section className="panel">
                    <div className="panel-heading">
                      <h3>Saved browser reports</h3>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          localStorage.removeItem("patentradar-reports-v1");
                          setSaved([]);
                        }}
                      >
                        Clear saved reports
                      </Button>
                    </div>
                    {saved.map((r, i) => (
                      <button
                        className="saved-row"
                        key={i}
                        onClick={() => {
                          setResult(r);
                          setProfile(r.profile);
                        }}
                      >
                        {r.profile.title}
                        <span className="badge">{r.mode}</span>
                      </button>
                    ))}
                  </section>
                )}
              </>
            )}
            {page === "API Providers" && (
              <>
                <div className="notice">
                  Configured, implemented and healthy are separate states.
                  Pending adapters never execute undocumented requests.
                </div>
                <SourceExplorer />
                <div className="provider-grid">
                  {providers.map((p) => (
                    <section className="panel provider" key={p.id}>
                      <div className="row between">
                        <Plug size={21} />
                        <span
                          className={
                            "status " + (p.status === "HEALTHY" ? "green" : "")
                          }
                        >
                          {p.status}
                        </span>
                      </div>
                      <h3>{p.name}</h3>
                      {p.tier && <span className="badge">TIER {p.tier}</span>}
                      <p>{p.detail}</p>
                      <div className="tags">
                        {p.capabilities.length ? (
                          p.capabilities.map((c) => (
                            <span className="badge" key={c}>
                              {c}
                            </span>
                          ))
                        ) : (
                          <span className="badge">
                            No enabled search capability
                          </span>
                        )}
                      </div>
                      <small>{p.authentication}</small>
                      {p.license && <small>{p.license}</small>}
                      <small>{p.rateLimit}</small>
                      {p.checkedAt && (
                        <small>
                          Observed {new Date(p.checkedAt).toLocaleString()}
                        </small>
                      )}
                      <a
                        href={p.documentation}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Official documentation <ExternalLink size={13} />
                      </a>
                    </section>
                  ))}
                </div>
              </>
            )}
          </motion.div>
          <footer>
            <span>
              {BRAND.name}<span className="footer-dot">.</span>
              <span className="footer-caption">
                A new perspective on what’s possible.
              </span>
            </span>
            <div>
              <button onClick={() => go("API Providers")}>Data sources</button>
              <span>Preliminary intelligence. Human expertise, always.</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
