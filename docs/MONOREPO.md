# Integrating FormaProof / PatentRadar

The repository is an npm-workspaces monorepo. Run commands from its root with Node 24+ and npm. There is one lockfile, one existing Next.js application and three reusable packages. API/MCP routes remain inside the application; they were not split into new services.

## Run and develop

```bash
npm ci
cp apps/web/.env.example apps/web/.env.local # optional; no keys needed for local CAD
npm run dev
```

`npm ci` builds shared packages and copies the unmodified CAD/PDF runtime assets into `apps/web/public`. `npm run dev` watches shared package sources and starts Next.js on port 3000. Production: `npm run build && npm start`. Do not run workspace-only install commands: install dependencies from the repository root.

| Directory | Contract |
| --- | --- |
| `apps/web` | Public UI, private portfolio, API/MCP routes, provider adapters, browser CAD worker and app tests |
| `packages/contracts` | Zod validators/types for patent evidence, invention profiles, audit records and API inputs |
| `packages/engineering` | Shared component/assembly schemas, starter catalog, housing and workbench operations; no CAD kernel bundled |
| `packages/sdk` | Typed HTTP client, incremental NDJSON search reader and public MCP connection utilities |
| `services/cad` | Optional native CadQuery worker, dependencies and tests |
| `docs`, `scripts` | Shared handoff/operations documentation and root tooling |

Shared package exports are compiled ESM with declarations. Node 24 supports their use from ESM and CommonJS. Existing application imports re-export these canonical contracts, avoiding divergent schema copies. The packages do not import Next.js, server environment variables or private storage.

## Add another application

Create `apps/your-app/package.json` with its own unique name and add the desired local dependencies at version `0.1.0`:

```json
{
  "name": "@your-team/application",
  "private": true,
  "dependencies": {
    "@formaproof/sdk": "0.1.0",
    "@formaproof/contracts": "0.1.0",
    "@formaproof/engineering": "0.1.0"
  }
}
```

Run `npm install` at the root and commit its lockfile change. Import the packages by their names. Add app-specific build/check scripts explicitly; the root build intentionally builds the existing deployable web app. Do not import `apps/web/src` into another application.

## Use in a separate repository

These packages are not published to the npm registry. Generate installable artifacts:

```bash
npm run sdk:pack
# In the target project, install all needed artifacts together:
npm install /path/to/artifacts/formaproof-contracts-0.1.0.tgz /path/to/artifacts/formaproof-sdk-0.1.0.tgz /path/to/artifacts/formaproof-engineering-0.1.0.tgz
```

`examples/integration.mjs` exercises the installed packages without networking. Set `FORMAPROOF_API_URL` explicitly to perform a real publication lookup and MCP handshake; it sends only the public example publication number/date, not an invention document.

```js
import { FormaProofClient } from "@formaproof/sdk";
const client = new FormaProofClient({ baseUrl: "https://patentradar-puce.vercel.app" });
for await (const event of client.streamSearch({
  query: "optical sample detection",
  shareQuery: true // explicit approval to send these short concepts externally
})) {
  if (event.candidate) console.log(event.candidate.publicationNumber, event.candidate.sourceUrl);
  if (event.result) console.log(event.result.patents.length);
}
```

The SDK validates input and response schemas, preserves provider provenance, honors cancellation/timeouts and rejects incomplete streams. Received candidates remain partial until `completed`. `compareFeatures` compares supplied evidence lexically; it does not authenticate caller-supplied records or provide legal clearance. Exact publication lookup currently requires an EP A/B number and publication date. Broader research depends on provider coverage and configuration.

HTTP endpoints remain `/api/v1/*`; remote MCP remains `/api/mcp`. `@formaproof/sdk/mcp` exports `mcpClientConfig`, `mcpEndpoint` and the real protocol probe. See [API/MCP reference](API_MCP.md).

## Private data and native CAD

Default local data now lives in `apps/web/.data`, relative to the web process. Existing local data is preserved during this migration. For a durable or shared deployment, configure the documented private backend or an absolute persistent `PATENTRADAR_DATA_DIR`. Do not commit private attachments, SQLite databases or `.env.local`. Separate development and production stores.

Browser OpenCascade remains the default CAD runtime. The original native worker lives in `services/cad`; preparation copies it into `apps/web/cad` for the existing server runtime and file tracing. Configure an absolute `CAD_PYTHON` only on a host with the pinned Python dependencies installed. Vercel does not acquire a Python CAD runtime from this migration. AI processing still requires configured access and user consent. BigQuery remains configuration-dependent; this migration does not claim a successful authenticated query.

## Deploy the monorepo

Vercel project settings:

| Setting | Value |
| --- | --- |
| Root directory | `apps/web` |
| Include source outside root directory | enabled |
| Framework | Next.js |
| Node | 24.x |
| Install command | `cd ../.. && npm ci` |
| Build command | `cd ../.. && npm run build` |
| Output directory | framework default (`.next` in `apps/web`) |

Run all root commands from the repository root locally. Docker build context is also the root: `Dockerfile.web` provides browser CAD; `Dockerfile` optionally adds Python/CadQuery. Docker requires separate validation on a Docker-capable host.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check:private-build
npm run test:e2e
PATENTRADAR_BROWSER=webkit npm run test:e2e -- tests/e2e/document-upload.spec.ts
npm run check:sdk # packed artifacts installed and typechecked in an isolated consumer
node examples/integration.mjs
```

The root E2E script forwards flags and file filters to Playwright. Install browser binaries/system libraries for your environment first. GitHub Actions runs root checks and the native worker tests from `services/cad`. Older audit documents retain their historical paths; prepend `apps/web/` to former `src`, `tests`, `public` and application configuration paths.
