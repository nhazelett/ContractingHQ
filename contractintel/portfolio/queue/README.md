# Office import queue — disabled execution release

The shared queue is durable control state in the existing Portfolio D1 database.
It contains office codes, approval fingerprints, checkpoint references and usage
counters, never award records. Migration 0003 creates only its own small table.
The existing browser live path, R2 cohort, Cron and nightly workflows are unchanged.

## What is available
- Coverage dashboard: browser-local office draft, reviewed JSON export, shared
  group status, approval status and proposed execution limits.
- Authenticated queue management: enqueue, approve, pause/resume, cancel and
  retry stopped work. These commands cannot dispatch a job or change configuration.
- Pure reservation/completion engine: single active batch, continuation before a
  new office, durable checkpoint references, independent-verification readiness
  gate, bounded retries, New York daily source/runtime budgets, fresh complete
  storage measurements and conservative reservations before work.
- Uncertain completion retains its budget and pauses for operator reconciliation.
  Do not cancel/re-enqueue that office until its workflow is confirmed stopped.
- Optimistic revision updates prevent duplicate concurrent queue commands.

## What is deliberately disabled
CONFIG.queue.executionEnabled is false. No production dispatcher, Cron hookup,
or source fetch is connected to the new queue. The HTTP API has no tick, execute,
completion or enable action. Existing FA4528/FA4800 work runs separately and is
not charged to the proposed queue budgets. No extra offices or R2 buckets are
created by this release. Enqueueing or approving is not execution authorization.

The model is tested with simulated outcomes. The final execution adapter still
needs to reserve durable claims, dispatch a supported office workflow, reconcile
actual job outcomes, and persist completions/admission without races. Only after
FA4800 comparison and routine-refresh measurement should we approve the first
small group and wire that adapter. The current R2 profile allowlist stays intact.

## Operator commands
Use the existing Worker ingest secret in the environment, never in a URL or plan:
CONTRACTINTEL_INGEST_SECRET must match Worker PORTFOLIO_INGEST_SECRET.

Create a plan without network calls:
node contractintel/portfolio/queue/admin.mjs plan --offices FA0001,FA0002 --out plan.json

The example office codes are placeholders; select real codes from the directory.
Alternatively export the reviewed plan from /coverage.html. Then:
node contractintel/portfolio/queue/admin.mjs status
node contractintel/portfolio/queue/admin.mjs enqueue --plan plan.json
node contractintel/portfolio/queue/admin.mjs approve --group GROUP_ID --hash PLAN_SHA256
node contractintel/portfolio/queue/admin.mjs pause
node contractintel/portfolio/queue/admin.mjs pause --group GROUP_ID
node contractintel/portfolio/queue/admin.mjs resume --group GROUP_ID
node contractintel/portfolio/queue/admin.mjs cancel --group GROUP_ID
node contractintel/portfolio/queue/admin.mjs retry --group GROUP_ID --office DODAAC

Commands read the current revision, then submit a conditional update. A conflict
fails rather than silently applying a changed plan. Nothing in these commands
enables execution.

## Limits
All new settings are in CONFIG.queue at the top of portfolio/ingest.mjs.
Initial preview limits: five offices per reviewed group; one active batch;
2,160 source requests and 90 minutes reserved runtime per America/New_York day;
256 MiB combined storage guard. A batch reserves the existing 720-request and
30-minute job caps and a 32 MiB office storage allowance before work. These
proposed limits apply to this queue when execution is connected, not the rest
of the account and not the currently running FA4800 cohort. They are not a
Cloudflare spending cap. Storage measurement must cover all managed buckets.
A batch cannot start if its maximum lifetime would cross a New York day boundary.

## Verification
node --test contractintel/tests/*.test.mjs
node --test contractintel/portfolio/r2/offices.test.mjs contractintel/portfolio/r2/ingest.test.mjs
node contractintel/qa/queue-dom.mjs

The DOM harness uses happy-dom and checks 390px and desktop controls; it does
not provide graphical browser/pixel-layout verification.

After deploy: confirm execution disabled and queue empty; select up to five
live-scan offices, export JSON, clear the draft, search by location, use dark
mode, and verify current FA4528/FA4800 loading still works. Do not submit a real
group or approve more offices as part of smoke testing.
