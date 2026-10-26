# FormaProof in a regular ChatGPT conversation

## Connect on ChatGPT web

1. Open https://chatgpt.com/plugins and choose **+ → Add custom MCP server** where your account/workspace permits it.
2. Use the name **FormaProof** and URL **https://patentradar-puce.vercel.app/api/mcp**.
3. Select **No authentication** for the public tools. Leave the optional icon empty, or use https://patentradar-puce.vercel.app/formaproof-mcp-icon.png (256 × 256 PNG, 874 bytes).
4. Acknowledge the connection notice, create the plugin and review the tools.
5. Start a new regular conversation, type **@** and select FormaProof.
6. Ask: **Use FormaProof to show the available patent providers and their coverage limits. Then show the mechanical component library.**

Codex and a ZIP installation are not required for this route. The downloadable portable package is a separate installation option for supporting clients; downloading it alone does not connect ChatGPT.

Custom MCP availability depends on the account, plan and workspace permissions. If creation is missing, consult the workspace admin and the current OpenAI guide. A hosted MCP server or an uploaded private package does not establish a public directory listing.

Official connection guidance: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt

## Compatibility fix, 2026-10-26

A real production `initialize` request including `Origin: https://chatgpt.com` returned HTTP 429 with `Rate limit or origin rejected`. A no-Origin official SDK connection succeeded. This demonstrates an origin compatibility failure; it does not establish that it was the only cause of any prior ChatGPT form rejection.

The MCP route now allows the exact origins `https://chatgpt.com` and `https://chat.openai.com`, in addition to the existing same-host/no-Origin paths. This exception is scoped to MCP; the default guard on account/file routes stays same-origin. Untrusted, malformed, path-bearing and lookalike origins are rejected with HTTP 403. Rate-limit failures retain HTTP 429 and now include `Retry-After: 60`.

The tools, existing anonymous/private boundary, server URL, consent requirements and stateless Streamable HTTP transport are unchanged. Anonymous calls never receive private portfolio tools. No wildcard origin or authentication bypass has been added. GET remains HTTP 405, as permitted for this stateless POST-only transport; opening the endpoint as an ordinary browser page is not a connection test.

## Repeatable checks

From the monorepo root:

```sh
npm run build:packages
npm exec --workspace @formaproof/web -- vitest run tests/api-mcp.test.ts tests/mcp-connection.test.ts
npm run typecheck
PATENTRADAR_URL=https://patentradar-puce.vercel.app node --use-env-proxy scripts/verify-mcp-connection.mjs
PATENTRADAR_URL=https://patentradar-puce.vercel.app PATENTRADAR_MCP_ORIGIN=https://chatgpt.com node --use-env-proxy scripts/verify-mcp-connection.mjs
```

The SDK checks initialize, discover tools and execute a real component-library call without mocks. They do not log into ChatGPT or establish that an account-specific connection has been installed. Allow for the public route's 20-request/minute per-IP limit when repeating checks.

## Evidence limits and privacy

Get approval before sending confidential text to the FormaProof server. External providers should receive approved short non-confidential queries. Tools return preliminary research with partial coverage; missing results do not establish novelty, patent clearance or permission to manufacture.
