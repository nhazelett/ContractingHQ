# Portfolio overview update

Prepared against codex/contractintel commit 3354beaeb0634b34c9ab35acd25c24101900339e.

## Behavior

- Missing latest-mod and option-mod results say "None Found". Existing detail notes explain that missing option evidence does not mean a contract has no options.
- The first four cards show prior-FY net obligations, current-FY net obligations, prior-FY distinct awards with activity, and current-FY distinct awards with activity.
- Fiscal data uses spending_by_transaction, action-date windows, and exact PIID-prefix checks. It includes deobligations and does not sum lifetime award values as annual spending.
- Fiscal scanning is independent of the register's selected history window. Queries cover each month of the previous FY and current FY to date. Twenty paced requests run per user action; Continue resumes the scan. Pause and office changes stop further work. No totals are presented until all monthly windows finish. A source paging limit or error leaves totals incomplete.
- The amber cards use current PoP ends within 90, 180, and 365 days (cumulative windows). The green recompete card uses potential final ends within 365 days, excludes missing dates, and labels these as candidates.
- Set-aside groups and filters cover loaded award details. They use the latest reported classification, including separate unreported categories. Clicking a group shows associated requirements and awardees. Set-aside is also available as an optional register/CSV column and in award details.
- No changes to Worker bindings, R2, D1, credentials, or bulk-import workflows.

## Validation and publication

All 31 Node tests pass (including five new overview tests), covering fiscal boundaries, deobligations, distinct awards, missing amounts, date windows, set-aside grouping, and transaction-source filtering. App syntax passes.

Live-source validation caught and corrected the transaction endpoint requiring an explicit PIID-prefix wildcard. Browser checks cover real set-aside categories, register filtering, label changes, and current/potential end-card navigation. Deployment is authorized.

On October 20, 2026, Nick explicitly authorized deploying from the working copy and syncing the canonical shared folder later. That folder currently has an older snapshot and remains to be synchronized. Preserve local-only files and conflicting edits during that later synchronization.

Changed files: web/app.mjs, web/source.mjs, web/index.html, web/styles.css.
New files: web/overview.mjs, tests/overview.test.mjs, docs/portfolio-cards-update.md.
