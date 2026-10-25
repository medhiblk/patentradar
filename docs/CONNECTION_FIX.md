# Workspace connection fix — 2026-10-25

## Report and evidence

The user reported that connecting did nothing and displayed no message. Before changes, a real production API check successfully registered a synthetic account, signed out, signed back in and retrieved private Blob files. This does not establish why the individual user failed to connect.

The Files form disabled both buttons for passwords shorter than 12 characters without explaining the disabled state. Account & Monitoring did not load an existing session on mount. Both paths used different form implementations. These concrete interface defects are corrected.

## Changes

- Shared `WorkspaceAuthForm` across Files, Studio drawers and Account. Clicks now validate visibly, Enter signs in, a show-password control is available, and first-visit instructions distinguish registration from login.
- Registration retains the 12-character minimum; login verifies the supplied existing password without applying a new-account password rule.
- Email addresses are trimmed and lowercased consistently. Passwords are never trimmed or logged.
- After authentication, a fresh session request verifies that cookies were retained before displaying success. Network requests time out after 30 seconds and preserve input on failure.
- Account automatically loads the current session. Signing out clears transient account/token/briefing views.
- Validation, unknown credentials, duplicate signup, storage failure and rate limits return appropriate, sanitized messages/statuses. Storage failures are not reported as invalid credentials. Structured auth failure logs contain only the event and action.

## Verification

- 98 unit/integration tests passed, including normalized emails, HTTPS session cookies, duplicate signup and input/credential messages.
- Production build and lint passed. All 34 function traces contained zero private local-file entries.
- Browser attachment flow passed with the shared form: signup, project/file storage, logout/login, isolation, analysis/CAD reuse and deletion.
- New browser sign-in flow passed: short-password explanation, show-password, signup, sign-in with Enter, Account recognizing the session, and sign-out.
- Tests use synthetic reserved `.example.test` identities. No user credentials or private documents were accessed. New production browser verification is recorded separately after deployment.

## Existing limitations

No OAuth account linking or password reset is implemented. Users must register a workspace account before signing in; GitHub/Vercel platform credentials are separate. Never recover an account by silently replacing its password or bypassing authentication.
