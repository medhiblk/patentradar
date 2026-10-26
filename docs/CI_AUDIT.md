# GitHub Actions diagnosis and recovery — 26 October 2026

Repository: `medhiblk/patentradar`. Baseline: `b43f79a30c537e55e8135f47f82afa7af9135f8f`.

## Inventory and actual initial state

Both repository workflows were inspected: `.github/workflows/ci.yml` and `.github/workflows/pages.yml`. GitHub also manages Dependency Graph and Dependabot Updates outside those files.

Three workflows had failures in the recent run history. At the start of this audit, the latest Validate PatentRadar run was already successful; Publish project introduction and the historical Dependabot Updates job still showed failures. Failed historical runs are not rewritten or deleted to make the history green.

| Workflow | Observed cause | Baseline evidence | Resolution / remaining boundary |
| --- | --- | --- | --- |
| Validate PatentRadar | Browser test expected the old `Open ChatGPT Plugins` link and old download-button text; tool counts had been hardcoded. An older partial-result unit test also expected one paper while unmocked sources supplied thirteen. | [Failed browser run](https://github.com/medhiblk/patentradar/actions/runs/40343075310), [older unit failure](https://github.com/medhiblk/patentradar/actions/runs/40190937689). The selector/tool-count correction was already committed in `30b7e1d`. [Baseline main run](https://github.com/medhiblk/patentradar/actions/runs/40361688957) passed app and native-cad. | Retain the existing corrected tests and every validation stage. Pin the runner to the known-working Ubuntu 24.04 image, add bounded job timeouts, audit locked dependencies and preserve browser failure artifacts. |
| Publish project introduction | `Configure Pages` returned HTTP 404: this repository has no configured Pages site. The action logged `enablement: false`. | [Failed publication](https://github.com/medhiblk/patentradar/actions/runs/40339345762). Authenticated GET `/repos/medhiblk/patentradar/pages` also returned 404. | Split validation/packaging from publication. PRs check the exact static payload without publishing. Main still requires a real configured Pages site; missing configuration remains a hard failure, not a skipped success. |
| Dependabot Updates (GitHub-managed) | `security_update_not_possible`: transitive `@vercel/cli-config@0.3.1` required vulnerable `zod@4.1.11`; the updater's alternative path would downgrade `@vercel/blob`. | [Historical updater failure](https://github.com/medhiblk/patentradar/actions/runs/40202859662). Current main already has the scoped patched `zod@4.6.7` override. | Fresh install and npm audit report zero vulnerabilities. Add a high/critical audit gate to CI. Do not rerun an old updater against an obsolete dependency state or claim its historical execution is now successful. Alert status requires additional permission; the alerts API returned 403. |

## External blocker: one-time Pages configuration

The existing GitHub connection has repository access but cannot create a Pages site: POST `/repos/medhiblk/patentradar/pages` with `build_type=workflow` returned **403 Resource not accessible by integration**. This is a platform permission boundary, not a missing application API key.

An authorized owner must open:

https://github.com/medhiblk/patentradar/settings/pages

Under **Build and deployment**, select **Source: GitHub Actions**. Then dispatch **Publish project introduction** on `main`. No new repository secret is required. Do not add a broadly privileged PAT to a pull-request job to bypass this setup requirement. After configuration, an actual successful `deploy` execution is required before declaring publication fixed.

The security-alerts API also returned 403. An owner should inspect Security → Dependabot alerts if a security-update entry remains open; this audit cannot attest to alert closure or a new successful managed updater run.

## Validation

- A fresh `npm ci` succeeded in an isolated worktree; no production application code changed.
- Local type checking, lint, all unit tests (270 web + 7 SDK), isolated SDK package verification, production build and private-build checks passed.
- Fresh `npm audit` reported 0 information, low, moderate, high and critical vulnerabilities.
- `actionlint 1.7.12` validates both workflow files.
- Static payload validation passes for `site/`; separate negative checks reject missing assets, invalid anchors and references escaping the uploaded directory.
- The local SDK pack check required a writable npm cache because this managed workspace's default cache is read-only. Using `npm_config_cache=/tmp/patentradar-ci-npm-cache` fixed that environment-only issue; GitHub-hosted runners already have a writable cache. No application or SDK code was changed for it.

The PR checks provide the authoritative hosted execution of the modified workflow. A PR's Pages build checks validation and artifact packaging only: deployment is intentionally restricted to main. A skipped PR deploy must not be described as a successful public deployment. Vercel application deployment is separate and is not changed by this PR.

## Additional hosted-run finding

The first PR attempt spent more than ten minutes downloading 25.9 MB of Ubuntu packages during `playwright install --with-deps`, not running browser tests. After cancellation, its actual logs showed repeated, very slow transfers from `azure.archive.ubuntu.com`, including a retried 7.5 MB font package. The same commit had completed the full application check in 3m05s on a different runner.

Both jobs now replace that Azure mirror entry in the runner's mirror list with the official public Ubuntu HTTPS archive before installing system packages. All dependencies and browser tests remain required. The change affects only disposable GitHub-hosted runners; it does not change application code, package versions, Vercel or the local machine. The replacement is conditional on the mirror-list file existing, preserving compatibility with image layout changes. A new hosted execution is required to validate the revised workflow.
