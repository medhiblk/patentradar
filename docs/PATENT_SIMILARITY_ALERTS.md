# Evidence-linked similarity alerts and real publication case

## Delivered behavior

Research results show an in-app alert when retrieved patent evidence shares multiple technical features with the reviewed profile. Saving research to a private project stores the comparison and alerts. Manual watch checks update their saved alerts too. `/alerts` lists the authenticated owner's saved signals and supports persistent reviewed/unread state. No scheduled checks, email delivery or legal-clearance conclusion is implied.

The lexical signal is deliberately explainable: at least two features must each share two non-generic terms, with at least four distinct meaningful terms overall. Titles alone, empty evidence, generic vocabulary and synthetic patent records do not trigger alerts. Claim text/excerpts or abstract evidence are labeled. This is a review threshold, never an infringement probability or proof of functional equivalence. Record-source URLs and retrieval dates remain visible. Changed matching evidence creates a fresh alert identity; repeating unchanged evidence retains review state.

## User-selected reference: US20080003142A1

The real **Microfluidic devices** application publication was supplied by the user:

- https://patents.google.com/patent/US20080003142A1/en
- PDF linked from that page: https://patentimages.storage.googleapis.com/89/d6/88/68356f0ae820d5/US20080003142A1.pdf

The PDF was actually downloaded with HTTP 200, `application/pdf`, 8,544,706 bytes, 83 pages. Original SHA-256: `7f2fdf36b240bc60d0fb6745369acdbe11198910595f9690037b69214dca661c`. The dated observation is kept in `src/lib/examples/us20080003142a1.json`. The app does not invent a Google search API or scrape Google results. It uses this one supplied, manually verified reference snapshot.

The app serves a 248,150-byte excerpt with its own provenance cover and original pages 1, 2 and 81. This fits the 4 MB attachment limit and is explicitly identified as four selected pages, not the complete original. Selected text excerpts from claims 1, 5, 9 and 10 retain source/page provenance; complete claim interpretation requires the original document. Source diagrams are not used to infer missing engineering dimensions.

Google currently reports **Abandoned** for this application. This is stored as publisher-reported status, not independently verified official status. The alert says that a similar publication exists; it does not call the application an active blocking patent or infer permission to manufacture. Related rights/status need separate investigation. Applicant data is left empty where not verified; Google's reported current assignee is separate provenance, not an invented original applicant or confirmed competitor.

## Demo flow

Open `/demo/patent` from the main `/demo` page:

1. Ingest the real excerpt. The browser checks its SHA-256 against the verified snapshot.
2. Review/edit the proposed microfluidic design. It is clearly an illustrative concept selected to resemble this reference. The actual edited description is extracted locally and compared against the selected claim excerpts.
3. Save to the private portfolio, signing in if necessary. The server computes/stores alerts; the original-page excerpt is uploaded through the normal private attachment endpoint. A failed attachment upload keeps the project and supports retry; matching existing attachments are not uploaded again.
4. Inspect the sourced similarity signal, open the Google Patents publication, review source passages and use `/alerts` to mark the signal reviewed. The project can be reopened with its private PDF after reconnecting.

This is a known-reference exercise, not a fresh worldwide discovery. No OpenAI call or third-party search is made by the reference comparison. Ordinary public-source search remains separate and continues to generate alerts from its own returned records.

## Architecture and access

- `src/lib/intelligence/alerts.ts`: pure threshold, provenance, stable alert identity and project-data integration.
- `src/app/api/project-alerts/route.ts`: owner-only summary and review mutations; no public/MCP-token access.
- `/api/vault`: server-generated alerts when a validated research report is saved to a project.
- `/api/watch`: manual watch alert refresh.
- `src/components/intelligence/`: reusable alert display, portfolio save and alert center.
- `src/app/api/demo/patent-case/`: fixed verified-reference metadata and actual local comparison. No arbitrary URL fetch or search claim.
- `src/app/theme.css`: high-contrast navy text, cobalt actions, violet accents and amber alerts. Legacy faint text colors were darkened in component styles. The existing CAD/research integrations are retained.

Automated tests cover meaningful overlap, negative cases, unsafe links, source checksum/page count, persistence, ownership and review state. Browser coverage exercises ingestion → comparison → private project/PDF → linked alert → review-state retention and mobile layout. Production evidence is recorded in the release JSON after deployment.
