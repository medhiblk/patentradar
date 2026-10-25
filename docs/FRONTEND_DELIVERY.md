# Product experience and portable development — 2026-10-25

## Delivered

- One product story: document → reviewed components → measured editable 3D → sourced patent evidence → design iteration. General invention research remains a separate starting point.
- A shared navigation with four primary destinations and an accessible secondary menu for Account, Files, Sources, API/MCP and GitHub. Mobile supports Escape/outside dismissal, active destinations and no horizontal overflow.
- A lightweight entry (`src/app/page.tsx`) and on-demand research workspace. CAD, account/project screens, AI comparison, source explorer and Recharts load when used. Existing provider, storage, API and MCP behavior remains compatible.
- A document-first studio with linked stages, clearer input, an empty-state action leading to real parts, and no WebGL viewer until geometry exists. Collapsed private-file drawers no longer fetch the account on initial studio load. Static 3D scenes render only after changes; animation and camera interaction retain frames, and grid resources are disposed on teardown.
- Shareable section hashes and browser Back support; only navigation state goes in URLs, never confidential descriptions. Original file handoffs remain authenticated and private.
- A GitHub Codespaces/devcontainer configuration, Node version file, concise README, portable browser executable resolution and a separate lightweight Node Docker configuration. Native CadQuery Docker remains optional.

- A guided `/demo` page uses an explicitly synthetic measured PDF with the real document interpreter and geometry engine, editing and STEP/STL exports. It starts no external AI or patent search automatically and does not restore an existing private design into the example.

## Measured performance

See `FRONTEND_PERFORMANCE.json`: fresh local production browser context, same viewport and measurement method. Initial JavaScript encoded bytes fell from 366,695 to 145,436 (60.34% reduction), total requests from 15 to 11, and initial API requests from one to zero. This is a resource measurement, not a Lighthouse score or a guarantee of equivalent improvement in every user's latency. The 22 MB CAD kernel remains necessary on first geometry computation; it is not downloaded by the homepage or empty studio.

Reproduce against a production build with:

```bash
npm run build
npm start
# Another terminal; install Playwright Chromium first if needed:
FRONTEND_MEASURE_OUTPUT=/tmp/frontend.json node scripts/measure-frontend.mjs
```

## Validation and limits

98 unit/integration tests and all 18 browser workflows passed. Browser tests cover source PDF → actual browser CAD → edited STEP export → consented research handoff → design iteration, mixed STEP assemblies, real boolean geometry, storage, sign-in, responsive menus, deep links and reports. Automated external search fixtures remain identified as mocks; browser CAD is not mocked. Build, lint, TypeScript and private-file trace checks passed.

A new clone of the public repository installed from the lockfile, typechecked, built and launched on port 3101 without an environment file; homepage and health returned HTTP 200. Codespaces configuration is committed, but no billable Codespace was provisioned. Docker configuration is supplied, but its image was not built during this task. Each local environment has its own accounts/documents unless explicitly connected to an authorized shared backend; GitHub contains source, not private files or credentials.

Production is READY. All six selected real browser checks passed on the public deployment: guided demo geometry/export, measured PDF engineering roundtrip, private attachments, sign-in, lightweight entry and mobile/deep-link navigation. See `FRONTEND_RELEASE.json`. Hosted provider coverage and native runtime requirements remain unchanged. This release does not claim unrestricted global patent coverage, exact reconstruction without measurements or legal clearance.
