import { ComponentSchema } from "@/lib/cad/schema";
import { z } from "zod";
import { guard } from "@/lib/security";
import { cadWorker } from "@/lib/cad/worker";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    guard(req);
    const form = await req.formData(),
      f = form.get("file");
    if (
      !(f instanceof File) ||
      f.size > 4 * 1024 * 1024 ||
      !/\.(step|stp)$/i.test(f.name)
    )
      throw new Error("Choose a STEP file up to 4 MB");
    const placements = z
      .array(ComponentSchema.pick({ id: true, position: true, rotation: true }))
      .max(20)
      .parse(JSON.parse(String(form.get("placements") || "[]")));
    return Response.json(
      await cadWorker({
        action: "import",
        placements,
        file: Buffer.from(await f.arrayBuffer()).toString("base64"),
      }),
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 400 },
    );
  }
}
