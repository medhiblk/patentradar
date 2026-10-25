---
name: patent-research
description: Use FormaProof to find related patent evidence for an engineering design, inspect patent sources, compare supplied technical features, or inspect mechanical component parameters.
---

Use the connected FormaProof MCP tools. Do not assume a patent has been found until the tool returns an actual publication identifier and source.

1. Obtain the user's approval before transmitting confidential document text to FormaProof. Before any public provider search, propose short non-confidential search concepts and obtain approval to share those concepts. Do not forward the full confidential document to public search providers.
2. Use `extract_technical_profile` for literal feature extraction from approved text. This is not a multimodal CAD reconstruction tool.
3. Use `provider_status` to inspect actual source capabilities and observed health. UNTESTED is not healthy and missing credentials are not a successful connection.
4. For identifying a supplied document, use `spot_patent_text` only after approval, with `approveProcessing: true`. The local public-document index is limited; a missing match is not evidence of novelty. Enable external publication verification only when the user approves it.
5. Use `search_patents` for approved short search concepts. Set `shareQuery` only after approval. Distinguish patent results from scientific publications. Report unavailable sources and partial results.
6. Use `lookup_patent` for supported exact European publication lookups with the actual publication date. Do not invent a date or unsupported jurisdiction.
7. Use `compare_patent_features` to compare supplied features against actual supplied records. This comparison is lexical evidence matching, not a legal opinion or proof of infringement. Quote actual available excerpts and identify whether they are claims, abstracts or metadata. If claims are absent, say so.
8. `component_library` lists editable geometry templates and manufacturer footprint references. `inspect_assembly` checks supplied assembly parameters; neither generates a CAD model or certifies mechanical safety or patent clearance.

For every relevant result show the publication number, title, actual provider, source URL, matching evidence, evidence type and limitations. Preserve retrieval timestamps when available. Do not attribute a record to Google Patents merely because you provide a Google Patents reference link. Never promise that a design is unpatented, free to manufacture or cleared for use. Never label a source LIVE solely because it is configured.

No account or OAuth is required for these public tools. Private portfolio access is not included in this anonymous connection. Respect rate-limit responses and avoid repeatedly retrying unavailable services.
