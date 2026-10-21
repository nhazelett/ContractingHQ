# Federal Opportunities pilot

The Opportunities workspace is separate from the existing USAspending Portfolio. It searches a shared SAM notice index and always sorts by source posting date/time descending, then notice ID. Source-check time never controls newness. Unknown posting times retain their source precision.

## Included

- National indexed scope or the selected six-character office.
- Title/solicitation search, agency, source type/status, set-aside, NAICS, PSC, performance state, deadline window and posting-date filters.
- Stable 50-row pagination pinned to an immutable published index; full filtered CSV export.
- Notice details, public source link, source attachment links, reported contacts and a separately cached SAM requirement description.
- Explicit source-active and deadline uncertainty; no inference that a forecast, award notice or passed award PoP is an open solicitation.
- Last source-check time, bounded source coverage, retained results on error and visible retry controls.
- No accounts, favorites, tracking, private capture notes or alerts.

## Source and capacity boundaries

This initial pilot uses at most three SAM search requests per import. It queries day windows newest first, requesting up to 1,000 records per source page. The requested lookback is seven days, but only the windows/pages actually checked are shown as covered. Quota limits or a busy source day can leave a partial window. This is not a complete active federal opportunity inventory.

Ingestion and on-demand descriptions share an atomic D1 counter capped at ten SAM calls per UTC day. That is a conservative application guard, not a statement of the account's entitlement. SAM can reject sooner because of other usage or provider limits. Cached descriptions are reused for six hours; a failed description request retains metadata and official source links. Description text is rendered as text, never executable source HTML. Very long descriptions are shortened with a visible source-link instruction.

The SAM key remains in GitHub Actions and the existing Worker server secret. No browser API key, authenticated description URL or deployment credential is returned by the public API.

The existing `kthq-contractintel` D1 database stores new `opp_*` tables only. Portfolio tables are untouched. Preparation enforces the existing 450 MB database guard with 35 MB reserved for this pilot. Import batches stay within the D1 100-parameter limit. Publication switches one active-version pointer only after row-count verification; the current and previous notice indexes are retained. Description caches older than seven days are removed at successful refresh.

## Refresh and deployment

The existing ContractIntel preview workflow prepares the index schema/binding, performs a bounded SAM import when no recent validated index exists, configures the server secret from the existing repository secret and deploys the same Worker.

This pilot refreshes on validated publication. No unattended source-refresh schedule is enabled yet; the coverage panel says so. A forced refresh is available through the preview workflow's `refresh_notices` dispatch input and still obeys the daily guard. Entitlement and observed usage should be measured before scheduling or expanding the lookback.

From a trusted runner with the existing repository secrets:

```sh
node --test contractintel/tests/*.test.mjs
node --check contractintel/web/opportunities.mjs
node contractintel/opportunities/deploy.mjs prepare
node contractintel/opportunities/deploy.mjs refresh
node contractintel/opportunities/deploy.mjs secret
npx --yes wrangler@4.140.0 deploy --config contractintel/worker/wrangler.jsonc
```

Preparation writes the actual existing database UUID into the runner's Wrangler configuration on every deployment; no placeholder binding is published.

## Validation

57 automated tests pass, including seven new service tests covering global newest-first pagination and filtering; source page indexes; bounded/partial coverage; failed-import recovery; atomic shared quotas; cached, non-executable descriptions; source failures; CSV formula prevention; and empty/unconfigured/retired dataset distinctions.

The browser transport disconnected during this implementation. Interactive desktop/mobile, visual and keyboard checks are pending until that connection is restored; do not claim they passed. Deployment is additionally gated on a successful real-source import, CI and live API/asset checks.

Existing USAspending API, award loader, fiscal loader, pause/resume and CSV routines remain unchanged. The portfolio presentation adds only a workspace link carrying the selected office.
