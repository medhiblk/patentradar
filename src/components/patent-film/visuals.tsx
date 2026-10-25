import {
  ArrowRight,
  Bell,
  Check,
  FileText,
  Radar,
  Search,
  Sparkles,
} from "lucide-react";
import { progress } from "./timeline";

function Blueprint({ angle = 0 }: { angle?: number }) {
  return (
    <svg className="pf-blueprint" viewBox="0 0 480 360" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        transform={`translate(240 180) rotate(${angle}) translate(-240 -180)`}
      >
        <path
          d="M80 223 233 306 407 207 254 125Z M80 223v16l153 83 174-99v-16 M233 306v16"
          fill="#153b5555"
        />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <path
            key={i}
            d={`M${112 + i * 17} ${194 - i * 9}v-62l128 69v62 M${112 + i * 17} ${132 - i * 9}l36-21 128 69-36 21`}
            fill="#0b253b88"
          />
        ))}
        <ellipse cx="258" cy="145" rx="60" ry="32" fill="#163c4d" />
        <ellipse cx="258" cy="134" rx="60" ry="32" fill="#0b1c30" />
        <ellipse cx="258" cy="134" rx="18" ry="10" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path
            key={i}
            d="M258 124 Q216 98 218 127 Q224 144 246 138"
            transform={`rotate(${i * 60} 258 134)`}
          />
        ))}
        <path
          d="M60 253 220 340 M252 339 431 237 M79 105 79 209 M338 74 338 116 M71 108h16 M330 78h16"
          strokeDasharray="3 5"
          opacity=".55"
        />
        <path
          d="M283 104 350 50h65 M124 168 60 145H16 M353 236 417 270h48"
          opacity=".5"
        />
        <g
          fill="currentColor"
          stroke="none"
          fontSize="9"
          fontFamily="monospace"
        >
          <text x="351" y="44">
            01 / ROTOR
          </text>
          <text x="16" y="137">
            02 / FINS
          </text>
          <text x="402" y="287">
            03 / BASE
          </text>
          <text x="122" y="316">
            THERMAL ASSEMBLY
          </text>
        </g>
      </g>
    </svg>
  );
}
function PatentCloud({ time, resolved }: { time: number; resolved: boolean }) {
  return (
    <div className="pf-cloud">
      <div className="pf-orbit pf-orbit-one" />
      <div className="pf-orbit pf-orbit-two" />
      {Array.from({ length: 14 }, (_, i) => {
        const angle = i * 2.399;
        const radius = 24 + (i % 3) * 10;
        return (
          <div
            className="pf-patent-fragment"
            key={i}
            style={{
              left: `${50 + Math.cos(angle) * radius}%`,
              top: `${48 + Math.sin(angle) * radius}%`,
              opacity: resolved
                ? i % 4 === 0
                  ? 0.65
                  : 0
                : 0.18 + progress(time, i * 0.25, 2) * 0.5,
              transform: `translate(-50%, -50%) rotate(${Math.sin(angle) * 14}deg) scale(${resolved ? 0.8 : 1})`,
            }}
          >
            <FileText size={12} />
            <span>
              {["EP", "US", "WO", "JP"][i % 4]} · DEMO{" "}
              {String(i + 1).padStart(3, "0")}
            </span>
            <i />
            <i />
            <svg viewBox="0 0 80 35">
              <path d="M8 22 36 8 69 20 40 33Z M36 8v12l33 0 M18 26v-12" />
            </svg>
          </div>
        );
      })}
      <div className="pf-model">
        <Blueprint angle={Math.sin(time / 5) * 7} />
      </div>
      {resolved && (
        <div
          className="pf-signal"
          style={{
            transform: `translate(-50%,-50%) scale(${0.3 + progress(time, 0, 6) * 2})`,
            opacity: 1 - progress(time, 0, 7),
          }}
        />
      )}
      {resolved && (
        <div
          className="pf-logo-reveal"
          style={{ opacity: progress(time, 1, 2) }}
        >
          <Radar size={32} />
          <strong>PatentRadar</strong>
          <span>Clarity, by design.</span>
        </div>
      )}
    </div>
  );
}
function Invention({ time }: { time: number }) {
  const text = "A new cooling mechanism for industrial machinery.";
  return (
    <div className="pf-product-window">
      <div className="pf-window-bar">
        <Radar size={16} />
        <span>PatentRadar</span>
        <span className="pf-window-route">/ New analysis</span>
      </div>
      <div className="pf-window-body">
        <span className="pf-eyebrow">YOUR NEXT BREAKTHROUGH</span>
        <h3>What are you working on?</h3>
        <div className="pf-input">
          {text.slice(0, Math.floor(progress(time, 0.4, 2.6) * text.length))}
          <span className="pf-cursor">|</span>
        </div>
        <div
          className="pf-upload"
          style={{ opacity: progress(time, 2.4, 0.6) }}
        >
          <FileText size={24} />
          <div>
            <strong>Cooling-system-spec.pdf</strong>
            <span>Technical document · illustrative</span>
          </div>
          <Check size={16} />
        </div>
        <div className="pf-seeds" style={{ opacity: progress(time, 3.5, 0.6) }}>
          <span>Competitor: Acme Thermal (demo)</span>
          <span>Known patent: EP-DEMO-001</span>
        </div>
        <div className="pf-concepts" style={{ opacity: progress(time, 5, 1) }}>
          <span>
            <Sparkles size={13} /> Technical concepts
          </span>
          <div>
            <b>Heat exchange</b>
            <b>Adaptive airflow</b>
            <b>Rotor cooling</b>
          </div>
        </div>
        <div className="pf-strategy" style={{ opacity: progress(time, 7, 1) }}>
          <Search size={15} />
          <span>
            Idea <ArrowRight size={12} /> Concepts <ArrowRight size={12} />{" "}
            Search strategy
          </span>
          <Check size={14} />
        </div>
      </div>
    </div>
  );
}
function Discovery({ time }: { time: number }) {
  const nodes = Array.from({ length: 26 }, (_, i) => ({
    x: 250 + Math.cos(i * 2.4) * (62 + (i % 4) * 32),
    y: 118 + Math.sin(i * 2.4) * (38 + (i % 3) * 20),
  }));
  return (
    <div className="pf-discovery">
      <svg viewBox="0 0 500 235" className="pf-network" aria-hidden="true">
        <g fill="none" stroke="#4b718f" opacity=".3">
          <ellipse cx="250" cy="118" rx="195" ry="96" />
          {[60, 120, 180].map((r) => (
            <ellipse key={r} cx="250" cy="118" rx={r} ry="96" />
          ))}
          {[70, 118, 166].map((y) => (
            <path key={y} d={`M60 ${y}h380`} />
          ))}
        </g>
        <g stroke="#55d9ed">
          {nodes.map((n, i) => (
            <line
              key={i}
              x1="250"
              y1="118"
              x2={n.x}
              y2={n.y}
              opacity={progress(time, i * 0.12, 2) * 0.3}
            />
          ))}
        </g>
        {nodes.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={i % 4 === 0 ? 4 : 2}
            fill={i % 3 === 0 ? "#b1a1ff" : "#77e3f2"}
            opacity={0.25 + progress(time, i * 0.15, 2) * 0.75}
          />
        ))}
        <circle cx="250" cy="118" r="7" fill="#b6f5ff" />
        <g fill="#a6bace" fontSize="10" fontFamily="monospace">
          <text x="80" y="49">
            US
          </text>
          <text x="270" y="30">
            EP
          </text>
          <text x="408" y="118">
            JP
          </text>
          <text x="180" y="221">
            WO
          </text>
        </g>
      </svg>
      <div className="pf-query">
        <Search size={13} />
        <span>thermal regulation ↔ refroidissement ↔ 冷却</span>
      </div>
      <div className="pf-result-stack">
        {[
          [
            "EP-DEMO-001",
            "Adaptive cooling assembly",
            "Acme Thermal · EP · 2024-04-18",
            "Strong concept overlap",
          ],
          [
            "US-DEMO-002",
            "Variable-flow heat exchanger",
            "Northstar Systems · US · 2023-09-07",
            "Related mechanism",
          ],
        ].map(([id, title, meta, score], i) => (
          <div
            className="pf-result"
            key={id}
            style={{
              opacity: progress(time, 3 + i * 1.5, 1),
              transform: `translateY(${(1 - progress(time, 3 + i * 1.5, 1)) * 12}px)`,
            }}
          >
            <FileText size={21} />
            <div>
              <span>{id} · ILLUSTRATIVE</span>
              <strong>{title}</strong>
              <small>{meta}</small>
            </div>
            <b>{score}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
function Comparison({ time }: { time: number }) {
  return (
    <div className="pf-comparison">
      <div className="pf-compare-heading">
        <span>
          <span className="pf-status-dot" /> Technical overlap detected
        </span>
        <small>REVIEW RECOMMENDED</small>
      </div>
      <div className="pf-compare-columns">
        <article>
          <span className="pf-eyebrow">YOUR INVENTION</span>
          <Blueprint />
          <h3>Adaptive cooling</h3>
          <p>
            Adjusts airflow based on <mark>operating temperature</mark>.
          </p>
        </article>
        <article>
          <span className="pf-eyebrow">SIMILAR PATENT · DEMO</span>
          <div className="pf-claim-lines">
            <i />
            <i />
            <i />
          </div>
          <h3>Relevant claims</h3>
          <p style={{ opacity: 0.4 + progress(time, 1, 2) * 0.6 }}>
            “A controller configured to <mark>vary cooling flow</mark> in
            response to a temperature signal…”
          </p>
          <span className="pf-source">
            Illustrative claim · not patent evidence
          </span>
        </article>
      </div>
      <div className="pf-evidence" style={{ opacity: progress(time, 3, 1) }}>
        <span>01</span>
        <div>
          <strong>Comparable feature</strong>
          <p>Temperature-responsive flow control</p>
        </div>
        <ArrowRight size={20} />
        <span>Claim 1</span>
      </div>
      <div className="pf-review" style={{ opacity: progress(time, 5, 1) }}>
        <Search size={16} />
        <span>Inspect source evidence before drawing conclusions.</span>
      </div>
    </div>
  );
}
function Monitoring({ time }: { time: number }) {
  return (
    <div className="pf-monitor">
      <div className="pf-monitor-top">
        <Radar size={23} />
        <div>
          <h3>Your technology landscape</h3>
          <span>Cooling systems / Monitoring preview</span>
        </div>
        <span className="pf-live">WATCHING</span>
      </div>
      <div className="pf-chart">
        <svg viewBox="0 0 450 125" aria-hidden="true">
          <path d="M0 105H450 M0 65H450 M0 25H450" stroke="#24364b" />
          <path
            d="M0 100 45 87 90 92 135 62 180 70 225 42 270 53 315 20 360 32 405 12 450 19"
            fill="none"
            stroke="#79dce8"
            strokeWidth="2"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - progress(time, 0, 3)}
          />
          {[90, 225, 360].map((x, i) => (
            <circle key={x} cx={x} cy={[92, 42, 32][i]} r="5" fill="#a89aff" />
          ))}
        </svg>
        <div>
          <span>MON</span>
          <span>TUE</span>
          <span>WED</span>
          <span>THU</span>
          <span>FRI</span>
        </div>
      </div>
      <div className="pf-tracking">
        <span>
          Acme Thermal <b>Competitor</b>
        </span>
        <span>
          Heat exchange <b>Technology</b>
        </span>
      </div>
      <div
        className="pf-alert"
        style={{
          opacity: progress(time, 2.5, 0.8),
          transform: `translateY(${(1 - progress(time, 2.5, 0.8)) * 15}px)`,
        }}
      >
        <Bell size={22} />
        <div>
          <strong>A new publication worth exploring.</strong>
          <span>Your personalized patent update is ready.</span>
        </div>
        <span>DEMO</span>
      </div>
    </div>
  );
}
export function FilmVisual({
  scene,
  time,
  explore,
}: {
  scene: number;
  time: number;
  explore: () => void;
}) {
  if (scene < 2) return <PatentCloud time={time} resolved={scene === 1} />;
  if (scene === 2) return <Invention time={time} />;
  if (scene === 3) return <Discovery time={time} />;
  if (scene === 4) return <Comparison time={time} />;
  if (scene === 5) return <Monitoring time={time} />;
  return (
    <div className="pf-finale">
      <div
        className="pf-final-radar"
        style={{ transform: `rotate(${time * 8}deg)` }}
      />
      <Radar size={62} strokeWidth={1} />
      <strong>PatentRadar</strong>
      <span>Intelligence for what comes next.</span>
      <button type="button" onClick={explore}>
        Explore PatentRadar <ArrowRight size={16} />
      </button>
    </div>
  );
}
