# Search sources, analysed patents and result evidence

`Research.searchTrace` is an optional version-compatible execution record, shared by web research, HTTP search and MCP search. It is preserved in private saved research and exported in the PDF report. Older reports have no trace: the UI explicitly says their database execution history is unavailable instead of reconstructing a search from source links.

## Recorded facts

- A per-search ID, start/completion dates and context (`live-search` or `known-reference`).
- Each planned adapter's category, operation, reviewed query concepts, queued/running/succeeded/empty/failed state, duration, returned patent/scientific counts and publication IDs.
- Failed and empty providers remain visible. Disabled BigQuery and unconfigured OPS are explicitly marked not queried. Scientific sources are not counted as patent databases.
- HTTP observations, scoped to each parallel job: endpoint origin/path, network versus memory/shared/in-flight cache access, actual HTTP status when observed, and sanitized error codes. URL query strings, credentials, request headers, response bodies and raw error messages are never included in the trace. An HTTP 200 does not override an adapter validation failure.
- SDK-based retrieval has no invented HTTP status. Cached content is identified as reused, not a fresh live request. Record timestamps and current adapter-check timestamps are displayed separately. Per-source counts can overlap; the analysed publication list is the retained, deduplicated shortlist (currently up to 20), not an exhaustive list of all worldwide patents.

The stream emits the initial trace and provider updates before completion. Partial/cancelled results retain the observations already received. Local-only execution records no external requests. Batch retrieval queries are shown as source queries; the app does not infer which individual query term caused an upstream search hit.

## Per-result evidence

`PatentEvidence` is reused on result cards, patent details, comparisons, the reference case and saved private research. It shows the publication's record source, retrieval timestamp, this run's retrieval queries, evidence basis (claims, claim excerpts, abstract only or title only), an actual compared passage, highlighted shared terms and the lexical explanation. Further compared features and original source records can be expanded.

For merged records, a passage is attributed to a source only when its stored fields contain the passage, or when the single supplied reference source explicitly identifies its claim excerpts. Otherwise the source link is labeled as a record source with unavailable passage attribution. Original PDF page numbers are shown only where supplied by verified evidence metadata. No missing claim numbers, pages, abstracts or legal conclusions are generated.

Search concepts are saved with the owner's analysis, not indexed with shared public patent records. Local index reads also discard historical cached query lists, avoiding cross-analysis attribution and exposure of another user's search history.

## User-supplied reference case

`/demo/patent` uses the verified US20080003142A1 snapshot. Its trace explicitly says **known reference / no database search**, records no new provider HTTP requests, and states that BigQuery was not queried. The original source timestamp and selected claim excerpts from original PDF page 81 remain visible. This is an editable comparison exercise, not a newly discovered patent or a fresh worldwide search.

## Validation

Unit/integration coverage exercises source successes, empty results, partial failures, actual versus cached HTTP observations, rate limits, secret removal, deduplicated passage attribution, title-only limitations, local-index privacy, reference context and PDF-report provenance. Browser tests cover the source panel, shortlisted publication inspection, highlighted passages, mobile layout and reopening saved research with its evidence. Real public connectivity and deployed private-storage checks are recorded separately from mocked automated provider tests in the release evidence.
