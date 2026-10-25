import { guard } from "@/lib/security";
import { publicCompare, apiError, readApiJson } from "@/lib/api/public";
export async function POST(req: Request) {
  try {
    guard(req);
    return Response.json(publicCompare(await readApiJson(req)));
  } catch (e) {
    return apiError(e);
  }
}
