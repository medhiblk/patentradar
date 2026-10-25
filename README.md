# FormaProof · PatentRadar

**Document → reviewed components → editable 3D → patent evidence → design iteration.**

Bring a technical manual, drawing or specification. Choose what to represent, check the measurements, build an assembly and investigate related patents. General patent research remains available for non-physical inventions.

[Open the app](https://patentradar-puce.vercel.app) · [Guided demo](https://patentradar-puce.vercel.app/demo) · [Real patent case](https://patentradar-puce.vercel.app/demo/patent) · [Use in ChatGPT](https://patentradar-puce.vercel.app/connect) · [3D Studio](https://patentradar-puce.vercel.app/engineering) · [Private files](https://patentradar-puce.vercel.app/files) · [API & MCP](https://patentradar-puce.vercel.app/developers)

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

Open http://localhost:3000. `npm ci` restores exact lockfile versions and prepares the self-hosted CAD assets. It does not download customer documents or production credentials. No `.env` is required for browser CAD, local storage and keyless research. To configure optional AI/providers, copy `.env.example` to `.env.local` and fill only what you need. Never commit secrets.

```bash
# Production build on any supported Node host
npm run build
npm start
```

Each environment has its **own** local accounts/files in `.data/` by default. Keep that directory on a persistent volume. Production private documents are **not** cloned from GitHub. To share the same private cloud workspace across trusted deployments, configure the same authorized private Blob backend and sign in separately on each host; see [storage setup](docs/PRIVATE_STORAGE.md). Use a separate store for disposable development environments.

### Lightweight Docker runtime

```bash
docker compose up --build
```

The compose service uses `Dockerfile.web`: Node and browser-based CAD, with persistent account/file storage in a named volume. The existing `Dockerfile` remains the optional, larger Python/CadQuery runtime. Docker configuration must be validated on your target Docker host.

## Use FormaProof in ChatGPT

Open the [connection guide](https://patentradar-puce.vercel.app/connect). Copy the public MCP URL, open [ChatGPT Plugins](https://chatgpt.com/plugins), add a custom MCP server and use no authentication for the public tools. Review the discovered tools and confirm the connection in your own account. Account/workspace restrictions apply. This is a custom connection; no approved public-directory listing is claimed.

The guide can test the real anonymous MCP handshake and download a standard MCP client configuration. The web-based 3D editor remains in the workspace; MCP exposes patent/research and component inspection tools. It does not expose private uploaded files.

```text
https://patentradar-puce.vercel.app/api/mcp
```

[Official OpenAI connection instructions](https://developers.openai.com/api/docs/guides/custom-mcp-server) · [Architecture](docs/UX_ARCHITECTURE.md)

## Patent similarity alerts

Research results now flag explainable multi-feature overlap and keep the source links visible. Save the research to a private project to retain the alerts, then review them at [/alerts](https://patentradar-puce.vercel.app/alerts). Watch checks refresh alerts when requested; background/email delivery is not enabled.

Try [the real US20080003142A1 case](https://patentradar-puce.vercel.app/demo/patent): ingest a verified excerpt, edit the example design, save the project/PDF and inspect the resulting sourced signal. The application is reported as abandoned by Google; the exercise establishes a prior publication and technical overlap, not an active blocking right. [Behavior, provenance and limitations](docs/PATENT_SIMILARITY_ALERTS.md).

## What works

Research now shows **Where we searched**, the exact analysed patent shortlist and **Evidence behind this result** on each record. Queries, provider failures/empty replies, cache reuse, claim/abstract/title limitations, source passages and timestamps remain inspectable in the UI, private portfolio and PDF report. [Traceability details](docs/SEARCH_EVIDENCE.md).

- PDF/text/image interpretation, component review, real measured geometry through OpenCascade WASM, STEP/STL import and export, purchased-part references and custom housings.
- Private projects and attachments with authenticated downloads and deletion; SQLite/filesystem locally, private Blob when configured.
- Progressive public-source patent/literature searches, source attribution, deduplication, comparisons and report export. Provider coverage is partial.
- [HTTP API and remote MCP](docs/API_MCP.md); [OpenAPI](https://patentradar-puce.vercel.app/api/v1/openapi.json).

Missing dimensions are never treated as verified measurements. Image interpretation and AI processing require explicit consent and configured OpenAI access. A relevant patent, expired record or missing result does **not** establish permission to manufacture or legal FTO clearance.

## Project map

| Location | Responsibility |
| --- | --- |
| `src/app/page.tsx` | Lightweight entry and lazy workspace loading |
| `src/components/home.tsx` | Product story and starting points |
| `src/components/app-navigation.tsx` | Minimal public menu: Demo, ChatGPT, Open workspace |
| `src/components/shell/` | Workspace shell and contextual tool navigation |
| `src/app/connect/`, `src/lib/mcp/` | ChatGPT onboarding, shared public metadata and real protocol probe |
| `src/components/demo/product-tour.tsx` | Controlled motion preview; actual CAD stays in the interactive Studio |
| `src/components/research-workspace.tsx` | Existing research flow, results, evidence and reports |
| `src/components/engineering-studio.tsx` | Document → measured parts → assembly → research |
| `src/lib/cad/` | Browser geometry worker and parametric schemas |
| `src/lib/providers/` | Capability-specific source adapters |
| `src/lib/platform/` | Private accounts, projects and attachments |
| `src/app/api/` | Existing API and MCP routes |

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

GitHub Actions runs application checks and the separate native CAD tests. External APIs are mocked in automated search tests; separate [discovery evidence](docs/discovery/README.md) records real connectivity. Browser CAD tests execute the real geometry engine.

## Deploy

Import this repository into Vercel as Next.js, choose Node 24.x, use `npm run build` and configure private Blob if you want persistent cloud accounts/files. Local SQLite is not persistent on a stateless Vercel function. Optional BigQuery/authenticated providers remain disabled without configuration. Environment values are not kept in GitHub source.

## Further documentation

[Engineering capabilities](docs/engineering/DELIVERY.md) · [Parts workbench](docs/engineering/WORKBENCH.md) · [Storage](docs/PRIVATE_STORAGE.md) · [API/MCP](docs/API_MCP.md) · [Provider coverage](docs/discovery/COVERAGE.md) · [Implementation status](docs/IMPLEMENTATION_STATUS.md) · [Licensing](NOTICES.md)

[Historical project guide](docs/PROJECT_GUIDE.md) preserves earlier audit detail; current runtime/setup instructions above take precedence. FormaProof is the working product name. The repository slug and PatentRadar API/MCP identifiers remain compatible.
