# Working Theory of Leadership

Edit these single-file HTML pages directly in the canonical shared folder. There is no content generator to rerun. The one-time scaffolding script was kept outside the website, and must not be used to overwrite Nick or Claude's edits.

- Essay length and cadence are flexible, not word limits. Do not impose a word minimum or maximum on essays or mentor takes. Read times describe finished content.
- Nick writes the essays and has the last pass on every essay paragraph. Add literature paragraphs and footnotes only against his draft or with his approval. Do not rewrite his prose or invent personal stories.
- Essay text belongs between `NICK'S ESSAY START` and `NICK'S ESSAY END`. Source entries belong between `SOURCES START` and `SOURCES END`. The index hooks are proposed placeholders.
- Source boxes require author, title, year, quoted page where applicable, evidence type, and limitations. Verify direct quotes against actual text. Book links must be verified title-specific DoD Libby links, or a clearly labeled publisher fallback. No affiliate links.
- All pages currently have `noindex, nofollow`. Remove it only from approved public content. Keep admin, template, and handoff pages excluded. Noindex is not access control.
- Accounts share the forum's Supabase project. Forum usernames and display names can be pseudonyms. Mentor real names are separate Worker records. Never write mentor real names into forum metadata, or expose email, `accountId`, or forum user IDs in public mentor payloads.
- Keep the separate Worker in `../working-theory-worker`. Nick chose verified KTHQ accounts instead of per-take email confirmations. Review happens in the approval desk; no Resend dependency or notification email setup is required for this version.
- Public forms stay closed until a Worker URL, Turnstile public key, and production settings are configured. Nick must approve a mentor profile and every take. The Worker checks the actual Supabase user on every public submission, not browser-supplied email or decoded metadata.
- Pending submissions require the admin bearer token. Render all contribution text using textContent. Never add HTML interpretation.
- ContractingFM currently uses the existing site-wide playlist, as Nick requested. A leadership-only playlist is deferred until he supplies songs.
- Publishing an essay also requires adding its slug to `site-config.js` and the Worker's `PUBLISHED_TOPICS`, calculating the actual read time, updating the index, and verifying all sources. The two topic lists must match.
- Follow the parent AGENTS.md before every GitHub push. This shared folder has no Git metadata; reconcile against the current repository in a proper checkout before publishing.
