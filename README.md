# FormaProof

Working identity; existing PatentRadar API/MCP identifiers and repository slug remain compatible.

Understand the system. Explore the design. Investigate the evidence.

Technical PDF, drawing or manual → reviewed system understanding → interactive measured 3D → patent evidence → design iteration. See [product positioning and capability boundaries](docs/product/POSITIONING.md).

**[Application](https://patentradar-puce.vercel.app) · [Developer portal](https://patentradar-puce.vercel.app/developers) · [OpenAPI](https://patentradar-puce.vercel.app/api/v1/openapi.json) · [API/MCP integration guide](docs/API_MCP.md)**

Public API and remote MCP offer anonymous evidence discovery with explicit query-sharing consent. [Try the 3D Studio](https://patentradar-puce.vercel.app/engineering): real OpenCascade WASM geometry, PDF measurements, editable parts and STEP/STL exports run in your browser without Python or an account. CadQuery native APIs remain optional. [Private projects and attachments](https://patentradar-puce.vercel.app/files) persist in a private Blob store when configured, with authenticated downloads and a local SQLite/filesystem fallback. Source coverage is partial and relevance is not a legal FTO assessment.

```bash
npm ci
npm run build
npm run start
```

The [parts workbench](docs/engineering/WORKBENCH.md) adds a sourced board-footprint library, purchased-component references and user-entered prices, custom housing pockets, envelope checks, mixed STEP/parametric assemblies, explicit fusion and individual STL export. Reopen editable parameter JSON and export a costed parts CSV. No live Amazon pricing or patent clearance is inferred.

For CAD runtime installation, private storage, input limits and tested capabilities see [engineering delivery](docs/engineering/DELIVERY.md). For application/data licensing, see [notices](NOTICES.md).

---

# PatentRadar

**Understand what already exists. Invent what comes next.**

A working Next.js application connecting technical documents, measured browser CAD and patent research. General patent analysis remains available for software, processes, biotech and other inventions; the engineering studio adds measured parts and editable assemblies.

## Run

Requires Node.js 24+. No cloud database account is required.

```bash
npm ci
cp .env.example .env.local
npm run dev
# Production:
npm run build
npm start
```

Open http://localhost:3000. Local scripts support the environment's configured proxy. Keep managed proxy settings and TLS verification enabled.

## Current workflow

1. Upload a text-based PDF (maximum 4 MB / 80 pages) or describe the actual design.
2. Extract and review its features. With an OpenAI key **and consent**, the Responses API produces a structured profile whose feature quotes are checked against the input. Otherwise local extractive rules use the actual input passages. No fixed synthetic profile is substituted.
3. Share reviewed technical search concepts with public sources only after consent.
4. Search patent metadata and scientific prior art. Results retain source URLs, query provenance, retrieval timestamps and missing-data warnings.
5. Inspect lexical relevance, evidence excerpts and applicants where actually supplied. Named parties are candidates to investigate, not automatically confirmed competitors.
6. Download an evidence-backed PDF report or opt in to browser-local saved reports.

The physical module adds explicit components/materials, function, and interface/relationship fields to the reviewed input. The Sources page also offers a working public-source explorer for research, organizations, chemistry, structure metadata and citations.

## Global anonymous API audit

See **[the complete discovery handover](docs/discovery/README.md)**.

- **80 endpoint candidates / 26 independent provider families** audited.
- **55 Tier A endpoints across 19 families**, 1 Tier B, 20 Tier C, 4 Tier D.
- [.env endpoint registry](.env.registry.example)
- [Verification matrix](docs/discovery/VERIFICATION.md), [CSV](docs/discovery/verification.csv), [raw observations](docs/discovery/verification.json)
- [16 repository findings](docs/discovery/REPOSITORIES.md)
- [Jurisdiction and capability gaps](docs/discovery/COVERAGE.md)

These are endpoint counts, not independent search-engine counts. Tier A applies to declared metadata/retrieval scopes, quotas and rights; it does not promise uptime or unlimited use. Parameterized example URLs remain templates, not automatically callable search endpoints.

The [user-provided endpoint audit and configuration guide](docs/discovery/PROVIDED_ENDPOINTS.md) documents live tests, compatible environment aliases, Europe PMC scientific metadata and the legacy PatentsView redirect. Dataset catalogues appear under Sources and `/api/v1/datasets`; bulk files are not automatically downloaded or imported.

Default research uses Europe PMC scientific metadata, OpenAIRE's literature-linked patent metadata, DataCite, HAL, arXiv, Zenodo, Crossref, OpenAlex and PubMed. Exact EP XML/PDF retrieval is available when a publication number and date are supplied. Other source-specific operations include INSPIRE, NASA, DOE, ROR, GLEIF, French company search, Wikidata, RCSB, PubChem and OpenCitations.

VeyIP MCP anonymous Chinese patent search/claims were genuinely tested, but its commercial/upstream PatentHub rights are unresolved: disabled by default. ZYB returned firewall 403. TIPO returned a verification-code requirement despite HTTP 200. JPO/KIPRIS registration requirements are not bypassed. EPO linked-data JSON/Turtle work under CC BY 4.0 but official fair use excludes an automatic production backend; bulk download is the scale route.

## Configuration

`.env.example` contains application settings and optional credentials. `.env.registry.example` preserves the audited endpoint variable names and groups candidates by tier. Never commit actual credentials or put them in `NEXT_PUBLIC_` variables.

OpenAI, EPO OPS and other authenticated services remain optional; they are not counted as anonymous free APIs. Free public-source research runs without those keys. Experimental/restricted source flags default to false; enabling a flag does not grant a licence or override fair use.

## API and code

- `POST /api/extract`: validated PDF/text extraction and optional consented OpenAI analysis.
- `POST /api/research`: bounded parallel search, deduplication, evidence comparison, source-diverse research results and partial failures.
- `POST /api/report`: downloadable report with references, attribution and limitations.
- `GET /api/health/providers`: observed runtime health plus eligibility summary; UNTESTED does not mean healthy.
- `GET /api/intelligence`: audited public endpoint catalogue.
- `POST /api/intelligence`: selected public-source operations; see the discovery handover for examples. No arbitrary URLs, SPARQL or MCP tools are accepted.

Provider contracts and adapters are in `src/lib/providers/`. Patent, research, organization, citation and graph-reference records remain separate. The UI is in `src/app/page.tsx`, `src/components/home.tsx` and `src/components/source-explorer.tsx`.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
# Separate, real external checks against the running app:
node scripts/discovery/smoke-adapters.mjs
```

Automated tests mock external services. Real HTTP probes and application smoke results are stored separately under `docs/discovery/evidence/`. Browser tests cover upload/extraction, report download, mobile navigation, physical-invention input, unexpected server responses and consented source lookup. Playwright uses `/usr/bin/chromium`; override `CHROMIUM_PATH` where needed.

To reproduce the endpoint audit, follow `docs/discovery/README.md`. Audit scripts are bounded; do not run repeated scans or load-test public services. Repository source/licence metadata is not permission to reuse upstream patent corpora.

## A 90-second real-data walkthrough

- 0–15 s: Open Analyze and describe a real technical concept, or load the sourced EP1000000A1 case.
- 15–30 s: Extract and edit the features; the interface identifies AI versus local extraction.
- 30–50 s: Review the public search concepts, grant consent and retrieve evidence.
- 50–70 s: Inspect patent metadata, sources, lexical overlap and uncertainty. The EP1000000A1 example is brick manufacturing; do not treat it as relevant to an unrelated instrument.
- 70–90 s: Inspect applicant information where available and download the report.

## Practical limits

Public quotas and incomplete coverage remain material. OpenAIRE is a literature-linked subset, not a complete global patent database. Comprehensive current official anonymous CN/JP/KR search, full worldwide claims, legal status, family/citation graphs and legal FTO assessment are not delivered by this source network. See the gap analysis.

Caching, in-flight deduplication and provider limiters are process-local. Multi-instance deployments need a shared limiter/cache or a self-hosted bulk index for organization-wide quota compliance. No quota circumvention is implemented. Uploaded PDFs stay in memory; browser-saved reports contain the reviewed profile and should be saved only on a trusted device. Multi-user access control and durable server storage remain deployment priorities.

API/JSON data retain Unicode. The current PDF font is basic Latin and can substitute non-Latin glyphs; full CJK report typography remains a gap. Lexical relevance is not semantic equivalence or infringement probability. PatentRadar provides preliminary technical intelligence, not a legal opinion or formal freedom-to-operate assessment.

## Deployment

Vercel production project: PatentRadar. Main URL: https://patentradar-puce.vercel.app . Deployment evidence for this release is recorded in the discovery handover after verification. For another environment, import the project as Next.js, choose Node.js 24.x, use `npm run build`, configure only the required server-side variables and validate a preview before release.

## Search engine execution update

See [implementation status](docs/IMPLEMENTATION_STATUS.md) for Work Package A results, exact live-smoke evidence and remaining blockers. `/api/research/stream` now returns progressive NDJSON while `/api/research` retains JSON compatibility. BigQuery is behind `ENABLE_BIGQUERY=false`; missing credentials do not block public providers. `node scripts/verify-bigquery.mjs` performs a separate configured live check and explicitly exits BLOCKED when configuration is absent.

## Engineering Studio, private workspaces and local patent index

See [engineering delivery](docs/engineering/DELIVERY.md) for runnable setup, feature boundaries, source/licence evaluation and test evidence. Engineering Studio runs real CadQuery geometry through a Python environment configured by CAD_PYTHON. Local sourced patent search is an alternative to the Google Cloud dependency, with explicit partial coverage. Private accounts and attachments now support Vercel private Blob, while local hosting retains SQLite and private files on a persistent volume. See [private attachment storage](docs/PRIVATE_STORAGE.md).

## Attach documents to private projects

Open `/files` or My Inventions, create/sign into an account, create a project, then drag in PDF, PNG/JPEG, STEP/STL, UTF-8 TXT or JSON files. Originals persist across refresh/sign-in. Download, delete or explicitly reopen a file for patent analysis or 3D interpretation. Storage does not start external AI or patent queries. Limits: 4 MB/file, 20/project, 50 files / 100 MB/account. Private documents are streamed through authenticated owner routes, never public URLs. See [setup, test evidence and limitations](docs/PRIVATE_STORAGE.md).
