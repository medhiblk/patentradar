import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { writeFile } from 'node:fs/promises';
const base = process.env.PATENTRADAR_URL || 'http://127.0.0.1:3000';
const client = new Client({ name: 'formaproof-public-connection-verifier', version: '1.0.0' });
try {
  const origin = process.env.PATENTRADAR_MCP_ORIGIN;
  await client.connect(new StreamableHTTPClientTransport(new URL('/api/mcp', base),
    origin ? { requestInit: { headers: { Origin: origin } } } : undefined));
  const { tools } = await client.listTools();
  const names = tools.map(t => t.name);
  const expected = ['provider_status','search_patents','spot_patent_text','lookup_patent','compare_patent_features','extract_technical_profile','component_library','inspect_assembly'];
  if (!expected.every(name => names.includes(name)) || names.includes('list_my_projects')) throw Error('Unexpected anonymous tool discovery');
  const result = await client.callTool({ name: 'component_library', arguments: {} });
  if (result.isError) throw Error('Component library tool failed');
  const payload = JSON.parse(result.content.find(item => item.type === 'text').text);
  if (!payload.parts?.length || payload.patentClearance !== 'NOT ESTABLISHED') throw Error('Unexpected component tool response');
  const proof = { base, requestOrigin: origin || null, checkedAt: new Date().toISOString(), passed: true, server: client.getServerVersion(), tools: names, componentLibraryItems: payload.parts.length, method: 'Official MCP SDK initialization, tool discovery and a real read-only tool call; no mocks.', externalProviderSearchPerformed: false, chatgptAccountInstallationPerformed: false };
  console.log(JSON.stringify(proof, null, 2));
  if (process.env.PATENTRADAR_VERIFY_OUTPUT) await writeFile(process.env.PATENTRADAR_VERIFY_OUTPUT, JSON.stringify(proof, null, 2)+'\n');
} finally { await client.close(); }
