import { AssemblySchema, buildable } from "@/lib/cad/schema";
import { cadWorker } from "@/lib/cad/worker";
import { guard } from "@/lib/security";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    guard(req);
    const a = AssemblySchema.parse(await req.json());
    if (!a.components.length || a.components.some((c) => !buildable(c)))
      return Response.json(
        {
          error:
            "Supply critical dimensions for every selected component. Missing dimensions are not invented.",
        },
        { status: 422 },
      );
    if (new Set(a.components.map((c) => c.id)).size !== a.components.length)
      throw new Error("Duplicate IDs");
    return Response.json({
      ...(await cadWorker({ action: "build", components: a.components })),
      reconstructionStatus:
        "parametric approximation — requires engineering validation",
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "CAD unavailable" },
      { status: 400 },
    );
  }
}
