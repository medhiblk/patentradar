# Internal blind PDF verification

This is an acceptance harness for actual uploaded documents, not a product demo or a worldwide search benchmark. The expected publication numbers in `spot-cases.json` are labels used by the verifier. They are never posted as search hints or read by the matching engine.

After a fresh production build is running locally:

```bash
PATENTRADAR_URL=http://127.0.0.1:3000 node --use-env-proxy scripts/verify-blind-patent.mjs
```

`--use-env-proxy` is useful in managed environments with an outbound proxy. The harness writes the actual observations to ignored `artifacts/blind-patent-verification.json`. `PATENTRADAR_VERIFY_OUTPUT` can select another output path. Do not point this public-source harness at confidential documents.

The checks are intentionally distinct:

1. Download the original modern EPO PDF and verify that the acceptance file is byte-identical, including actual HTTP status, content type and SHA-256.
2. Upload it under a neutral filename and unknown MIME type; require the correct publication and exact input/source passage offsets.
3. Upload a second genuine historical patent as a separate control.
4. Remove publication identifiers, title and applicant/inventor names from the real PDF text. Require a sourced match but distinguish lexical overlap from verbatim same-document recognition.
5. Rank three independently phrased descriptions against the disclosed index. French femoral-fixation text is compared to original French claims; no translation capability is assumed.
6. Submit an unrelated parasol description and require no close match.
7. Independently download an EP publication absent from the reference index, upload only its bytes under a neutral filename, and authorize exact public lookup. Require its number/date to be extracted, actual claims returned, and an EPO XML network HTTP200 in the source trace. A cached-only response is not counted as fresh connectivity proof.

The outside-index control establishes anonymous exact EP retrieval by number and publication date. It does not establish anonymous worldwide keyword search. The three curated technical descriptions establish only those specific cases; no precision/recall, novelty, infringement or freedom-to-operate percentage is inferred. Every pass/fail is recorded, and the script exits unsuccessfully when any required check fails.

The direct PDF and subsequent EPO XML request are separated by at least 1.1 seconds. Run once against a fresh server rather than repeatedly exhausting the application rate limit. There is no cache or access-control bypass.

For a focused recheck, `FORMAPROOF_VERIFY_CHECK` may name one check, for example `metadata-redacted-source-recognition`; select a separate output file. Its record explicitly says `focused-check` and reports only checks actually executed. A focused pass must not be presented as a complete-suite pass. Text-passage offsets are checked against the actual CRLF line endings used by multipart form serialization.

`apps/web/tests/spot.test.ts` separately exercises the real PDF parser, source index and API route with external network transport disabled. It includes misleading-filename, invalid-PDF and consent-preserving cases. Those tests are not a substitute for the separate real HTTP observations above.
