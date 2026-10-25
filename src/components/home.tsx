"use client";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brand";
const experiences = [
  {
    number: "01",
    title: "Analyze an invention",
    description: "Start with your manual, technical description or engineering brief.",
    action: "Start an analysis",
    page: "New Analysis",
    theme: "cobalt",
    shape: "lens",
  },
  {
    number: "02",
    title: "Explore patents",
    description: "Compare your design with existing technologies and trace the evidence.",
    action: "Explore the evidence",
    page: "Patent Search",
    theme: "emerald",
    shape: "layers",
  },
  {
    number: "03",
    title: "Competitor intelligence",
    description: "Investigate relevant applicants and the technologies they publish.",
    action: "Discover the landscape",
    page: "Competitor Intelligence",
    theme: "amber",
    shape: "torus",
  },
  {
    number: "04",
    title: "Physical inventions",
    description: "Describe parts and relationships, or reconstruct measured geometry in the studio.",
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
            <span className="live-dot" /> DOCUMENT → SYSTEM → DESIGN → EVIDENCE
          </div>
          <h1>
            Start with what you have.
            <br />
            <span>Explore what you could build.</span>
          </h1>
          <p>
            Bring your technical PDF, drawing or manual. Review the system,
            explore measured 3D parts and investigate patent evidence.
            <br className="mobile-break" /> Modify your design, then investigate again.
          </p>
          <div className="intro-actions">
            <a className="quiet-button" href="/engineering">
              Upload a technical document <ArrowUpRight size={14} />
            </a>
            <button className="quiet-button" disabled={busy} onClick={demo}>
              Research a real patent <ArrowUpRight size={14} />
            </button>
            <span>
              Measured CAD on your device · External research only after consent
            </span>
          </div>
        </motion.div>
      </section>
      <section className="experience-section" aria-label="Explore Format Proof">
        <div className="gallery-heading">
          <span>YOUR DOCUMENTS. YOUR NEXT DESIGN.</span>
          <span>
            Engineering, connected <span className="tiny-arrow">↘</span>
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
                <span>{item.number} / {BRAND.name.toUpperCase()}</span>
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
          <span>From the document you already have to the design you can question.</span>
          <span>Evidence-led. Human-reviewed.</span>
        </div>
      </section>
      <section className="perspective">
        <div className="perspective-copy">
          <span className="section-kicker">UNDERSTAND. MODEL. INVESTIGATE. ITERATE.</span>
          <h2>
            One system.
            <br />
            New possibilities.
          </h2>
          <p>
            Start with the documents on your desk. Review the components,
            functions and available dimensions. Explore an editable assembly,
            investigate relevant patents, then return to the design.
            Each step keeps the evidence and uncertainty visible.
          </p>
          <a className="quiet-button" href="/engineering">
            Open your engineering workspace <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="evidence-flow">
          <span className="section-kicker">ONE RESEARCH WORKFLOW</span>
          {[
            {
              n: "01",
              title: "Bring your existing documents",
              detail: "A PDF, technical drawing, manual or measured specification.",
            },
            {
              n: "02",
              title: "Understand the system",
              detail: "Review components, functions, geometry and connections. Confirm what is known and what is missing.",
            },
            {
              n: "03",
              title: "Explore an editable 3D model",
              detail: "Build from available measurements. Inspect, arrange and modify supported parts.",
            },
            {
              n: "04",
              title: "Investigate patent evidence",
              detail: "Review search concepts, find similar technologies and inspect source passages and available claims.",
            },
            {
              n: "05",
              title: "Iterate the design",
              detail: "Return to your assembly, explore a different design and launch a fresh analysis.",
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
