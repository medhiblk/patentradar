"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Captions,
  Pause,
  Play,
  Radar,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import narrationManifest from "../../../public/patent-film/narration.json";
import { clampTime, duration, sceneAt, scenes, timecode } from "./timeline";
import { FilmVisual } from "./visuals";
import { FilmSound } from "./sound";
import "./patent-film.css";

const manifest: {
  available: boolean;
  src: string | null;
  cues?: { start: number; end: number; text: string }[];
} = narrationManifest;

export function PatentFilm({ explore }: { explore: () => void }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [revision, setRevision] = useState(0);
  const failedAudio = useRef(false);
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLElement>(null);
  const currentTime = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const score = useRef<FilmSound | null>(null);
  const started = useRef(false);
  const speechOwned = useRef(false);
  const index = sceneAt(time);
  const scene = scenes[index];
  const caption =
    sound && manifest.available && manifest.cues
      ? manifest.cues.find((cue) => time >= cue.start && time < cue.end)
          ?.text || ""
      : scene.narration;

  function cancelSpeech() {
    if (speechOwned.current && "speechSynthesis" in window)
      window.speechSynthesis.cancel();
    speechOwned.current = false;
  }
  function seek(next: number) {
    currentTime.current = clampTime(next);
    setTime(currentTime.current);
    if (audio.current) audio.current.currentTime = currentTime.current;
    cancelSpeech();
    setRevision((value) => value + 1);
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
      audio.current?.pause();
      cancelSpeech();
      score.current?.close();
      score.current = null;
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
      // Generated narration is the master clock; buffering never desynchronizes visuals.
      const next =
        sound && audio.current
          ? audio.current.currentTime
          : currentTime.current + delta;
      currentTime.current = clampTime(next);
      if (now - lastPaint >= 16 || next >= duration) {
        setTime(currentTime.current);
        lastPaint = now;
      }
      if (next >= duration || (sound && audio.current?.ended)) {
        currentTime.current = duration;
        setTime(duration);
        setPlaying(false);
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, sound]);

  useEffect(() => {
    score.current?.active(playing && sound);
    const element = audio.current;
    if (element) {
      element.muted = !sound;
      if (playing && sound)
        void element.play().catch(() => {
          setPlaying(false);
          setSound(false);
          setNotice(
            "Audio could not play. Try Enable sound again, or use captions.",
          );
        });
      else element.pause();
    }
    if (!playing || !sound) cancelSpeech();
  }, [playing, sound]);

  useEffect(() => {
    if (!playing || !sound) return;
    score.current?.cue(index === scenes.length - 1);
    if (audio.current || !("speechSynthesis" in window)) return;
    // Temporary browser narration uses chapter-level cues; voice duration varies by device.
    const utterance = new SpeechSynthesisUtterance(scenes[index].narration);
    utterance.lang = "en-US";
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find((v) => /^en[-_]US/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      null;
    utterance.rate = 1.08;
    utterance.onerror = (event) => {
      if (event.error !== "canceled" && event.error !== "interrupted") {
        setNotice("Browser voice unavailable · use captions or the transcript");
      }
    };
    speechOwned.current = true;
    window.speechSynthesis.speak(utterance);
    return cancelSpeech;
  }, [index, playing, sound, revision]);

  function togglePlay() {
    if (!playing && time >= duration) seek(0);
    // Restart the current chapter on browser-voice resume, avoiding clipped sentences.
    else if (!playing && sound && !audio.current) seek(scene.start);
    void score.current?.resume().catch(() => {});
    setPlaying(!playing);
  }
  function enableSound() {
    if (sound) {
      setSound(false);
      return;
    }
    try {
      if (!score.current && "AudioContext" in window)
        score.current = new FilmSound();
      void score.current?.resume().catch(() => {});
      if (
        manifest.available &&
        manifest.src &&
        !audio.current &&
        !failedAudio.current
      ) {
        const element = new Audio(manifest.src);
        element.preload = "auto";
        element.onerror = () => {
          failedAudio.current = true;
          audio.current = null;
          setSound(false);
          setPlaying(false);
          setNotice(
            "Narration is unavailable. Enable sound again for a browser voice preview.",
          );
        };
        audio.current = element;
      }
      seek(0);
      setSound(true);
      setPlaying(true);
      setNotice(
        audio.current
          ? "AI-generated narration"
          : "speechSynthesis" in window
            ? "Browser voice preview · chapter timing may vary"
            : "Voice unavailable in this browser · captions and soundscape enabled",
      );
    } catch {
      setSound(false);
      setNotice(
        "Sound is unavailable in this browser. The full transcript is below.",
      );
    }
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
          {captions ? caption : ""}
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
              void score.current?.resume().catch(() => {});
            }}
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            onClick={enableSound}
            className="pf-sound"
            aria-pressed={sound}
          >
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>{sound ? "Mute" : "Enable sound"}</span>
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
        <span role="status">
          {notice ||
            (manifest.available
              ? "AI-generated narration · sound off by default"
              : "Browser voice preview available · studio narration pending")}
        </span>
      </div>
      <details className="pf-transcript">
        <summary>Read the film transcript</summary>
        <ol>
          {scenes.map((item) => (
            <li key={item.start}>
              <strong>
                {timecode(item.start)} — {item.label}
              </strong>
              <p>{item.narration}</p>
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
