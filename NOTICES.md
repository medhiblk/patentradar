# Source and third-party notices

PatentRadar original application code follows the Apache 2.0 licence selected in the medhiblk/patentradar repository and retained in LICENSE. Third-party software and source data retain their own licences.

- Three.js: MIT.
- Replicad 1.2.0 library: MIT, verified in its packaged LICENSE; the browser application visualizer is not embedded.
- replicad-opencascadejs 1.1.0 dynamically loaded module: LGPL-2.1-only. Unmodified loader/WASM, licence text and corresponding-source/build links are served under /cad-kernel/. Modules remain replaceable.
- CadQuery: Apache 2.0 at project level; native OCCT/OCP, CasADi, solvers and bundled libraries have separate obligations. See `docs/engineering/OPEN_SOURCE.md` and upstream notices before redistributing native binaries.
- PDFium/Pillow and the Node dependencies retain their respective upstream licences.
- Patent/research data retain source-specific rights and required attribution; CC-BY metadata rights do not establish rights to every linked full-text document.
- Experimental providers with unclear reuse rights remain disabled by default.

No confidential user portfolio, uploaded client document, credential or local SQLite database belongs in the published repository. `.env.example` and `.env.registry.example` contain configuration templates, not real keys.

## User-selected publication example

`public/examples/US20080003142A1-excerpt.pdf` reproduces selected pages of the published US application **Microfluidic devices**, supplied by the user via Google Patents, plus an original provenance cover. Original document: https://patentimages.storage.googleapis.com/89/d6/88/68356f0ae820d5/US20080003142A1.pdf . The snapshot, page mapping, checksums and source attribution are recorded in `src/lib/examples/us20080003142a1.json` and `docs/PATENT_SIMILARITY_ALERTS.md`. The application's code licence does not grant patent rights or independently license third-party source documents. Publication and publisher-reported abandoned status do not establish manufacturing permission or the status of related rights.
