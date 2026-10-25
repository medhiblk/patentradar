import { z } from "zod";
import {
  AssemblySchema,
  ComponentSchema,
  buildable,
  type AssemblySpec,
  type ComponentSpec,
} from "./schema";

export const STARTER_PARTS = [
  {
    id: "uno-pcb",
    name: "Arduino UNO R3 footprint",
    category: "Electronics",
    shape: "box",
    length: 68.6,
    width: 53.4,
    source: "https://store.arduino.cc/products/arduino-uno-rev3",
    page: 1,
    quote: "Length 68.6 mm Width 53.4 mm",
    note: "Footprint envelope only, not a complete board model. Enter occupied height including headers, power socket and USB connector. Board outline and hole positions are not modeled.",
  },
  {
    id: "pico-pcb",
    name: "Raspberry Pi Pico PCB",
    category: "Electronics",
    shape: "box",
    length: 51,
    width: 21,
    height: 1,
    source: "https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf",
    page: 7,
    quote: "The Raspberry Pi Pico is a single sided 51×21 mm 1 mm thick PCB",
    note: "Bare PCB approximation only. USB connector, chips, solder and headers are excluded; measure the complete populated board before designing a housing.",
  },
  {
    id: "plate",
    name: "Mounting plate",
    category: "Mechanical",
    shape: "box",
    length: 80,
    width: 60,
    height: 3,
  },
  {
    id: "shaft",
    name: "Drive shaft",
    category: "Mechanical",
    shape: "cylinder",
    length: 60,
    diameter: 12,
  },
  {
    id: "sleeve",
    name: "Bearing sleeve",
    category: "Mechanical",
    shape: "tube",
    length: 20,
    diameter: 20,
    innerDiameter: 12,
  },
  {
    id: "spacer",
    name: "Hollow spacer",
    category: "Mechanical",
    shape: "tube",
    length: 10,
    diameter: 8,
    innerDiameter: 4,
  },
  {
    id: "wheel",
    name: "Wheel blank",
    category: "Mechanical",
    shape: "cylinder",
    length: 10,
    diameter: 40,
  },
  {
    id: "enclosure",
    name: "Open enclosure",
    category: "Custom",
    shape: "box",
    length: 90,
    width: 65,
    height: 25,
    pocket: { wall: 2, floor: 2 },
  },
  {
    id: "motor",
    name: "Motor space reservation",
    category: "Envelope",
    shape: "cylinder",
    note: "Conceptual envelope only. Enter actual motor length and diameter; no internal motor geometry is inferred.",
  },
  {
    id: "board",
    name: "Purchased board envelope",
    category: "Electronics",
    shape: "box",
    note: "Enter the complete occupied dimensions including connectors and components from the vendor or your measurements.",
  },
] as const;
export function starterPart(id: string): ComponentSpec {
  const row = STARTER_PARTS.find((p) => p.id === id);
  if (!row) throw new Error("Unknown library part");
  const p = row as typeof row & {
    length?: number;
    width?: number;
    height?: number;
    diameter?: number;
    innerDiameter?: number;
    source?: string;
    page?: number;
    quote?: string;
    note?: string;
    pocket?: { wall: number; floor: number };
  };
  return ComponentSchema.parse({
    id: crypto.randomUUID(),
    name: p.name,
    description:
      p.note ||
      "Editable starting dimensions for a generic prototype. Not extracted from a product or certified to a standard.",
    shape: p.shape,
    dimensions: {
      length: p.length ?? null,
      width: p.width ?? null,
      height: p.height ?? null,
      diameter: p.diameter ?? null,
      innerDiameter: p.innerDiameter ?? null,
    },
    material: "Not specified",
    sourcePage: p.page || 1,
    sourceQuote:
      p.quote ||
      "User-adjustable prototype template; dimensions are design choices, not verified product specifications.",
    basis: p.source ? "source-text" : "user-entered",
    referenceUrl: p.source,
    templateId: p.id,
    role:
      p.source || p.category === "Envelope" || p.id === "board"
        ? "envelope"
        : "custom",
    pocket: p.pocket,
    connections: [],
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    rights: {
      status: "unknown",
      note: "Template code is Apache-2.0; product, design and patent rights are not cleared.",
    },
  });
}
export const HousingInput = z.object({
  clearance: z.number().min(0.05).max(100),
  wall: z.number().min(0.2).max(100),
  floor: z.number().min(0.2).max(100),
});
export function envelopeSize(
  p: ComponentSpec,
): [number, number, number] | null {
  if (!buildable(p)) return null;
  const d = p.dimensions;
  return p.shape === "box"
    ? [d.length!, d.width!, d.height!]
    : [d.diameter!, d.diameter!, d.length!];
}
export function housingFor(
  p: ComponentSpec,
  input: z.infer<typeof HousingInput>,
): ComponentSpec {
  const { clearance, wall, floor } = HousingInput.parse(input),
    size = envelopeSize(p);
  if (!size)
    throw new Error(
      "Provide all occupied dimensions before creating a housing.",
    );
  return ComponentSchema.parse({
    ...starterPart("enclosure"),
    id: crypto.randomUUID(),
    name: (p.name + " housing").slice(0, 150),
    description:
      "Open-top custom housing around a bounding envelope. User-selected clearance, wall and floor; not a validated mechanical fit.",
    dimensions: {
      length: size[0] + 2 * (clearance + wall),
      width: size[1] + 2 * (clearance + wall),
      height: size[2] + 2 * clearance + floor,
      diameter: null,
      innerDiameter: null,
    },
    pocket: { wall, floor, targetId: p.id },
    rotation: [...p.rotation],
    position: add(p.position, rotate([0, 0, -floor / 2], p.rotation)),
    connections: [`Space reservation for ${p.name}`],
    sourceQuote:
      "Computed from reviewed target dimensions and user-selected housing parameters. No mounting or electrical compatibility inferred.",
  });
}
const add = (a: number[], b: number[]): [number, number, number] => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
function rotate(
  v: number[],
  degrees: number[],
  inverse = false,
): [number, number, number] {
  let [x, y, z] = v;
  for (const axis of inverse ? [2, 1, 0] : [0, 1, 2]) {
    const a = ((degrees[axis] * Math.PI) / 180) * (inverse ? -1 : 1),
      c = Math.cos(a),
      s = Math.sin(a);
    if (axis === 0) [y, z] = [y * c - z * s, y * s + z * c];
    if (axis === 1) [x, z] = [x * c + z * s, -x * s + z * c];
    if (axis === 2) [x, y] = [x * c - y * s, x * s + y * c];
  }
  return [x, y, z];
}
export function fitInHousing(h: ComponentSpec, p: ComponentSpec) {
  const hs = envelopeSize(h),
    ps = envelopeSize(p);
  if (!h.pocket || h.shape !== "box" || !hs || !ps)
    return { status: "unknown" as const, gapsMm: [] };
  const lo = [
      -hs[0] / 2 + h.pocket.wall,
      -hs[1] / 2 + h.pocket.wall,
      -hs[2] / 2 + h.pocket.floor,
    ],
    hi = [hs[0] / 2 - h.pocket.wall, hs[1] / 2 - h.pocket.wall, hs[2] / 2];
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const x of [-ps[0] / 2, ps[0] / 2])
    for (const y of [-ps[1] / 2, ps[1] / 2])
      for (const z of [-ps[2] / 2, ps[2] / 2]) {
        const world = add(rotate([x, y, z], p.rotation), p.position);
        const local = rotate(
          world.map((v, i) => v - h.position[i]),
          h.rotation,
          true,
        );
        local.forEach((v, i) => {
          min[i] = Math.min(min[i], v);
          max[i] = Math.max(max[i], v);
        });
      }
  const gaps = lo
    .flatMap((v, i) => [min[i] - v, hi[i] - max[i]])
    .map((v) => Math.round(v * 1000) / 1000);
  return {
    status: gaps.every((v) => v >= -0.001)
      ? ("fits-envelope" as const)
      : ("does-not-fit" as const),
    gapsMm: gaps,
  };
}
export function mergeAssembly(
  existing: AssemblySpec,
  incoming: AssemblySpec,
): AssemblySpec {
  const parsed = AssemblySchema.parse(incoming);
  if (existing.components.length + parsed.components.length > 20)
    throw new Error(
      "An assembly supports at most 20 components. Remove parts or split the project.",
    );
  const ids = new Map(
    parsed.components.map((p) => [p.id, crypto.randomUUID()]),
  );
  return AssemblySchema.parse({
    ...existing,
    components: [
      ...existing.components,
      ...parsed.components.map((p) => ({
        ...p,
        id: ids.get(p.id)!,
        pocket: p.pocket
          ? {
              ...p.pocket,
              targetId: p.pocket.targetId
                ? ids.get(p.pocket.targetId) || p.pocket.targetId
                : undefined,
            }
          : undefined,
      })),
    ],
    limitations: [
      ...new Set([...existing.limitations, ...parsed.limitations]),
    ].slice(0, 20),
  });
}
export function billOfMaterials(spec: AssemblySpec) {
  const subtotals: Record<string, number> = {};
  let unpriced = 0;
  const rows = spec.components.map((p) => {
    const c = p.commerce;
    if (c?.unitPrice != null)
      subtotals[c.currency] =
        (subtotals[c.currency] || 0) + Math.round(c.unitPrice * 100);
    else unpriced++;
    return {
      id: p.id,
      name: p.name,
      quantity: 1,
      unitPrice: c?.unitPrice ?? null,
      currency: c?.currency ?? null,
      url: c?.url || p.referenceUrl || "",
      priceBasis: c ? "User-entered, not a live quote" : "Not priced",
      rightsStatus: p.rights?.status || "unknown",
      rightsEvidence: p.rights?.evidenceUrl || "",
    };
  });
  return {
    rows,
    subtotals: Object.fromEntries(
      Object.entries(subtotals).map(([k, v]) => [k, v / 100]),
    ),
    unpriced,
    limitations:
      "Known purchase prices only. No taxes, shipping, manufacturing cost or royalties estimated. No currency conversion.",
  };
}
export function bomCSV(spec: AssemblySpec) {
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[\s]*[=+@-]/, (match) => "'" + match)
      .replaceAll('"', '""') +
    '"';
  const rows = billOfMaterials(spec).rows;
  return [
    [
      "Part",
      "Quantity",
      "Unit price",
      "Currency",
      "Product URL",
      "Price basis",
      "Rights declaration",
      "Rights evidence",
    ],
    ...rows.map((p) => [
      p.name,
      1,
      p.unitPrice,
      p.currency,
      p.url,
      p.priceBasis,
      p.rightsStatus,
      p.rightsEvidence,
    ]),
  ]
    .map((r) => r.map(cell).join(","))
    .join("\r\n");
}
export function inspectAssembly(raw: unknown) {
  const spec = AssemblySchema.parse(raw);
  return {
    title: spec.title,
    goal: spec.goal || "",
    bom: billOfMaterials(spec),
    measurementsRequired: spec.components
      .filter((p) => !buildable(p))
      .map((p) => ({
        id: p.id,
        name: p.name,
        reason:
          p.role === "imported"
            ? "Imported CAD source required; geometry not recoverable from parameters alone"
            : "Geometry or required measurements missing",
      })),
    fitChecks: spec.components
      .filter((p) => p.pocket)
      .map((h) => {
        const target = spec.components.find((p) => p.id === h.pocket?.targetId);
        return {
          housing: h.id,
          target: h.pocket?.targetId || null,
          ...(target
            ? fitInHousing(h, target)
            : { status: "unknown", gapsMm: [] }),
        };
      }),
    rights: spec.components.map((p) => ({
      id: p.id,
      status: p.rights?.status || "unknown",
      evidence: p.rights?.evidenceUrl || null,
      verified: false,
    })),
    patentClearance: "NOT ESTABLISHED",
    limitations: [
      "No patent search performed by this operation. Zero search results never establish permission to manufacture.",
      "Envelope fit is not a strength, motion, thermal, electrical, tolerance or printer simulation.",
      "Purchase costs exclude taxes, shipping, production costs and royalties. Rights declarations require independent review.",
    ],
  };
}
