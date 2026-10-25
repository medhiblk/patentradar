import assert from "node:assert/strict";
import { PatentSchema } from "@formaproof/contracts";
import { AssemblySchema } from "@formaproof/engineering";
import { FormaProofClient, mcpClientConfig, checkPublicMcp } from "@formaproof/sdk";

// This is a runnable integration check, not fabricated patent search data.
assert.equal(PatentSchema.safeParse({}).success, false);
assert.equal(typeof AssemblySchema.safeParse, "function");
const baseUrl = process.env.FORMAPROOF_API_URL || "http://localhost:3000";
const client = new FormaProofClient({ baseUrl });
assert.equal(mcpClientConfig(baseUrl).mcpServers.patentradar.url, client.mcpUrl);
console.log("Shared contracts, engineering package, SDK and MCP configuration imported successfully.");

if (process.env.FORMAPROOF_API_URL) {
  const publication = await client.lookupPatent({ publicationNumber: "EP1000000A1", publicationDate: "20000517" });
  assert.ok(publication.patents.length, "The real public lookup returned no publication.");
  console.log(JSON.stringify({ patents: publication.patents.map(p => ({ publicationNumber: p.publicationNumber, source: p.source, sourceUrl: p.sourceUrl, claims: p.claims?.length || 0 })) }));
  console.log(JSON.stringify(await checkPublicMcp(client.mcpUrl, AbortSignal.timeout(20000))));
}
