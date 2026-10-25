"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import {
  ComponentSchema,
  type AssemblySpec,
  type ComponentSpec,
} from "@/lib/cad/schema";
import {
  STARTER_PARTS,
  starterPart,
  housingFor,
  fitInHousing,
  billOfMaterials,
  bomCSV,
} from "@/lib/cad/workbench";

function textDownload(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PartsWorkbench({
  spec,
  selected,
  onAdd,
  onUpdate,
  onError,
}: {
  spec: AssemblySpec;
  selected: string;
  onAdd: (part: ComponentSpec) => void;
  onUpdate: (id: string, patch: Partial<ComponentSpec>) => void;
  onError: (text: string) => void;
}) {
  const [filter, setFilter] = useState(""),
    [clearance, setClearance] = useState("0.5"),
    [wall, setWall] = useState("2"),
    [floor, setFloor] = useState("2");
  const [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [price, setPrice] = useState(""),
    [currency, setCurrency] = useState("EUR");
  const [size, setSize] = useState({ length: "", width: "", height: "" });
  const part = spec.components.find((p) => p.id === selected),
    bom = billOfMaterials(spec);
  function act(fn: () => void) {
    try {
      fn();
    } catch (e) {
      onError(
        e instanceof Error ? e.message : "Check the component parameters.",
      );
    }
  }
  return (
    <section className="panel parts-workbench" aria-label="Parts workbench">
      <div className="row between wrap">
        <div>
          <span className="eyebrow">BUILD WITH WHAT YOU NEED</span>
          <h2>Parts, purchases & custom designs</h2>
        </div>
        <span className="hint">{spec.components.length} / 20 parts</span>
      </div>
      <details open>
        <summary>Browse the starter library</summary>
        <label>
          Find a library part
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Board, shaft, plate, enclosure…"
          />
        </label>
        <div className="parts-library-grid">
          {STARTER_PARTS.filter((p) =>
            (p.name + " " + p.category)
              .toLowerCase()
              .includes(filter.toLowerCase()),
          ).map((p) => (
            <article key={p.id}>
              <small>{p.category}</small>
              <h3>{p.name}</h3>
              <p>
                {p.id === "pico-pcb"
                  ? "Manufacturer-sourced bare PCB dimensions. Populated components excluded."
                  : p.id === "uno-pcb"
                    ? "Manufacturer-sourced footprint. Overall height must be supplied."
                    : "Editable geometry template. Prototype dimensions require your review."}
              </p>
              <Button
                variant="outline"
                disabled={spec.components.length >= 20}
                onClick={() => act(() => onAdd(starterPart(p.id)))}
              >
                Add {p.name}
              </Button>
            </article>
          ))}
        </div>
        <p className="hint">
          Original parametric templates, not an online CAD marketplace. Supplier
          drawings remain linked at source. Template licensing does not grant
          product or patent rights.
        </p>
      </details>
      <details>
        <summary>Add a product from a web link</summary>
        <p>
          Paste an Amazon, distributor or manufacturer link. Enter the price and
          complete occupied dimensions yourself. No page is scraped and no live
          price or compatibility is inferred.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(() => {
              const p = starterPart("board");
              onAdd(
                ComponentSchema.parse({
                  ...p,
                  name: name.trim(),
                  referenceUrl: url.trim(),
                  description:
                    "Purchased component represented by a user-measured bounding envelope; internal geometry not reconstructed.",
                  dimensions: {
                    ...p.dimensions,
                    ...Object.fromEntries(
                      Object.entries(size).map(([k, v]) => [
                        k,
                        v.trim() ? Number(v) : null,
                      ]),
                    ),
                  },
                  commerce: {
                    url: url.trim(),
                    unitPrice: price.trim() ? Number(price) : null,
                    currency,
                    recordedAt: new Date().toISOString(),
                    basis: "user-entered",
                  },
                }),
              );
            });
          }}
        >
          <div className="parts-form-grid">
            <label>
              Product name
              <input
                required
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Product URL
              <input
                required
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
            <label>
              Unit price (optional)
              <input
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label>
              Price currency
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {["EUR", "USD", "GBP", "CNY", "JPY"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {(["length", "width", "height"] as const).map((k) => (
              <label key={k}>
                Purchased {k} (mm)
                <input
                  type="number"
                  min="0.01"
                  max="2000"
                  step="0.01"
                  value={size[k]}
                  onChange={(e) => setSize({ ...size, [k]: e.target.value })}
                  placeholder="Leave unknown dimensions empty"
                />
              </label>
            ))}
          </div>
          <Button disabled={spec.components.length >= 20}>
            Add purchased part
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!part}
            onClick={() =>
              act(() => {
                if (!part) return;
                const checked = ComponentSchema.parse({
                  ...part,
                  commerce: {
                    url: url.trim(),
                    unitPrice: price.trim() ? Number(price) : null,
                    currency,
                    recordedAt: new Date().toISOString(),
                    basis: "user-entered",
                  },
                });
                onUpdate(part.id, { commerce: checked.commerce });
              })
            }
          >
            Attach product reference to selected part
          </Button>
        </form>
      </details>
      <details open>
        <summary>Create a custom housing for the selected part</summary>
        <p>
          {part ? `Target: ${part.name}` : "Select a part first."} · Dimensions
          must include connectors, moving parts and required occupied space.
        </p>
        <div className="parts-form-grid">
          {[
            ["Clearance per side (mm)", clearance, setClearance],
            ["Housing wall (mm)", wall, setWall],
            ["Housing floor (mm)", floor, setFloor],
          ].map(([label, value, setter]) => (
            <label key={String(label)}>
              {String(label)}
              <input
                type="number"
                min="0.05"
                max="100"
                step="0.1"
                value={String(value)}
                onChange={(e) =>
                  (setter as (v: string) => void)(e.target.value)
                }
              />
            </label>
          ))}
        </div>
        <Button
          disabled={!part || spec.components.length >= 20}
          onClick={() =>
            act(() => {
              if (part)
                onAdd(
                  housingFor(part, {
                    clearance: Number(clearance),
                    wall: Number(wall),
                    floor: Number(floor),
                  }),
                );
            })
          }
        >
          Create fitted housing
        </Button>
        {spec.components
          .filter((p) => p.pocket?.targetId)
          .map((h) => {
            const target = spec.components.find(
              (p) => p.id === h.pocket!.targetId,
            );
            const fit = target
              ? fitInHousing(h, target)
              : { status: "unknown", gapsMm: [] };
            return (
              <p className="hint" key={h.id}>
                <strong>
                  {h.name}: {fit.status}
                </strong>
                {fit.gapsMm.length
                  ? ` · Minimum envelope clearance ${Math.min(...fit.gapsMm)} mm`
                  : " · Target or measurements missing"}
              </p>
            );
          })}
        <p className="hint">
          Computed open-top pocket and spatial envelope check only. Fasteners,
          ports, tolerances, strength, heat, electrical safety and print
          settings require engineering validation. This does not model a working
          motor.
        </p>
      </details>
      {part && (
        <PartRights
          key={part.id}
          part={part}
          onSave={(patch) => onUpdate(part.id, patch)}
          onError={onError}
        />
      )}
      <details>
        <summary>Parts list & known purchase costs</summary>
        <div className="bom-scroll">
          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th>Purchase reference</th>
                <th>User-entered price</th>
                <th>Rights declaration</th>
              </tr>
            </thead>
            <tbody>
              {bom.rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer">
                        Source ↗
                      </a>
                    ) : (
                      "Not supplied"
                    )}
                  </td>
                  <td>
                    {p.unitPrice === null
                      ? "Unknown"
                      : `${p.unitPrice.toFixed(2)} ${p.currency}`}
                  </td>
                  <td>{p.rightsStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          {Object.entries(bom.subtotals)
            .map(([c, v]) => `${v.toFixed(2)} ${c}`)
            .join(" · ") || "No known prices"}{" "}
          · {bom.unpriced} unpriced part(s)
        </p>
        <p className="hint">{bom.limitations}</p>
        <Button
          variant="outline"
          disabled={!spec.components.length}
          onClick={() =>
            textDownload(
              bomCSV(spec),
              "assembly-bom.csv",
              "text/csv;charset=utf-8",
            )
          }
        >
          Export parts list CSV
        </Button>
      </details>
    </section>
  );
}
function PartRights({
  part,
  onSave,
  onError,
}: {
  part: ComponentSpec;
  onSave: (patch: Partial<ComponentSpec>) => void;
  onError: (text: string) => void;
}) {
  const [status, setStatus] = useState(part.rights?.status || "unknown"),
    [evidence, setEvidence] = useState(part.rights?.evidenceUrl || ""),
    [note, setNote] = useState(part.rights?.note || "");
  return (
    <details>
      <summary>Rights evidence for {part.name}</summary>
      <p>
        Published patents are not automatically open-source. An open hardware
        licence, a component purchase and a patent licence confer different
        rights. Royalty obligations depend on the actual licence and applicable
        patents; they cannot be inferred from the brand of an assembly.
      </p>
      <label>
        Rights review status
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="unknown">Unknown — no clearance</option>
          <option value="permission-documented">
            Permission document supplied — verify scope
          </option>
          <option value="review-required">Specialist review required</option>
        </select>
      </label>
      <label>
        Rights evidence URL
        <input
          type="url"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Licence or official source"
        />
      </label>
      <label>
        Licence / scope / territory notes
        <textarea
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <Button
        variant="outline"
        onClick={() => {
          try {
            if (status === "permission-documented" && !evidence.trim())
              throw Error(
                "Supply a licence or permission source before marking permission as documented.",
              );
            const parsed = ComponentSchema.parse({
              ...part,
              rights: {
                status,
                evidenceUrl: evidence.trim() || undefined,
                note,
              },
            });
            onSave({ rights: parsed.rights });
          } catch (e) {
            onError(e instanceof Error ? e.message : "Check the evidence URL.");
          }
        }}
      >
        Save rights evidence
      </Button>
      <p className="hint">
        User declarations and links are not independently verified. Search
        results, including zero results, never certify freedom to operate.
      </p>
    </details>
  );
}
