"use client";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, ArrowRight } from "lucide-react";
const experiences = [
  {
    number: "01",
    title: "Analyze an invention",
    description: "From a technical document to a new perspective.",
    action: "Start an analysis",
    page: "New Analysis",
    theme: "cobalt",
    shape: "lens",
  },
  {
    number: "02",
    title: "Explore patents",
    description: "Find the ideas that came before your next one.",
    action: "Explore the evidence",
    page: "Patent Search",
    theme: "emerald",
    shape: "layers",
  },
  {
    number: "03",
    title: "Competitor intelligence",
    description: "See who’s working at the edge of your field.",
    action: "Discover the landscape",
    page: "Competitor Intelligence",
    theme: "amber",
    shape: "torus",
  },
  {
    number: "04",
    title: "Physical inventions",
    description: "Machine parts, mechanisms and assemblies.",
    action: "Open the physical module",
    page: "Physical Analysis",
    theme: "violet",
    shape: "orbit",
  },
];
function Sculpture({ shape }: { shape: string }) {
  return (
    <div className={"patent-drawing drawing-" + shape} aria-hidden="true">
      <span className="drawing-axis horizontal" />
      <span className="drawing-axis vertical" />
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="drawing-element"
          style={{ "--i": i } as React.CSSProperties}
        />
      ))}
      <span className="drawing-label">
        FIG.{" "}
        {shape === "lens"
          ? "01"
          : shape === "layers"
            ? "02"
            : shape === "torus"
              ? "03"
              : "04"}
      </span>
      <span className="drawing-coordinate">PR / RESEARCH SYSTEM</span>
    </div>
  );
}
export function Home({
  go,
  demo,
  busy,
}: {
  go: (page: string) => void;
  demo: () => void;
  busy: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <>
      <section className="home-intro">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="intro-label">
            <span className="live-dot" /> A NEW PERSPECTIVE ON PATENT
            INTELLIGENCE
          </div>
          <h1>
            Understand the evidence.
            <br />
            <span>Build what comes next.</span>
          </h1>
          <p>
            Patent evidence for software, processes, biotech and physical
            inventions.
            <br className="mobile-break" /> More clarity for your next
            breakthrough — with measured 3D reconstruction when geometry is
            provided.
          </p>
          <div className="intro-actions">
            <a className="quiet-button" href="/engineering">
              Try 3D Studio <ArrowUpRight size={14} />
            </a>
            <button className="quiet-button" disabled={busy} onClick={demo}>
              Research a real patent <ArrowUpRight size={14} />
            </button>
            <span>
              Live EPO + literature search · Shares public technical keywords
            </span>
          </div>
        </motion.div>
      </section>
      <section className="experience-section" aria-label="Explore FormaProof">
        <div className="gallery-heading">
          <span>FOUR WAYS TO SEE FURTHER</span>
          <span>
            Built for curious minds <span className="tiny-arrow">↘</span>
          </span>
        </div>
        <div className="experience-gallery">
          {experiences.map((item, i) => (
            <motion.button
              className={"experience-card " + item.theme}
              key={item.theme}
              onClick={() => go(item.page)}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 * i }}
              whileHover={reduce ? {} : { y: -6 }}
              whileTap={reduce ? {} : { scale: 0.99 }}
            >
              <div className="card-grain" />
              <div className="experience-top">
                <span>{item.number} / PATENTRADAR</span>
                <span className="card-arrow">
                  <ArrowUpRight size={17} strokeWidth={1.4} />
                </span>
              </div>
              <Sculpture shape={item.shape} />
              <div className="experience-copy">
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <span className="experience-cta">
                  {item.action}
                  <ArrowRight size={14} />
                </span>
              </div>
            </motion.button>
          ))}
        </div>
        <div className="gallery-foot">
          <span>Purpose-built for the people building what’s next.</span>
          <span>Evidence-led. Human-reviewed.</span>
        </div>
      </section>
      <section className="perspective">
        <div className="perspective-copy">
          <span className="section-kicker">LESS NOISE. MORE PERSPECTIVE.</span>
          <h2>
            Every breakthrough
            <br />
            starts with a connection.
          </h2>
          <p>
            A feature. A claim. An unexpected overlap.
            <br />
            Bring your technical thinking into focus with
            <br className="desktop-break" /> evidence you can trace back to its
            source.
          </p>
          <button className="quiet-button" onClick={() => go("New Analysis")}>
            Follow your next idea <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="evidence-flow">
          <span className="section-kicker">ONE RESEARCH WORKFLOW</span>
          {[
            {
              n: "01",
              title: "Describe the invention",
              detail:
                "Software, a process, a formulation or a physical system.",
            },
            {
              n: "02",
              title: "Find patent evidence",
              detail: "Search public records and inspect available claims.",
            },
            {
              n: "03",
              title: "Compare and investigate",
              detail:
                "Review technical overlap, applicants and original sources.",
            },
          ].map((step) => (
            <div key={step.n}>
              <span>{step.n}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="trust-strip">
        <div>
          <span className="trust-dot" /> Clarity, with context.
        </div>
        <p>
          Traceable sources. Visible limitations. Your expertise at the center.
        </p>
        <button className="quiet-button" onClick={() => go("API Providers")}>
          Meet the sources <ArrowUpRight size={14} />
        </button>
      </section>
    </>
  );
}
