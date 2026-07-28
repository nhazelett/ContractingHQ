# HARD CALLS: One-Time Setup

Two pieces of backend to wire up: the anonymous poll (Cloudflare Worker + KV, same account as `kthq-ai-helper` and `farcade-leaderboard`) and comments (giscus on GitHub Discussions). About 15 minutes total. Everything degrades gracefully until you finish: if the Worker isn't deployed, the poll hides itself and THE CALL unlocks anyway; if the giscus IDs are still placeholders, the comments box just won't render.

## Part 1: Poll Worker (Cloudflare)

Files: `hardcalls-poll-worker.js` (the code) and `hardcalls-poll-wrangler.toml` (only needed for the CLI route). The scenario pages already point at `https://hardcalls-poll.nickhazelett.workers.dev`, so the worker name matters.

### Dashboard route (no npm, no CLI, recommended)

1. Go to dash.cloudflare.com → **Storage & Databases** → **KV**
2. Click **Create Instance** (may be labeled "Create a namespace")
3. Name it `HARDCALLS_VOTES` → Create
4. Go to **Workers & Pages** → **Create** → **Create Worker**
5. Name it exactly `hardcalls-poll` → **Deploy** the starter
6. Click **Edit code**, delete the starter, paste in everything from `hardcalls-poll-worker.js`, **Deploy**
7. From the worker's page: **Settings** → **Bindings** → **Add** → **KV namespace**
   - Variable name: `VOTES` (exactly, capital letters)
   - KV namespace: `HARDCALLS_VOTES`
8. Save → **Deploy** again if prompted

### CLI route (alternative)

If you'd rather use wrangler: run `npx wrangler kv namespace create HARDCALLS_VOTES`, paste the printed id into `hardcalls-poll-wrangler.toml` where marked, then `npx wrangler deploy --config hardcalls-poll-wrangler.toml`.

### Test it

Open this in a browser:

```
https://hardcalls-poll.nickhazelett.workers.dev/results/001-parking-spaces
```

You should see `{"counts":{"A":0,"B":0,"C":0},"total":0}`. Then open the pilot scenario page, vote, and refresh that URL. The count should move.

### Notes

- No auth, no PII, no cookies. The only repeat-vote control is a localStorage flag in the reader's browser, best effort by design.
- Two truly simultaneous votes can occasionally collapse into one (read-then-write counters). For a gut-check poll, that's fine.
- To reset a poll or fix a count: KV → `HARDCALLS_VOTES` → edit the `votes:<scenario-id>:<A|B|C>` keys directly.
- Free tier is plenty: 100,000 requests/day on Workers, 1,000 KV writes/day = 1,000 votes/day.
- If you ever rename the worker, update `POLL_API` near the bottom of every scenario page and in `hardcalls/template.html`.

## Part 2: Comments (giscus on GitHub Discussions)

### Enable Discussions on the repo

1. Go to github.com/nhazelett/ContractingHQ
2. **Settings** (repo settings, the tab on the repo itself, not your account)
3. Stay on the **General** page, scroll down to the **Features** section
4. Check the box for **Discussions**

### Create the "Hard Calls" category

1. The repo now has a **Discussions** tab. Open it.
2. In the left sidebar next to "Categories," click the **pencil icon** (Manage categories)
3. Click **New category**
4. Name: `Hard Calls`. Description: whatever you like.
5. Discussion format: pick **Announcement**. This means only you (and giscus) can create the thread for each page, but anyone can comment and reply. That keeps drive-by top-level threads out of the category.
6. **Create**

### Install the giscus app

1. Go to github.com/apps/giscus
2. Click **Install**
3. Choose **Only select repositories** → pick `ContractingHQ` → **Install**

### Get your repo ID and category ID

1. Go to giscus.app
2. Scroll to the **Configuration** section
3. Under "Repository," type `nhazelett/ContractingHQ`. Wait for the green check that says the repo meets all the criteria.
4. Under "Page ↔ Discussions Mapping," leave it on **pathname** (the pages are already set to pathname mapping)
5. Under "Discussion Category," pick **Hard Calls**
6. Scroll to the generated `<script>` block at the bottom. You don't need the whole block, just two values from it:
   - `data-repo-id="R_..."`
   - `data-category-id="DIC_..."`

### Plug the IDs into the pages

In `hardcalls/template.html` and `hardcalls/001-parking-spaces.html`, find the giscus script tag (section 6, THE FLOOR) and replace:

- `PLACEHOLDER_REPO_ID` → your `R_...` value
- `PLACEHOLDER_CATEGORY_ID` → your `DIC_...` value

Same two values on every current and future scenario page. The template carries them forward once you set them there.

The theme is already set to `transparent_dark` to match the site, and mapping is `pathname`, so each scenario page gets its own discussion thread automatically the first time someone comments.

## Publishing a new scenario (the routine, for reference)

1. Copy `hardcalls/template.html` → `hardcalls/NNN-slug.html`
2. Fill in every `EDIT:` marker, delete the draft banner when final
3. Add one entry to `hardcalls/manifest.json`
4. Optionally add a line to `sitemap.xml`
5. Push. Done.

## Remaining manual steps

- [ ] Cancel the PikaPods forum instance (forum.kthq.org). Nothing on the site links to it anymore.
- [ ] Deploy the poll Worker (Part 1 above) and test with the pilot page
- [ ] Enable Discussions, create the Hard Calls category, install giscus, and plug the two IDs into the template and the pilot (Part 2 above)
- [ ] Rewrite the pilot's facts and THE CALL in your own words, verify the cites, then delete the DRAFT banners in `001-parking-spaces.html` and the `"status": "draft"` line in `manifest.json`
- [ ] Optional: announce Hard Calls in the homepage Announcements list (the old forum announcement was removed, not replaced)
