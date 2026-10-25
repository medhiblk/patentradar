import { z } from "zod";
const dimension = z.number().positive().max(2000).nullable();
export const ComponentSchema = z.object({
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
export const AssemblySchema = z.object({
  title: z.string().max(200),
  components: z.array(ComponentSchema).max(20),
  limitations: z.array(z.string().max(1000)).max(20),
});
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
  requiredDimensions(p).every((k) => p.dimensions[k] !== null);
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
  return {
    title: "Measured document reconstruction",
    components: components.slice(0, 20),
    limitations: [
      "Local rules recognize explicit mm dimensions for boxes, cylindrical shafts and explicitly dimensioned tubes only. Shapes are parametric approximations. Connections and placements require user validation.",
    ],
  };
}
