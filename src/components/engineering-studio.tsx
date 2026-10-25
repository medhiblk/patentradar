"use client";
import { browserCAD } from "@/lib/cad/browser";
import { useState } from "react";
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
}: {
  onPatentResearch: (text: string) => void;
}) {
  const [spec, setSpec] = useState<AssemblySpec>({
    title: "Untitled engineering assembly",
    components: [],
    limitations: [],
  });
  const [source, setSource] = useState({ name: "", hash: "" });
  const [file, setFile] = useState<File | null>(null),
    [text, setText] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
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
  const build = () =>
    run(
      "Generating CAD on your device (first kernel load may take a moment)",
      async () => {
        let d;
        if (file && /\.(step|stp)$/i.test(file.name)) {
          d = await browserCAD("import", {
            file,
            placements: spec.components.map((c) => ({
              id: c.id,
              position: c.position,
              rotation: c.rotation,
            })),
          });
        } else d = await browserCAD("build", spec);
        setGeometry(d);
        setDirty(false);
        setNotice(
          "OpenCascade generated valid parametric solids on your device. Primitive reconstruction still requires engineering validation.",
        );
      },
    );
  async function interpret() {
    await run("Reading source documentation", async () => {
      if (file && /\.(step|stp)$/i.test(file.name)) {
        const d = await browserCAD("import", { file });
        const components = d.parts.map((p: MeshPart) => ({
          ...blank(),
          id: p.id,
          name: p.id,
          shape: "unresolved" as const,
          description: "Imported STEP solid; parameters not recovered",
          sourceQuote: file.name,
        }));
        setSpec({
          title: file.name,
          components,
          limitations: [
            "Imported geometry can be inspected and placed. Parametric feature history is not recovered.",
          ],
        });
        setGeometry(d);
        setSelected(components[0]?.id || "");
        setSource({ name: file.name, hash: "" });
        setDirty(false);
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
        setSpec({
          title: file.name,
          components: [p],
          limitations: [
            "STL is a mesh; no parametric or STEP export is inferred.",
          ],
        });
        setGeometry({
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
        });
        setSelected(p.id);
        setDirty(false);
        return;
      }
      const form = new FormData();
      if (file) form.set("file", file);
      form.set("text", text);
      form.set("consent", String(consent));
      const d = await request("/api/cad/interpret", form);
      setSpec(d.spec);
      setSource({ name: d.sourceName, hash: d.sourceHash });
      setGeometry(null);
      setSelected(d.spec.components[0]?.id || "");
      setNotice(
        d.spec.components.length
          ? d.notice
          : "No reconstructable primitive with explicit mm dimensions was found. Add the required measurements below; no dimensions were invented.",
      );
      setDirty(true);
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
    <div className="engineering-studio">
      <header className="studio-intro">
        <span className="eyebrow">FORMAPROOF / ENGINEERING STUDIO</span>
        <h1>
          From a technical page
          <br />
          to an editable assembly.
        </h1>
        <p>
          Measured geometry. Traceable evidence. Editable parts. CAD runs on
          your device; no Python installation required.
        </p>
      </header>
      <section className="panel">
        <div className="row wrap">
          <label className="grow">
            PDF, drawing, image or CAD file
            <input
              aria-label="Engineering source file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.step,.stp,.stl"
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
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Allow OpenAI to interpret document text and images (requires
          configured access and signed-in account).
        </label>
        <div className="row wrap">
          <Button
            disabled={!!busy || (!file && !text.trim())}
            onClick={interpret}
          >
            Read document & identify parts
          </Button>
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() => {
              const p = blank();
              setSpec({ ...spec, components: [...spec.components, p] });
              setSelected(p.id);
              setDirty(true);
            }}
          >
            Add a measured component
          </Button>
        </div>
        <p className="hint">
          Files stay on this server unless you explicitly consent to external AI
          processing. PDFs: first 20 text pages and first 4 rendered pages. Up
          to 4 MB. Missing dimensions require your input.
        </p>
      </section>
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
      <div className="cad-layout">
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
                {c.shape} · {c.basis} ·{" "}
                {buildable(c)
                  ? "Ready for primitive reconstruction"
                  : "Measurements / geometry required"}
              </small>
            </button>
          ))}
          <div className="row wrap">
            <Button
              disabled={
                !!busy ||
                !spec.components.length ||
                (spec.components.some((c) => !buildable(c)) &&
                  !(file && /\.(step|stp)$/i.test(file.name)))
              }
              onClick={build}
            >
              Rebuild CAD
            </Button>
            <Button
              variant="outline"
              disabled={!component}
              onClick={() => {
                if (!component) return;
                const p = {
                  ...structuredClone(component),
                  id: crypto.randomUUID(),
                  name: component.name + " copy",
                };
                setSpec({ ...spec, components: [...spec.components, p] });
                setSelected(p.id);
                setDirty(true);
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
                setDirty(true);
              }}
            >
              Remove
            </Button>
          </div>
        </aside>
        <section className="cad-stage">
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
                  onChange={(e) =>
                    update(component.id, {
                      shape: e.target.value as ComponentSpec["shape"],
                    })
                  }
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
                  Source: {source.name || "User specification"} · page{" "}
                  {component.sourcePage}
                </strong>
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
      <section className="panel">
        <h3>Export & research</h3>
        {dirty && geometry && (
          <p>
            Geometry or placement changed. Rebuild before exporting the updated
            assembly.
          </p>
        )}
        <div className="row wrap">
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
            onClick={() =>
              onPatentResearch(
                spec.components
                  .map(
                    (c) =>
                      `${c.name}: ${c.description}; ${c.connections.join(", ")}`,
                  )
                  .join("\n"),
              )
            }
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
                    setSpec({ ...spec, components: [...spec.components, p] });
                    setSelected(p.id);
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
