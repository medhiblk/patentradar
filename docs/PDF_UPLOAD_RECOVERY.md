# Download, reupload and PDF reader recovery

## Report and observations

The reported path is `/demo` → download the source PDF → upload/drop that file → read it. Earlier demo coverage mainly exercised the preloaded `File`, not this round trip.

WebKit 27.2 reproduces the exact native message `The string did not match the expected pattern.` when `Response.json()` receives HTML. The Studio previously parsed server responses without checking them. Fresh, unmocked production round trips succeeded in Chromium and WebKit during diagnosis; the original user's failed HTTP response was not captured, so its status and infrastructure origin are not asserted. Regression tests explicitly inject HTML 502/503 responses to reproduce the failure boundary.

## Implemented behavior

- The demo accepts a source directly through its visible file chooser or a file drop. The Studio source panel also handles drops, preserving the existing assembly until the user reads/appends the new document. A filename and enabled reading action identify the selected source.
- Source selection validates size/format. The server inspects PDF bytes and accepts valid `.pdf` files when an OS file provider supplies `application/octet-stream` instead of `application/pdf`.
- Studio requests check text/JSON, status and result shape, retain the selected file on failure, and avoid exposing a raw WebKit parse error or response body. Requests have deadlines.
- For a PDF read without external-AI consent, a recoverable upload-service failure activates a real, on-device PDF.js reader. It extracts actual page text and passes that text to the same measured-component rules as the server. Source quotes, page numbers and the SHA-256 of the actual input are retained. There is no hardcoded replacement assembly.
- Local fallback reads at most 20 text pages from an 80-page/4 MB PDF, with text/work limits and worker cleanup. Missing measurements remain unresolved. Images/scans require the existing explicit AI path or user-supplied dimensions.
- Auth, upload-size and quota refusals are not silently bypassed. A consented AI request is not silently replaced by local extraction or automatically resubmitted. Private save operations keep their existing server authorization.

## Runtime assets

`scripts/prepare-cad-assets.mjs` also prepares unmodified PDF.js legacy reader/worker modules and their Apache-2.0 licence under `public/document-kernel/`. They are self-hosted, generated from the locked dependency during `npm ci`, ignored by Git, and loaded only when fallback is needed. This keeps the initial homepage/demo free of PDF/CAD runtimes. Server-side PDF ingestion remains available and is attempted first.

## Reproduction and acceptance tests

Run `npx playwright test tests/e2e/document-upload.spec.ts` for Chromium or `PATENTRADAR_BROWSER=webkit npx playwright test tests/e2e/document-upload.spec.ts` after installing the relevant Playwright browser/dependencies. Both run with a mobile viewport/touch configuration. Use `PATENTRADAR_TEST_URL` to target the deployed app.

The tests download the actual PDF, reupload it with a file-provider MIME type and verify its SHA-256 and extracted dimensions. With an injected HTML gateway failure, they verify real local extraction, OpenCascade solid generation and a valid STEP export. Separate generated PDFs with different measurements prove that dropping a document uses its own content, including when appending a second part to an existing assembly. Only the failure response is mocked in recovery scenarios; the PDF decoder and geometry engine are real. Browser-engine testing is not a physical iPhone Safari device test.
