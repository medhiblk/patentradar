export async function GET() {
  return Response.json({
    name: "PatentRadar",
    version: "1.1.0",
    transport: "streamable-http",
    endpoint: "/api/mcp",
    publicTools: [
      "provider_status",
      "search_patents",
      "lookup_patent",
      "compare_patent_features",
      "extract_technical_profile",
    ],
    authentication: { public: "none", private: "scoped bearer token" },
    documentation: "/developers",
    openapi: "/api/v1/openapi.json",
  });
}
