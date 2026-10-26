# Remote branch analysis

Inspected on 26 October 2026 using fetched Git history and source comparisons. The comparison baseline is `main` at `3843837de1dfc02e32d772e54ad8cdb83d4bfa47`, before this documentation publication. Commit counts below are fixed to that baseline and will change as development continues.

## Recommendation

Continue development on **main**. Keep the other branches as references until their remaining work has been evaluated. Do not replace main with either branch or merge the older source-query branch wholesale. No branch was merged or deleted as part of this review.

## Inventory

| Remote branch                          | Tip at inspection | Commits behind main | Commits unique to branch | Finding                                                                                                                                                      |
| -------------------------------------- | ----------------- | ------------------: | -----------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main`                                 | `3843837`         |                   0 |                        — | Default branch; contains the monorepo, current PDF/SPOT workflow, private storage, English UI, downloadable integration package and latest MCP-origin fixes. |
| `feat/patentradar-cinematic-explainer` | `357720b`         |                  11 |                        3 | Divergent history, but the film implementation is already present identically in main. The older homepage still mounts it.                                   |
| `fix/source-query-plugin`              | `93f323c`         |                  33 |                        6 | Older pre-monorepo branch with source-query features that are not all present in main. Selective porting is required.                                        |

The local `work` branch was initially one commit behind main. It was fast-forwarded to the remote baseline without discarding the pending README and presentation files. `work` was a local branch, not an additional remote branch.

## Cinematic explainer: implementation already retained

The merge base with main is `68fddf0`, the monorepo migration. All seven inspected film files have identical Git object IDs in main and this branch:

- The CSS, React component, story, timeline and visuals under `apps/web/src/components/patent-film/`.
- `apps/web/tests/patent-film.test.ts`.
- `docs/patentradar-film.md`.

The homepage is different: the branch imports and renders `PatentFilm`; current main uses the later, lightweight SPOT-first homepage without mounting the film. That is a presentation difference, not missing film source code. Restoring the old homepage wholesale would also restore outdated copy and entry actions.

**Next step:** if the film is wanted again, integrate its existing component into the current navigation deliberately and rerun lightweight-home and browser checks. There is no need to merge the entire branch just to recover the film. Archiving the branch is a later owner decision; it has not been deleted.

## Source-query/plugin branch: useful work needs a port

The merge base is `5e5729a`, before the monorepo migration. This branch edits root-level `src/`, `tests/` and `public/`, while current application code is under `apps/web/` and shared contracts live under `packages/`. Its direct tip-to-tip diff against main spans 392 files, largely reflecting structural and subsequent product changes; that count is not a count of independently useful features.

### Work present on the branch but missing or incomplete in main

| Area                                   | Evidence from source comparison                                                                                                                                          | Suggested treatment                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Explicit source query                  | Branch contains `src/lib/api/source-query.ts`, `POST /api/v1/sources/query` and the `query_source` MCP tool. The corresponding dispatcher/HTTP route are absent in main. | Port dispatcher and contracts into the monorepo; preserve explicit consent and bounded inputs.                                |
| Lens adapter                           | Main's `apps/web/src/lib/providers/lens.ts` is a status-only placeholder. Branch implements bounded requests and validated parsing.                                      | Review and port adapter/tests separately; authenticated live access remains unverified.                                       |
| Additional aggregate sources           | Main has NASA/DOE/INSPIRE adapters and registry entries, but its aggregate orchestrator does not enqueue them. The branch adds them to aggregate search.                 | Port orchestration with deterministic mocks; avoid accidental live calls in CI.                                               |
| HAL default endpoint                   | Main defaults to `api.archives-ouvertes.fr`; branch uses `api.hal.science` while retaining an override.                                                                  | Verify official endpoint compatibility and port with adapter tests.                                                           |
| Endpoint aliases and setup diagnostics | Branch adds `providers/endpoints.ts`, `providers/setup.ts` and source regression tests; equivalent files are absent in main.                                             | Compare against main's existing eligibility catalogue and diagnostics before adapting; do not duplicate competing catalogues. |

Some concerns have already been addressed differently on main: persistent-local-index availability checks and per-source search evidence exist in the current orchestrator. Compare behavior rather than replaying every old patch.

### Changes to avoid importing blindly

The branch contains a website/display-name change to “Format Proof” followed by a restoration of FormaProof, an older plugin page and package, and pre-monorepo routing changes. Main already has later connection, integration-package and origin-security work. Retain current branding, private-storage controls and MCP security fixes when porting useful source work.

The branch's `docs/PROVIDER_CHANGES.md` says Lens is unimplemented, while its tip contains a Lens adapter and `SOURCE_CONFIGURATION.md` describes it. This is stale documentation within the branch; adapter presence is not proof of successful authenticated live access.

## Follow-up implementation

The source-query follow-up adapts the explicit HTTP/MCP dispatcher, bounded Lens adapter and regression checks to the current monorepo, with shared contracts and an SDK method. It preserves current origin checks and keeps the public dispatcher out of the local index. See [SOURCE_QUERY.md](SOURCE_QUERY.md). The table above records the original inspection baseline; it does not describe these follow-up changes as missing forever. Additional aggregate NASA/DOE/INSPIRE integration, HAL endpoint migration and old setup/catalogue modules remain separate from this port.

## Validation and scope

This review fetched all three remote heads, resolved merge bases, counted unique commits, compared source files and checked patch equivalence. Patch-equivalence checks alone did not identify the film as integrated; identical file-object comparisons established that result.

No runtime, live provider or security validation of the alternate branches was performed. Findings describe code and history, not production readiness. Proposed code ports remain separate implementation work.
