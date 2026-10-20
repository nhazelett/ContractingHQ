# ContractIntel operations

## Deployment prerequisite

Repository `nhazelett/ContractingHQ` already has `SAM_API_KEY`. Add one further
Actions secret named `CLOUDFLARE_API_TOKEN` using a custom Cloudflare token scoped
to account `a7443e0102de587d778491ab08fd883f` with:

| Scope | Permission | Purpose |
| --- | --- | --- |
| Account | Workers Scripts: Edit | Deploy the ContractIntel read API |
| Account | D1: Edit | Create the database, import and verify staged versions |
| Account | Workers R2 Storage: Edit | Create the private archive bucket and store source files |

No DNS, zone, billing, or account-membership edit permissions are needed. These
account permissions can affect other matching resources in the account; the
checked-in workflow targets the named ContractIntel resources only. The account
owner must create and store the token directly. Never paste it into a chat, a
repository file, a workflow input, a command argument, or an issue.

The workflows also accept the existing repository secret `CLOUDFARE_API_TOKEN`
(legacy spelling). The correctly spelled name takes precedence if both exist.
The **ContractIntel Cloudflare access check** makes three read-only requests to
verify D1, R2, and Workers account access. It logs pass/fail only; it does not
create resources or establish that write operations will succeed.

Cloudflare login in a browser does not authorize a GitHub runner. The publisher
fails before remote work if its token is absent. The token is used only in the
explicit publication job and the read-only access check, not pull-request tests. Wrangler is pinned to 4.140.0,
with optional telemetry disabled. The frontend contains no credentials.

## First launch

1. Pass the CI checks and finish desktop/mobile interactive browser QA.
2. Provision and publish with the manual **ContractIntel guarded backfill** workflow.
   A dry run (`publish=false`) downloads and validates without contacting Cloudflare.
   Start with a small full month to measure source size and performance. This is
   a labeled partial dataset, not the launch inventory.
3. For the initial historical reconstruction, select a first-of-month start date
   (default 2000-10-01) and today's end date. Downloads are partitioned by month.
   The provider may not expose every older record; source coverage is stated honestly.
4. With `publish=true`, the workflow creates `kthq-contractintel` D1 and
   `kthq-contractintel-raw` R2 if absent. R2 stays Standard and private. There is
   no public bucket URL and no upload route in the Worker.
5. The workflow archives each original ZIP by SHA-256, reconstructs the complete
   retained manifest locally, checks totals and foreign keys, then stages SQL
   without changing the active dataset. It checks the remote counts and totals
   again before atomically switching `active_dataset` and deploying the Worker.
6. Open `/api/status` on `https://kthq-contractintel.nickhazelett.workers.dev`,
   inspect the coverage and known issues, and verify a transaction drilldown.
7. Publish the static `contractintel/web/` directory through KTHQ's normal GitHub
   Pages release. Add the homepage link only after the data and interactive QA
   are accepted. Until then, existing KTHQ pages remain untouched.

The pipeline updates its generated Wrangler database binding inside the runner.
Keep that database UUID in the repository config on the first successful release.
Do not publish the placeholder binding locally.

## Cost and failure controls

- The Cloudflare account has a $5 account-wide usage alert. It does not stop spending.
- The archive ledger stops new source uploads before its tracked raw data exceeds
  4 GB. A single ZIP is capped at 500 MB. Unexpected hosts and redirects are rejected.
- Source export polling is bounded at 15 minutes per job. New export creation is
  not retried automatically. GitHub limits a backfill run to 350 minutes.
- D1 publication stops above 80,000 estimated indexed-row writes per run or if
  the estimated database footprint would exceed 450 MB. Local snapshots stop at
  200 MB. These are conservative application guards, not provider billing caps.
- Other applications, prior same-day runs, and D1 accounting can still consume
  shared allowances. A full historical dataset may require Workers Paid or a
  partitioned database design. Stop and review the actual measured size before
  changing any plan or increasing a guard.
- Historical ZIPs are not deleted automatically. The ledger preserves original
  inputs for reproduction and rollback. When a guard fires, plan archival cleanup
  with retained-version references instead of blindly deleting old files.
- No scheduled work runs until repository variable
  `CONTRACTINTEL_SCHEDULE_ENABLED=true` is set after a successful initial backfill.

## Refresh and corrections

The enabled daily schedule refreshes calendar months covering the last 120 days.
This overlaps public release delays and refreshes whole partitions so source
deletions disappear from the reconstructed version. The retained monthly manifest
must be contiguous; a gap or truncation of an existing month stops publication.

Refresh all loaded historical months periodically with the manual workflow to
pick up older corrections/deletions; the 120-day overlap alone cannot catch them.
Large reconciliations remain manual until storage/write consumption has been
measured. There is no claim that source coverage end equals complete reporting.

The active pointer is never switched after a failed validation. Status shows the
last published version and successful staged run metadata. Use GitHub Actions
for failed or interrupted attempts; failed runs before staging are not yet
mirrored into the public status page. Do not mistake the last success for proof
that a later attempt succeeded.

## Recovery

Previous published versions are retained in D1 until capacity is reviewed. To
roll back, choose a previously validated `dataset_versions.id`, verify its rows
still exist, and change the single `active_dataset.version_id` pointer using a
parameterized query. Keep archived sources and the version's manifest.

An interrupted stage can be replayed from the same source manifest. Version IDs
include source hashes, requested windows, completeness text, and normalizer
version; `INSERT OR IGNORE` staging does not duplicate rows. Do not alter files
under an existing version ID. Bump the normalizer version for logic changes.

If a bucket already exists without a readable `catalog.json`, the job stops.
Inspect whether it belongs to this project before initializing a replacement
catalog. An unreadable catalog must never be treated as an empty bucket.

## V2 boundaries

The schema reserves opportunities, matches, usage counters, and checkpoints.
Nightly SAM ingestion, weighted matching, match reasons, PALT, bridge flags,
and cross-office search are not enabled. When added, match scores are heuristics,
not probabilities, and government-only unrevealed data must stay out of this
public application. Multiple keys do not automatically multiply an authorized
quota; entitlement must be verified for each endpoint and account type.
