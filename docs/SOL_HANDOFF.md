# GPT-6.1 Sol handoff

Read FEATURE_AUDIT.md → BIGQUERY_INTEGRATION.md → EXECUTION_PLAN.md. Exactly three work packages; implement A before B, C last. This handoff is a plan, not authorization to claim unperformed tests or unavailable integrations.

## Repository facts

- Root `/workspace/patentradar`; no git metadata in this workspace. Inspect the actual checkout supplied to you before committing anything.
- Next.js App Router, React, TypeScript, Zod, existing OpenAI Responses SDK; no BigQuery SDK or persistent database.
- `src/app/api/research/route.ts` is the real search entry; `src/app/page.tsx` currently waits for its complete JSON response.
- `src/lib/providers/google-patents.ts` is only a registry wrapper. Google env names in examples do not make it implemented.
- `src/components/invention-workspace.tsx` saves seed strings locally but sends only description to analysis. Fix this before building extra UI.
- `src/lib/normalize.ts` loses evidence from duplicates. Preserve all source records when merging.
- `src/lib/compare.ts` is lexical. Keep that truthful fallback; do not relabel it AI/semantic.
- Providers and data categories must stay distinct. The endpoint catalogue is not a count of working patent engines.

## First development task

Implement and test the typed seed handoff: project → extraction/review state → ResearchSchema → orchestrator plan. Max 10, canonical publication IDs with raw input retained, no invented kind codes, backward-compatible single-publication/date fields. Test that three seed patents reach the server and influence the retrieval plan without sending the full description externally. This task needs no Google credential and removes the current broken user journey.

Immediately afterward implement evidence-preserving merge and extract a streaming orchestrator from the current route. Keep old JSON clients working from the same code path. Use the exact files, proposed events, budgets and acceptance criteria in package A.

## BigQuery gate

Ask the project owner only for the actions listed in BIGQUERY_INTEGRATION.md when execution reaches that dependency; never ask for a key in chat. No Google project/ADC is available locally and deployed health reports unconfigured. Authenticated live metadata and bounded real patent SELECT are prerequisites to enabling the adapter. Document job ID/statistics, source table version and actual returned record. No successful SQL query occurred during this audit.

Do not assume public means anonymous or unlimited. Do not enable billing, increase a scan cap, perform full-corpus copies or turn on Google HTML enrichment automatically. If blocked, finish A's independent work and clearly retain BLOCKED status. A dry run or mock is not a live integration test.

## Required validation and release discipline

1. Establish clean baseline with `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; current fresh audit ran unit/integration suite only, 45 passed.
2. Update stale Playwright description labels and add project handoff/storage tests before asserting browser coverage. Check current server build; playwright config reuses an existing process and can accidentally test stale code.
3. Run `npm run test:e2e` against the intended build. Mock external services for deterministic tests; run a small separate, consented public-data smoke check respecting provider quotas.
4. Run real BigQuery verification only after credentials/budget gate. Test selected exact records, schema/claims absence, quota failures and cost reporting. Never load test a public provider.
5. Record local versus deployed revision. The latest project UI changes were not redeployed in the prior turn; do not assume production equals this directory. Deployment requires the normal requested release scope, not merely a planning document.
6. Final delivery must identify implemented behavior, blocked credentials, tests actually run, real provider observations, measured relevance and deployment URL/status. Never summarize all work packages as complete when only placeholders exist.

## Non-negotiable constraints

Preserve PDF extraction, report exports, source links and existing consent gates. Do not log confidential descriptions; use approved minimized query concepts. No synthetic records in live results. No arbitrary user SQL/remote URLs/tool names. No guessed claims, families, status, citations or legal opinions. Leave experimental/licence-uncertain sources disabled. Do not call scientific citation results patent citations. A missing patent match is not freedom to operate.

## Most important blocker

The application lacks a proven, sufficiently broad patent retrieval path: default discovery is a literature-linked subset, while BigQuery has neither executable adapter nor available authenticated project. Google configuration is the external blocker; seed handoff and progressive evidence-preserving orchestration are the immediate development work that can proceed without it.

## Execution follow-up

Work Package A implementation has started and is committed locally. Read IMPLEMENTATION_STATUS.md before further edits: the seed handoff, streaming pipeline, evidence merge and gated BigQuery SDK adapter now exist. Do not repeat the initial seed task or treat the original audit as current implementation state. Remaining remote expansion and credential validation are explicitly listed there.
