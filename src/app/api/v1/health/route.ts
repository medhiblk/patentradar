export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({
    name: "PatentRadar",
    apiVersion: "v1",
    status: "ready",
    mcp: {
      endpoint: "/api/mcp",
      transport: "streamable-http",
      authentication:
        "Public tools anonymous; private tools require scoped bearer token",
    },
    capabilities: {
      publicPatentSearch: "available with partial source coverage and quotas",
      exactLookup: "EP A/B + publication date",
      comparison: "lexical, client-supplied evidence",
      privateStorage:
        process.env.VERCEL && !process.env.PATENTRADAR_DATA_DIR
          ? "not-configured"
          : "local-server",
      browserCAD:
        "Available at /engineering: OpenCascade WASM, no account or Python required",
      cad: process.env.CAD_PYTHON
        ? "configured; verify by actual build"
        : "not-configured",
    },
    documentation: "/developers",
    openapi: "/api/v1/openapi.json",
  });
}
