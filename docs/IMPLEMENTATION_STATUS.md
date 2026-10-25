# Work Package A execution record

2026-10-25. Local implementation; not deployed in this execution. Previous production release is not this revision. No mock data added to production search. Git was absent; an initial source snapshot commit was created before implementation.

## Delivered and verified

- Structured multiple seed references survive project → extraction/review → search server. Optional project title retained. Existing exact EP/date input remains supported. Unresolved kind codes and unavailable lookup are surfaced rather than guessed.
- Shared search orchestrator for legacy JSON and POST NDJSON endpoints. Up to four jobs run concurrently, partial failures do not discard other sources, each available patent produces an upsert before all sources finish. Client displays progress and partial cards, preserves evidence if interrupted, and supports stopping a search. Request abort is passed to provider fetches.
- Patent dedup isolates bad identifiers, preserves source snapshots/conflicts, complementary claims, applicants, classifications and query attribution. Families are namespaced and shown separately without dropping publications. Existing lexical comparison and reports remain functional.
- Reference terminology/classification suggestions are derived from retrieved seeds for user review. Citation graph helper traverses only retrieved edges, with one/two-hop and 50-node/100-edge bounds. UI shows retrieved directed edges. No invented edges or citation-based technical score.
- Existing public providers and policy flags retained. Confidential profile title is no longer used as an implicit external-query fallback. Logs contain IDs, counts, timings and provider outcomes, not documents/query contents.
- Optional shared Redis REST public-record cache and atomic provider pacing. Without credentials, local fallback explicitly reports single-process scope. Shared storage failures fail closed. Shared Redis behavior is mocked in tests; no real shared service was available for certification.
- Feature-flagged BigQuery SDK adapter: ADC/WIF resolution, live metadata/schema checks, DOCDB batch lookup, parameterized metadata title search, dry-run/cap checks, 1 GiB hard ceiling/job, 30s execution cancellation, shared conservative monthly byte reservations in hosted mode, source attribution, actual job-stat logging and local public result caching. Seed retrieval includes claims/citations when the schema exposes them. No global full-text scan or automatic cap increase. Hosted execution refuses to run without shared budget storage.

## Real connectivity evidence

`WORK_PACKAGE_A_SMOKE.json`: local production server, public microfluidic concepts plus the published EP1000000A1 retrieval example. First patent arrived in **2.952s**, total **5.392s**, **13 patents**, **30 papers**, **34 events**, terminal completed event. Separate PDF response was HTTP200 with `%PDF-` header. The EP example is brick-manufacturing evidence used to verify transport and reports; it is not asserted similar to microfluidics.

`node scripts/verify-bigquery.mjs` returned BLOCKED (exit2). No authenticated BigQuery query executed. Google project/ADC/WIF credentials are missing; configuration steps are in BIGQUERY_INTEGRATION.md. SDK fixture tests are not a live provider validation.

## Tests

Initial baseline: typecheck, lint, 45 tests and production build passed. Implementation suite adds streaming-order, fragmented UTF-8, seed preservation, evidence merge, family namespaces, cancellation, bounded citations, cost rejection, parameterization, normalization and shared quota behavior. Final validation results are recorded below after checks complete. Existing seven browser cases passed; a separate new browser test passed three-seed handoff through consented streamed search. External APIs are mocked in browser tests, separately tested by the real smoke above.

## Remaining blockers / limitations — A is not fully complete

1. **BigQuery live activation blocked** by project/identity. A real schema/seed query and measured scan cost are required before calling it operational. Broad keyword scans may exceed the 1 GiB cap and will be rejected. No source freshness claim is made.
2. **Shared Redis deployment unconfigured**. Atomic Lua-backed pacing/cache is implemented and mocked; cross-instance operation still requires a provisioned backend and real multi-instance check. Single-process fallback is not deployment-wide quota enforcement.
3. Seed expansion currently resolves exact EP/date or configured BigQuery IDs and suggests terminology. **Automatic iterative family/assignee/classification retrieval and remote multi-hop citation fetching remain incomplete**. The graph only traverses evidence already retrieved.
4. Research diversity uses existing source-URL dedup, not complete cross-provider DOI resolution. Patent merge retains conflicting source snapshots but does not establish field-level legal authority.
5. BigQuery claims may be a whole unsegmented block; no fabricated individual claim numbers. Claim-level semantic comparison, AI reranking, multilingual translation and relevance benchmarking remain package B.
6. Query-cache coalescing and provider health remain partly process-local; streaming has no durable resume, heartbeat or multi-instance replay. Cancellation of a shared in-flight call can affect a coalesced caller. Monthly BigQuery reservation is deliberately conservative and does not include external project usage; GCP quotas are still required.
7. SaaS authentication, tenant storage, alerts and credits remain package C. No confidential uploads are persisted.

## Run

`npm ci`; `npm run build`; `npm run start`. Use My Inventions → describe → optional known patents → Review technical features → Extract → edit → review search concepts → consent → Retrieve & compare. Exact EP lookup needs date YYYYMMDD. Inspect original sources and choose Compare evidence; reports download from Reports.

Environment: ENABLE_BIGQUERY=false by default; enable only with GOOGLE_CLOUD_PROJECT and authorized ADC/WIF. BIGQUERY_MAX_BYTES may lower the 1 GiB ceiling. UPSTASH_REDIS_REST_URL/TOKEN activate shared public cache/pacing; never expose token through NEXT_PUBLIC. Preserve disabled experimental-provider flags. No deployment or secret provisioning occurred in this execution.

## Final verification

- `npm run typecheck`: passed.
- `npm run lint`: passed, no warnings.
- `npm test`: **58 passed**, 7 files.
- `npm run build`: passed, including both JSON and streaming research routes.
- `npm run test:e2e`: **8 passed** on the final production build, 18.2 seconds; browser fixtures do not assert live provider readiness.
- `git diff --check`: passed.
- Live public-provider smoke and PDF: passed as described above. BigQuery verification: BLOCKED, not passed. Shared Redis live validation: not performed, configuration unavailable.

Coherent commits: `e190f6a` baseline snapshot, `eba0ff8` streamed search/seed/evidence integration, followed by the final hardening/documentation commit visible in `git log`. No remote was configured and no push or deployment was attempted.

## Subsequent engineering and platform execution

Local sourced FTS search, private workspaces, bounded AI evidence-review routes and a real CadQuery Engineering Studio were added after this A-only record. Read `engineering/DELIVERY.md` for current behavior, tests, remaining B/C gaps and deployment requirements. Earlier A-only limitations remain historical where superseded; there is still no claim of complete worldwide data or credential-free cloud CAD hosting.
