import { STARTER_PARTS } from "@/lib/cad/workbench";
export async function GET() {
  return Response.json(
    {
      parts: STARTER_PARTS,
      templateCodeLicense: "Apache-2.0",
      coverage:
        "Generic starting templates and linked manufacturer footprint evidence. No product/patent rights cleared; no live prices or remote CAD downloads.",
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
