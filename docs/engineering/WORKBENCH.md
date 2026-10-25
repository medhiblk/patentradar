# Engineering component workbench

## Delivered behavior

Start at `/engineering`, enter **What would you like to represent?**, upload a manual, drawing, measured specifications or existing CAD, then review the extracted components. OpenAI interpretation remains opt-in and configuration/account dependent. Without AI, explicit mm dimensions and conservative named entries under a component-list heading are extracted; names do not create invented geometry. A list such as `Components / 1. Rotor / 2. Stator / 3. Drive shaft` produces unresolved components requiring measurements. After defining geometry for an individual part, **Preview ready parts** renders only the ready subset and states its count. Complete assembly exports remain disabled; a ready selected part can be exported separately as STL. This is not automatic functional motor reconstruction.

The assembly supports 20 components. New document/STEP/parameter imports append by default; uncheck append to deliberately replace. Parameter imports remap IDs and internal housing target IDs on merge. Imported STEP solids remain available in memory for mixing, duplication and transforms. Neither their original files nor recovered feature history are stored in exported parameter JSON. After reopening a parameter-only assembly or returning from patent research, reimport the source STEP if needed.

## Starter library and purchases

Ten starter entries: Arduino UNO R3 footprint (68.6 × 53.4 mm, occupied height unknown), Raspberry Pi Pico bare PCB (51 × 21 × 1 mm), mounting plate, drive shaft, bearing sleeve, hollow spacer, wheel blank, open enclosure, motor space reservation and purchased-board envelope. Generic values are labeled editable design choices; not standards, manufacturer parts or sourced engine internals.

Manufacturer dimensions were retrieved through real HTTPS requests; see [source evidence](COMPONENT_SOURCES.json). Only factual dimensions and short attributed quotations are included. No supplier CAD assets, trademark licence or patent permissions are incorporated. The Pico footprint excludes USB overhang, headers, solder and populated components. Verify the entire occupied volume before enclosure design.

Paste an Amazon/distributor/manufacturer HTTP(S) link and enter a product name, optional price/currency and occupied dimensions. The link can be attached to an existing selected CAD part or used to create a new occupied-envelope part. It is retained as a user reference; no page is fetched by the application. There is no Amazon API integration or live price claim. Unknown prices remain unknown. The BOM totals known prices independently per currency, counts unpriced parts, and excludes tax/shipping/manufacturing/royalties. CSV export protects against spreadsheet formula injection.

## Custom geometry and checks

Select a measured component, set clearance per side, wall and floor, then **Create fitted housing**. This creates a real open-top box pocket through a CAD boolean subtraction. The housing is positioned around the target using its Euler rotations. Six cavity-to-envelope gaps update from parameters and placement; fit is an occupied bounding-envelope calculation, not exact contact, dynamics, FEA, thermal, electrical or manufacturing verification. No joints, holes, port access, mounting constraints or tolerances are invented.

**Rebuild CAD** computes all parametric/imported solids and preserves separate solids in STEP. **Fuse touching parts into one solid** performs a real boolean union in the browser; disconnected output is rejected. The viewer continues to expose original parts for editing. Fusing a board and an enclosure is usually the wrong manufacturing operation: export the printable custom part separately with **Export selected part STL**. STL is a millimetre mesh for a slicer, not machine G-code or a print-service order. STEP supports further edits in compatible CAD software; imported feature history is not recovered. Export/reopen JSON to retain the application's supported parameters and metadata.

Optional native CadQuery also supports pocket subtraction. Browser mixed-import and fusion options are not claimed as native API capabilities. Rotations in the viewer now use ZYX Euler order to match explicit extrinsic X→Y→Z CAD transforms.

## Rights and patent evidence

Per-component user declarations distinguish unknown, permission document supplied and review required, with an evidence link and scope/territory notes. These declarations are not independently verified. Published or expired patent records, open hardware design licences and purchasing an item do not automatically authorize every form of reproduction or assembly. Royalties and exhaustion depend on the rights, jurisdiction, actual licence and use. Branding alone never establishes a royalty obligation.

**Review features for patent research** opens the existing consented research flow with current design dimensions and descriptions. Supplier prices and rights notes are not automatically forwarded as queries. A search with no results retains a partial-coverage limitation; it never certifies novelty, manufacture permission or freedom to operate. Automatic legal-status/licence/royalty determination, full motor reconstruction, engineering simulation, universal imported feature editing and live supplier-price ingestion remain unimplemented.

## API and MCP

- GET `/api/v1/cad/catalog` lists starter metadata and source links.
- POST `/api/v1/cad/inspect` accepts the current assembly schema, returns missing geometry, housing-envelope checks, known per-currency costs and unverified rights statements, and always returns `patentClearance: NOT ESTABLISHED`. No external calls, document retention or CAD execution.
- MCP `component_library` and `inspect_assembly` expose the same read/compute operations anonymously; no extra public account storage access.

## Reproduce

1. Start the app normally, open `/engineering`, add **Raspberry Pi Pico PCB**.
2. Choose 0.5 mm clearance, 2 mm wall/floor; create fitted housing. The resulting external size is 56 × 26 × 4 mm and nominal six-sided envelope gaps are 0.5 mm. This is a bare-PCB test, not a populated-board packaging certification.
3. Rebuild: housing volume is 3536 mm³, demonstrating actual cavity subtraction. Export selected STL and full STEP.
4. Add a purchased component link with your own dimensions/price; export the parts CSV.
5. Import the exported STEP with append enabled, add a shaft, rebuild and export the combined STEP.
6. Export parameter JSON and reopen it. Imported solids require source reimport; parametric/commerce/rights metadata remains editable.
7. Separately add a mounting plate, duplicate it at the same position, and fuse. The fused volume is 14400 mm³ rather than double-counted volume. Move one plate to X=100 mm and retry: disconnected fusion must fail.

Local browser tests: `npm run build && npm run test:e2e`. To probe only these non-AI workbench flows on a real deployment, run `PATENTRADAR_TEST_URL=https://patentradar-puce.vercel.app npx playwright test tests/e2e/workbench.spec.ts`. The test posts only synthetic user specifications, uses the real CAD worker, and does not search external patent sources or invoke paid AI. Native tests: `/path/to/cad-venv/bin/python cad/test_worker.py`.

## Validation status

TypeScript, ESLint and production build passed. 82 unit/integration tests and six native Python/CadQuery tests passed. All thirteen browser workflows passed after correcting intrinsic grid overflow exposed by an expanded mobile parts list; the updated workbench scenarios also cover changing a purchase reference and retaining user rights evidence without inferring patent clearance. These tests use actual WASM geometry for pockets, mixed STEP solids, STL/STEP exports and boolean fusion. External search-provider certification and live OpenAI credentials are not inferred from these tests. Production verification is recorded separately when executed.

Production verification passed on 2026-10-25 at https://patentradar-puce.vercel.app/engineering : all three workbench browser scenarios passed against the real deployed server/kernel. Catalog/inspection HTTP routes and both new tools were verified through the official MCP client. Seven public MCP tools were discovered; no external patent queries or paid AI calls were needed. See [release evidence](WORKBENCH_RELEASE.json). Source CI passed: https://github.com/medhiblk/patentradar/actions/runs/40193761507 . Repeat API/MCP checks with `PATENTRADAR_URL=https://patentradar-puce.vercel.app node --use-env-proxy scripts/verify-workbench.mjs`.
