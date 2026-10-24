# Pilot verification — 2026-10-20

Live preview: https://kthq-contractintel.nickhazelett.workers.dev/

Deployment run: https://github.com/nhazelett/ContractingHQ/actions/runs/39363658494

Dataset: usa-d87ec88d7450c760b126. Coverage: 2025-09-01 through 2025-09-30.
This is a partial validation dataset, not a complete active portfolio.

| Office | Awards | Transactions | Net obligations |
| --- | ---: | ---: | ---: |
| FA4800 | 173 | 194 | $36,369,603.83 |
| FA4855 | 83 | 91 | $10,459,782.79 |
| FA8101 | 38 | 49 | $9,970,464.89 |
| Total | 294 | 334 | $56,799,851.51 |

All three deployed office totals reconcile to their transaction drilldowns.
Local and GitHub validation passed: integer-cent normalization, correction and
deleted-row rebuilds, failed-version isolation, API input validation, version
pinning, CSV escaping, and formatting. Desktop and 390px mobile views checked;
search, office switching, reported-unexpired filtering, award details and
transaction drilldowns exercised. The Tinker active filter exported four CSV
records, matching the displayed count. The browser download-event watcher
timed out, but the actual saved CSV was verified. KTHQ CORS was verified.

Measured archive: 7,222,215 bytes. Local database: 5,005,312 bytes. Estimated
indexed-row writes: 2,341. These are September-only measurements, not a reliable
projection of every historical month. Existing guards remain 4 GB raw archives,
200 MB local snapshot, 80,000 estimated indexed-row writes per publication, and
450 MB projected remote database footprint. No paid plan was enabled.

The initial historical workflow targets 2000-10-01 through 2026-10-20. It retains
raw sources in the private R2 archive and only changes the active dataset after
all local and remote checks pass. A capacity or validation failure leaves the
September pilot active. Nightly refresh remains disabled. KTHQ main is unmerged.

The broader office cross-reference is being prepared separately by Claude; the
pilot allowlist remains FA4800, FA4855, and FA8101.

Local validation initially encountered an unexplained Application Insights
connection. The host PowerShell 7.6.5 installation includes Microsoft's telemetry
SDK and had no opt-out configured. Tests completed in isolated Node/Python
processes with a minimal environment and telemetry opt-out settings, without
the PowerShell startup path. No project telemetry was added or security
monitoring disabled. This identifies a likely cause, not a captured-payload
forensic attribution.
