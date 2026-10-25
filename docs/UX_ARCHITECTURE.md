# Site, workspace and MCP connection architecture

## Navigation boundary

The public header has two destinations, **Demo** and **ChatGPT**, plus the primary **Open workspace** action. It does not list every tool. `AppNavigation` owns only public navigation, the brand/home action, responsive menu dismissal and its focus behavior.

The separate `WorkspaceShell` and `WorkspaceNavigation` own context navigation: 3D Studio, patent research, projects/files and reports; account and resources stay within the workspace. `/workspace` is the entry hub. Existing `/#...` research routes, `/engineering`, `/files`, API and MCP URLs stay compatible. On the research page, contextual navigation preserves in-memory search results through callbacks; standalone pages use canonical links.

## File boundaries

- `src/components/app-navigation.tsx`: public header.
- `src/components/shell/`: workspace shell/sidebar, contextual styles.
- `src/app/page.tsx`, `src/components/home.tsx`: lightweight product entry with explicit web/ChatGPT choices. Heavy tools still load on demand.
- `src/app/workspace/page.tsx`: lightweight workspace entry, no automatic private/project/provider fetch.
- `src/app/connect/page.tsx`: server-rendered connection instructions and metadata; interactive actions live in `components/integrations/mcp-connection-panel.tsx`.
- `src/lib/mcp/connection.ts`: public endpoint/tool metadata shared by discovery, UI and validation. No tokens/secrets.
- `src/lib/mcp/check-connection.ts`: bounded anonymous initialize → initialized → tools/list protocol check. Cookies are omitted; it never invokes provider search or paid AI.
- `src/app/.well-known/mcp.json/route.ts`: backward-compatible descriptor plus display name and guide link.
- `src/components/demo/product-tour.tsx`: isolated route-only Motion preview, four scenes, play/pause and manual selection. It is labeled as illustration rather than generated live evidence.
- `src/app/demo/page.tsx`: preloads the 1,075-byte synthetic example PDF once, reuses that file when the user opens the real editor, and leaves actual extraction/geometry generation to explicit actions. No confidential design-return draft is restored into the example.
- The example launch now scrolls to and focuses the enabled document-reading action after the source is committed. Guided navigation then follows actual extraction to the component list and a successful CAD build to the viewer. The selected source is shown beside its action. A failed preload can be retried on click; download errors are visible beside the launch button. The loader validates the PDF signature/size and applies a 20-second timeout even with a parent cancellation signal. Standard Studio navigation remains unchanged unless guided mode is requested.

## MCP availability and boundaries

Public read-only tools are anonymous. Private scope/token and file authorization remain separate and unchanged. The descriptor uses the existing PatentRadar server identity for compatibility and FormaProof as the display name.

The connection page verifies its deployed server, not the user's ChatGPT installation or all downstream provider health. No ChatGPT-directory listing is invented. The user must add and select the custom connection in their own account. The 3D viewer is not advertised as an embedded ChatGPT app: available MCP tools inspect component parameters; geometry editing runs in the browser workspace.

Official setup was checked on 2026-10-25 against:

- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://developers.openai.com/plugins/quickstart

The current Plugins flow does not require a blanket instruction to enable developer mode first. Account/workspace permissions still apply. An older Apps-interface fallback is kept in the guide's expandable section.

## Verification

Unit tests cover the MCP probe's protocol sequence, anonymous credentials policy and failure handling. Browser tests exercise the deployed protocol check, config download, two-link public header, context navigation, responsive layouts, preloaded source, motion controls and the existing real CAD/storage/search/report journeys. `scripts/verify-mcp-connection.mjs` separately uses the official MCP SDK without mocking or external provider search. Dated production evidence is recorded in the corresponding release JSON after deployment.
