"use client";
import { setDesignSession, takeDesignSession, clearDesignSession } from "@/lib/cad/design-session";
import { designFunctionText } from "@/lib/cad/spot-design";
import { DesignRevision, currentDesignResult } from "@/lib/cad/design-revision";
import { browserCAD, type ImportedSolid } from "@/lib/cad/browser";
import { mergeAssembly } from "@/lib/cad/workbench";
import { PartsWorkbench } from "./parts-workbench";
import { PrivateWorkspace } from "./private-workspace";
import { PRIVATE_SIGNOUT_EVENT } from "@/lib/private-session";
import {
  sourceFileError,
  SOURCE_ACCEPT,
  isPdfSource,
} from "@/lib/cad/source-files";
import { studioRequest, StudioRequestError } from "@/lib/cad/studio-request";
import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import { Button } from "./ui/button";
import {
  ComponentSchema,
  AssemblySchema,
  buildable,
  requiredDimensions,
  measurementReview,
  type AssemblySpec,
  type ComponentSpec,
} from "@/lib/cad/schema";
import type { MeshPart } from "./cad-viewer";
import { z } from "zod";
const InterpretationSchema = z.object({
  spec: AssemblySchema,
  sourceName: z.string().max(500),
  sourceHash: z.string().max(64),
  notice: z.string().max(5000),
});
function zInterpretation(value: unknown) {
  const parsed = InterpretationSchema.safeParse(value);
  if (!parsed.success)
    throw new StudioRequestError(
      "The document service returned invalid data. Your source is kept; retry reading it.",
      200,
      true,
    );
  return parsed.data;
}
const Viewer = dynamic(() => import("./cad-viewer").then((m) => m.CADViewer), {
  ssr: false,
  loading: () => <div className="cad-canvas">Loading 3D workspace…</div>,
});
type Geometry = {
  designRevision?: number;
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
  initialText = "",
  onFileConsumed,
  restoreDraft = true,
  guidedNavigation = false,
}: {
  onPatentResearch: (text: string) => void;
  initialFile?: File | null;
  initialText?: string;
  onFileConsumed?: () => void;
  restoreDraft?: boolean;
  guidedNavigation?: boolean;
}) {
  const studio = useRef<HTMLDivElement>(null);
  const [draggingSource, setDraggingSource] = useState(false);
  function selectSource(source: File | undefined) {
    if (!source || busy) return;
    const error = sourceFileError(source);
    if (error) {
      setError(error);
      return;
    }
    setError("");
    setFile(source);
    setNotice(
      "Source selected. Read the document to identify its parts and measurements.",
    );
    guideTo("#studio-read-source");
  }
  function guideTo(selector: string) {
    if (!guidedNavigation) return;
    requestAnimationFrame(() => {
      const target = studio.current?.querySelector<HTMLElement>(selector);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  }
  const designRevision = useRef(new DesignRevision());
  const [renderedRevision, setRenderedRevision] = useState(0);
  const [spec, setSpecState] = useState<AssemblySpec>({
    title: "Untitled engineering assembly",
    components: [],
    limitations: [],
  });
  const setSpec = useCallback((value: SetStateAction<AssemblySpec>) => {
    designRevision.current.changed();
    setRenderedRevision(designRevision.current.capture());
    setSpecState(value);
  }, []);
  const [source, setSource] = useState({ name: "", hash: "" });
  const [documentPages, setDocumentPages] = useState<{ page: number; text: string }[]>([]);
  const [pickerVersion, setPickerVersion] = useState(0);
  const [showPrivateFiles, setShowPrivateFiles] = useState(false);
  const [imports, setImportsState] = useState<Record<string, ImportedSolid>>({});
  const setImports = useCallback((value: SetStateAction<Record<string, ImportedSolid>>) => {
    designRevision.current.changed();
    setRenderedRevision(designRevision.current.capture());
    setImportsState(value);
  }, []);
  const [appendDocument, setAppendDocument] = useState(true);
  const [file, setFile] = useState<File | null>(null),
    [text, setText] = useState(initialText),
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
  const geometryCurrent = !!geometry && !dirty && geometry.designRevision === renderedRevision;
  const component = spec.components.find((c) => c.id === selected);
  const meshInfo = geometry?.parts.find((p) => p.id === selected);
  useEffect(() => {
    const reset = () => {
      clearDesignSession();
      setFile(null);
      setAppliedSource(null);
      setText("");
      setSpec({
        title: "Untitled engineering assembly",
        components: [],
        limitations: [],
      });
      setSource({ name: "", hash: "" });
      setDocumentPages([]);
      setImports({});
      setGeometry(null);
      setCatalog([]);
      setSelected("");
      setPickerVersion((v) => v + 1);
      setNotice("Signed out. Open document and geometry views were cleared.");
    };
    window.addEventListener(PRIVATE_SIGNOUT_EVENT, reset);
    return () => window.removeEventListener(PRIVATE_SIGNOUT_EVENT, reset);
  }, [setSpec, setImports]);
  useEffect(() => {
    if (!initialText) return;
    const timer = setTimeout(() => setText(initialText), 0);
    return () => clearTimeout(timer);
  }, [initialText]);
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
    const installedRevision = designRevision.current.capture();
    setGeometry((g) =>
      preview
        ? {
            ...preview,
            designRevision: installedRevision,
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
  // A same-tab research handoff keeps STEP Files only in memory; storage holds parameters only.
  useEffect(() => {
    if (!restoreDraft) return;
    const timer = setTimeout(() => {
      try {
        const memory = takeDesignSession();
        if (memory) {
          setSpec(memory.spec);
          setImports(memory.imports);
          setSource(memory.source);
          setDocumentPages(memory.documentPages || []);
          setFile(memory.sourceFile || null);
          setAppliedSource(memory.sourceFile || null);
          setSelected(memory.spec.components[0]?.id || "");
          setGeometry(null);
          setDirty(true);
          setNotice("Design and imported STEP references restored in this tab. Rebuild to inspect or export the current assembly. Original files remain in memory only.");
          try { sessionStorage.removeItem("patentradar-design-return-v1"); } catch {}
          return;
        }
        const draft = sessionStorage.getItem("patentradar-design-return-v1");
        if (!draft) return;
        const parsed = JSON.parse(draft);
        const restored = AssemblySchema.safeParse(parsed.spec);
        if (parsed.version !== 1 || !restored.success) {
          sessionStorage.removeItem("patentradar-design-return-v1");
          return;
        }
        setSpec(restored.data);
        setImports({});
        setDocumentPages([]);
        setGeometry(null);
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
  }, [restoreDraft, setSpec, setImports]);
  async function request(url: string, body: object | FormData) {
    return studioRequest(url, body);
  }
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
      guideTo('[role="alert"]');
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
        const result = await currentDesignResult(designRevision.current, () => browserCAD("build", {
          ...AssemblySchema.parse(spec),
          imports,
          fuse,
        }));
        setGeometry({ ...result.value, designRevision: result.revision });
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
      const inputRevision = designRevision.current.capture();
      if (file && /\.json$/i.test(file.name)) {
        if (file.size > 4 * 1024 * 1024)
          throw new Error("Parameter file exceeds 4 MB");
        const data = JSON.parse(await file.text());
        designRevision.current.assertCurrent(inputRevision);
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
        setDocumentPages([]);
        setAppliedSource(file);
        setNotice(
          "Editable parameters imported. Rebuild measured parts; imported CAD source files must be reselected.",
        );
        return;
      }
      if (file && /\.(step|stp)$/i.test(file.name)) {
        const d = await browserCAD("import", { file });
        designRevision.current.assertCurrent(inputRevision);
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
        setDocumentPages([]);
        setAppliedSource(file);
        setNotice(
          "STEP geometry imported. Add library or custom parts, then rebuild to export the combined assembly. Feature history was not recovered.",
        );
        return;
      }
      if (file && /\.stl$/i.test(file.name)) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        designRevision.current.assertCurrent(inputRevision);
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
        p.description = "STL inspection mesh — units are not encoded in STL; display assumes millimetres. No CAD feature history or validated solid.";
        p.sourceName = file.name;
        p.role = "imported";
        installParts(
          {
            title: file.name,
            components: [p],
            limitations: [
              "STL inspection only: source units are unknown and the display assumes mm. Placement changes require a mesh-capable external tool; no parametric or STEP export is inferred.",
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
        setDocumentPages([]);
        setAppliedSource(file);
        return;
      }
      const form = new FormData();
      if (file) form.set("file", file);
      form.set("text", text);
      form.set("consent", String(consent));
      form.set("goal", spec.goal || "");
      let visionNotice = "";
      if (consent && file && isPdfSource(file)) {
        const { preparePdfVision } = await import("@/lib/documents/browser-pdf");
        const vision = await preparePdfVision(form, file);
        visionNotice = vision.notice || "";
      }
      let result;
      try {
        result = zInterpretation(
          await studioRequest(
            "/api/cad/interpret",
            form,
            consent ? 65000 : 20000,
          ),
        );
      } catch (error) {
        if (
          consent ||
          !file ||
          !isPdfSource(file) ||
          !(error instanceof StudioRequestError) ||
          !error.recoverable
        )
          throw error;
        setBusy("Upload unavailable — reading the actual PDF on this device");
        const { interpretPdfLocally } = await import(
          "@/lib/cad/browser-document"
        );
        result = zInterpretation(
          await interpretPdfLocally(file, spec.goal || ""),
        );
      }
      designRevision.current.assertCurrent(inputRevision);
      installParts({
        ...result.spec,
        components: result.spec.components.map((c) => ({
          ...c,
          sourceName: result.sourceName,
        })),
      });
      setSource({ name: result.sourceName, hash: result.sourceHash });
      setDocumentPages(!file && text.trim() ? [{ page: 1, text: text.slice(0, 8000) }] : []);
      setAppliedSource(file);
      setNotice([
        result.spec.components.length
          ? result.notice
          : "No reconstructable primitive with explicit dimensions was found. Add the required measurements below; no dimensions were invented.",
        visionNotice,
      ].filter(Boolean).join(" "));
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
            preview: geometryCurrent ? geometry?.parts.find((p) => p.id === component?.id) : undefined,
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
      <section
        className={
          "panel studio-source" + (draggingSource ? " is-dragging" : "")
        }
        id="studio-source"
        onDragOver={(event) => {
          if (Array.from(event.dataTransfer.types).includes("Files")) {
            event.preventDefault();
            setDraggingSource(true);
          }
        }}
        onDragLeave={() => setDraggingSource(false)}
        onDrop={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          event.preventDefault();
          event.stopPropagation();
          setDraggingSource(false);
          if (event.dataTransfer.files.length !== 1) {
            setError("Drop one source document at a time.");
            return;
          }
          selectSource(event.dataTransfer.files[0]);
        }}
      >
        <div className="section-heading">
          <span className="product-kicker">01 / YOUR DOCUMENT</span>
          <h2>What would you like to build?</h2>
          <p>
            A part, an assembly or a custom housing. Start with your document
            or dimensions you already know.
          </p>
        </div>
        <label className="studio-source-goal" htmlFor="studio-representation-goal">
          What would you like to represent?
          <textarea
            id="studio-representation-goal"
            maxLength={1000}
            value={spec.goal || ""}
            onChange={(e) => setSpec({ ...spec, goal: e.target.value })}
            placeholder="For example: model a motor shaft, assemble its components or create a housing for an electronics board."
            rows={2}
          />
        </label>
        <div className="studio-source-fields">
          <div className="studio-source-field">
            <label className="studio-source-field-title" htmlFor="studio-source-document">
              {file ? "Selected document" : "Your technical document"}
            </label>
            <div className="studio-source-upload">
              <input
                key={pickerVersion}
                id="studio-source-document"
                className="studio-source-file-input"
                aria-label="Engineering source file"
                aria-describedby="studio-source-file-help"
                type="file"
                accept={SOURCE_ACCEPT}
                onChange={(e) => {
                  selectSource(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
              <label className="studio-source-picker" htmlFor="studio-source-document">
                <span className="studio-source-picker-action">
                  {file ? "Choose another document" : "Choose a document"}
                </span>
                <span className="studio-source-picker-caption">or drop it into this panel</span>
              </label>
              <p className="studio-source-file-name">
                {file ? file.name : "No document selected"}
              </p>
            </div>
            <p className="studio-source-file-help" id="studio-source-file-help">
              PDF, PNG/JPEG, STEP/STL or JSON · Up to 4 MB.
            </p>
          </div>
          <label className="studio-source-field studio-source-text" htmlFor="studio-measured-specifications">
            Or enter known dimensions
            <textarea
              id="studio-measured-specifications"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="For example: base plate 80 × 50 × 6 mm. Enter actual measurements; missing dimensions will not be invented."
              rows={5}
            />
          </label>
        </div>
        <p className="hint">
          Drop your file anywhere in this panel. Review the parts and
          measurements before generating the model.
        </p>
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
        <p role="alert" tabIndex={-1} className="notice error">
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
                  ? imports[c.id] ? "Imported STEP solid ready to rebuild" : measurementReview(c).state === "ready" ? "Ready to build" : "Approximate geometry — measurements require review"
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
                  const result = await currentDesignResult(designRevision.current, () => browserCAD("build", {
                    ...AssemblySchema.parse(spec),
                    components: ready,
                    imports,
                  }));
                  setGeometry({ ...result.value, designRevision: result.revision, step: undefined, stl: undefined });
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
                      measurementEvidence: undefined,
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
                  placeholder="Describe what this component actually does and how it interacts with the system. Dimensions alone do not explain its technical function."
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
        {!geometryCurrent && geometry && (
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
                const result = await currentDesignResult(designRevision.current, () => browserCAD("build", {
                  title: component.name,
                  components: [component],
                  limitations: [],
                  imports,
                }));
                download(result.value.stl, "selected-part.stl", "model/stl");
              })
            }
          >
            Export selected part STL
          </Button>
          <Button
            disabled={!geometry?.step || !geometryCurrent}
            onClick={() =>
              download(geometry!.step!, "assembly.step", "application/step")
            }
          >
            Export STEP assembly
          </Button>
          <Button
            disabled={!geometry?.stl || !geometryCurrent}
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
                setDesignSession({ spec, source, imports, sourceFile: appliedSource || file || undefined, documentPages });
              } catch {
                setError("Review the component parameters before starting patent research. The current assembly contains invalid values.");
                return;
              }
              try {
                sessionStorage.setItem(
                  "patentradar-design-return-v1",
                  JSON.stringify({ version: 1, spec, source }),
                );
              } catch {
                setNotice(
                  "Browser parameter storage is unavailable. This tab retains the design and imported STEP references in memory; export editable parameters before closing it.",
                );
              }
              onPatentResearch(designFunctionText({ spec, source, imports, sourceFile: appliedSource || file || undefined, documentPages }));
            }}
          >
            Check this design for related patents
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
                  Object.keys(imports).length ? "Parameters saved privately. Imported STEP files are retained only in this tab; attach their originals to your private project before closing it. Reopening parameters alone requires reimport." : "Parametric assembly saved privately. Rebuild when reopened.",
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
                    preview: geometryCurrent ? geometry?.parts.find(
                      (p) => p.id === component!.id,
                    ) : undefined,
                  },
                });
                await loadCatalog();
              })
            }
          >
            Save part to catalog
          </Button>
        </div>
        {spec.components.some((part) => measurementReview(part).state !== "ready") && (
          <p className="notice">Some dimensions or shapes still require review. Any generated geometry is an approximation, not a verified reconstruction.</p>
        )}
        {spec.components.some((part) => part.role === "imported" && !imports[part.id]) && (
          <p className="notice">Imported mesh or unavailable CAD source: inspection only until the original STEP file is supplied. STL does not encode units; its display assumes millimetres.</p>
        )}
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
                    const next = AssemblySchema.parse(item.data.assembly);
                    setSpec(next);
                    setDocumentPages([]);
                    setImports({});
                    setSelected(next.components[0]?.id || "");
                    setHidden([]);
                    setIsolate(false);
                    setExplode(0);
                    setAnimate(false);
                    setGeometry(null);
                    setNotice(next.components.some((part) => part.role === "imported") ? "Parameters reopened. Reimport each original STEP/STL source before rebuilding imported parts; no previous project geometry was reused." : "Assembly parameters reopened. Rebuild to inspect or export the current geometry.");
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
