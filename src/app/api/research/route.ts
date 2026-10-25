import { guard, failure } from "@/lib/security";
import { ResearchSchema } from "@/lib/model";
import { execute } from "@/lib/search/orchestrator";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    guard(req);
    return Response.json(
      await execute(
        ResearchSchema.parse(await req.json()),
        undefined,
        req.signal,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
