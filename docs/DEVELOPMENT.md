# Development and deployment

[Project overview](../README.md) · [Feature inventory](FEATURES.md)

## Work from any environment

**[Open in GitHub Codespaces](https://codespaces.new/medhiblk/patentradar)** — create a codespace, let `npm ci` finish, then run `npm run dev`. Open forwarded port 3000. The committed dev container uses Node 24; no cloud database or Python account is needed.

Or use a local computer, a VM, a coding agent or any Node environment:

```bash
git clone https://github.com/medhiblk/patentradar.git
cd patentradar
# Node.js 24+; nvm use if you have nvm
npm ci
npm run dev
```

Open http://localhost:3000. `npm ci` restores exact lockfile versions and prepares the self-hosted CAD assets. It does not download customer documents or production credentials. No `.env` is required for browser CAD, local storage and keyless research. To configure optional AI/providers, copy `apps/web/.env.example` to `apps/web/.env.local` and fill only what you need. Never commit secrets.

```bash
# Production build on any supported Node host
npm run build
npm start
```

Each environment has its **own** local accounts/files in `apps/web/.data/` by default. Keep that directory on a persistent volume. Production private documents are **not** cloned from GitHub. To share the same private cloud workspace across trusted deployments, configure the same authorized private Blob backend and sign in separately on each host; see [storage setup](PRIVATE_STORAGE.md). Use a separate store for disposable development environments.

### Lightweight Docker runtime

```bash
docker compose up --build
```

The compose service uses `Dockerfile.web`: Node and browser-based CAD, with persistent account/file storage in a named volume. The existing `Dockerfile` remains the optional, larger Python/CadQuery runtime. Docker configuration must be validated on your target Docker host.

## Monorepo

Four npm workspaces share the same lockfile. The existing app, API and MCP routes keep their URLs.

| Workspace                                          | Responsibility                                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/web` — `@formaproof/web`                     | Next.js app, API/MCP routes, server integrations, private storage, browser CAD and end-to-end tests |
| `packages/contracts` — `@formaproof/contracts`     | Shared Zod schemas for patent records, profiles, search audit and public API inputs                 |
| `packages/engineering` — `@formaproof/engineering` | Framework-independent component/assembly schemas, catalog and parametric workbench operations       |
| `packages/sdk` — `@formaproof/sdk`                 | Typed HTTP client, progressive search reader and MCP connection utilities                           |
| `services/cad`                                     | Optional Python/CadQuery worker and native tests; browser CAD remains the default                   |

[Integration guide and deployment settings](MONOREPO.md) · [Functional inventory](FEATURES.md) · [API contract](API_MCP.md)

```bash
npm run sdk:pack       # creates three installable .tgz files in artifacts/
node examples/integration.mjs  # validates local contracts; no network by default
```

Packages are private workspaces, not published npm packages. Other projects can use the packed artifacts or join this repository as another workspace. Shared packages contain no Next.js or server credential imports.

## Validate changes

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check:private-build
npx playwright install chromium
# On Linux, install browser system dependencies if necessary:
# npx playwright install --with-deps chromium
CHROMIUM_PATH="$(node -p 'require("@playwright/test").chromium.executablePath()')" npm run test:e2e
```

GitHub Actions runs application checks and the separate native CAD tests. External APIs are mocked in automated search tests; separate [discovery evidence](discovery/README.md) records real connectivity. Browser CAD tests execute the real geometry engine.

## Deploy

Import this repository into Vercel with root directory `apps/web`, include sources outside the root, choose Node 24.x, set install command `cd ../.. && npm ci` and build command `cd ../.. && npm run build`. Configure private Blob if you want persistent cloud accounts/files. See [all deployment settings](MONOREPO.md#deploy-the-monorepo). Local SQLite is not persistent on a stateless Vercel function. Optional BigQuery/authenticated providers remain disabled without configuration. Environment values are not kept in GitHub source.

## Further documentation

[Engineering capabilities](engineering/DELIVERY.md) · [Parts workbench](engineering/WORKBENCH.md) · [Storage](PRIVATE_STORAGE.md) · [API/MCP](API_MCP.md) · [Provider coverage](discovery/COVERAGE.md) · [Implementation status](IMPLEMENTATION_STATUS.md) · [Licensing](../NOTICES.md)

[Historical project guide](PROJECT_GUIDE.md) preserves earlier audit detail; current runtime/setup instructions above take precedence. FormaProof is the working product name. The repository slug and PatentRadar API/MCP identifiers remain compatible.
