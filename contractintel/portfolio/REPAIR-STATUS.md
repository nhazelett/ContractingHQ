# Repair checkpoint — 2026-10-28

FA4800 publication repair completed successfully in commit 8fdba9f.

- Published 7,968 awards to authoritative D1 version `90245098-ed8a-43e2-995b-d9c9e817de19`.
- Matching R2 cache admitted for reads. All four application windows, 32 CSV checks,
  and D1 field-by-field round trip passed. This repair made zero USAspending calls.
- Root cause: an interrupted D1 stage retained its original validation receipt;
  a later operational CONFIG change changed ingest-run config_json on reconstruction.
  Resume now restores only the original config metadata and requires the entire
  candidate to match the original immutable receipt hash. New checkpoints pin it.
- Local targeted tests: 35 passed. Full GitHub Python/Node CI passed.
- Shared ContractIntel files reconciled with the feature branch; previous local
  versions preserved under _internal/contractintel-before-repair-20261028.
- Final measured cost: 32,393 source calls, 299.843 source-job minutes, 109
  attempts. These minutes are not billable-runner minutes or a dollar bill.
- One compressed R2 publication: 8,675,837 bytes; total stored office bytes:
  24,482,018 (includes checkpoint and supporting objects).
- Top 150 offices were queued in the earlier audit. No rollout gate was opened
  by this repair. Next: review capacity and complete managed R2 baseline before
  recording a publication-bound cost review and enabling the automatic queue.
- Latest evidence: https://github.com/nhazelett/ContractingHQ/actions/runs/40787705198

Reports: docs/fa4800-publication-repair.json and docs/fa4800-cost.json.
