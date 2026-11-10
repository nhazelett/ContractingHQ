# KTHQ music delivery

Production music is served by `https://music.kthq.org` from the Cloudflare R2 Standard bucket `kthq-music`. The custom domain has TLS 1.2 minimum. Public development access is not used. Only public MP3 files belong in this bucket.

The original MP3s remain in this shared folder and GitHub. `_config.yml` excludes them from the GitHub Pages package. ContractingFM, the CCO playlist, Ollie, First Light, warrant study pages, and the acquisition cycle use the R2 copies. Playlist IDs and saved favorites are unchanged.

## Adding or replacing music

1. Save new songs under `audio/` and update the relevant playlist. Prefer a new filename when replacing a song so already-cached copies cannot hide the replacement.
2. From the canonical website folder, run `node scripts/sync-music-r2.mjs`. It uses the existing Wrangler sign-in, uploads new or changed files, and checks every public copy. Identical files are skipped; nothing is deleted.
3. Run `node --test tests/music-r2.test.mjs tests/player-yet-album.test.mjs tests/working-theory-player.test.mjs` and publish the website through the existing GitHub Pages process.

To check the public library without writing anything, run `node scripts/sync-music-r2.mjs --verify-only`. Checks cover full-file checksum and size, audio MIME type, CORS, and exact mid-file byte ranges used for seeking.

The bucket's browser access configuration is in `scripts/music-r2-cors.json`. Apply with `node working-theory-worker/node_modules/wrangler/bin/wrangler.js r2 bucket cors set kthq-music --file scripts/music-r2-cors.json --force` if it changes. Credentials stay in Wrangler's user configuration, outside this website.

## Rollback

The originals are retained. To restore Pages delivery, remove the music exclusions in `_config.yml`, restore the previous player/page audio URLs, and publish together. Verify playback after the completed deployment. Leave R2 copies available during rollback so cached pages continue to work.

Player script tags use `?v=20261110-r2` so refreshed pages load the R2 version even when a browser cached the legacy player. Keep this version when adding pages. Bump the script version across public HTML when a future player change needs immediate cache invalidation.

After migration, refresh pages opened before the update so they load the R2 player. Old direct `kthq.org/audio/...` download URLs are no longer published by Pages; the matching R2 URL has the same path under `music.kthq.org`.
