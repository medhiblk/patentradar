"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Box,
  FileText,
  Pause,
  Play,
  ScanLine,
  Search,
} from "lucide-react";
const scenes = [
  {
    title: "Bring the document",
    detail: "A measured specification is the starting point.",
    icon: FileText,
  },
  {
    title: "Review the parts",
    detail: "Check the dimensions found in the source.",
    icon: ScanLine,
  },
  {
    title: "Explore the design",
    detail: "Adjust the part, then export to your next tool.",
    icon: Box,
  },
  {
    title: "Investigate the evidence",
    detail: "Review concepts before sharing search queries.",
    icon: Search,
  },
] as const;
export function ProductTour() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [preference, setPreference] = useState<boolean | null>(null);
  const playing = preference ?? !reduce;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      if (!document.hidden) setStep((value) => (value + 1) % scenes.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [playing]);
  const scene = scenes[step];
  const Icon = scene.icon;
  return (
    <section className="product-tour" aria-label="Animated product walkthrough">
      <div className="tour-topbar">
        <span className="tour-window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>FormaProof / The workflow</span>
        <small>ILLUSTRATED PREVIEW</small>
      </div>
      <div className="tour-screen">
        <div className="tour-caption">
          <span className="product-kicker">0{step + 1} / THE NEXT STEP</span>
          <h2>{scene.title}</h2>
          <p>{scene.detail}</p>
        </div>
        <div
          className="tour-visual"
          role="img"
          aria-label={scene.title + ": animated example illustration"}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="tour-scene"
              key={step}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: reduce ? 0 : 0.3 }}
            >
              {step === 0 && (
                <div className="tour-document">
                  <FileText size={25} strokeWidth={1.2} />
                  <strong>Mounting plate</strong>
                  <span>Technical specification</span>
                  <div className="tour-document-lines">
                    <i />
                    <i />
                    <i />
                  </div>
                  <svg viewBox="0 0 220 115" aria-hidden="true">
                    <path d="M38 55 105 20 183 52 117 91Z M38 55v11l79 36 66-39V52 M117 91v11" />
                    <path
                      d="M30 81 106 116 M196 68 130 107"
                      strokeDasharray="3 3"
                    />
                    <text x="57" y="105">
                      80 mm
                    </text>
                    <text x="156" y="98">
                      50 mm
                    </text>
                  </svg>
                  <small>Synthetic measured source · PDF</small>
                </div>
              )}
              {step === 1 && (
                <div className="tour-features">
                  <div className="tour-feature-heading">
                    <Icon size={18} />
                    <strong>Base plate</strong>
                    <span>01 PART</span>
                  </div>
                  {[
                    ["Length", "80 mm"],
                    ["Width", "50 mm"],
                    ["Height", "6 mm"],
                  ].map(([label, value], index) => (
                    <motion.div
                      className="tour-measurement"
                      key={label}
                      initial={reduce ? false : { opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: reduce ? 0 : index * 0.12 }}
                    >
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </motion.div>
                  ))}
                  <small>Review measurements before building</small>
                </div>
              )}
              {step === 2 && (
                <div className="tour-model">
                  <div className="tour-grid" />
                  <motion.div
                    className="tour-model-plate"
                    animate={
                      playing && !reduce
                        ? { rotate: [-4, 4, -4], y: [0, -8, 0] }
                        : { rotate: -4, y: 0 }
                    }
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <span className="tour-dimension">
                    width <strong>50 → 55 mm</strong>
                  </span>
                  <div className="tour-export">
                    <span>Editable parameters</span>
                    <span>
                      STEP <ArrowRight size={10} /> STL
                    </span>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="tour-evidence">
                  <div>
                    <Search size={17} />
                    <strong>mounting plate · mechanical support</strong>
                  </div>
                  <p>Review search concepts</p>
                  <ul>
                    <li>Inspect original sources</li>
                    <li>Compare technical passages</li>
                    <li>Return to adjust the design</li>
                  </ul>
                  <small>Research starts only after your consent</small>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="tour-controls">
        <button
          type="button"
          onClick={() => setPreference(!playing)}
          aria-label={playing ? "Pause walkthrough" : "Play walkthrough"}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <nav aria-label="Walkthrough steps">
          {scenes.map((item, index) => (
            <button
              type="button"
              key={item.title}
              aria-label={item.title}
              aria-current={index === step ? "step" : undefined}
              onClick={() => {
                setStep(index);
                setPreference(false);
              }}
            >
              <span />
              {index + 1}
            </button>
          ))}
        </nav>
        <span>
          {step + 1} / {scenes.length}
        </span>
      </div>
      <p className="tour-disclosure">
        Motion preview of the workflow. Open the preloaded example below to
        generate and edit actual CAD geometry.
      </p>
    </section>
  );
}
