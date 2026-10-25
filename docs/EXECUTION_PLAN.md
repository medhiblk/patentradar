# PatentRadar — three implementation work packages

Planning only, 2026-10-25. Build on the existing Next.js App Router application. Do not replace its provider adapters, PDF extractor, consent gates or evidence-backed report flow. This document proposes future files; none of the application changes below was implemented during the audit.

## Target flow and contracts

Description + optional seeds → local/consented profile extraction → editable technical profile and external query preview → capability-aware plan → bounded parallel providers → streamed normalized candidate upserts → evidence-preserving dedup → provisional lexical shortlist → optional low-cost semantic/AI rerank → selected patent claim comparison.

Keep patent, paper and organization collections separate. Candidate identity is normalized publication including kind; family grouping is a view, not destructive dedup. A provider may support lookup without search or claims. Missing field, unsupported operation, not found, quota exceeded and provider failure must remain distinct. Do not automatically send an entire confidential description as a fallback search query.

Use POST fetch with an NDJSON response and AbortController; no EventSource query-string payload. Events: `started`, `provider_started`, `candidate_upsert`, `provider_finished`, `provider_failed`, `ranking_updated`, `completed`. Every event has schemaVersion, searchId, sequence and timestamp; candidate events carry stable IDs and provenance. Emit available records as providers finish rather than waiting for Promise.allSettled. Final completion includes source counts, coverage, queries actually executed, errors and ranking version. A disconnected client retains results already shown and may retry; durable replay is not required until C. Preserve `/api/research` JSON compatibility using the same orchestrator, add a separate streaming route.

## WORK PACKAGE A — Search Engine & BigQuery

### Exact file changes

Modify `src/components/invention-workspace.tsx`, `src/app/page.tsx`, `src/lib/patent-seeds.ts`, `src/lib/model.ts`, `src/lib/normalize.ts`, `src/lib/providers/types.ts`, `src/lib/providers/contracts.ts`, `src/lib/providers/normalization.ts`, `src/lib/providers/http.ts`, `src/lib/providers/registry.ts`, `src/lib/providers/google-patents.ts`, `src/app/api/research/route.ts`, `src/app/api/health/providers/route.ts`, `.env.example`, `package.json`, `package-lock.json`.

Add `src/lib/search/{schema,plan,orchestrator,events,seeds,merge}.ts`, `src/lib/providers/bigquery-client.ts`, `src/lib/cache/{store,memory,shared}.ts`, `src/lib/limits/provider-budget.ts`, `src/app/api/research/stream/route.ts`, `src/components/search-progress.tsx`, `tests/search-engine.test.ts`, `tests/bigquery.test.ts`, `tests/e2e/search-progress.spec.ts`, `scripts/verify-bigquery.mjs`. Update `tests/patent-seeds.test.ts` and `tests/e2e/workflow.spec.ts`.

### Implementation steps

1. Fix seed handoff first: submit `{title,description,seedPublications}` from the project component, keep seeds through extraction/review, validate max 10 on server. Migrate old single publication/date input into one seed for compatibility. Recognize absent kind code as unresolved rather than guessing. Consolidate canonicalization, retain provider-specific DOCDB conversion and raw input.
2. Introduce capability-specific execution contracts with typed partial outcomes. Implement seed resolution through available authorized providers; EPO requires an explicit date unless another legitimate source supplies it. Do not fabricate claims/family/citation data for unresolved seeds. Cache resolved public records.
3. Implement merge before additional sources: isolate invalid records, preserve every source/time/query, merge missing complementary claims/classifications, retain conflicting field alternatives with provenance. Preserve original applicants plus normalized keys. Namespace families. Deduplicate research by DOI where supplied, not only URLs.
4. Extract current parallel dispatch into one orchestrator. Default max four concurrent upstream jobs; provider-specific gates take precedence. Deduplicate identical planned calls and cap query fanout (initially three concept variants). Track executed vs skipped queries. Use shared atomic rate reservations/cache in hosted multi-instance mode; local memory fallback only advertises single-process protection. No mass concurrent fanout to OpenAIRE's low quota.
5. Implement streaming contract above and incremental UI. Slow/failing provider must not delay healthy-source candidate display. Forward abort to fetches and costed jobs. Final HTTP JSON compatibility comes from the same normalized results, not a second search.
6. Implement BigQuery only as described in BIGQUERY_INTEGRATION.md: resolve identity, inspect live metadata, parameterized bounded seed lookup first, dry run/cost gate, real query, then measured metadata search and targeted claims/family/citation lookup. No Google HTML fallback. Missing credentials remains NOT CONFIGURED, not generic empty success.
7. Build seed-derived queries from retrieved titles/abstracts and recurring verified classification codes; expose suggestions for editing. Multilingual query generation belongs to B. Introduce forward/backward citation expansion only when provider exposes actual edges: default one hop, explicit second hop, visited set, max 50 nodes/100 edges, source timestamps and truncation notice. Citation adjacency contributes exploration candidates, not similarity score.
8. Update health to separate configured, implemented, verifiedAt and last runtime outcome. Log counts/latency/cost metadata without confidential text. Verify existing public-source operations still function.

### Dependencies / expected behavior

Shared cache/limiter service and hosted runtime credentials are external deployment prerequisites. A memory implementation keeps local development usable. BigQuery credentials are conditional: complete all credential-independent work while blocked; never mark BigQuery operational from fixtures. Existing OpenAIRE/EPO sources continue to work within coverage limits.

### Acceptance tests

- Three seeds survive project → extraction → review → server plan; duplicates collapse; unresolved kind is reported; no secret query strings or whole-description fallback.
- Two providers return same patent: one card retains both sources and later claim text; conflicting dates remain attributable. A malformed ID cannot discard all valid records.
- Fake fast provider at 100 ms and slow provider at 5 s: first upsert reaches client before slow provider settles; final output matches JSON route. Test split UTF-8/frame chunks, abort, retry and no duplicate cards.
- Shared limiter tested against two orchestrator instances with the same backing store, including Retry-After and simultaneous identical requests. Failed/quota provider leaves useful partial results visible.
- BigQuery fixtures cover multilingual repeated fields, zero dates, null families, US claim text, empty non-US claims, DOCDB formatting, injection input, dry-run rejection and timeout cancellation. No live network in unit tests.
- Separate authorized real BigQuery seed query records job statistics and correct record. If unavailable, release evidence explicitly lists it BLOCKED and hides the operational search capability.

### Risks / definition of done

BigQuery scans may be unaffordable even for exact IDs; public-source quotas limit recall; streaming may buffer through proxies. DoD: real existing sources stream, seeds are consumed, merged provenance survives, rate limits work across instances, and a bounded BigQuery query is proven OR the release explicitly retains BigQuery as blocked. Full BigQuery integration itself is not done until real query proof exists.

## WORK PACKAGE B — Patent Intelligence & UX

### Exact file changes

Modify `src/lib/compare.ts`, `src/lib/extract.ts`, `src/lib/model.ts`, `src/lib/providers/types.ts`, `src/lib/report.ts`, `src/app/page.tsx`, `src/app/globals.css`, `src/components/invention-workspace.tsx`, `tests/core.test.ts`, `tests/e2e/workflow.spec.ts`.

Add `src/lib/intelligence/{rank,compare,translate,schemas,budget}.ts`, `src/app/api/comparison/route.ts`, `src/app/api/translation/route.ts`, `src/components/{patent-shortlist,claim-comparison,citation-explorer}.tsx`, `tests/intelligence.test.ts`, `tests/e2e/comparison.spec.ts`, `tests/fixtures/relevance-cases.json`.

### Implementation steps

1. Consume A's stable records/events. Render provisional ranking and later updates without discarding user selections. Simple navigation: Dashboard, My Inventions, Patent Explorer, AI Comparison, Intelligence & Monitoring, Account & Credits. Unavailable account/watch capabilities must be clearly explained, never populated with invented metrics.
2. Keep current lexical result as deterministic fallback. Add classification alignment only when codes exist and semantic scores only when actually computed. Fuse independently ranked signals (e.g. reciprocal-rank fusion), distinguish evidence availability from technical relevance, keep citation edges out of similarity scoring. Do not call it hybrid until at least two real signals run.
3. Consent separately to sending reviewed features and retrieved passages to OpenAI. One structured rerank call for up to 20 candidates; bound total input tokens, output tokens, timeout and configurable dollar budget. Server-controlled model. Validate returned IDs against candidates; reject invented evidence. Cache by profile/evidence/model/prompt hash within the user's scope. Missing key/budget returns the lexical ranking with an honest label.
4. Use reranking to select up to five for claims retrieval, not to send every description to AI. Claim object includes number, language, dependency if known, original text, publication ID, source and retrieval time. Never invent claim segmentation when source structure is ambiguous.
5. Structured comparison maps each feature to exact quote offsets in a retrieved claim, with supported/partial/not-established/insufficient-evidence labels and explanation. Validate offsets/substrings server-side. Keep original evidence adjacent; no legal infringement scores. Absence of a phrase does not prove novelty or clearance.
6. On-demand translation only: preserve original, mark machine translation, align claim IDs, cache by content hash/language; never replace the source quote with translated text. Generate EN/FR/ZH concept variants where requested, review before querying. CPC/IPC suggestions require vocabulary validation and a candidate label.
7. Show citation direction, source and bounded expansion; family and citation graphs are separate. Status stays unknown unless an actual jurisdiction-specific status source provides dated evidence. Add responsive side-by-side/stacked views and accessible claim highlighting.
8. Fix project storage schema validation/hydration, edit-in-place and stale selectors. Preserve one-click source access and report export; embed appropriate Unicode fonts for multilingual excerpts, with licence documentation.

### Dependencies / expected behavior

A's merge/stream/seed contracts; OpenAI key and user consent for AI paths; source claim availability. Completion should improve relevance and explain evidence without hiding sparse claims. Full legal-status integration is not inferred from publication/grant dates.

### Acceptance tests

- Frozen expert-reviewed benchmark with at least 20 varied cases (include unrelated patents, CJK, generic terms and missing claims): report baseline vs new precision@5/nDCG@10, and do not ship an unmeasured improvement claim. Require no regression on agreed critical cases.
- Reranker cannot add IDs or fabricate citations; malicious text stays data. Invalid AI output, timeout, insufficient budget and missing key preserve functional lexical results.
- Every displayed claim highlight resolves to an exact source substring; missing claims invokes the explicit abstract-only comparison. Machine translation never changes the underlying quote.
- Privacy tests verify only approved fields leave the app; API denies comparison without consent. Mobile 390px + desktop 1440px flows, keyboard navigation, retry and export are exercised against current accessible labels.
- Credit/cost reservation blocks concurrent over-budget AI calls even before SaaS billing is introduced.

### Risks / definition of done

AI hallucination, mistranslation and sparse claims are core risks. DoD: measured matching quality, bounded AI expense, validated claim evidence, original/translated distinction, useful mobile progressive UX and no false semantic/legal claims. Real AI smoke test is separate from mocked acceptance tests; missing credentials must be disclosed.

## WORK PACKAGE C — SaaS Features (lower priority)

### Exact file changes

Modify `src/components/invention-workspace.tsx`, `src/app/page.tsx`, `src/lib/security.ts`, `src/app/api/{extract,research,report,intelligence}/route.ts`, A/B costed routes, `.env.example`, `package.json`, `README.md`.

Add `src/lib/{auth,db,projects,usage,monitoring,mail,mcp}.ts`, `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, `src/app/api/watchlists/route.ts`, `src/app/api/account/usage/route.ts`, `src/app/api/billing/webhook/route.ts`, `src/app/api/cron/monitor/route.ts`, `src/app/api/mcp/route.ts`, `db/migrations/001_portfolios.sql`, `db/migrations/002_usage_monitoring.sql`, `tests/tenant-isolation.test.ts`, `tests/monitoring.test.ts`, `tests/mcp.test.ts`.

### Implementation steps

1. Select managed auth plus PostgreSQL persistence; keep existing local data until the user explicitly imports it. Tenant-owned projects/documents/research runs/shortlists; private object storage with signed access, deletion and retention. Validate tenant ownership on every read/write/export/job. No public uploads.
2. Persist watchlists/search plans and run history. Schedule bounded provider searches using A's shared budgets, dedup discoveries by publication/version, distinguish new filing vs newly discovered old record. Report coverage/outages and source dates.
3. Personalized newsletters require opt-in, frequency, preview, unsubscribe and idempotent delivery. No email is sent merely because a project exists. Scheduler authentication and retries cannot double-send.
4. Implement append-only usage ledger with atomic reserve/commit/release for AI and costed retrieval. Report measured usage separately from purchased credits. Billing only after payment configuration: signed webhook verification, replay protection, atomic idempotency and refunds. Never fabricate balances.
5. Expose tenant-scoped read/search/compare MCP tools with explicit schemas, authentication, per-tool permissions and budget checks. Restrict outbound provider tools to approved read operations. VeyIP remains disabled until its terms are cleared; existing anonymous MCP transport does not grant commercial reuse.

### Dependencies / expected behavior

A/B stable contracts; auth/database/private storage, mail and optional payments configurations. Do not block A on billing or newsletters. Local mode remains explicit and private only to the browser profile, not described as a secure account.

### Acceptance tests / risks / definition of done

Two users cannot access each other's project IDs, documents, exports, cached AI results or MCP tools. Concurrent requests cannot overspend; duplicate webhooks/jobs cannot double-charge or email. Unsubscribe prevents queued future delivery. Local import requires consent and does not overwrite data. Account deletion obeys retention policy. Real configured delivery/payment smoke checks use appropriate test environments, not unsuspecting recipients. DoD: authenticated isolation, persistent portfolios, reproducible watch results, opted-in idempotent newsletters, auditable credits and authenticated MCP, with unconfigured integrations visibly disabled. Main risks: privacy breach, duplicate billing and uncontrolled background source usage.
