# Target positioning — engineering documents to informed design

**Understand the system. Explore the design. Investigate the evidence.**

FormaProof connects the documents engineers already possess to reviewed system understanding, interactive mechanical models and patent evidence. PatentRadar repository, domain and API/MCP identifiers remain compatible. General patent research stays available; mechanical reconstruction is a connected workflow rather than a requirement for every invention.

## User journey

1. **PDF, dessin technique ou manuel** — partir de ce que l’ingénieur possède déjà, ou saisir des spécifications mesurées.
2. **Compréhension du système assistée par IA** — revoir composants, fonctions, géométrie, relations et contraintes. L’utilisateur valide l’interprétation.
3. **Modélisation 3D interactive** — visualiser les pièces, modifier les dimensions et positions, explorer un assemblage.
4. **Patent Intelligence** — rechercher les technologies similaires, lire les preuves et les revendications effectivement disponibles, identifier les points à approfondir.
5. **Itération du design** — revenir aux paramètres de l’assemblage, explorer une autre conception, puis relancer une recherche sur des concepts revus.

## Current implementation and boundaries

| Stage | Available | Boundary |
| --- | --- | --- |
| Existing documents | PDF text extraction, measured specification input, STEP import, STL inspection; PNG/JPG input for configured multimodal interpretation | Drawings/images are not universally reconstructed; no-key rules require explicit supported dimensions. |
| System understanding | Components, source page/quote, materials/relationships when supplied, editable technical features; optional consented OpenAI interpretation | OpenAI needs configured credentials and account access. Local extraction is labeled and does not pretend to be AI. Connection text is not a solved mechanical constraint system. |
| Interactive 3D | Browser OpenCascade box/cylinder/tube primitives, measured bore, transforms, selection, exploded inspection, STEP/STL export | Missing dimensions remain missing. Geometric kernel validity does not establish engineering/manufacturing correctness. Imported STEP/STL source must be reselected after leaving the studio. |
| Patent intelligence | Real public-source search, progressive records, source attribution, available claim/abstract comparisons, optional account-gated AI review | Coverage and claim availability are partial. A relevant applicant is a candidate competitor; a similarity score is not infringement probability. No legal clearance is asserted. |
| Design iteration | Explicit research handoff retains validated assembly parameters and source filename/hash in tab-scoped session storage; return action restores editable dimensions. The next handoff includes current parameters. | No original PDF or imported geometry is retained. No automatic search on handoff, and no claim that a geometry edit avoids a patent. This is not a generated or optimized design-around recommendation. |

## Privacy and continuity

The user deliberately chooses “Review features for patent research.” This stores parameters, descriptions and source references in the current browser tab. The research screen receives the technical brief for review; external patent search and AI processing retain their separate consent requirements. Shared-device users must treat browser storage as local data, not an authenticated private vault. On return, the draft is schema-validated and consumed; CAD is rebuilt explicitly. Rebuild requires source reimport for imported geometry. Browser storage failures stop navigation and ask the user to export parameters first.

## Delivery verification

The engineering Playwright flow exercises measured PDF ingestion, actual CAD generation, parameter edit, STEP download, research handoff, restoration, a second edit and a second handoff. It verifies that simply navigating this loop makes zero research/AI requests. General research, evidence and report coverage remains in the existing end-to-end suite. Live external-provider availability is not inferred from browser fixtures.

Local verification on 2026-10-25: TypeScript, ESLint, 72 unit/integration tests, production build and 10 browser tests passed. The extended engineering browser test verifies two design-to-research handoffs and preserved dimensions with zero automatic research/AI calls.

Production verification: [release evidence](DESIGN_ITERATION_RELEASE.json). Deployment `dpl_pY46TRKwkeaobXAijsxfjNmL6Peb` is READY at https://patentradar-puce.vercel.app . The browser probe used the actual deployed document parser and WASM kernel: STEP export/reimport, preserved width 55 mm after research, second width 60 mm handoff, and no native CAD API calls. Source CI also passed: https://github.com/medhiblk/patentradar/actions/runs/40190711268 . The explicit measured PDF fixture is test input, not a hardcoded output or live patent result.
