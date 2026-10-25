import { openapi } from "@/lib/api/openapi";
export async function GET() {
  return Response.json(openapi, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
