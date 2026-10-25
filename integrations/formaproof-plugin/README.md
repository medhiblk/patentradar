# FormaProof — free MCP plugin package

A portable Agent Plugins package connecting to the public FormaProof MCP service.

**Download:** https://raw.githubusercontent.com/medhiblk/patentradar/main/downloads/formaproof-plugin.zip

## Install

For a client supporting Agent Plugins 1.0, download and extract the ZIP into its plugin directory, then enable FormaProof using that client's plugin controls. The archive contains `plugin.json`, `mcp.json`, the research skill and a PNG icon. Client support and permissions vary.

For ChatGPT, downloading the ZIP alone does not install a custom app. Where custom MCP connections are supported by your account or workspace, add this server through the custom app settings:

- Name: **FormaProof**
- MCP server URL: **https://patentradar-puce.vercel.app/api/mcp**
- Transport: **Streamable HTTP**
- Authentication: **None**
- Optional icon: `assets/icon.png` (256 × 256 PNG, under 10 kB)

This download is not an approval or public listing in the ChatGPT app directory. Custom app availability depends on the client, plan and workspace policies.

## Public tools

- `component_library`: editable component templates and manufacturer footprint references.
- `inspect_assembly`: inspect supplied dimensions and assembly parameters; does not generate CAD.
- `provider_status`: configured source capabilities and observed source health.
- `search_patents`: approved short-query retrieval; sources depend on actual server configuration.
- `spot_patent_text`: identify related evidence in a limited public patent corpus, with optional exact publication verification.
- `lookup_patent`: supported exact European publication lookup with a known publication date.
- `compare_patent_features`: compare supplied features with supplied patent evidence.
- `extract_technical_profile`: local literal feature extraction from text.

## Try it

Ask: "Use FormaProof to show the mechanical component library."

Then: "Show the available patent providers and explain their coverage limits."

Before sharing confidential material, approve what is transmitted to the hosted FormaProof server. External searches should use approved short non-confidential concepts. Results are preliminary technical evidence with partial coverage, not legal clearance, an infringement opinion, or proof that no patent exists. Private portfolios are not exposed by this anonymous connection.

## License and hosting

The package source is available under the repository's Apache-2.0 license (included). The package is free to download; this does not grant rights to third-party patent data or guarantee unlimited availability of the hosted service. No API key, OAuth token or private account credentials are included.
