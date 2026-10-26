# Repair checkpoint — 2026-10-26
- D1 authority repair deployed in 81a90e7; security follow-up in 82095bd.
- Live FA4528 D1 publication: 82965cc2-f9de-48a2-a130-4419ed1cd353.
  4,091 awards; all four windows and 32 CSV checks matched its regenerated R2.
- 137 cloud tests and unauthenticated page/API blocking checks passed.
- Cloudflare Access organization/app API calls both returned HTTP 403. Origin
  denies coverage access by default. Access SSO setup still needs token account
  permissions Access: Apps and Policies/Edit and Access: Organizations/Read,
  plus an enabled Zero Trust organization. New apps default to deny until an
  administrator adds the intended identity allowlist.
- FA4800 saved work remains 90245098-ed8a-43e2-995b-d9c9e817de19. Last checked
  completed batch confirmed 4,717 prepared of 7,968; newer batches may be ahead.
- Full source validation must precede FA4800 D1 publication/cache admission.
- Healthy continuations now exit successfully; terminal errors still fail.
- The post-verification cost collector includes old failed attempts and discloses
  missing logs rather than claiming exact accounting.
- Still pending: FA4800 completion/parity/cost report, FY25-ranked 150-office
  seed queue and first-request warming. No full 1,432-office crawl is authorized.
  Action-date delta discovery with weekly full rediscovery is a proposal after
  rollout, not a claim about current maintenance.
