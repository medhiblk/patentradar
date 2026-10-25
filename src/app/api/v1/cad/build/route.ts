import { guard } from "@/lib/security";
import { requireUser } from "@/lib/platform/auth";
import { AssemblySchema, buildable } from "@/lib/cad/schema";
import { cadWorker } from "@/lib/cad/worker";
import { apiError, readApiJson } from "@/lib/api/public";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    guard(req);
    try {
      requireUser(req);
    } catch {
      return Response.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message:
              "A signed-in session or developer bearer token is required.",
          },
        },
        { status: 401 },
      );
    }
    const spec = AssemblySchema.parse(await readApiJson(req));
    if (!spec.components.length || spec.components.some((c) => !buildable(c)))
      return Response.json(
        {
          error: {
            code: "MEASUREMENTS_REQUIRED",
            message:
              "Supply every required dimension; missing measurements are never invented.",
          },
        },
        { status: 422 },
      );
    return Response.json(
      await cadWorker({ action: "build", components: spec.components }),
    );
  } catch (e) {
    return apiError(e);
  }
}
