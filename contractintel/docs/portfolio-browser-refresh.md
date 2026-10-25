# Portfolio browser refresh and workspace identity

Portfolio remains the root landing page; fresh entry opens Overview. Explicit award/tab hashes, opportunity URLs and browser history retain their meaning. Office selection is remembered locally, with an explicit URL office taking priority. Workspace selection is never stored as a default. Opportunities uses a quiet slate light/dark page background with the same header colors as Portfolio, a clear workspace heading, search-first layout, quick views, and expandable refinements. Set-aside categories and deadline warnings keep their original meanings.

## Loading and storage

Opening an office or changing its history window starts a fresh USAspending scan. Request memoization is cleared, direct source requests bypass the browser HTTP cache, and existing request pacing, retries and source limits remain in force. A first complete office scan is still dependent on USAspending response times and portfolio size.

The client first retrieves award summaries, making current/potential ends, awardees, descriptions, values and set-asides available. It then loads transaction evidence, retaining the same first 200 transactions and older-action expansion as before. Opening a detail view can prioritize that contract's history. Modification and latest-action cells show Loading evidence until their transactions arrive; None Found is used only after evidence has been evaluated. Pausing and resuming works in either phase. Fiscal transaction scans and math are unchanged.

IndexedDB holds at most three office/window metadata snapshots, capped at 2 MiB of serialized metadata per snapshot and 6 MiB total payload. Raw transactions, fiscal transaction rows, files, source cursors and credentials are not stored. Updates are throttled to once per 15 seconds during scans, with a final checkpoint and a best-effort page-exit save. Metadata snapshots can help after navigation/reload but never skip the fresh scan or resume an old source cursor. Unavailable/denied/full browser storage fails quietly and live loading continues.

Saved results remain visibly marked Updating while fresh source rows replace them. Once fresh award discovery and summaries finish, saved-only rows disappear, including when the source genuinely returns an empty dataset. Failed source scans retain the saved preview and expose the interrupted state. CSV exports include Source refresh pending and Transaction evidence pending flags. No Last checked option or manual freshness control was added.

## Cost boundaries

No shared Portfolio database/cache or archive, paid service, subscription change, storage binding or background download was added. Browser snapshots are stored on the visitor's device. The existing Opportunities index and its daily SAM request guard are unchanged. Account billing-plan status was not changed or inferred.

## Verification

71 Node tests cover existing behavior plus office/window isolation, metadata bounds, browser persistence/eviction, unavailable storage, source summary/full-response parity, preview replacement, summary-before-evidence ordering, pause/resume, failure recovery, stale generation rejection and empty scans. Live deployment smoke checks compare all changed browser assets and exercise opportunity filters, details and CSV. Interactive visual/keyboard/mobile checks could not be performed because this session has no browser-control tool.
