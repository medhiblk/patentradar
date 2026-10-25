import { z } from "zod";
import { request } from "./http";
import { PatentSchema, type PatentRecord } from "./types";
import { normalizePublication } from "../normalize";
const endpoint = "https://www.veyip.com/api/mcp";
export function parseMcp(raw: string) {
  const text = raw.trim();
  const messages = text.startsWith("{")
    ? [JSON.parse(text)]
    : text
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data: "))
        .map((l) => JSON.parse(l.slice(6)));
  const message = messages.find((m) => m.result || m.error);
  if (!message || message.error || message.result?.isError)
    throw new Error("VeyIP MCP returned an error");
  return message.result;
}
async function rpc(method: string, params: object, id: number) {
  const raw = await request(
    "veyip",
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    },
    false,
  );
  return parseMcp(raw);
}
function enabled() {
  if (process.env.ENABLE_EXPERIMENTAL_VEYIP !== "true")
    throw new Error(
      "VeyIP is experimental and disabled: commercial reuse and upstream PatentHub rights must be cleared.",
    );
}
export async function listTools() {
  enabled();
  return rpc("tools/list", {}, 1);
}
export function normalizeVeyip(result: unknown, query: string): PatentRecord[] {
  const data = z
    .object({
      structuredContent: z.object({
        items: z.array(
          z.object({
            documentNumber: z.string(),
            applicationNumber: z.string().optional(),
            title: z.string(),
            applicant: z.string().optional(),
            publicationDate: z.string().optional(),
            ipc: z.string().optional(),
            url: z.string().url(),
          }),
        ),
      }),
    })
    .parse(result);
  return data.structuredContent.items.map((r) =>
    PatentSchema.parse({
      id: r.documentNumber,
      publicationNumber: normalizePublication(r.documentNumber),
      applicationNumber: r.applicationNumber,
      title: r.title,
      applicants: r.applicant ? [r.applicant] : [],
      publicationDate: r.publicationDate,
      jurisdiction: r.documentNumber.slice(0, 2),
      ipcCodes: r.ipc ? [r.ipc] : undefined,
      source: "VeyIP MCP / upstream PatentHub (experimental)",
      sourceUrl: r.url,
      retrievedAt: new Date().toISOString(),
      queries: [query],
    }),
  );
}
export async function search(
  query: string,
  page = 1,
  scope: "cn" | "all" = "cn",
) {
  enabled();
  await rpc(
    "initialize",
    {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "PatentRadar", version: "1.0" },
    },
    1,
  );
  const result = await rpc(
    "tools/call",
    {
      name: "search_patents",
      arguments: { q: query, dataScope: scope, page, pageSize: 5 },
    },
    2,
  );
  return normalizeVeyip(result, query);
}
export async function getClaims(number: string) {
  enabled();
  const n = normalizePublication(number);
  const result = await rpc(
    "tools/call",
    {
      name: "get_patent",
      arguments: { number: n, part: "claims", dataScope: "all", offset: 0 },
    },
    3,
  );
  const parsed = z
    .object({
      structuredContent: z.object({
        documentNumber: z.string(),
        part: z.literal("claims"),
        nextOffset: z.number().nullable().optional(),
      }),
      content: z.array(
        z.object({ type: z.string(), text: z.string().optional() }),
      ),
    })
    .parse(result);
  if (normalizePublication(parsed.structuredContent.documentNumber) !== n)
    throw new Error("MCP publication identifier mismatch");
  return {
    publicationNumber: n,
    content: parsed.content
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("\n"),
    nextOffset: parsed.structuredContent.nextOffset,
    source: "VeyIP / PatentHub, experimental third-party text",
    retrievedAt: new Date().toISOString(),
  };
}
// No arbitrary tools/call endpoint: mutation/consultation tools are deliberately not exposed.
