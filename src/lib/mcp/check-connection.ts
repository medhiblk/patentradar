import { PUBLIC_MCP_TOOLS } from "./connection";
/** Test the anonymous protocol, not account access or provider search health. */
export async function checkPublicMcp(endpoint: string, signal: AbortSignal) {
  let protocol = "2025-03-26";
  async function rpc(message: object, notification = false) {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": protocol,
      },
      body: JSON.stringify(message),
    });
    if (!response.ok)
      throw Error(
        response.status === 429
          ? "Too many checks. Wait one minute and retry."
          : `MCP connection unavailable (HTTP ${response.status}). Retry shortly.`,
      );
    if (notification) return;
    const body = await response.json();
    if (body.error || !body.result)
      throw Error("The MCP server did not complete protocol discovery.");
    return body.result;
  }
  const initialized = await rpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: protocol,
      capabilities: {},
      clientInfo: { name: "formaproof-connection-check", version: "1.0.0" },
    },
  });
  if (
    typeof initialized.protocolVersion !== "string" ||
    typeof initialized.serverInfo?.name !== "string"
  )
    throw Error("Invalid MCP initialization response.");
  protocol = initialized.protocolVersion;
  await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, true);
  const listed = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const names = Array.isArray(listed.tools)
    ? listed.tools
        .map((tool: { name?: unknown }) => tool.name)
        .filter((name: unknown): name is string => typeof name === "string")
    : [];
  if (!PUBLIC_MCP_TOOLS.every((tool) => names.includes(tool.name)))
    throw Error(
      "The server did not expose all expected public tools. Retry after the deployment finishes.",
    );
  return {
    server: initialized.serverInfo.name as string,
    protocol,
    tools: PUBLIC_MCP_TOOLS.map((tool) => tool.name),
    checkedAt: new Date().toISOString(),
  };
}
