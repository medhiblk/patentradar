# Public medical patent reference corpus

FormaProof includes a **small, explicitly indexed public reference corpus**, separate from live external patent providers. It makes a reproducible document-to-evidence demonstration possible without API credentials. It is not a worldwide patent database, complete competitor landscape, live monitoring feed or freedom-to-operate assessment.

## Actual source and scope

18 real European patent publications were retrieved from the official anonymous EPO Publication Server REST v1.2. Five are published on 2020-01-08; thirteen on 2000-05-17. Identifiers were discovered in official dated publication listings and each included XML publication was individually retrieved and checked. The retained dataset contains **21 successful HTTP observations**: 18 XML records and three actual PDF documents. Those are dated retrieval observations, not a guarantee of current service health.

The data file `apps/web/src/lib/patents/data/public-medtech-patents.json` contains actual titles, applicants/inventors where supplied, publication dates, medical IPC classifications, abstracts where supplied, claim text, bounded description excerpts, source URLs and retrieval timestamps. XML and PDF SHA-256 values identify the retrieved source bytes. No family identifier, current legal status, active exclusivity, licence or infringement probability has been inferred.

Claim text keeps its actual source language. Some historical records have French or German claims; these are not invented English translations. Claims are bounded to 20 items, 6,000 characters per item and 40,000 total characters. Truncation sets `claimsScope: "excerpts"`; otherwise the retrieved claims container is preserved as `full`. Description excerpts are bounded to 18,000 characters. These excerpts are not a complete publication reconstruction.

## Reproducible real-document cases

| Case | Publication | Actual document | Source PDF SHA-256 |
| --- | --- | --- | --- |
| `medical-device-03` — primary | EP3590450A1, 2020-01-08 | Attachment position confirmation member, osteotomy assistance kit, and position detection program | `fcc1798819a8c9499a5062082252867b74b5d05ee6e316f62a6b4097937bafbf` |
| `medical-device-01` | EP1000590A1, 2000-05-17 | Self-expanding stent with recapture/repositioning features | `8d9eb030d8fd7bf8819659b21ab2fa79d7873e709280d4b1157aab7bf108dc03` |
| `medical-device-02` | EP1000594A1, 2000-05-17 | Fixation stem for femoral head; source claims in French | `3cf0bd4f38771499bf94ef6140811bb328b2f7fc5f8691aed83893e6f193b3de` |

The PDFs under `apps/web/public/examples/medtech/sample-document-01.pdf` through `03.pdf` are actual downloaded documents, not generated handpicked summaries. They are under 4 MB. Neutral filenames prevent filename-based shortcuts; the PDFs themselves still contain publication information. A same-document match alone is therefore not proof of semantic similarity. Verification must separately mask publication numbers/applicants/inventors and use independent paraphrased technical descriptions, preserving source evidence and reporting missed matches honestly.

`MEDTECH_CASES` is a UI download manifest. Case identifiers select bytes; they must never be passed as expected answers, search seeds or ranking bonuses to the matching engine.

## Refresh and integrity

Run from the repository root:

```bash
python3 scripts/import-public-medtech.py
```

This makes sequential, bounded, anonymous requests to documented EPO publication URLs, at least 1.1 seconds apart. It validates publication identifiers, nonempty claim containers, medical classifications and PDF signatures, and rewrites the indexed dataset and sample manifest. No retries, CAPTCHA bypass, credentials or Google scraping are used. Original observed import latencies are retained where measured; `null` means latency was not recorded. Audit-only `--offline-cache /tmp` requires a matching prior HTTP-200 observation and source SHA-256; it does not pretend to make a new live request.

The typed loader validates patent records with the application's canonical schema and returns cloned records to callers. Unit tests check provenance integrity, source-document hashes and bounded files; they do not certify provider uptime or retrieval quality.

## Access and rights

Official service/documentation: https://data.epo.org/publication-server/ ; source URLs are retained for each publication. The observations establish public anonymous technical access, not a new blanket commercial licence to all content or permission to manufacture the described inventions. Attribute the EPO source and review applicable service/reuse terms before expanding or commercially redistributing a bulk corpus. The importer is deliberately a light, bounded reference-data operation rather than a crawler or a production search backend.
