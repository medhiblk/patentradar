import { guard } from "@/lib/security";
import { publicLookup, apiError, readApiJson } from "@/lib/api/public";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    guard(req);
    return Response.json(await publicLookup(await readApiJson(req)));
  } catch (e) {
    return apiError(e);
  }
}
