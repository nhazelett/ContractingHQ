# ContractIntel tabbed UI release

Approved presentation-only rebuild of the existing office portfolio.

## Files changed

- `contractintel/web/index.html`: persistent header, tabs, shared filters, methodology dialog.
- `contractintel/web/styles.css`: light/dark tokens, responsive layout, runway, register and details.
- `contractintel/web/app.mjs`: presentation state and renderers; existing loading and CSV routines preserved.
- `contractintel/web/presentation.mjs`: pure dataset, expiry, category and runway helpers.
- `contractintel/tests/presentation.test.mjs`: lifecycle boundaries, category stability and runway evidence tests.
- `contractintel/docs/tabbed-ui.md`: this checklist.

## State and evidence

Office, dataset, history window and date basis are shared across tabs. Register search, set-aside, sorting, columns and page remain intact when switching tabs. Explicit overview drill-downs clear stale register search/set-aside filters. Tab and contract links use URL hashes. The loader retains its original source pagination, automatic pacing, retries, six-hour session cache and pause/resume behavior. CSV uses every filtered register match, not the displayed 50-row page.

The header uses an indeterminate progress indicator because the source does not establish a reliable full-portfolio denominator. Loaded counts and partial coverage stay visible. Fiscal totals remain blank until their scan finishes. No source refresh or option schedule is invented. No set-aside used is distinct from full/open competition; missing set-asides remain Not reported.

## Deployment

From the repository root:

```powershell
node --test contractintel/tests/*.test.mjs
node --check contractintel/web/app.mjs
node --check contractintel/web/presentation.mjs
npx --yes wrangler@4.140.0 deploy --config contractintel/worker/wrangler.jsonc
```

The existing ContractIntel preview workflow runs validation and deploys web changes pushed to `codex/contractintel`. This release uses that workflow, with an expected-parent branch update. No worker configuration, source adapter, API, database, or workflow changes are needed. Canonical shared-folder synchronization remains deferred.

## Manual QA (2026-10-21)

1. Load FA4800: directory, source details and automatic incremental loading work; prior-FY totals resolve.
2. Pause/resume: pause retains loaded records; resume continues from the existing count.
3. Date mode: current/potential choice updates expiry groups and countdown basis; review records stay excluded from reliable expiry views.
4. Filter persistence: set-aside drill-down opens Register; switching tabs preserves its filter. Completed/review/all datasets switch without a fetch or page reload.
5. CSV: downloaded export contained 161 matches while the table page held 50; original 19 fields retained.
6. Themes: light and dark render with stable category colors and readable labels.
7. Width 390: no document horizontal overflow; register/chart scroll inside their containers; mobile details fit.
8. Details: real source transactions, current/potential end and current value appear; no inferred option count; keyboard Escape dismisses.
9. Hashes and keyboard: tab Arrow keys update focus/selection; contract hash and browser Back restore the expected view.
10. Empty/error: no-match dataset shows an explicit empty state; invalid award shows an error and working Retry control. Existing source tests cover malformed responses, rate limiting, retry exhaustion and missing details.

Automated validation: 43 tests passed. Source modules and the existing API, portfolio/fiscal loader and CSV function bodies were compared with the pre-redesign working copy and remain unchanged.

## Requirement-first follow-up

- Office selector now uses an accent surface, a Contracting office label, and an explicit Change office action.
- A visible USAspending notice explains that full loading may take several minutes and counts remain partial. It reflects loading, pause/interruption, fiscal-only loading, and completion.
- Overview replaces the runway and duplicate Next to end list with one register-style Contracts ending soon table. Descriptions lead each requirement, with PIID below.
- Expiring uses the same description-first table and retains inline evidence expansion.
- Full Register includes Requirement by default, with wrapped descriptions and preserved PIID links. CSV columns and underlying source/loader logic are unchanged.

Follow-up QA: real FA4800 descriptions, overview-to-details, Register descriptions, grouped inline evidence, potential-end headings, office search and 390px overflow checks passed; loading and paused notices verified. All 43 existing tests pass.
