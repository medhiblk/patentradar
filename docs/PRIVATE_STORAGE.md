# Private project and attachment storage

## Implemented

`/files`, My Inventions, and collapsible file drawers on analysis/engineering screens provide account sign-in, project creation, multiple-file selection/drop, stored file lists, original download, deletion and explicit reuse in patent/3D workflows. Device-only drafts remain separate and are preserved. Files are not analyzed automatically. Uploaded originals are retained until the owner deletes them.

Accounts/sessions/projects/usage now use an asynchronous repository (`src/lib/platform/store.ts`). Existing local SQLite accounts remain supported. On Vercel, configured private Blob storage is selected automatically; account records (salted scrypt password hashes), hashed expiring sessions, project JSON, manifests and original binaries are private objects. No serverless `/tmp` file storage is used as a persistent fallback. The local fallback stores SQLite metadata and mode-0600 files under PATENTRADAR_DATA_DIR/private-files. Do not serve that directory as public assets. Private files and SQLite records are excluded from Git, Docker build contexts and Next.js API file traces, including the conventional file names under custom volume paths.

The Vercel private store `patentradar-private` was provisioned in iad1 for the existing PatentRadar project. Its automatically injected encrypted BLOB_READ_WRITE_TOKEN was limited to production, without reading/printing its value. Preview/development must use a separate store or local volume. BLOB_STORE_ID/OIDC may also be used where configured. No credentials or uploaded files belong in Git.

## Safety and limits

- 4 MB/file, 20 files/project, 50 files and 100 MB/account. Quota counts pending/deleting entries too.
- Allowed formats: PDF, PNG, JPEG, STEP, STL, UTF-8 TXT, JSON. Extension/signature/text checks reject obvious mismatches. This is not antivirus scanning, a certificate of document validity, or execution of CAD code. Downloads are attachments with nosniff and sandbox headers.
- File paths contain server-generated UUIDs under an authenticated owner namespace; original names never determine filesystem/object paths. APIs check account, project ownership and full-session scope before bytes are accessed. Cross-account IDs return not-found.
- Blob operations always specify private access. Object URLs, store tokens and password hashes are never returned to clients. Downloads stream through an authenticated route with private/no-store headers. Cookie/session secrets are not in URLs.
- SHA-256 and size are computed from actual original bytes. File manifests use ETag conditional writes to prevent concurrent quota reservations from overwriting each other. Local manifest updates use SQLite version checks.
- Uploads reserve quota before object writes and become ready afterwards. Failed cleanup can leave a visible pending/deleting entry; the owner can retry deletion. There is no background orphan reconciliation service or cross-object transaction guarantee.
- Project deletion marks a tombstone before attachment removal, blocking racing new uploads. Attachment deletion releases quota after the object is removed.
- Public search/MCP capabilities remain anonymous. Existing scoped developer/MCP tokens cannot read/write original attachment bytes. Private MCP project titles work with Blob; the local-index tool is not offered on cloud hosting without SQLite persistence.

## Reuse

A stored PDF/TXT can be loaded into patent analysis; supported engineering sources can be loaded into 3D Studio. Only UUID references are used in the tab handoff; original bytes are fetched through the authenticated API. Reopening does not auto-send documents to OpenAI. The user still chooses interpretation/extraction and any external-processing consent. Importing STEP into the browser still does not recover its feature history.

## Run locally

```sh
npm ci
cp .env.example .env.local
npm run build
npm run start
```

Without private Blob configuration, local Node hosting uses the existing SQLite database plus private-files under .data or PATENTRADAR_DATA_DIR. Keep the directory on a persistent private volume and back it up under your retention policy. For cloud operation, connect a **private** Vercel Blob store and redeploy; public stores are unsuitable. PRIVATE_STORAGE_BACKEND=blob can force configured Blob, but no fallback to ephemeral disk is allowed when cloud credentials are absent.

## Tested scope / remaining work

Local verification: production build (including TypeScript), lint, 96 unit/integration tests and all 14 browser workflows passed. The document browser test covers a real filesystem-backed upload/download and reuse; mocked Blob tests cover cloud account/session contracts and concurrent quota enforcement. Real Blob proof is separate.

Automated tests cover original byte/hash roundtrip, per-owner denial, anonymous/scoped-token denial, logout and new-session persistence, project/file deletion, rejected types/sizes and conditional-write concurrency. A mocked Blob adapter test verifies private operations and simultaneous project-quota reservations; it does not certify the actual hosted store. Playwright covers create account/project, upload, refresh, download, logout/relogin, reuse for analysis/CAD, mobile rendering and deletion. Real hosted proof is recorded separately after execution.

This is an MVP private workspace, not a completed production identity/compliance system. Email verification, password reset/account deletion, MFA, malware scanning, file versions, large direct uploads, relational portfolio indexing and automated expiry/orphan cleanup remain unimplemented. Native CAD and the local patent index still need their own runtime/volume. Blob JSON portfolio indexing is bounded to 100 saved items per account and is intended for small workspaces; not large-scale analytics.

## Real hosted verification

The production store was verified with actual account creation, project/file upload, byte-identical SHA-256 download, anonymous HTTP401, cross-account HTTP404, logout revocation, fresh-login retention and project/file deletion. The independent real browser test also passed through the live UI, including private PDF reuse for patent extraction and engineering interpretation and mobile layout. No provider calls were mocked in these hosted checks; only a public synthetic measured fixture was uploaded, then its project/files were deleted. Test account records remain with generated credentials never logged. [Release evidence](PRIVATE_STORAGE_RELEASE.json). Reproduce backend proof with `PATENTRADAR_URL=https://patentradar-puce.vercel.app EXPECT_PRIVATE_BACKEND=blob node --use-env-proxy scripts/verify-private-storage.mjs`; the script uses only synthetic test accounts/data and cleans up projects/files.

Build privacy check: `npm run check:private-build` scanned all 34 generated function manifests and found zero local private-file/SQLite entries. It also runs in CI after the production build. Git/Docker ignores cover the corresponding data paths.
