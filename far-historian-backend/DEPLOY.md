# FAR Historian — backend deploy runbook

The page (`far-historian.html`) works **fully on its own** for the 2017‑forward tier — no backend needed. This Worker adds two things on top:

1. **Latest FAR changes** ticker (a live "what just changed across the whole FAR" feed).
2. **Deep history 1996–2016** (annual GovInfo editions spliced onto the bottom of each section's ledger).

The ticker works the moment the Worker is deployed. The 1996–2016 tier only lights up after you run the one‑time ingest.

Commands below are verified against **wrangler v4** (Nov 2025 syntax).

---

## Prerequisites

- Node 18+ (the ingester uses global `fetch`).
- A free Cloudflare account.
- Wrangler: `npm install -g wrangler` then `wrangler login`.

## 1. Create the KV namespace

```
wrangler kv namespace create FAR_KV
```

Copy the returned `id` into `wrangler.toml`, replacing `PASTE_YOUR_KV_NAMESPACE_ID_HERE`.

## 2. Deploy the Worker

```
wrangler deploy
```

Note the URL it prints, e.g. `https://far-historian.<your-subdomain>.workers.dev`.

## 3. Point the page at the Worker

In `far-historian.html`, set the one line near the top of the script:

```js
const KTHQ_BACKEND = "https://far-historian.<your-subdomain>.workers.dev";
```

Push `far-historian.html`. The ticker should now appear. (The daily cron at 11:00 UTC keeps the feed fresh; it also rebuilds on first request as a cold‑start fallback.)

## 4. Backfill the 1996–2016 annual tier (optional, one time)

This runs **on your machine**, not in the Worker (the volumes are large and KV write limits make bulk backfill a local job). GovInfo serves ~5 MB per volume, so the full run takes a while — you can do a subset first.

```
node ingest.mjs            # all years 1996–2016
node ingest.mjs 1996 2000  # or a smaller range to start
```

It writes `./out/*.json` and prints one upload command per file. They look like:

```
wrangler kv bulk put ./out/kv-far-1996.json --binding FAR_KV --remote
wrangler kv bulk put ./out/kv-idx.json      --binding FAR_KV --remote
wrangler kv bulk put ./out/kv-hist.json     --binding FAR_KV --remote
```

Run each one. Confirm a year loaded:

```
curl "https://far-historian.<your-subdomain>.workers.dev/api/ingest?year=1996"
```

## What the Worker serves

- `GET /api/recent` — auto‑updated FAR‑core change feed (parts 1–53; DFARS and other agency supplements excluded).
- `GET /api/annual/years?section=15.404-1` — which annual editions hold a section.
- `GET /api/annual?section=15.404-1&year=1996` — that section's text from an annual edition.
- `GET /api/ecfr/<path>` — CORS + edge‑cache proxy to the eCFR (only needed on networks that block outbound calls).

## Notes

- The recent feed auto‑widens its lookback (730 days → 3× → 10 years) so it's never empty between FAC bursts.
- Annual editions are frozen by definition, so the 1996–2016 tier needs no refresh once loaded.
- The 1997 Part 15 rewrite renumbered many sections, so a pre‑2017 number may cover a different subject than today — the page says so rather than forcing a false match.
