# Open-source and repository findings

Repository metadata was fetched from the public GitHub API. Last push/update dates are observed GitHub fields, not claims about maintenance quality. Repository licences do not license upstream patent data. No code from these repositories was executed.

| Repository | Licence (GitHub SPDX) | Last push / last repository update | Jurisdictions | Actual source / use | Public endpoint / hosting |
|---|---|---|---|---|---|
| [CNIPA-AI/patent-data-parser](https://github.com/CNIPA-AI/patent-data-parser) | MIT | 2026-04-08T08:09:35Z / 2026-09-17T05:09:15Z | CN / WIPO ST.36 | Local CNIPA/WIPO XML parser; publisher is not assumed to be the government CNIPA. | Local library; no public endpoint |
| [deeparchi-ai/patent-mcp-server](https://github.com/deeparchi-ai/patent-mcp-server) | MIT | 2026-09-30T03:32:53Z / 2026-10-09T09:02:23Z | Global | MCP integration; README mentions BigQuery. Upstream access requirements remain. | Self-host/client setup required |
| [djfksjd/patent-search-skill](https://github.com/djfksjd/patent-search-skill) | MIT | 2026-07-31T03:55:13Z / 2026-10-02T15:12:54Z | CN / JP / KR / global | Patent-search skill references KIPRIS/WIPO; no new anonymous upstream API proved. | Local skill, not hosted API |
| [Tech-curator/korean-patent-mcp](https://github.com/Tech-curator/korean-patent-mcp) | MIT | 2025-12-16T12:40:34Z / 2026-07-29T07:08:06Z | KR | KIPRIS integration; upstream service key remains required. | Self-hosted MCP |
| [nuri428/mcp_kipris](https://github.com/nuri428/mcp_kipris) | MIT | 2026-08-07T20:39:33Z / 2026-08-07T20:39:37Z | KR | KIPRIS Plus; README explicitly asks for a key. | Self-hosted MCP |
| [ChloePark85/kipris-cli](https://github.com/ChloePark85/kipris-cli) | MIT-0 | 2026-05-04T01:22:51Z / 2026-05-04T01:22:55Z | KR | KIPRIS client CLI; does not remove upstream registration. | Local CLI |
| [satoh-ip-tools/jplatpat-dual-view](https://github.com/satoh-ip-tools/jplatpat-dual-view) | MIT | 2026-07-22T08:53:13Z / 2026-07-22T08:52:39Z | JP | J-PlatPat viewing aid; not a licensed anonymous patent database API. | Local tool |
| [parkerhancock/patent_client](https://github.com/parkerhancock/patent_client) | NOASSERTION | 2026-04-24T15:24:41Z / 2026-10-19T14:33:11Z | US / EP | USPTO/EPO clients; API credentials and terms remain source-specific. SPDX NOASSERTION needs licence-file review. | Local library |
| [ip-tools/python-epo-ops-client](https://github.com/ip-tools/python-epo-ops-client) | Apache-2.0 | 2026-10-23T13:23:10Z / 2026-10-19T18:42:03Z | EP / OPS international | OPS OAuth, throttling and optional caching. Requires OPS credentials. | Local library |
| [google/patents-public-data](https://github.com/google/patents-public-data) | Apache-2.0 | 2024-06-17T21:48:06Z / 2026-10-12T00:09:45Z | Global | BigQuery schemas/examples and datasets; GCP access required. No anonymous REST search API. | Cloud query account or exported-data workflow |
| [grobidOrg/grobid](https://github.com/grobidOrg/grobid) | Apache-2.0 | 2026-10-24T23:36:19Z / 2026-10-24T17:50:38Z | Global documents | ST.36 patent citation parsing; host your own service. Public demo is not assumed production infrastructure. | Self-hosted service |
| [AI-Growth-Lab/PatentSBERTa](https://github.com/AI-Growth-Lab/PatentSBERTa) | MIT | 2024-11-03T06:43:49Z / 2026-09-04T07:37:40Z | Primarily US training examples | Patent semantic embeddings; code licence does not independently license training corpora or every model artifact. | Local model/runtime |
| [LGAI-Research/PANORAMA](https://github.com/LGAI-Research/PANORAMA) | NOASSERTION | 2025-10-22T04:47:02Z / 2026-09-17T00:47:34Z | US / patent research | Research data/model materials; GitHub SPDX NOASSERTION, review individual artifact licences. | Self-host/research artifacts |
| [hopped/uspto-patents-parsing-tools](https://github.com/hopped/uspto-patents-parsing-tools) | MIT | 2014-05-29T15:08:31Z / 2026-06-18T16:59:36Z | US | Parse acquired USPTO patent XML; no public search service. | Local bulk pipeline |
| [max-planck-innovation-competition/go-uspto](https://github.com/max-planck-innovation-competition/go-uspto) | MIT | 2025-08-05T12:06:38Z / 2025-08-13T05:48:36Z | US | USPTO bulk parsing/processing; data must be legitimately acquired. | Local bulk pipeline |
| [patent-dev/dpma-connect-plus](https://github.com/patent-dev/dpma-connect-plus) | MIT | 2026-09-22T19:59:09Z / 2026-09-22T19:59:11Z | DE | DPMA client; official contract/access is still required. | Local authenticated client |

## Gitee and GitLab

Native-language Gitee and GitLab searches were performed and recorded in `evidence/`. No additional repository was both precisely identified and licence-verified as a reusable keyless patent service during this audit. This is a bounded negative finding, not a claim that no such project exists. Public repository visibility alone is insufficient to establish a licence. Unrelated search hits and repositories with restrictive/all-rights-reserved licences were not padded into the useful integration list.

## Practical priorities

1. Use the CNIPA/WIPO XML parser and EPO/USPTO bulk loaders only with legitimately licensed input corpora.
2. Use Korean/Japanese wrappers as implementation references, not evidence of anonymous upstream access.
3. Evaluate PatentSBERTa and related research for a later local semantic index after reviewing model/data licences.
4. The VeyIP hosted MCP is independently verified in this audit; its commercial-use uncertainty is separate from the licences of open-source MCP clients.
