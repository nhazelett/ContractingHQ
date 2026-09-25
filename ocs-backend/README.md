# Hosted SAM gateway

The peer preview frontend is served at https://kthq.org/ocs-supplier-atlas.html. This Cloudflare Worker supplies only the public SAM entity and firm-exclusions endpoints, plus safe connection status. It is separate from the existing KTHQ backend services.

`SAM_API_KEY` is a Cloudflare secret. Do not place credentials in Git, HTML, URLs served to clients, logs, or configuration files. Deploy with `npm ci` and `npx wrangler deploy`; install/rotate the secret with `npx wrangler secret put SAM_API_KEY` using secure stdin or the private prompt. `wrangler types` generates ignored local runtime types.

One SQLite-backed Durable Object coordinates the shared credential's quota and 30-minute cache. Successful and failed upstream attempts count; cache hits do not. The ceiling is 1,000 per UTC day at the user's instruction; this is an application ceiling, not a verified SAM entitlement. SAM 429 responses create a persisted cooldown. Ten previously used local requests were carried into the initial September 25 counter. The local preview server now forwards to this same service rather than maintaining a second live allowance.

Country, name, classification and page filters are allowlisted; entity records require public-display permission. Exclusions accept active Firm records only, with verified primary-address country. Raw source responses and credentials never reach the frontend. Exclusion requests omit optional includeSections because SAM rejected the documented exclusionAddress projection in live testing; normalization still copies only the selected public fields. Outbound requests use manual redirects and reject non-success responses without forwarding credentials to another destination. JSON sizes, per-IP traffic and total daily upstream usage are bounded.

CORS accepts KTHQ origins and the local preview origin. CORS is not authentication, and the direct-link peer preview is public. No homepage/tools/dossier card or sitemap entry is deployed; the preview HTML requests no indexing. This is not a CAC/.mil access gate.

Tests: `node --test tests/ocs-*.test.mjs` from the repository root. Live verification on September 25: Saudi active registrations returned 10 of 200 matches; U.S. active firm exclusions returned 10 of 7,993 matches; Saudi firm exclusions returned zero matches. These are dated, paginated source results, not eligibility clearance or complete vendor inventories.
