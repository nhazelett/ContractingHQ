# FAR-CADE Leaderboard — Cloudflare Worker Setup

One-time setup, about 5 minutes. Same Cloudflare account you used for `kthq-ai-helper`.

## 1. Create the KV namespace

1. Go to dash.cloudflare.com → **Storage & Databases** → **KV**
2. Click **Create a namespace**
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
https://farcade-leaderboard.nickhazelett.workers.dev/?sector=0
```

You should see `{"scores":[]}`. Then play a round of PART LOCK, lock in a callsign, and refresh — your score should be in the list.

## Notes

- The game degrades gracefully: if the worker is unreachable or not deployed yet, scores save to the player's browser and the board shows "OFFLINE — SCORES ON THIS MACHINE ONLY". Nothing breaks if you skip this setup.
- Stores top 100 per sector, serves top 25. Names are server-side sanitized to A-Z, 0-9, space, period, underscore, hyphen, 18 chars max.
- Scores above 12,000 are rejected (theoretical max is ~11,400), so casual score spoofing through the API is bounded.
- To wipe a board or remove a name: KV → FARCADE_SCORES → edit the `sector0` / `sector1` / `sector2` entry directly.
- If you ever rename the worker, update `LB_URL` near the top of the script in `far-cade.html`.
- This file and `farcade-leaderboard-worker.js` don't need to be pushed to GitHub — they're for your reference. Pushing them is harmless, though.

## Free tier limits (plenty)

Workers free tier: 100,000 requests/day. KV free tier: 100,000 reads/day, 1,000 writes/day. A write only happens when someone submits a score, so 1,000 score submissions per day is the practical cap.
