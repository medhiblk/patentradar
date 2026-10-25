"use client";
import { useRef, useState } from "react";
import type { Research } from "@/lib/model";
import { WorkspaceAuthForm } from "../workspace-auth-form";
class SignInRequired extends Error {}
export function ResearchPortfolioSave({
  research,
  description,
  document,
  onSaved,
}: {
  research: Research;
  description: string;
  document?: { url: string; name: string; sha256: string };
  onSaved?: (id: string) => void;
}) {
  const [showAuth, setShowAuth] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("");
  const project = useRef("");
  async function json(url: string, body?: object | FormData) {
    const response = await fetch(url, {
      cache: "no-store",
      ...(body
        ? {
            method: "POST",
            ...(body instanceof FormData
              ? { body }
              : {
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                }),
          }
        : {}),
    });
    const data = await response.json();
    if (response.status === 401) throw new SignInRequired();
    if (!response.ok) throw Error(data.error || "Unable to save the research.");
    return data;
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (!project.current) {
        const response = await json("/api/vault", {
          action: "save",
          kind: "project",
          title: research.profile.title.slice(0, 200),
          data: {
            description,
            research,
            seedPublications: research.patents.map((patent) => ({
              publicationNumber: patent.publicationNumber,
            })),
          },
        });
        project.current = response.id;
      }
      if (document) {
        const existing = await json(
          "/api/attachments?projectId=" + project.current,
        );
        if (
          !existing.files.some(
            (file: { sha256: string; status: string }) =>
              file.sha256 === document.sha256 && file.status === "ready",
          )
        ) {
          const response = await fetch(document.url, {
            signal: AbortSignal.timeout(20000),
          });
          if (!response.ok)
            throw Error(
              "The source excerpt could not be loaded. Your project is saved; retry to attach it.",
            );
          const form = new FormData();
          form.set("projectId", project.current);
          form.set(
            "file",
            new File([await response.blob()], document.name, {
              type: "application/pdf",
            }),
          );
          await json("/api/attachments", form);
        }
      }
      setSaved(project.current);
      setShowAuth(false);
      onSaved?.(project.current);
    } catch (e) {
      if (e instanceof SignInRequired) setShowAuth(true);
      else
        setError(e instanceof Error ? e.message : "Unable to save research.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="portfolio-save"
      aria-label="Save research to private portfolio"
    >
      <div>
        <strong>Keep the evidence with your project</strong>
        <p>
          Save this research{document ? " and the source PDF excerpt" : ""}{" "}
          privately. Similarity alerts are retained with the project.
        </p>
      </div>
      {saved ? (
        <p role="status">
          Saved to your private portfolio.{" "}
          <a href={"/files?projectId=" + saved}>Open project ↗</a> ·{" "}
          <a href="/alerts">View alerts ↗</a>
        </p>
      ) : (
        <button className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? "Saving project and evidence…" : "Save to private portfolio"}
        </button>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {showAuth && !saved && (
        <WorkspaceAuthForm
          onAuthenticated={async () => {
            await save();
          }}
        />
      )}
    </section>
  );
}
