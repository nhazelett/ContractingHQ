# FAR-CADE Leaderboard — Cloudflare Worker Setup

One-time setup, about 5 minutes. Same Cloudflare account you used for `kthq-ai-helper`.

> **Already deployed v1?** Just open the worker, **Edit code**, re-paste everything from `farcade-leaderboard-worker.js`, and Deploy. v2 adds weekly season boards (reset Mondays, UTC) and the Daily Drill board. No KV changes needed — same `LB` binding.

## 1. Create the KV namespace

1. Go to dash.cloudflare.com → **Storage & Databases** → **KV**
2. Click **Create Instance** (may be labeled "Create a namespace")
3. Name it `FARCADE_SCORES` → Create

## 2. Create the Worker

1. Go to **Workers & Pages** → **Create** → **Create Worker**
2. Name it exactly `farcade-leaderboard` (the game points at `https://farcade-leaderboard.nickhazelett.workers.dev`)
3. Deploy the starter, then click **Edit code**
4. Delete the starter code, paste in everything from `farcade-leaderboard-worker.js`, and **Deploy**

## 3. Bind the KV namespace

1. From the worker's page: **Settings** → **Bindings** → **Add** → **KV namespace**
2. Variable name: `LB` (exactly, capital letters)
3. KV namespace: `FARCADE_SCORES`
4. Save → **Deploy** again if prompted

## 4. Test it

Open this in a browser:

```
https://farcade-leaderboard.nickhazelett.workers.dev/?board=0&scope=week
```

You should see `{"scores":[]}`. Then play a round of PART LOCK, lock in a callsign, and refresh — your score should be in the list. Also try `?board=daily` after a Daily Drill.

## How the boards work (v2)

- **Sector scores** are written to two boards at once: the all-time board and the current week's season board (ISO week, UTC, resets Monday). The game's HIGH SCORES screen has a THIS WEEK / ALL-TIME toggle.
- **Daily Drill scores** go to a per-date board (UTC). Every player gets the same 15 seeded questions each day; one attempt per device.
- The rank returned after a submission is the weekly rank (or daily rank for drills).

## Notes

- The game degrades gracefully: if the worker is unreachable or not deployed yet, scores save to the player's browser and the board shows "OFFLINE — SCORES ON THIS MACHINE ONLY". Nothing breaks if you skip this setup.
- Stores top 100 per board, serves top 25. Names are server-side sanitized to A-Z, 0-9, space, period, underscore, hyphen, 18 chars max.
- Scores above 12,000 are rejected (theoretical max is ~11,400), so casual score spoofing through the API is bounded.
- To wipe a board or remove a name: KV → FARCADE_SCORES → edit the relevant key (`sector0`, `week:2026-W24:0`, `daily:2026-06-09`, etc.).
- Old weekly/daily keys just sit unused; KV free tier storage is 1 GB, so no cleanup needed for years. Delete old keys whenever you feel tidy.
- If you ever rename the worker, update `LB_URL` near the top of the script in `far-cade.html`.
- This file and `farcade-leaderboard-worker.js` don't need to be pushed to GitHub — they're for your reference. Pushing them is harmless, though.

## Free tier limits (plenty)

Workers free tier: 100,000 requests/day. KV free tier: 100,000 reads/day, 1,000 writes/day. A sector submission now uses 2 writes (all-time + weekly), so the practical cap is ~500 sector submissions plus daily submissions per day. Still far more than needed.
