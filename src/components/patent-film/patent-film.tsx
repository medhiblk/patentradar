"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Captions,
  Pause,
  Play,
  Radar,
  RotateCcw,
} from "lucide-react";
import { clampTime, duration, sceneAt, scenes, timecode } from "./timeline";
import { FilmVisual } from "./visuals";
import "./patent-film.css";

export function PatentFilm({ explore }: { explore: () => void }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLElement>(null);
  const currentTime = useRef(0);
  const started = useRef(false);
  const index = sceneAt(time);
  const scene = scenes[index];
  function seek(next: number) {
    currentTime.current = clampTime(next);
    setTime(currentTime.current);
  }

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const preference = () => {
      setReduced(media.matches);
      if (media.matches) setPlaying(false);
    };
    const frame = requestAnimationFrame(preference);
    media.addEventListener("change", preference);
    const visibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) setPlaying(false);
        else if (!started.current) {
          started.current = true;
          if (
            !media.matches &&
            !connection?.saveData &&
            !/2g/.test(connection?.effectiveType || "")
          )
            setPlaying(true);
        }
      },
      { threshold: 0.15 },
    );
    if (root.current) observer.observe(root.current);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", visibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    let lastPaint = 0;
    const tick = (now: number) => {
      const delta = Math.min((now - previous) / 1000, 0.2);
      previous = now;
      const next = currentTime.current + delta;
      currentTime.current = clampTime(next);
      if (now - lastPaint >= 16 || next >= duration) {
        setTime(currentTime.current);
        lastPaint = now;
      }
      if (next >= duration) {
        currentTime.current = duration;
        setTime(duration);
        setPlaying(false);
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  function togglePlay() {
    if (!playing && time >= duration) seek(0);
    setPlaying(!playing);
  }

  return (
    <section
      ref={root}
      className="patent-film"
      aria-label="PatentRadar product explainer"
      data-playing={playing}
    >
      <div className="pf-intro">
        <div>
          <span className="pf-eyebrow">
            <span className="pf-status-dot" /> INTRODUCING PATENTRADAR
          </span>
          <h2>
            Every breakthrough starts
            <br />
            with a clearer picture.
          </h2>
          <p>
            From your first idea to the evidence behind it.
            <br />
            Discover patent intelligence in 65 seconds.
          </p>
        </div>
        <button className="pf-primary" onClick={explore}>
          Research your invention <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="pf-theater">
        <div className="pf-topline">
          <span>
            <Radar size={15} /> PatentRadar <i>/</i> THE FILM
          </span>
          <span>ILLUSTRATIVE PRODUCT PREVIEW</span>
        </div>
        <div className="pf-stage" data-scene={index}>
          <div className="pf-scene-copy" key={`copy-${index}`}>
            <span className="pf-eyebrow">
              0{index + 1} <i>/</i> {scene.label.toUpperCase()}
            </span>
            <h3>{scene.title}</h3>
            <p>{scene.subtitle}</p>
            <span className="pf-scene-line" />
          </div>
          <div className="pf-visual" key={`visual-${index}`}>
            <FilmVisual
              scene={index}
              time={
                reduced ? scene.end - scene.start - 0.1 : time - scene.start
              }
              explore={explore}
            />
          </div>
        </div>
        <div className="pf-caption" aria-hidden={!captions}>
          {captions ? scene.caption : ""}
        </div>
        <div className="pf-controls">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause film" : "Play film"}
          >
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button
            type="button"
            aria-label="Replay film"
            onClick={() => {
              seek(0);
              setPlaying(true);
            }}
          >
            <RotateCcw size={16} />
          </button>
          <label className="pf-scrubber">
            <span className="pf-sr-only">Film position in seconds</span>
            <input
              type="range"
              min="0"
              max={duration}
              step=".1"
              value={time}
              aria-valuetext={`${timecode(time)} of 1:05, ${scene.label}`}
              onChange={(event) => {
                seek(Number(event.target.value));
                setPlaying(false);
              }}
            />
          </label>
          <span className="pf-time" aria-hidden="true">
            {timecode(time)} <i>/</i> 1:05
          </span>
          <button
            type="button"
            onClick={() => setCaptions(!captions)}
            aria-label="Show captions"
            aria-pressed={captions}
          >
            <Captions size={18} />
          </button>
        </div>
      </div>
      <nav className="pf-chapters" aria-label="Film chapters">
        {scenes.map((item, i) => (
          <button
            key={item.start}
            aria-current={index === i ? "step" : undefined}
            onClick={() => {
              seek(item.start);
              setPlaying(false);
            }}
          >
            <span>0{i + 1}</span>
            {item.label}
            <i
              style={{
                transform: `scaleX(${time >= item.end ? 1 : time < item.start ? 0 : (time - item.start) / (item.end - item.start)})`,
              }}
            />
          </button>
        ))}
      </nav>
      <div className="pf-notes">
        <span>
          Illustrative data throughout · Research guidance, not legal clearance.
        </span>
      </div>
      <details className="pf-transcript">
        <summary>Read the walkthrough</summary>
        <ol>
          {scenes.map((item) => (
            <li key={item.start}>
              <strong>
                {timecode(item.start)} — {item.label}
              </strong>
              <p>{item.caption}</p>
            </li>
          ))}
        </ol>
        <p>
          PatentRadar supports preliminary research. It does not provide legal
          clearance or replace a patent attorney. All example companies, claims
          and publication identifiers in this film are fictional.
        </p>
      </details>
    </section>
  );
}
