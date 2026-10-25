import { z } from "zod";
const dimension = z.number().positive().max(2000).nullable();
export const MeasuredComponentSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/),
  name: z.string().min(1).max(150),
  description: z.string().max(1000),
  shape: z.enum(["box", "cylinder", "tube", "unresolved"]),
  dimensions: z.object({
    length: dimension,
    width: dimension,
    height: dimension,
    diameter: dimension,
    innerDiameter: dimension,
  }),
  material: z.string().max(150),
  sourcePage: z.number().int().min(1).max(80),
  sourceQuote: z.string().max(2000),
  basis: z.enum([
    "source-text",
    "visual-unverified",
    "user-entered",
    "unknown",
  ]),
  connections: z.array(z.string().max(150)).max(10),
  position: z.tuple([
    z.number().min(-5000).max(5000),
    z.number().min(-5000).max(5000),
    z.number().min(-5000).max(5000),
  ]),
  rotation: z.tuple([
    z.number().min(-360).max(360),
    z.number().min(-360).max(360),
    z.number().min(-360).max(360),
  ]),
});
export const referenceUrl = z
  .url()
  .max(2000)
  .refine((value) => {
    const u = new URL(value);
    return (
      ["https:", "http:"].includes(u.protocol) && !u.username && !u.password
    );
  }, "Use a public HTTP(S) reference without credentials");
export const ComponentSchema = MeasuredComponentSchema.extend({
  sourceName: z.string().max(250).optional(),
  referenceUrl: referenceUrl.optional(),
  templateId: z.string().max(100).optional(),
  role: z.enum(["measured", "envelope", "custom", "imported"]).optional(),
  pocket: z
    .object({
      wall: z.number().min(0.2).max(1000),
      floor: z.number().min(0.2).max(1000),
      targetId: z.string().max(50).optional(),
    })
    .optional(),
  commerce: z
    .object({
      url: referenceUrl,
      unitPrice: z.number().min(0).max(10000000).nullable(),
      currency: z.enum(["EUR", "USD", "GBP", "CNY", "JPY"]),
      recordedAt: z.iso.datetime(),
      basis: z.literal("user-entered"),
    })
    .optional(),
  rights: z
    .object({
      status: z.enum(["unknown", "permission-documented", "review-required"]),
      evidenceUrl: referenceUrl.optional(),
      note: z.string().max(1000),
    })
    .optional(),
});
// Keep AI extraction schema separate from user procurement/licensing declarations.
export const DocumentAssemblySchema = z.object({
  title: z.string().max(200),
  components: z.array(MeasuredComponentSchema).max(20),
  limitations: z.array(z.string().max(1000)).max(20),
});
export const AssemblySchema = z
  .object({
    title: z.string().max(200),
    components: z.array(ComponentSchema).max(20),
    limitations: z.array(z.string().max(1000)).max(20),
    goal: z.string().max(1000).optional(),
  })
  .refine(
    (spec) =>
      new Set(spec.components.map((p) => p.id)).size === spec.components.length,
    "Component IDs must be unique",
  );
export type ComponentSpec = z.infer<typeof ComponentSchema>;
export type AssemblySpec = z.infer<typeof AssemblySchema>;
export const requiredDimensions = (p: ComponentSpec) =>
  p.shape === "box"
    ? (["length", "width", "height"] as const)
    : p.shape === "tube"
      ? (["length", "diameter", "innerDiameter"] as const)
      : (["length", "diameter"] as const);
export const buildable = (p: ComponentSpec) =>
  p.shape !== "unresolved" &&
  requiredDimensions(p).every(
    (k) => Number.isFinite(p.dimensions[k]) && p.dimensions[k]! > 0,
  ) &&
  (!p.pocket ||
    (p.shape === "box" &&
      p.dimensions.length! > 2 * p.pocket.wall &&
      p.dimensions.width! > 2 * p.pocket.wall &&
      p.dimensions.height! > p.pocket.floor));
export function extractMeasured(
  pages: { page: number; text: string }[],
): AssemblySpec {
  const components: ComponentSpec[] = [];
  for (const page of pages)
    for (const line of page.text.split(/[\n\r;]+/)) {
      const box = line.match(
        /(.{1,100}?)\s+(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*mm\b/i,
      );
      const diameter = line.match(
          /(?:diameter|diamètre|[Øø])\s*[:=]?\s*(\d+(?:\.\d+)?)\s*mm/i,
        ),
        length = line.match(
          /(?:length|longueur)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*mm/i,
        );
      const inner = line.match(
        /(?:inner diameter|diamètre intérieur)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*mm/i,
      );
      if (!box && !(diameter && length)) continue;
      components.push(
        ComponentSchema.parse({
          id: "component-" + (components.length + 1),
          name: box?.[1].trim() || line.slice(0, 60),
          description: line.slice(0, 1000),
          shape: box ? "box" : inner ? "tube" : "cylinder",
          dimensions: {
            length: box ? Number(box[2]) : Number(length![1]),
            width: box ? Number(box[3]) : null,
            height: box ? Number(box[4]) : null,
            diameter: box ? null : Number(diameter![1]),
            innerDiameter: !box && inner ? Number(inner[1]) : null,
          },
          material: "Not specified",
          sourcePage: page.page,
          sourceQuote: line.slice(0, 2000),
          basis: "source-text",
          connections: [],
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        }),
      );
      if (components.length === 20) break;
    }
  // Conservative local fallback: only explicit component-list entries, not inferred geometry.
  for (const page of pages) {
    if (
      !/components|parts list|bill of materials|composants|nomenclature|liste des pièces/i.test(
        page.text,
      )
    )
      continue;
    for (const line of page.text.split(/[\n\r]+/)) {
      const entry = line.match(/^\s*(?:[-•*]|\d{1,3}[.)])\s+(.{2,120})$/);
      if (
        !entry ||
        !/\b(rotor|stator|shaft|bearing|piston|valve|gear|housing|crankshaft|arbre|roulement|carter|bielle|engrenage|carte|board)\b/i.test(
          entry[1],
        )
      )
        continue;
      const name = entry[1].trim();
      if (
        components.length >= 20 ||
        components.some(
          (p) =>
            p.name.toLowerCase() === name.toLowerCase() ||
            p.sourceQuote === line,
        )
      )
        continue;
      components.push(
        ComponentSchema.parse({
          id: "component-" + (components.length + 1),
          name,
          description:
            "Explicit component-list entry. Geometry and dimensions need review.",
          shape: "unresolved",
          dimensions: {
            length: null,
            width: null,
            height: null,
            diameter: null,
            innerDiameter: null,
          },
          material: "Not specified",
          sourcePage: page.page,
          sourceQuote: line,
          basis: "source-text",
          role: "measured",
          connections: [],
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        }),
      );
    }
  }
  return {
    title: "Measured document reconstruction",
    components: components.slice(0, 20),
    limitations: [
      "Local rules recognize explicit mm dimensions for boxes, cylindrical shafts and explicitly dimensioned tubes only. Shapes are parametric approximations. Connections and placements require user validation.",
    ],
  };
}
