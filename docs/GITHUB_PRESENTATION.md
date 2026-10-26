# GitHub project presentation

The README introduces the problem, value, workflow and capabilities. `site/` contains a standalone project introduction for GitHub Pages. Development and deployment details are in [DEVELOPMENT.md](DEVELOPMENT.md).

## Repository About

Suggested description (copy into the repository’s **About → Edit** field):

> Explore related patent publications from technical PDFs and design descriptions, inspect source evidence, and work with measured 3D parts. Open source · FormaProof.

Use `https://patentradar-puce.vercel.app` as the website while Pages is unpublished. After Pages deployment succeeds, the expected project-site address for this repository is `https://medhiblk.github.io/patentradar/`. Verify the deployed URL before replacing the website field.

Suggested topics:

```text
patent-search prior-art engineering invention research pdf cad nextjs typescript open-source mcp
```

Avoid describing the app as determining whether an idea is already patented: related publications, granted claims, territorial scope and current legal status are different questions.

## GitHub Pages

1. Commit and push the presentation files and `.github/workflows/pages.yml` to `main` through the normal review process.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
3. Run **Publish project introduction** from Actions if a deployment has not already started. The workflow also runs when `site/` or its workflow changes on `main`.
4. Open the successful deployment’s URL and check the document, demo and GitHub links.

The workflow uploads **only `site/`**. It does not publish the checkout, local databases, documents or environment files. Pages hosts the static introduction; the Next.js application and its server APIs remain on their existing host. The static page requires no npm install, server credentials, framework build or external fonts.

For local review, run `python3 -m http.server 8080 --directory site` from the repository root. The stylesheet uses a relative URL so it works below the `/patentradar/` project path.

## If the Pages workflow says “Not Found”

The run on 26 October 2026 failed at **Configure Pages** with `Get Pages site failed` and HTTP 404. This means the repository had no enabled Pages site at that time; it is separate from the application/browser test failure.

Open https://github.com/medhiblk/patentradar/settings/pages and select **GitHub Actions** under **Build and deployment → Source**, then rerun the Pages workflow. Confirm a successful deployment before advertising the Pages URL.

Do not add `enablement: true` with the default workflow token as a workaround. The official `actions/configure-pages` input documentation states that automatic enablement requires a token other than `GITHUB_TOKEN`, with repository administration/Pages permissions. No additional token is needed when the repository owner enables Pages through Settings.

## GitHub-managed sections

Stars, watchers, forks, contributors, language percentages, activity, releases and packages are maintained by GitHub. Do not invent or hard-code popularity statistics or releases in the README. Create a release only when there is a versioned deliverable and release notes; package publication is separate from packing the local SDK.

No development duration, launch milestone or user-count claim is included without supporting evidence. The license links to the existing Apache 2.0 license, and third-party attribution remains in NOTICES.md.

Repository metadata edits and live Pages publication were not completed by the documentation change. They require repository settings access and a successful deployment.
