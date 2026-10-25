# PatentRadar — global public-source discovery and integration

Audit performed 2026-10-24/25 UTC. This handover supersedes earlier claims that a responsive URL or a free registration tier is a production-ready anonymous API.

## Delivered artifacts

| Deliverable | Artifact |
|---|---|
| A. Public endpoint environment registry | `../../.env.registry.example` — 80 endpoint candidates, grouped by eligibility; only Tier A assignments active, other candidates commented |
| B. Verification matrix | `VERIFICATION.md`, `verification.csv`, `verification.json` — exact test URL, method, actual status, latency, response format/shape, documentation, access and reuse assessment |
| C. Repository findings | `REPOSITORIES.md`, `repositories.json` — 16 inspected repositories, licences, observed push/update timestamps, upstream services and self-hosting requirements |
| D. Working integration | `../../src/lib/providers/`, `/api/intelligence`, `/api/health/providers`, updated research pipeline and Sources UI |
| E. Coverage gaps | `COVERAGE.md` — 22 jurisdiction/service groups, bulk/manual/self-hosted alternatives and remaining limitations |

**Counts:** 80 endpoint candidates, 26 independent provider families. **55 Tier A endpoints across 19 families**, 1 Tier B, 20 Tier C, 4 Tier D. Sixteen OpenAlex routes remain one provider. MCP initialize/search/claims calls remain one endpoint, not three APIs. Portals, repositories and bulk-source landing pages are not padded into the API count.

A tier applies to the declared metadata/retrieval scope, source rights and quota. It is not a guarantee of service availability or permission to redistribute every linked full-text document. B/C/D entries stay out of default automatic execution. Additional credentialed government services are discussed as exclusions/gaps rather than padded into the 80 tested candidates.

## Important discoveries

- **China:** ZYB publishes list/detail documentation, but actual calls returned firewall 403; authentication is therefore unresolved. VeyIP Streamable HTTP MCP initialized anonymously, exposed 18 tools, returned real Chinese patent search results and a claims block for CN102299288B. Its upstream is PatentHub. Licence/redistribution uncertainty and undisclosed daily IP quotas keep it **Tier C, disabled**. Only read-only patent tools were called; no consultation, lead-submission or other write tool was used.
- **Japan:** the JPO patent-information API explicitly requires registration. J-STAGE scientific API commercial use requires prior approval even if free to end users. Neither satisfies this project's no-registration commercial requirement.
- **Korea:** KIPRIS Plus registration/service-key and product quota/fee requirements remain. An open-source wrapper does not make the upstream API anonymous.
- **Taiwan:** HTTP 200 was a false positive. Both TIPO test bodies explicitly said the verification code failed, only sample data was available and the user must apply to TIPO.
- **EPO:** the supplied application JSON URL works; Turtle was separately parsed into 37 RDF triples with N3. It supplies application/publication/classification/family references. Official CC BY 4.0 is clear, but fair use explicitly says the live linked-data service is not a production application backend. Use bulk data for that purpose. The supplied SPARQL path returned HTML, not query results.
- **OpenAIRE:** the official graph pipeline imports Lens-derived patent metadata but keeps patents connected to non-patent research. Anonymous API access is documented, the graph is reusable under CC-BY, and actual responses included US12233417B2 with publication date 2025-02-25. It is **not the Lens API** and does not require a Lens key. It is not a complete patent database. Attribution, upstream provenance and metadata normalization are disclosed.
- **PubChem:** anonymous compound-to-patent references include CN, JP and other authorities. These are identifiers, not complete patent records; no title, applicant, claim or family is invented.
- **OpenAlex:** all 16 supplied resource routes returned actual JSON data during this audit. Current official documentation permits basic anonymous requests under a shared $0.10/day budget; a key increases budget and is required for cursor paging beyond the first page. No key was requested or generated.
- **Semantic Scholar:** anonymous transport exists, but the tested search returned 429 and commercial API embedding/redistribution terms need review. Dataset ODC-BY rights are not a substitute for API permission; default automatic use is disabled.

## Runtime integration

The automatic research pipeline uses OpenAIRE patent/research metadata, DataCite, HAL, arXiv, Zenodo, Crossref, OpenAlex and PubMed. EPO exact publication retrieval remains available when a publication number/date is supplied. Keyword queries are shared only after the existing consent gate. Research and patent data have separate contracts; a DOI record is never manufactured into a patent.

Additional source-specific operations support INSPIRE, NASA NTRS, DOE OSTI, ROR, GLEIF, French company search, Wikidata entity/SPARQL relationships, RCSB structure metadata, PubChem properties/patent references and OpenCitations DOI citations/references. These are available through the working **Sources → Explore a public source** interface.

- `GET /api/intelligence`: audited catalogue with tiers, documentation, rights and dated verification facts; no live fan-out.
- `POST /api/intelligence`: selected source operation with explicit consent, validated identifiers and bounded pagination.
- `GET /api/health/providers`: runtime observations plus eligibility summary. UNTESTED does not mean healthy. Serverless instances may have separate health observations.
- `/api/research`: bounded parallel search, typed normalization, patent deduplication, source-diverse paper shortlist, provenance, partial errors and honest coverage warnings.
- `/api/report`: existing evidence-backed PDF report with source references and OpenAIRE attribution.

Example request (public metadata only):

```bash
curl -X POST http://localhost:3000/api/intelligence \
  -H 'Content-Type: application/json' \
  --data '{"provider":"datacite","query":"microfluidic","consent":true}'
```

Other examples:

| Provider | Query | Optional operation | Returned category |
|---|---|---|---|
| `openaire` | `microfluidic` | `search` | Separate patent and research arrays |
| `hal`, `arxiv`, `zenodo`, `inspire` | Technical words | `search` | Research metadata |
| `nasa`, `doe` | Technical words | `search` | Technical reports, first bounded page only |
| `ror`, `gleif`, `fr-company` | Organization name or SIREN where supported | `search` | Organization candidates |
| `wikidata` | `Q312` | `search` or `relations` | Entity/relationship assertions, not verified ownership |
| `pubchem` | `aspirin` | `search` | Compound properties |
| `pubchem` | `123` | `patent-references` | Patent identifiers only |
| `rcsb` | `4HHB` | `search` | Structure metadata, not 3D/CAD analysis |
| `opencitations` | `10.1038/nphys1170` | `citations` or `references` | Scientific citation graph, not patent citations |
| `epo-linked` | `81850042` | `application` or `rdf` | Optional reference JSON/RDF, disabled by default |
| `veyip` | `ts:电池` | `search` | Experimental patent results, disabled by default |
| `veyip` | `CN102299288B` | `claims` | Experimental retrieved text block, disabled by default |

No endpoint accepts arbitrary URLs, arbitrary SPARQL or arbitrary MCP tool names. The Wikidata SPARQL operation uses a fixed query with a validated Q identifier. Remote MCP instructions are data and never become execution instructions.

## Policy flags and compatibility

Existing implementations are retained but sources with unresolved commercial rights or non-production usage policies require explicit operator opt-in:

```dotenv
ENABLE_EXPERIMENTAL_VEYIP=false
ENABLE_EPO_LINKED_REFERENCE=false
ENABLE_GOOGLE_PATENT_PAGES=false
ENABLE_EPMC_PATENT_ARCHIVE=false
ENABLE_SEMANTIC_SCHOLAR=false
```

Enabling a flag does not grant a licence, waive a fair-use policy or establish legal accuracy. Clear the relevant conditions first. The original OpenAI/OPS/other credential variable names are preserved; paid/authenticated services are optional and are excluded from the anonymous-source count. Never add secrets to the endpoint registry or `NEXT_PUBLIC_` settings.

## Transport, normalization and scale

- HTTPS requests, 10-second timeout, one bounded exponential-backoff retry for transient failures; non-transient HTTP errors are not repeatedly retried.
- Provider pacing, `Retry-After` seconds/date handling and fast local quota errors instead of long blocked requests.
- Bounded 8 MB response reads, cache keys separated by method/body/header identity, five-minute normal cache, one-hour arXiv/OpenAIRE cache and in-flight request deduplication.
- OpenAIRE default pacing is at least 61 seconds per uncached call because current anonymous documentation says up to 60 calls/hour. arXiv enforces at least 3.1 seconds and a single sequential start path in a process.
- Unicode/NFKC identifiers, CJK bigram and Korean token handling, classification normalization and explicit-ID-only family grouping.
- ROR/GLEIF/Wikidata/SIREN results are candidates for human review; inventor/assignee similarity is not proof of identical entities.
- Caches and limiters are process-local. A multi-instance deployment needs a shared limiter/cache or self-hosted bulk-data index to enforce organization-wide quotas. No IP rotation or quota circumvention is implemented.
- Many raw registry routes are reusable parameterized definitions; they are not all separate UI actions or independent provider adapters. The declared provider contracts preserve distinctions between patents, research, organizations, citations and raw graph references.

## Validation and reproduction

```bash
python scripts/discovery/catalogue.py
python scripts/discovery/verify.py
python scripts/discovery/finalize.py
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
# With the application running, performs real external requests:
node scripts/discovery/smoke-adapters.mjs
```

The audit probes are paced by host and use small public examples. Do not run them repeatedly or load-test public services. `verification.json` and `evidence/` distinguish transport failures, HTML, structured error bodies and useful data. The classifier is conservative but its policy decisions are reviewed separately from HTTP success. Follow-up PubChem/EPO RDF checks are explicitly recorded rather than disguised as the original test.

Mocked tests cover source parsing, incorrect identifiers, date provenance, disabled experimental access, consent, arbitrary-provider rejection, safe MCP envelope handling, multilingual normalization, in-flight deduplication and source diversity. Existing PDF/analysis/report tests remain.

A separate real local application smoke test returned HTTP 200 for **17 source-specific operations**, including organizations, chemistry, citations and technical reports. The aggregate microfluidic workflow returned **12 patent metadata records and 30 scientific records**, and a real PDF report. See `evidence/adapter-smoke.json`. This validates those tested operations, not every field or worldwide patent coverage. Production-specific smoke results and deployment state are recorded separately after release.

## Explicit remaining gaps

No comprehensive, current, official anonymous CN/JP/KR patent search/claims/legal-status service was production-qualified. Worldwide claim construction, complete patent-family/citation graphs, legal-status monitoring and full automatic inventor disambiguation remain incomplete. Source descriptions, limits and `COVERAGE.md` must accompany any claims about geographic reach. Do not use this research as a legal FTO conclusion.

## Primary policy references

- EPO licence and fair use: https://www.epo.org/en/searching-for-patents/data/linked-open-data
- OpenAIRE anonymous API terms: https://graph.openaire.eu/docs/10.1.0/apis/terms/
- OpenAIRE graph licence: https://graph.openaire.eu/faq
- Official Lens-to-OpenAIRE patent mapping: https://graph.openaire.eu/docs/graph-production-workflow/aggregation/non-compatible-sources/lens/
- JPO registration: https://www.jpo.go.jp/system/laws/sesaku/data/api-provision.html
- KIPRIS quotas/fees: https://plus.kipris.or.kr/portal/use/paymentMmg.do?menuNo=210112
- TIPO product/access documentation: https://cloud.tipo.gov.tw/S220/opdata/detail/PatentPub
- VeyIP MCP documentation: https://www.veyip.com/ai
- OpenAlex current anonymous budgets: https://help.openalex.org/api/authentication/
- arXiv metadata rights and rate limit: https://info.arxiv.org/help/api/tou.html
- HAL metadata rights: https://static.ccsd.cnrs.fr/principles/
- OpenCitations public API and optional token: https://api.opencitations.net/index/v2
- INSPIRE API documentation: https://github.com/inspirehep/rest-api-doc
- NASA NTRS API schema: https://ntrs.nasa.gov/api/openapi/

## Release verification — 2026-10-25 UTC

Final local checks passed: TypeScript, ESLint, 42 unit/integration tests and production build. Seven browser scenarios were validated (six original workflow scenarios plus the new public-source explorer, whose corrected accessibility label was rerun separately).

Production smoke testing returned 200 for 16 of 17 initial source operations; HAL timed out on its first isolated call, then succeeded in the aggregate research workflow. That workflow returned 12 sourced patent metadata records, 30 scientific records and a valid PDF. The fixed Wikidata relationship operation separately returned 20 records. Provider transport failures now produce sanitized 503 responses, while quota failures produce 429 with Retry-After. These tests demonstrate partial-failure handling rather than universal provider uptime.

Production: https://patentradar-puce.vercel.app . Dated deployment and follow-up observations are recorded in `evidence/deployment.json` and `evidence/production-followup.json`.

Final post-release checks: health and catalogue returned HTTP200 with the expected 80-endpoint classification and EPO Publication Tier A. HAL remained intermittent: its final isolated follow-up returned sanitized HTTP503. It is not represented as continuously healthy.
