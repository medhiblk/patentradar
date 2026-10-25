import { guard } from "@/lib/security";
import { apiError, readApiJson } from "@/lib/api/public";
import { inspectAssembly } from "@/lib/cad/workbench";
export async function POST(req: Request) {
  try {
    guard(req);
    return Response.json(inspectAssembly(await readApiJson(req)));
  } catch (e) {
    return apiError(e);
  }
}
