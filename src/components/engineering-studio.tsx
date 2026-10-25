"use client";
import { browserCAD, type ImportedSolid } from "@/lib/cad/browser";
import { mergeAssembly } from "@/lib/cad/workbench";
import { PartsWorkbench } from "./parts-workbench";
import { PrivateWorkspace } from "./private-workspace";
import { PRIVATE_SIGNOUT_EVENT } from "@/lib/private-session";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "./ui/button";
import {
  ComponentSchema,
  AssemblySchema,
  buildable,
  requiredDimensions,
  type AssemblySpec,
  type ComponentSpec,
} from "@/lib/cad/schema";
import type { MeshPart } from "./cad-viewer";
const Viewer = dynamic(() => import("./cad-viewer").then((m) => m.CADViewer), {
  ssr: false,
  loading: () => <div className="cad-canvas">Loading 3D workspace…</div>,
});
type Geometry = {
  parts: MeshPart[];
  step?: string;
  stl?: string;
  engine: string;
  fused?: boolean;
  exportVolume?: number;
};
const blank = (): ComponentSpec => ({
  id: crypto.randomUUID(),
  name: "New component",
  description: "User-defined primitive",
  shape: "box",
  dimensions: {
    length: null,
    width: null,
    height: null,
    diameter: null,
    innerDiameter: null,
  },
  material: "Not specified",
  sourcePage: 1,
  sourceQuote: "User-defined measurements",
  basis: "user-entered",
  connections: [],
  position: [0, 0, 0],
  rotation: [0, 0, 0],
});
export function EngineeringStudio({
  onPatentResearch,
  initialFile,
  onFileConsumed,
  restoreDraft = true,
  guidedNavigation = false,
}: {
  onPatentResearch: (text: string) => void;
  initialFile?: File | null;
  onFileConsumed?: () => void;
  restoreDraft?: boolean;
  guidedNavigation?: boolean;
}) {
  const studio = useRef<HTMLDivElement>(null);
  function guideTo(selector: string) {
    if (!guidedNavigation) return;
    requestAnimationFrame(() => {
      const target = studio.current?.querySelector<HTMLElement>(selector);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  }
  const [spec, setSpec] = useState<AssemblySpec>({
    title: "Untitled engineering assembly",
    components: [],
    limitations: [],
  });
  const [source, setSource] = useState({ name: "", hash: "" });
  const [pickerVersion, setPickerVersion] = useState(0);
  const [showPrivateFiles, setShowPrivateFiles] = useState(false);
  const [imports, setImports] = useState<Record<string, ImportedSolid>>({});
  const [appendDocument, setAppendDocument] = useState(true);
  const [file, setFile] = useState<File | null>(null),
    [text, setText] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [appliedSource, setAppliedSource] = useState<File | null>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null),
    [selected, setSelected] = useState(""),
    [hidden, setHidden] = useState<string[]>([]),
    [isolate, setIsolate] = useState(false),
    [explode, setExplode] = useState(0),
    [animate, setAnimate] = useState(false),
    [catalog, setCatalog] = useState<
      {
        id: string;
        title: string;
        kind: string;
        data: {
          component?: ComponentSpec;
          preview?: MeshPart;
          assembly?: AssemblySpec;
          source?: typeof source;
        };
      }[]
    >([]),
    [filter, setFilter] = useState(""),
    [dirty, setDirty] = useState(false);
  const component = spec.components.find((c) => c.id === selected);
  const meshInfo = geometry?.parts.find((p) => p.id === selected);
  useEffect(() => {
    const reset = () => {
      setFile(null);
      setAppliedSource(null);
      setText("");
      setSpec({
        title: "Untitled engineering assembly",
        components: [],
        limitations: [],
      });
      setSource({ name: "", hash: "" });
      setImports({});
      setGeometry(null);
      setCatalog([]);
      setSelected("");
      setPickerVersion((v) => v + 1);
      setNotice("Signed out. Open document and geometry views were cleared.");
    };
    window.addEventListener(PRIVATE_SIGNOUT_EVENT, reset);
    return () => window.removeEventListener(PRIVATE_SIGNOUT_EVENT, reset);
  }, []);
  useEffect(() => {
    if (!initialFile) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        if (/\.txt$/i.test(initialFile.name)) {
          const value = await initialFile.text();
          if (cancelled) return;
          setText(value);
          setFile(null);
        } else setFile(initialFile);
        setNotice(
          "Source loaded. Choose what to represent, then read the document. No external AI processing was started.",
        );
        setAppliedSource(initialFile);
      } catch {
        setError("Unable to read private source.");
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [initialFile]);
  // Notify after React has committed the selected source and enabled its action.
  // Calling inside the loader timer can try to focus a still-disabled button.
  useEffect(() => {
    if (appliedSource && appliedSource === initialFile) onFileConsumed?.();
  }, [appliedSource, initialFile, onFileConsumed]);
  const canBuild = (p: ComponentSpec) => buildable(p) || !!imports[p.id];
  function addPart(part: ComponentSpec) {
    if (spec.components.length >= 20) {
      setError(
        "An assembly supports at most 20 parts. Split the design or remove a part.",
      );
      return;
    }
    setSpec({ ...spec, components: [...spec.components, part] });
    setSelected(part.id);
    setDirty(true);
    setError("");
  }
  function installParts(
    incoming: AssemblySpec,
    preview?: Geometry,
    references: Record<string, ImportedSolid> = {},
  ) {
    const append = appendDocument && spec.components.length > 0;
    const next = append
      ? mergeAssembly(spec, incoming)
      : AssemblySchema.parse(incoming);
    const added = append
      ? next.components.slice(spec.components.length)
      : next.components;
    const ids = new Map(incoming.components.map((p, i) => [p.id, added[i].id]));
    const nextImports = Object.fromEntries(
      Object.entries(references).map(([id, ref]) => [ids.get(id)!, ref]),
    );
    setSpec(next);
    setSelected(added[0]?.id || "");
    setImports(append ? { ...imports, ...nextImports } : nextImports);
    setGeometry((g) =>
      preview
        ? {
            ...preview,
            parts: [
              ...(append ? g?.parts || [] : []),
              ...preview.parts.map((p) => ({ ...p, id: ids.get(p.id)! })),
            ],
            step: append ? undefined : preview.step,
            stl: append ? undefined : preview.stl,
          }
        : append
          ? g
          : null,
    );
    setDirty(append || !preview);
    guideTo("#studio-model");
  }
  // An explicit research handoff retains parameters, never the original file.
  useEffect(() => {
    if (!restoreDraft) return;
    const timer = setTimeout(() => {
      try {
        const draft = sessionStorage.getItem("patentradar-design-return-v1");
        if (!draft) return;
        const parsed = JSON.parse(draft);
        const restored = AssemblySchema.safeParse(parsed.spec);
        if (parsed.version !== 1 || !restored.success) {
          sessionStorage.removeItem("patentradar-design-return-v1");
          return;
        }
        setSpec(restored.data);
        setSelected(restored.data.components[0]?.id || "");
        if (
          typeof parsed.source?.name === "string" &&
          typeof parsed.source?.hash === "string"
        )
          setSource({ name: parsed.source.name, hash: parsed.source.hash });
        setDirty(true);
        setNotice(
          "Design restored in this tab. Review your changes and rebuild CAD. Imported STEP/STL geometry requires reimporting the original file. No original document was retained.",
        );
        sessionStorage.removeItem("patentradar-design-return-v1");
      } catch {
        setError(
          "The saved design could not be restored. Reopen your source or use your exported parameters to re-enter measurements.",
        );
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [restoreDraft]);
  async function request(url: string, body: object | FormData) {
    const r = await fetch(url, {
      method: "POST",
      ...(body instanceof FormData
        ? { body }
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Request failed");
    return d;
  }
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy("");
    }
  }
  function update(id: string, patch: Partial<ComponentSpec>) {
    setSpec((s) => ({
      ...s,
      components: s.components.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    }));
    setDirty(true);
  }
  function download(data: string, name: string, type: string) {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const build = (fuse = false) =>
    run(
      "Generating CAD on your device (first kernel load may take a moment)",
      async () => {
        const d = await browserCAD("build", {
          ...AssemblySchema.parse(spec),
          imports,
          fuse,
        });
        setGeometry(d);
        setDirty(false);
        guideTo(".cad-stage");
        setNotice(
          fuse
            ? "Touching/overlapping parts fused into one checked solid. This geometric operation does not establish strength, printability or patent clearance."
            : "OpenCascade generated checked solids on your device. Parts remain separate in the STEP assembly. Engineering validation still required.",
        );
      },
    );
  async function interpret() {
    await run("Reading source documentation", async () => {
      if (file && /\.json$/i.test(file.name)) {
        if (file.size > 4 * 1024 * 1024)
          throw new Error("Parameter file exceeds 4 MB");
        const data = JSON.parse(await file.text());
        const incoming = AssemblySchema.parse(data.spec || data);
        if (
          typeof data.source?.name === "string" &&
          data.source.name.length <= 250 &&
          typeof data.source?.hash === "string" &&
          /^(?:[a-f0-9]{64})?$/.test(data.source.hash)
        ) {
          setSource({ name: data.source.name, hash: data.source.hash });
          incoming.components = incoming.components.map((p) => ({
            ...p,
            sourceName:
              p.sourceName ||
              (!p.referenceUrl && !p.templateId ? data.source.name : undefined),
          }));
        }
        installParts(incoming);
        setNotice(
          "Editable parameters imported. Rebuild measured parts; imported CAD source files must be reselected.",
        );
        return;
      }
      if (file && /\.(step|stp)$/i.test(file.name)) {
        const d = await browserCAD("import", { file });
        const components = d.parts.map((p: MeshPart) => ({
          ...blank(),
          id: p.id,
          name: p.id,
          shape: "unresolved" as const,
          description: "Imported STEP solid; parameters not recovered",
          sourceQuote: file.name,
          sourceName: file.name,
          role: "imported" as const,
        }));
        installParts(
          {
            title: file.name,
            components,
            limitations: [
              "Imported geometry can be inspected and placed. Parametric feature history is not recovered.",
            ],
          },
          d,
          Object.fromEntries(
            components.map((p, i) => [p.id, { file, solidIndex: i }]),
          ),
        );
        setSource({ name: file.name, hash: "" });
        setNotice(
          "STEP geometry imported. Add library or custom parts, then rebuild to export the combined assembly. Feature history was not recovered.",
        );
        return;
      }
      if (file && /\.stl$/i.test(file.name)) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.length > 4 * 1024 * 1024) throw new Error("STL exceeds 4 MB");
        const binarySTL =
          bytes.length >= 84 &&
          84 + new DataView(bytes.buffer).getUint32(80, true) * 50 ===
            bytes.length;
        const asciiSTL = /^\s*solid[\s\S]*facet\s+normal/i.test(
          new TextDecoder().decode(bytes.slice(0, 1500)),
        );
        if (!binarySTL && !asciiSTL) throw new Error("Invalid STL file.");
        let binary = "";
        for (const b of bytes) binary += String.fromCharCode(b);
        const p = blank();
        p.shape = "unresolved";
        p.name = file.name;
        p.description = "Imported STL mesh — no CAD feature history";
        installParts(
          {
            title: file.name,
            components: [p],
            limitations: [
              "STL is a mesh; no parametric or STEP export is inferred.",
            ],
          },
          {
            parts: [
              {
                id: p.id,
                stl: btoa(binary),
                volume: 0,
                valid: false,
                bounds: [],
              },
            ],
            stl: btoa(binary),
            engine: "Imported mesh",
          },
        );
        return;
      }
      const form = new FormData();
      if (file) form.set("file", file);
      form.set("text", text);
      form.set("consent", String(consent));
      form.set("goal", spec.goal || "");
      const d = await request("/api/cad/interpret", form);
      installParts({
        ...d.spec,
        components: d.spec.components.map((c: ComponentSpec) => ({
          ...c,
          sourceName: d.sourceName,
        })),
      });
      setSource({ name: d.sourceName, hash: d.sourceHash });
      setNotice(
        d.spec.components.length
          ? d.notice
          : "No reconstructable primitive with explicit mm dimensions was found. Add the required measurements below; no dimensions were invented.",
      );
    });
  }
  function deviceCatalog() {
    try {
      const rows = JSON.parse(
        localStorage.getItem("patentradar-cad-catalog-v1") || "[]",
      );
      return Array.isArray(rows)
        ? rows
            .filter(
              (item) =>
                item &&
                typeof item.id === "string" &&
                typeof item.title === "string" &&
                (item.kind === "component"
                  ? ComponentSchema.safeParse(item.data?.component).success
                  : AssemblySchema.safeParse(item.data?.assembly).success),
            )
            .slice(0, 100)
        : [];
    } catch {
      return [];
    }
  }
  async function loadCatalog() {
    const local = deviceCatalog();
    setCatalog(local);
    try {
      const r = await fetch("/api/vault");
      const d = await r.json();
      if (r.ok && d.user) {
        setCatalog([
          ...local,
          ...d.items.filter((i: { kind: string }) =>
            ["component", "assembly"].includes(i.kind),
          ),
        ]);
        return;
      }
    } catch {}
    setNotice(
      "Device catalog loaded. Server-private catalog requires a configured account; nothing was uploaded.",
    );
  }
  function saveOnDevice(kind: "component" | "assembly") {
    const data =
      kind === "component"
        ? {
            component,
            source,
            preview: geometry?.parts.find((p) => p.id === component?.id),
          }
        : { assembly: spec, source };
    const next = [
      {
        id: "device-" + crypto.randomUUID(),
        title: kind === "component" ? component!.name : spec.title,
        kind,
        data,
      },
      ...deviceCatalog(),
    ].slice(0, 100);
    try {
      localStorage.setItem("patentradar-cad-catalog-v1", JSON.stringify(next));
      setCatalog(next);
      setNotice(
        "Saved only in this browser profile. Shared-device users may access browser storage.",
      );
    } catch {
      setError(
        "Browser storage unavailable or full; export editable parameters instead.",
      );
    }
  }

  return (
    <div className="engineering-studio" ref={studio}>
      <header className="studio-intro">
        <span className="eyebrow">FORMAPROOF / ENGINEERING STUDIO</span>
        <h1>
          Make the document
          <br />
          your starting point.
        </h1>
        <p>
          Choose what to represent. Review the parts and measurements, then
          build an editable assembly. Investigate patent evidence when your
          design is ready.
        </p>
      </header>
      <nav className="studio-journey" aria-label="Design workflow">
        <a href="#studio-source">
          <span>01</span> Source document
        </a>
        <a href="#studio-model">
          <span>02</span> Parts & 3D{" "}
          <small>{spec.components.length} parts</small>
        </a>
        <a href="#parts-workbench">
          <span>03</span> Add & customize
        </a>
        <a href="#studio-export">
          <span>04</span> Export & investigate
        </a>
      </nav>
      <section className="panel studio-source" id="studio-source">
        <div className="section-heading">
          <span className="product-kicker">01 / YOUR STARTING POINT</span>
          <h2>What are we building?</h2>
          <p>
            A complete machine, one component or a custom part. Start with what
            you have.
          </p>
        </div>
        <label>
          What would you like to represent?
          <textarea
            maxLength={1000}
            value={spec.goal || ""}
            onChange={(e) => setSpec({ ...spec, goal: e.target.value })}
            placeholder="For example: the motor assembly, its drive shaft only, or an electronics enclosure. Specify the function you want to study."
            rows={2}
          />
        </label>
        <div className="row wrap">
          <label className="grow">
            {file
              ? "Replace the selected source (optional)"
              : "PDF, drawing, image or CAD file"}
            <input
              key={pickerVersion}
              aria-label="Engineering source file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.step,.stp,.stl,.json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <label className="grow">
            Or paste measured specifications
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter actual dimensions, e.g. part name followed by length × width × height in mm. No dimensions are assumed."
              rows={3}
            />
          </label>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={appendDocument}
            onChange={(e) => setAppendDocument(e.target.checked)}
          />
          Add imported or identified parts to the existing assembly (uncheck to
          replace)
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Allow OpenAI to interpret document text and images (requires
          configured access and signed-in account).
        </label>
        {file && (
          <p className="notice studio-selected-source">
            Selected source: {file.name}
          </p>
        )}
        <div className="row wrap">
          <Button
            id="studio-read-source"
            disabled={!!busy || (!file && !text.trim())}
            onClick={interpret}
          >
            Read document & identify parts
          </Button>
          <Button
            variant="outline"
            disabled={!!busy || spec.components.length >= 20}
            onClick={() => addPart(blank())}
          >
            Add a measured component
          </Button>
          <a className="link-button" href="#parts-workbench">
            Library, purchased parts & custom housing ↓
          </a>
        </div>
        <p className="hint">
          Files stay on this server unless you explicitly consent to external AI
          processing. PDFs: first 20 text pages and first 4 rendered pages. Up
          to 4 MB. Missing dimensions require your input.
        </p>
      </section>
      <details
        className="private-file-drawer"
        onToggle={(e) => setShowPrivateFiles(e.currentTarget.open)}
      >
        <summary>Keep source files in a private project</summary>
        {showPrivateFiles && (
          <PrivateWorkspace
            allowPatentAnalysis={false}
            pendingFile={file}
            onUseFile={async (source) => {
              if (/\.txt$/i.test(source.name)) {
                setText(await source.text());
                setFile(null);
              } else setFile(source);
              setNotice(
                "Private source loaded. Click Read document & identify parts when ready.",
              );
            }}
          />
        )}
      </details>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="notice">
          {busy}…
        </p>
      )}
      {notice && <p className="notice">{notice}</p>}
      <div className="cad-layout" id="studio-model" tabIndex={-1}>
        <aside className="panel cad-parts">
          <h3>Assembly components</h3>
          <input
            aria-label="Assembly title"
            value={spec.title}
            onChange={(e) => setSpec({ ...spec, title: e.target.value })}
          />
          {!spec.components.length && (
            <p>Import a document or add a component to begin.</p>
          )}
          {spec.components.map((c) => (
            <button
              className={"part-item " + (selected === c.id ? "active" : "")}
              key={c.id}
              onClick={() => setSelected(c.id)}
            >
              <strong>{c.name}</strong>
              <small>
                {c.shape} · {c.role || c.basis} ·{" "}
                {canBuild(c)
                  ? "Ready to build"
                  : "Measurements / geometry required"}
              </small>
            </button>
          ))}
          <div className="row wrap">
            <Button
              disabled={
                !!busy ||
                !spec.components.length ||
                spec.components.some((c) => !canBuild(c))
              }
              onClick={() => build()}
            >
              Rebuild CAD
            </Button>
            <Button
              variant="outline"
              disabled={!!busy || !spec.components.some(canBuild)}
              onClick={() =>
                run("Previewing measured parts", async () => {
                  const ready = spec.components.filter(canBuild);
                  const d = await browserCAD("build", {
                    ...AssemblySchema.parse(spec),
                    components: ready,
                    imports,
                  });
                  setGeometry({ ...d, step: undefined, stl: undefined });
                  setDirty(true);
                  setNotice(
                    `Preview contains ${ready.length} of ${spec.components.length} parts. Missing geometry is not reconstructed. Full assembly export requires every part; a ready selected part can be exported separately.`,
                  );
                })
              }
            >
              Preview ready parts
            </Button>
            <Button
              variant="outline"
              disabled={!component || spec.components.length >= 20}
              onClick={() => {
                if (!component) return;
                const p = {
                  ...structuredClone(component),
                  id: crypto.randomUUID(),
                  name: component.name + " copy",
                };
                addPart(p);
                if (imports[component.id])
                  setImports({ ...imports, [p.id]: imports[component.id] });
              }}
            >
              Duplicate
            </Button>
            <Button
              variant="outline"
              disabled={!component}
              onClick={() => {
                setSpec({
                  ...spec,
                  components: spec.components.filter((c) => c.id !== selected),
                });
                setGeometry((g) =>
                  g
                    ? { ...g, parts: g.parts.filter((p) => p.id !== selected) }
                    : g,
                );
                setSelected("");
                setImports((current) =>
                  Object.fromEntries(
                    Object.entries(current).filter(([id]) => id !== selected),
                  ),
                );
                setDirty(true);
              }}
            >
              Remove
            </Button>
          </div>
        </aside>
        <section className="cad-stage" tabIndex={-1}>
          {geometry?.parts.length ? (
            <Viewer
              parts={geometry?.parts || EMPTY_PARTS}
              components={spec.components}
              selected={selected}
              hidden={hidden}
              isolated={isolate}
              explode={explode}
              animate={animate}
              onSelect={setSelected}
              onMove={(id, position) => update(id, { position })}
            />
          ) : (
            <div className="cad-canvas cad-empty">
              <div className="empty-assembly-symbol" aria-hidden="true">
                ◇
              </div>
              <h3>Your assembly takes shape here</h3>
              <p>
                Identify parts from a document or add one from the library.
                <br />
                Review its dimensions, then select Rebuild CAD.
              </p>
              <a href="#parts-workbench" className="link-button">
                Browse the parts library ↗
              </a>
            </div>
          )}
          <div className="cad-toolbar">
            <Button
              variant="outline"
              disabled={!selected}
              onClick={() =>
                setHidden((h) =>
                  h.includes(selected)
                    ? h.filter((id) => id !== selected)
                    : [...h, selected],
                )
              }
            >
              Hide / show
            </Button>
            <Button variant="outline" onClick={() => setIsolate(!isolate)}>
              {isolate ? "Show assembly" : "Isolate part"}
            </Button>
            <label>
              Exploded view
              <input
                type="range"
                min="0"
                max="4"
                step="0.1"
                value={explode}
                onChange={(e) => setExplode(Number(e.target.value))}
              />
            </label>
            <Button
              variant="outline"
              disabled={!selected}
              onClick={() => setAnimate(!animate)}
            >
              {animate ? "Stop motion" : "Preview rotation"}
            </Button>
          </div>
          <p className="hint">
            Orbit · zoom · select · drag XYZ axes. Exploded view and rotation
            are visual previews, not mechanical simulation or solved joints.
          </p>
        </section>
        <aside className="panel cad-inspector">
          <h3>Part parameters</h3>
          {component ? (
            <>
              <label>
                Name
                <input
                  value={component.name}
                  onChange={(e) =>
                    update(component.id, { name: e.target.value })
                  }
                />
              </label>
              <label>
                Primitive
                <select
                  value={component.shape}
                  onChange={(e) => {
                    if (imports[component.id]) {
                      setImports((current) =>
                        Object.fromEntries(
                          Object.entries(current).filter(
                            ([id]) => id !== component.id,
                          ),
                        ),
                      );
                      setNotice(
                        "Imported shape replaced by a user-defined parametric approximation. Original CAD feature history is not recovered.",
                      );
                    }
                    update(component.id, {
                      shape: e.target.value as ComponentSpec["shape"],
                      pocket:
                        e.target.value === "box" ? component.pocket : undefined,
                      role: "custom",
                    });
                  }}
                >
                  {["box", "cylinder", "tube", "unresolved"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              {requiredDimensions(component).map((k) => (
                <label key={k}>
                  {k} (mm)
                  <input
                    type="number"
                    min="0.01"
                    max="2000"
                    step="0.1"
                    value={component.dimensions[k] ?? ""}
                    placeholder="Required measurement"
                    onChange={(e) =>
                      update(component.id, {
                        dimensions: {
                          ...component.dimensions,
                          [k]: e.target.value ? Number(e.target.value) : null,
                        },
                        basis: "user-entered",
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Material
                <input
                  value={component.material}
                  onChange={(e) =>
                    update(component.id, { material: e.target.value })
                  }
                />
              </label>
              <label>
                Function / description
                <textarea
                  maxLength={1000}
                  value={component.description}
                  onChange={(e) =>
                    update(component.id, { description: e.target.value })
                  }
                />
              </label>
              <label>
                Connections (one per line)
                <textarea
                  value={component.connections.join("\n")}
                  onChange={(e) =>
                    update(component.id, {
                      connections: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .slice(0, 10)
                        .map((s) => s.slice(0, 150)),
                    })
                  }
                />
              </label>
              {component.pocket && (
                <>
                  <h4>Open-top pocket</h4>
                  {(["wall", "floor"] as const).map((k) => (
                    <label key={k}>
                      {k} thickness (mm)
                      <input
                        type="number"
                        min="0.2"
                        max="1000"
                        step="0.1"
                        value={component.pocket![k]}
                        onChange={(e) =>
                          update(component.id, {
                            pocket: {
                              ...component.pocket!,
                              [k]: Number(e.target.value),
                            },
                            basis: "user-entered",
                          })
                        }
                      />
                    </label>
                  ))}
                </>
              )}
              <h4>Position / rotation</h4>
              {(["position", "rotation"] as const).map((key) => (
                <div className="cad-vector" key={key}>
                  {component[key].map((v, i) => (
                    <label key={i}>
                      {key === "position" ? "XYZ"[i] : "XYZ"[i] + "°"}
                      <input
                        type="number"
                        value={Number(v.toFixed(2))}
                        onChange={(e) => {
                          const vector = [...component[key]] as [
                            number,
                            number,
                            number,
                          ];
                          vector[i] = Number(e.target.value);
                          update(component.id, { [key]: vector });
                        }}
                      />
                    </label>
                  ))}
                </div>
              ))}
              <div className="cad-provenance">
                <strong>
                  Source:{" "}
                  {component.sourceName ||
                    (component.referenceUrl
                      ? "Linked reference"
                      : component.templateId
                        ? "Prototype template"
                        : source.name || "User specification")}{" "}
                  · page {component.sourcePage}
                </strong>
                {component.referenceUrl && (
                  <p>
                    <a
                      href={component.referenceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Component source ↗
                    </a>
                  </p>
                )}
                {component.commerce && (
                  <p>
                    <a
                      href={component.commerce.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Purchase reference (user supplied) ↗
                    </a>
                  </p>
                )}
                <blockquote>
                  {component.sourceQuote || "No verified source passage"}
                </blockquote>
                <small>
                  {component.basis} · Primitive approximation · Engineering
                  validation required
                </small>
                <p>
                  {component.connections.join("; ") ||
                    "Connections not established"}
                </p>
              </div>
            </>
          ) : (
            <p>Select a part to inspect its measurements and source.</p>
          )}
          {meshInfo?.valid && (
            <p className="hint">
              Solid volume: {Number(meshInfo.volume.toFixed(2))} mm³ · Kernel
              validity checked
            </p>
          )}
          {geometry?.engine && (
            <small>Geometry engine: {geometry.engine}</small>
          )}
        </aside>
      </div>
      <div id="parts-workbench">
        <PartsWorkbench
          spec={spec}
          selected={selected}
          onAdd={addPart}
          onUpdate={update}
          onError={setError}
        />
      </div>
      <section className="panel" id="studio-export">
        <span className="product-kicker">04 / TAKE YOUR DESIGN FURTHER</span>
        <h3>Export & research</h3>
        {dirty && geometry && (
          <p>
            Geometry or placement changed. Rebuild before exporting the updated
            assembly.
          </p>
        )}
        <div className="row wrap">
          <Button
            variant="outline"
            disabled={
              !!busy ||
              spec.components.length < 2 ||
              spec.components.some((c) => !canBuild(c))
            }
            onClick={() => build(true)}
          >
            Fuse touching parts into one solid
          </Button>
          <Button
            variant="outline"
            disabled={!!busy || !component || !canBuild(component)}
            onClick={() =>
              run("Exporting selected part", async () => {
                if (!component) return;
                const d = await browserCAD("build", {
                  title: component.name,
                  components: [component],
                  limitations: [],
                  imports,
                });
                download(d.stl, "selected-part.stl", "model/stl");
              })
            }
          >
            Export selected part STL
          </Button>
          <Button
            disabled={!geometry?.step || dirty}
            onClick={() =>
              download(geometry!.step!, "assembly.step", "application/step")
            }
          >
            Export STEP assembly
          </Button>
          <Button
            disabled={!geometry?.stl || dirty}
            onClick={() =>
              download(geometry!.stl!, "assembly.stl", "model/stl")
            }
          >
            Export STL
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const blob = new Blob(
                [JSON.stringify({ spec, source }, null, 2)],
                { type: "application/json" },
              );
              const u = URL.createObjectURL(blob),
                a = document.createElement("a");
              a.href = u;
              a.download = "assembly-parameters.json";
              a.click();
              URL.revokeObjectURL(u);
            }}
          >
            Export editable parameters
          </Button>
          <Button
            variant="outline"
            disabled={!spec.components.length}
            onClick={() => {
              try {
                sessionStorage.setItem(
                  "patentradar-design-return-v1",
                  JSON.stringify({ version: 1, spec, source }),
                );
              } catch {
                setError(
                  "This browser cannot retain your design for the return journey. Export editable parameters before leaving.",
                );
                return;
              }
              onPatentResearch(
                `${spec.title}\nRepresentation goal: ${spec.goal || "User-selected components"}\n` +
                  spec.components
                    .map(
                      (c) =>
                        `${c.name}: ${c.description}\nCurrent design geometry (reviewed parameters): ${c.shape}; ${Object.entries(
                          c.dimensions,
                        )
                          .filter(([, value]) => value !== null)
                          .map(([name, value]) => `${name} ${value} mm`)
                          .join(
                            ", ",
                          )}; material: ${c.material}. Connections: ${c.connections.join(", ") || "Not specified"}.`,
                    )
                    .join("\n"),
              );
            }}
          >
            Review features for patent research
          </Button>
          <Button
            variant="outline"
            disabled={!spec.components.length || !!busy}
            onClick={() =>
              run("Saving private assembly", async () => {
                await request("/api/vault", {
                  action: "save",
                  kind: "assembly",
                  title: spec.title,
                  data: { assembly: spec, source },
                });
                await loadCatalog();
                setNotice(
                  "Parametric assembly saved privately. Rebuild when reopened.",
                );
              })
            }
          >
            Save assembly privately
          </Button>
          <Button
            variant="outline"
            disabled={!component || !!busy}
            onClick={() =>
              run("Saving catalog component", async () => {
                await request("/api/vault", {
                  action: "save",
                  kind: "component",
                  title: component!.name,
                  data: {
                    component,
                    source,
                    preview: geometry?.parts.find(
                      (p) => p.id === component!.id,
                    ),
                  },
                });
                await loadCatalog();
              })
            }
          >
            Save part to catalog
          </Button>
        </div>
        {geometry?.fused && (
          <p className="hint">
            Export contains one fused solid · Volume{" "}
            {Number(geometry.exportVolume?.toFixed(3))} mm³. The viewer keeps
            the original parts selectable. Rebuild normally to export separate
            parts.
          </p>
        )}
        <p className="hint">
          STEP preserves separate solids for CAD tools; STL is a millimetre mesh
          for a slicer, not printer G-code. Fusion requires connected solids and
          is a geometric operation, not a functional assembly test.
        </p>
        <p className="hint">
          Patent research starts with your review, not an automatic external
          search. Continuing retains editable parameters in this tab, without
          the original file. Return to the design to change parts and analyze
          again. Similarity findings are research leads, not a legal opinion.
        </p>
        <ul>
          {spec.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <div className="row wrap">
          <h3>Component catalog</h3>
          <Button
            variant="outline"
            disabled={!component}
            onClick={() => saveOnDevice("component")}
          >
            Save selected part on this device
          </Button>
          <Button
            variant="outline"
            disabled={!spec.components.length}
            onClick={() => saveOnDevice("assembly")}
          >
            Save assembly on this device
          </Button>
          <Button
            variant="outline"
            onClick={() => run("Loading catalog", loadCatalog)}
          >
            Load device / account catalog
          </Button>
          <input
            aria-label="Search component catalog"
            placeholder="Search components and assemblies"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {catalog
          .filter((c) => c.title.toLowerCase().includes(filter.toLowerCase()))
          .map((item) => (
            <article className="saved-row" key={item.id}>
              <strong>{item.title}</strong>
              <small>{item.kind}</small>
              <Button
                variant="outline"
                onClick={() => {
                  if (item.data.component) {
                    const p = {
                      ...structuredClone(item.data.component),
                      id: crypto.randomUUID(),
                    };
                    if (spec.components.length >= 20) {
                      setError("At most 20 parts per assembly.");
                      return;
                    }
                    addPart(p);
                    if (item.data.preview)
                      setGeometry((g) => ({
                        engine: g?.engine || "Catalog mesh preview",
                        parts: [
                          ...(g?.parts || []),
                          { ...item.data.preview!, id: p.id },
                        ],
                      }));
                  } else if (item.data.assembly) {
                    setSpec(item.data.assembly);
                    setGeometry(null);
                  }
                  if (item.data.source) setSource(item.data.source);
                  setDirty(true);
                }}
              >
                Reuse / open parameters
              </Button>
            </article>
          ))}
      </section>
    </div>
  );
}
const EMPTY_PARTS: MeshPart[] = [];
