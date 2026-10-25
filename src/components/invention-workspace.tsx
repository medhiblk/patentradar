"use client";
import { useState } from "react";
import { parseSeeds } from "@/lib/patent-seeds";
import { Button } from "./ui/button";
import { PrivateWorkspace } from "./private-workspace";
type Project = {
  id: string;
  title: string;
  description: string;
  seeds: string;
  updatedAt: string;
};
export function InventionWorkspace({
  onAnalyze,
  onUseFile,
}: {
  onAnalyze: (project: {
    title: string;
    description: string;
    seedPublications: { publicationNumber: string }[];
  }) => void;
  onUseFile?: (file: File, target: "analysis" | "cad") => void | Promise<void>;
}) {
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(
        localStorage.getItem("patentradar-projects-v1") || "[]",
      );
    } catch {
      return [];
    }
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [seeds, setSeeds] = useState("");
  const [error, setError] = useState("");
  function persist(next: Project[]) {
    try {
      localStorage.setItem("patentradar-projects-v1", JSON.stringify(next));
      setProjects(next);
      setError("");
    } catch {
      setError("Unable to save on this browser.");
    }
  }
  let references: ReturnType<typeof parseSeeds> = [];
  try {
    references = parseSeeds(seeds);
  } catch {}
  return (
    <>
      <PrivateWorkspace onAnalyze={onAnalyze} onUseFile={onUseFile} />
      <details>
        <summary>Device-only drafts (this browser)</summary>
        <section className="panel">
          <h2>
            Describe your invention. We’ll find the closest existing
            technologies.
          </h2>
          <p>
            Saved only in this browser. Other people using this browser can
            access these projects. No external transmission until you choose
            analysis and consent.
          </p>
          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="What does your invention do?"
            />
          </label>
          <details>
            <summary>Add a title and known patents</summary>
            <label>
              Invention title
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Known publication numbers — one per line
              <textarea
                value={seeds}
                onChange={(e) => setSeeds(e.target.value)}
                placeholder={"EP2345898B1\nCN102299288B"}
              />
            </label>
            <p>
              Reference links open Google Patents. Document availability is not
              verified; Google is not the source of your search results.
            </p>
            {references.map((p) => (
              <p key={p.publicationNumber}>
                <a href={p.referenceUrl} target="_blank" rel="noreferrer">
                  {p.publicationNumber} ↗
                </a>{" "}
                · {p.jurisdiction} · {p.kindCode || "Kind code unspecified"}
              </p>
            ))}
          </details>
          {error && <p role="alert">{error}</p>}
          <div className="row wrap">
            <Button
              disabled={description.trim().length < 30}
              onClick={() => {
                try {
                  onAnalyze({
                    title,
                    description,
                    seedPublications: parseSeeds(seeds).map((p) => ({
                      publicationNumber: p.publicationNumber,
                    })),
                  });
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Invalid seeds");
                }
              }}
            >
              Review technical features
            </Button>
            <Button
              variant="outline"
              disabled={!description.trim()}
              onClick={() => {
                try {
                  parseSeeds(seeds);
                  persist([
                    ...projects,
                    {
                      id: crypto.randomUUID(),
                      title: title.trim() || description.slice(0, 60),
                      description,
                      seeds,
                      updatedAt: new Date().toISOString(),
                    },
                  ]);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Invalid patent number",
                  );
                }
              }}
            >
              Save invention on this device
            </Button>
          </div>
          <Button
            variant="outline"
            disabled={!description.trim()}
            onClick={async () => {
              try {
                const seedPublications = parseSeeds(seeds).map((p) => ({
                  publicationNumber: p.publicationNumber,
                }));
                const r = await fetch("/api/vault", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "save",
                    kind: "project",
                    title: title || description.slice(0, 60),
                    data: { description, seedPublications },
                  }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
                setError("Saved privately to your signed-in account.");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Save failed");
              }
            }}
          >
            Save to private account
          </Button>
          <h3>My inventions</h3>
          {projects.length === 0 && <p>No saved projects yet.</p>}
          {projects.map((p) => (
            <article className="panel" key={p.id}>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <small>{new Date(p.updatedAt).toLocaleDateString()}</small>
              <div className="row wrap">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTitle(p.title);
                    setDescription(p.description);
                    setSeeds(p.seeds);
                  }}
                >
                  Open
                </Button>
                <Button
                  variant="outline"
                  onClick={() => persist(projects.filter((x) => x.id !== p.id))}
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </section>
      </details>
    </>
  );
}
