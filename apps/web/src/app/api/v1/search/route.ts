import { guard } from "@/lib/security";
import { publicSearch, apiError, readApiJson } from "@/lib/api/public";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    guard(req);
    return Response.json(
      await publicSearch(await readApiJson(req), req.signal),
    );
  } catch (e) {
    return apiError(e);
  }
}
