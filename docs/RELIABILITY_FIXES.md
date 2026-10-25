# FormaProof — document, design and patent workflow corrections

This release builds on the existing public monorepo, rather than restarting the application. The homepage walkthrough, existing API/MCP paths, source integrations and private storage remain available.

## Entry and continuity

`/workspace` provides one intake for a document or description, followed by the user's intended outcome: patent evidence or measured CAD. No external AI call starts at intake. Core navigation is New project, My projects and Watch; specialist tools remain under Resources. Existing direct routes remain compatible.

Design-to-research passes an editable profile derived from actual components instead of forcing re-extraction from a serialized text dump. Search concepts remain visible and require approval before external search. Original documents and imported STEP files remain in memory during same-tab design/research transitions and are cleared on sign-out. They are not serialized into browser storage.

## Document ingestion and geometry

Patent extraction and component extraction share bounded multipart/PDF ingestion. Valid PDF signatures are accepted despite a missing or generic MIME type. Limits: 4 MiB source, 80 pages, first 20 text pages, 60,000 text characters, up to four consented page previews within the hosted request budget. API responses expose actual page coverage and truncation. Corruption, encryption, unsupported format, account, allowance and temporary failure have distinct error states.

PDF.js renders real page images in the browser for consented multimodal interpretation; Python/CadQuery is not a prerequisite for this path. Scans require configured OpenAI access, a signed-in account and allowance. Without those conditions, the UI retains the source and asks for readable text or measurements. AI availability has not been certified by mock tests.

Dimensions retain per-field evidence, source page/hash and units. Decimal commas and explicit mm/cm/m/in conversions are supported. Unknown dimensions remain unknown; a numeric substring is insufficient proof. Primitive CAD remains limited to boxes, cylinders, tubes and unresolved components. Approximate geometry is identified; this is not automatic reconstruction of arbitrary machines or manufacturing certification.

A design revision protects asynchronous builds and exports. Opening another assembly clears old imported references; STEP imports over 20 solids fail explicitly instead of silently dropping parts. STL remains inspection-oriented and does not recover parametric geometry.

## Patent evidence and monitoring

Literature and patents remain distinct. Search displays whether sources were unavailable, unconfigured, still running or returned an empty sample. Claim passages are centered on actual matching terms, with original offsets and source links. Up to two EP A/B candidates missing claims can be enriched through the existing public EPO Publication Server, using only a real publication date already returned by source metadata. This stage has a 12-second budget, records actual lookup provenance and retains original results on failure. It is exact-document retrieval, not a replacement for worldwide keyword search. Ranking is recalculated after enrichment. Optional authenticated/consented AI reranking changes the actual shortlist and PDF report, validates publication IDs and ignores stale responses.

Manual watches keep cumulative observations and historic review signals through partial failures. A first baseline is not announced as new publications. First observation, publication date, cached results and confirmed fresh checks are separate. Atomic updates preserve reviews performed during a long check. Corporate grouping normalizes spelling conservatively; subsidiary equivalence requires confirmed aliases.

## Important remaining limits

- Keyless patent discovery remains partial; scientific APIs are not substitutes for a worldwide patent corpus. No unsupported scraping or credential has been added.
- A patent hit is preliminary technical evidence. No hit is not permission to manufacture or a freedom-to-operate opinion.
- Private assembly saves currently preserve parameters. Retaining original STEP files across closing/reloading requires explicitly attached/reimported originals; same-tab memory retention is not cloud file persistence.
- Watches remain manual. Automatic scheduled monitoring and email delivery are not included.
- Public access to patentradar.io returned HTTP401 during investigation. Comparative feature counts and superiority claims remain unverified; see POSITIONING.md.

## Validation boundary

Local unit/integration checks, type checking, lint and production build are recorded in RELIABILITY_RELEASE.json. External services are mocked in automated tests; no new live provider success is inferred from these tests. No final production tests are run at the user's request. A focused local browser regression checks only the reported source-picker layout, keyboard access and overflow at desktop/mobile widths.
