# Manual patent watches

Watches run only when an authenticated owner explicitly checks approved concepts. No scheduler, automatic subscription or email delivery is enabled.

`POST /api/watch` retains its `{id, consent}` input and response `result`, `newDiscoveries`, `newsletter` fields. It additionally returns `check`, separating the initial baseline, first observed records, source-reported recent publication dates, patent-source successes/failures and cache reuse. Old publications first encountered today are not described as newly filed patents. The first result set establishes a baseline and announces zero new discoveries.

Publication observations are cumulative, normalized and retain first/last observation timestamps. A partial shortlist or failed source does not erase previously encountered publications or missing alerts. Reviewed alerts keep their state when only match/term ordering changes. Evidence changes may require a new review. Legacy baseline publications retain unknown first-seen timestamps rather than invented dates.

`lastAttemptedAt` records every completed check attempt; `lastChecked` and the new `lastConfirmedCheckAt` advance only when a successful patent/mixed source has a confirmed network response in the audit trace. Legacy `lastChecked` values are preserved but are not displayed as confirmed network freshness. Cached, local-only, unknown-freshness and failed runs are labeled explicitly. A failed patent-source check keeps the previous successful result. Scientific-source success alone does not establish a successful patent check. Recency uses calendar-day precision because most publication metadata provides no publication time.

The merge re-reads the latest private item atomically: Blob uses conditional versioned writes with retries; SQLite uses a short transaction. Concurrent alert reviews are therefore preserved while a search is in flight. Changed watch concepts during retrieval produce a conflict rather than assigning results to a different query. Authentication, quota, conflict and service failures return distinct statuses without raw provider payloads.

Histories are bounded to 2,000 observed publications, 200 retained alerts and the existing 3 MB private item limit. Reaching a bound produces an explicit error; history is never silently trimmed and later re-announced as new. Export the briefing and create a new watch if a limit is reached. Durable large-scale monitoring needs a separate indexed event store.

`applicantActivity` groups only case/spacing/punctuation variants by default, counting a publication once per applicant group. Corporate/subsidiary aliases require explicit `confirmed: true` groups; contradictory groups are rejected. This is aggregation of retrieved records, not a worldwide applicant search or proof that an applicant is a competitor.

Targeted tests cover A/B → A → A/B, all-source failure, cached runs, day-precision dates, reorder-stable reviews, consent/ownership, concurrent review during search and concurrent private-Blob updates. External providers are mocked in these tests; no production verification or email delivery is implied.
