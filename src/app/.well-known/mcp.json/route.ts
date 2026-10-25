import { MCP_CONNECTION, PUBLIC_MCP_TOOLS } from "@/lib/mcp/connection";
export async function GET() {
  return Response.json({
    name: "PatentRadar",
    version: "1.2.0",
    transport: "streamable-http",
    endpoint: "/api/mcp",
    displayName: MCP_CONNECTION.name,
    connectionGuide: "/connect",
    publicTools: PUBLIC_MCP_TOOLS.map((tool) => tool.name),
    authentication: { public: "none", private: "scoped bearer token" },
    documentation: "/developers",
    openapi: "/api/v1/openapi.json",
  });
}
