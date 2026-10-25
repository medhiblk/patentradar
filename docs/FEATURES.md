# Functional inventory

24 functional groups in the monorepo. This is a product inventory, not a count of routes, API candidates, tests or workspaces. Configuration-dependent and partial capabilities are identified below; their presence is not a claim of universal data coverage.

| # | Feature group | Implementation / verification evidence and scope |
| --- | --- | --- |
| 1 | Technical PDF/document import | `apps/web/src/lib/cad/browser-document.ts`, `document-upload.test.ts`, `e2e/document-upload.spec.ts`: real PDF bytes, measured text, page/hash provenance and bounded local recovery |
| 2 | Reviewable invention profile | `src/components/research-workspace.tsx`, `src/lib/extract.ts`, `core.test.ts`: editable technical features and explicit consent for external AI |
| 3 | Publication seeds and exact lookup | `src/lib/patent-seeds.ts`, `patent-seeds.test.ts`: normalization and provider-scoped lookup; worldwide metadata availability varies |
| 4 | Parallel patent retrieval | `src/lib/search/orchestrator.ts`, `search-engine.test.ts`: real configured providers; unavailable providers retain explicit warnings |
| 5 | Scientific prior-art discovery | `src/lib/providers/`, `discovery.test.ts`: research providers kept separate from patent records |
| 6 | Progressive live results | `src/app/api/research/stream/route.ts`, `e2e/search-progress.spec.ts`: incremental NDJSON candidates, source outcomes and completion |
| 7 | Duplicate and family grouping | `src/lib/normalize.ts`, `src/lib/providers/normalization.ts`, `search-engine.test.ts`: explicit family IDs when supplied; no invented families |
| 8 | Citation exploration | `src/lib/search/citations.ts`, `src/lib/providers/technical.ts`: sourced links where providers expose them; citations do not prove technical equivalence |
| 9 | Search audit and per-result evidence | `search-evidence.test.ts`, `e2e/search-evidence.spec.ts`: databases, queries, passages, timestamps and failure/empty states |
| 10 | Feature-to-patent comparison | `src/lib/compare.ts`, `core.test.ts`: lexical overlap with actual claims when present; abstract/title-only limitations shown |
| 11 | Similarity alerts and review | `similarity-alerts.test.ts`, `e2e/patent-alerts.spec.ts`: explainable overlap signals and review state; no infringement probability |
| 12 | Saved watch checks | `src/app/api/watch/route.ts`, `platform.test.ts`: user-triggered refresh; background email/newsletters are excluded |
| 13 | Competitor and technology views | `src/components/research-workspace.tsx`: applicant/jurisdiction/activity views for the returned sample, not a complete landscape |
| 14 | Private invention portfolios | `src/lib/platform/`, `platform.test.ts`: accounts, saved projects and research |
| 15 | Private attachment storage | `attachments.test.ts`, `blob-storage.test.ts`, `e2e/attachments.spec.ts`: authenticated upload/download/deletion; local or configured private Blob |
| 16 | Exportable intelligence PDF | `src/lib/report.ts`, `core.test.ts`: source references, methodology and limitations |
| 17 | Reusable component catalog | `packages/engineering/src/workbench.ts`, `workbench.test.ts`: starter templates and device-local saved components with source references |
| 18 | Parametric assembly editing | `packages/engineering/src/schema.ts`, `workbench.test.ts`, `e2e/workbench.spec.ts`: part dimensions, placement, duplication and assembly composition |
| 19 | Interactive 3D inspection | `src/components/cad-viewer.tsx`, `e2e/engineering.spec.ts`: selection, visibility, exploded view and basic motion; not physical simulation |
| 20 | Custom component housings | `packages/engineering/src/workbench.ts`, `engineering.test.ts`, `workbench.test.ts`: entered clearances and actual cavity geometry |
| 21 | CAD import/export | `src/lib/cad/browser.ts`, `e2e/engineering.spec.ts`: actual STEP/STL geometry and editable assembly JSON; incomplete measurements block verified reconstruction |
| 22 | Design-to-patent research handoff | `src/components/engineering-studio.tsx`, `e2e/workbench.spec.ts`: reviewed concepts from components and return to design iteration |
| 23 | HTTP API and remote MCP | `api-mcp.test.ts`, `mcp-connection.test.ts`, `e2e/developers.spec.ts`: versioned public endpoints, OpenAPI, real protocol discovery and public tools |
| 24 | Reusable integration SDK | `packages/sdk`, `packages/sdk/tests/client.test.ts`, `examples/integration.mjs`: validated API access, streaming/cancellation and MCP utilities usable outside Next.js |

Unless prefixed with `packages/`, `src/` and app test paths above are relative to `apps/web`. Historical feature audit documents describe earlier checkpoints. Billing, purchased credits, automatic newsletters, universal legal-status validation and operational BigQuery access are not counted. Patent signals are preliminary technical evidence, not permission to manufacture or a formal freedom-to-operate opinion.
