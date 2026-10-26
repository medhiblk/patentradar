/** Public connection metadata. Never put account credentials or tokens here. */
export const MCP_CONNECTION = {
  name: "FormaProof · PatentRadar",
  serverId: "patentradar",
  endpointPath: "/api/mcp",
  transport: "streamable-http",
  pluginsUrl: "https://chatgpt.com/plugins",
  documentation:
    "https://developers.openai.com/api/docs/guides/custom-mcp-server",
  quickstart: "https://developers.openai.com/plugins/quickstart",
} as const;
export const PUBLIC_MCP_TOOLS = [
  {
    name: "query_source",
    title: "Query a specific source",
    detail: "Query one public provider with explicit consent and inspect its outcome and source attribution.",
  },
  {
    name: "provider_status",
    title: "Check source coverage",
    detail: "See available providers and their reported capabilities.",
  },
  {
    name: "search_patents",
    title: "Find related inventions",
    detail:
      "Search patent metadata and literature with approved generic concepts.",
  },
  {
    name: "spot_patent_text",
    title: "Check a technical document",
    detail:
      "Match user-approved text against indexed public patent evidence; optional exact EPO verification, no external AI.",
  },
  {
    name: "lookup_patent",
    title: "Open an EP publication",
    detail:
      "Retrieve a publication by number and date, with claims when available.",
  },
  {
    name: "compare_patent_features",
    title: "Compare technical evidence",
    detail:
      "Explain lexical overlap with supplied evidence and its limitations.",
  },
  {
    name: "extract_technical_profile",
    title: "Review technical features",
    detail: "Extract a literal profile from text approved for this server.",
  },
  {
    name: "component_library",
    title: "Explore component templates",
    detail: "Find editable templates and linked manufacturer footprints.",
  },
  {
    name: "inspect_assembly",
    title: "Inspect an assembly",
    detail:
      "Check missing dimensions, housing envelopes and known entered costs.",
  },
] as const;
export function mcpEndpoint(origin: string) {
  return new URL(MCP_CONNECTION.endpointPath, origin).href;
}
export function mcpClientConfig(origin: string) {
  return { mcpServers: { patentradar: { url: mcpEndpoint(origin) } } };
}
