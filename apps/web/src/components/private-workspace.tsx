"use client";
import { safeJsonResponse } from "@/lib/safe-json-response";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { WorkspaceAuthForm } from "./workspace-auth-form";
import { clearPrivateSessionView } from "@/lib/private-session";
import { ReportSchema } from "@/lib/model";
import { SearchProvenance } from "./intelligence/search-provenance";
import { PatentEvidence } from "./intelligence/patent-evidence";
type Project = {
  id: string;
  kind: string;
  title: string;
  data: {
    description?: string;
    seedPublications?: { publicationNumber: string }[];
    _deleting?: boolean;
    similarityAlerts?: { publicationNumber: string; acknowledged: boolean }[];
    research?: unknown;
  };
};
type FileRow = {
  id: string;
  projectId: string;
  name: string;
  contentType: string;
  size: number;
  sha256: string;
  createdAt: string;
  status: string;
};
type Props = {
  allowPatentAnalysis?: boolean;
  pendingFile?: File | null;
  onUseFile?: (file: File, target: "analysis" | "cad") => void | Promise<void>;
  onAnalyze?: (project: {
    title: string;
    description: string;
    seedPublications: { publicationNumber: string }[];
  }) => void;
};
export async function loadPrivateFile(projectId: string, id: string) {
  const r = await fetch(
    `/api/attachments/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`,
    { cache: "no-store" },
  );
  if (!r.ok) {
    const d = await safeJsonResponse(r);
    throw Error(d.error || "Private file unavailable.");
  }
  return new File(
    [await r.blob()],
    decodeURIComponent(r.headers.get("X-Attachment-Name") || "document.pdf"),
    { type: r.headers.get("Content-Type") || "application/octet-stream" },
  );
}
export function PrivateWorkspace({
  pendingFile,
  onUseFile,
  onAnalyze,
  allowPatentAnalysis = true,
}: Props) {
  const router = useRouter();
  const [account, setAccount] = useState<{ email: string } | null>(null),
    [projects, setProjects] = useState<Project[]>([]),
    [selected, setSelected] = useState(""),
    [files, setFiles] = useState<FileRow[]>([]);
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [chosen, setChosen] = useState<File[]>(pendingFile ? [pendingFile] : []);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [backend, setBackend] = useState(""),
    [usage, setUsage] = useState({ bytes: 0, files: 0 });
  const project = projects.find((p) => p.id === selected);
  const parsedResearch = ReportSchema.safeParse(project?.data.research);
  const savedResearch = parsedResearch.success
    ? parsedResearch.data
    : undefined;
  async function json(url: string, body?: object | FormData, method?: string) {
    const r = await fetch(url, {
      method: method || (body ? "POST" : "GET"),
      cache: "no-store",
      ...(body instanceof FormData
        ? { body }
        : body
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
    });
    let d;
    try {
      d = await safeJsonResponse(r);
    } catch {
      throw Error(
        `Unexpected server response (HTTP ${r.status}). Retry; your selected files have been kept.`,
      );
    }
    if (!r.ok) throw Error(d.error || "Request failed");
    return d;
  }
  async function load(prefer?: string) {
    const d = await json("/api/vault");
    setAccount(d.user);
    setBackend(d.storage?.backend || "unavailable");
    const rows = (d.items || []).filter((p: Project) =>
      ["project", "assembly"].includes(p.kind),
    );
    setProjects(rows);
    setSelected((current) =>
      prefer && rows.some((p: Project) => p.id === prefer)
        ? prefer
        : rows.some((p: Project) => p.id === current)
          ? current
          : rows[0]?.id || "",
    );
    if (!d.user) {
      setFiles([]);
      setSelected("");
    }
  }
  async function loadFiles(id = selected) {
    if (!id) return;
    const d = await json(
      "/api/attachments?projectId=" + encodeURIComponent(id),
    );
    setFiles(d.files);
    setUsage(d.usage);
  }
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Private workspace unavailable",
      );
    } finally {
      setBusy("");
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/vault", { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const d = await safeJsonResponse(r);
        if (!r.ok) throw Error(d.error);
        return d;
      })
      .then((d) => {
        setAccount(d.user);
        setBackend(d.storage?.backend || "unavailable");
        const rows = (d.items || []).filter((p: Project) =>
          ["project", "assembly"].includes(p.kind),
        );
        setProjects(rows);
        const preferred = new URL(window.location.href).searchParams.get(
          "projectId",
        );
        setSelected(
          rows.some((row: Project) => row.id === preferred)
            ? preferred!
            : rows[0]?.id || "",
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    fetch("/api/attachments?projectId=" + encodeURIComponent(selected), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await safeJsonResponse(r);
        if (!r.ok) throw Error(d.error);
        return d;
      })
      .then((d) => {
        setFiles(d.files);
        setUsage(d.usage);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setFiles([]);
          setError(e.message);
        }
      });
    return () => controller.abort();
  }, [selected]);
  useEffect(() => {
    if (!pendingFile) return;
    const timer = setTimeout(() => setChosen([pendingFile]), 0);
    return () => clearTimeout(timer);
  }, [pendingFile]);
  async function openAttachment(f: FileRow, target: "analysis" | "cad") {
    if (onUseFile) {
      const file = await loadPrivateFile(selected, f.id);
      await onUseFile(file, target);
    } else {
      sessionStorage.setItem(
        "patentradar-private-file-handoff",
        JSON.stringify({ projectId: selected, id: f.id, target }),
      );
      router.push("/");
    }
  }
  return (
    <section
      className="panel private-workspace"
      aria-label="Private projects and attachments"
    >
      <div className="row between wrap">
        <div>
          <span className="eyebrow">YOUR PRIVATE ENGINEERING LIBRARY</span>
          <h2>Projects & attached documents</h2>
        </div>
        <a href="/files">Open file workspace ↗</a>
      </div>
      <p>
        Keep manuals, drawings and CAD files with your projects. Documents are
        private, persist after signing in again, and are only analyzed when you
        explicitly choose it.
      </p>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {busy && <p role="status">{busy}…</p>}
      {!account ? (
        <WorkspaceAuthForm
          disabledReason={
            backend === "unavailable"
              ? "Private cloud storage is unavailable. Please retry shortly."
              : undefined
          }
          onAuthenticated={() => load()}
        />
      ) : (
        <>
          <div className="row wrap">
            <p>
              Signed in as {account.email} ·{" "}
              {backend === "blob"
                ? "Private cloud storage"
                : "Private server storage"}
            </p>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                run("Signing out", async () => {
                  await json("/api/vault", { action: "logout" });
                  clearPrivateSessionView();
                  setTitle("");
                  setDescription("");
                  setFiles([]);
                  setUsage({ bytes: 0, files: 0 });
                  setChosen([]);
                  await load();
                  setNotice(
                    "Signed out. Files remain in your private account.",
                  );
                })
              }
            >
              Sign out of workspace
            </Button>
          </div>
          <div className="parts-form-grid">
            <label>
              Private project title
              <input
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional — defaults to your filename"
              />
            </label>
            <label>
              Private project description
              <textarea
                maxLength={40000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional technical notes"
              />
            </label>
          </div>
          <Button
            disabled={!!busy}
            onClick={() =>
              run("Creating project", async () => {
                const d = await json("/api/vault", {
                  action: "save",
                  kind: "project",
                  title:
                    title.trim() || chosen[0]?.name || "Engineering project",
                  data: { description, seedPublications: [] },
                });
                await load(d.id);
                setTitle("");
                setDescription("");
                setNotice("Private project saved. Add your documents below.");
              })
            }
          >
            Create private project
          </Button>
          <label>
            Project for attachments
            <select
              aria-label="Project for attachments"
              value={selected}
              onChange={(e) => {
                setFiles([]);
                setError("");
                setSelected(e.target.value);
              }}
            >
              <option value="">Select a private project</option>
              {projects.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.title}
                  {p.data._deleting ? " (deletion pending)" : ""}
                </option>
              ))}
            </select>
          </label>
          {project?.data.similarityAlerts?.length ? (
            <div className="project-alert-link">
              <strong>
                {project.data.similarityAlerts.length} similarity alert(s)
                attached to this project
              </strong>
              <a href="/alerts">Review patent alerts ↗</a>
            </div>
          ) : null}
          {savedResearch && (
            <details className="saved-research-evidence">
              <summary>
                Saved search &amp; evidence ({savedResearch.patents.length}{" "}
                patents)
              </summary>
              <SearchProvenance
                trace={savedResearch.searchTrace}
                patents={savedResearch.patents}
              />
              {savedResearch.patents.map((patent) => (
                <div className="panel" key={patent.publicationNumber}>
                  <h3>
                    {patent.publicationNumber} — {patent.title}
                  </h3>
                  <PatentEvidence
                    patent={patent}
                    profile={savedResearch.profile}
                    trace={savedResearch.searchTrace}
                  />
                </div>
              ))}
            </details>
          )}
          {project && (
            <div className="row wrap">
              {onAnalyze && project.data.description && (
                <Button
                  variant="outline"
                  disabled={!!busy || !!project.data._deleting}
                  onClick={() =>
                    onAnalyze({
                      title: project.title,
                      description: project.data.description || "",
                      seedPublications: project.data.seedPublications || [],
                    })
                  }
                >
                  Review saved invention
                </Button>
              )}
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() =>
                  run("Deleting project and attachments", async () => {
                    await json("/api/vault", {
                      action: "delete",
                      id: selected,
                    });
                    setFiles([]);
                    await load();
                    setNotice("Project and its attachments deleted.");
                  })
                }
              >
                Delete project & files
              </Button>
            </div>
          )}
          <div
            className="attachment-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (busy) return;
              setChosen(Array.from(e.dataTransfer.files));
            }}
          >
            <label>
              Project attachments
              <input
                aria-label="Project attachments"
                type="file"
                multiple
                disabled={!!busy}
                accept=".pdf,.png,.jpg,.jpeg,.step,.stp,.stl,.txt,.json"
                onChange={(e) => {
                  setChosen(Array.from(e.target.files || []));
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <p>
              Drop PDF, images, STEP/STL, TXT or JSON here. Up to 4 MB per file,
              20 per project, 50 files / 100 MB per account.
            </p>
            {chosen.length > 0 && (
              <p>{chosen.map((f) => f.name).join(" · ")}</p>
            )}
            <Button
              disabled={
                !!busy ||
                !selected ||
                !chosen.length ||
                !!project?.data._deleting
              }
              onClick={() =>
                run("Uploading private attachments", async () => {
                  let uploaded = 0;
                  try {
                    for (let i = 0; i < chosen.length; i++) {
                      const file = chosen[i];
                      if (file.size > 4 * 1024 * 1024)
                        throw Error(file.name + ": maximum 4 MB.");
                      setBusy(`Uploading ${i + 1} of ${chosen.length}`);
                      const form = new FormData();
                      form.set("projectId", selected);
                      form.set("file", file);
                      await json("/api/attachments", form);
                      uploaded++;
                    }
                  } finally {
                    setChosen(chosen.slice(uploaded));
                    await loadFiles();
                  }
                  setNotice(
                    "Attachments stored privately. No AI or patent search was started.",
                  );
                })
              }
            >
              Upload selected files privately
            </Button>
          </div>
          {selected && (
            <>
              <div className="row between wrap">
                <p>
                  {usage.files} / 50 files ·{" "}
                  {(usage.bytes / 1024 / 1024).toFixed(2)} / 100 MB used by
                  account attachments
                </p>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => run("Refreshing files", () => loadFiles())}
                >
                  Refresh stored files
                </Button>
              </div>
              {!files.length && <p>No attachments stored for this project.</p>}
              {files.map((f) => (
                <article className="attachment-row" key={f.id}>
                  <div>
                    <strong>{f.name}</strong>
                    <p>
                      {(f.size / 1024).toFixed(1)} KB ·{" "}
                      {new Date(f.createdAt).toLocaleString()} ·{" "}
                      {f.status === "ready"
                        ? "Stored privately"
                        : "Incomplete operation — retry deletion"}
                    </p>
                    <small>SHA-256: {f.sha256}</small>
                  </div>
                  <div className="row wrap">
                    {f.status === "ready" && (
                      <>
                        <a
                          className="link-button"
                          href={`/api/attachments/${f.id}?projectId=${selected}`}
                          download
                        >
                          Download {f.name}
                        </a>
                        {allowPatentAnalysis &&
                          /\.(pdf|txt)$/i.test(f.name) && (
                            <Button
                              variant="outline"
                              disabled={!!busy}
                              onClick={() =>
                                run("Loading private document", () =>
                                  openAttachment(f, "analysis"),
                                )
                              }
                            >
                              Use {f.name} for patent analysis
                            </Button>
                          )}
                        <Button
                          variant="outline"
                          disabled={!!busy}
                          onClick={() =>
                            run("Loading private engineering source", () =>
                              openAttachment(f, "cad"),
                            )
                          }
                        >
                          Use {f.name} in 3D Studio
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      disabled={!!busy}
                      onClick={() =>
                        run("Deleting attachment", async () => {
                          await json(
                            `/api/attachments/${f.id}?projectId=${selected}`,
                            undefined,
                            "DELETE",
                          );
                          await loadFiles();
                          setNotice("Attachment deleted.");
                        })
                      }
                    >
                      Delete {f.name}
                    </Button>
                  </div>
                </article>
              ))}
            </>
          )}
        </>
      )}
      <p className="hint">
        Original documents are retained until you delete them. Storing does not
        send them to OpenAI or public patent providers. AI processing remains a
        separate opt-in. Local drafts and private cloud projects are separate.
      </p>
    </section>
  );
}
