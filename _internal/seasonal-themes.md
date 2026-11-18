# Seasonal themes

The homepage and training hub share one annual calendar. Their links, announcements, training content, search, and music player remain in the existing pages. Seasonal copy, colors, illustrations, and decorative effects are applied around that content.

## Calendar

All boundaries use America/New_York, independent of the visitor's timezone. A theme runs through the last day shown and switches at midnight on the following day.

| Dates | Theme key |
| --- | --- |
| January 1–31 | `winter` |
| February 1–last day, including February 29 | `valentine` |
| March 1–June 30 | `standard` |
| July 1–31 | `independence` |
| August 1–31 | `standard` |
| September 1–30 | `fiscal` |
| October 1–31 | `halloween` |
| November 1–Thanksgiving Day | `thanksgiving` |
| Day after Thanksgiving–December 31 | `christmas` |

Thanksgiving is calculated as the fourth Thursday in November. Christmas begins November 27 in 2026, November 26 in 2027, and November 29 in 2030. No annual date edits, scheduled deployments, cron jobs, Workers, or paid services are needed for this feature. The browser uses its device clock, resolves on page load and tab return, and checks the clock at minute boundaries while visible; an already-open page updates within about a minute of a boundary, subject to browser timer throttling.

## Preview and manual override

Open `/seasonal-preview.html` to compare the actual homepage and training page in desktop and phone widths. The preview loads those existing pages in an iframe; it does not maintain separate copies of the homepage.

- `/index.html?theme=christmas` previews one theme for that visit.
- `/training.html?theme=winter` previews the training hub.
- `/index.html?theme-date=2026-11-27` exercises the calendar for a specific Eastern calendar date.
- Malformed themes/dates are ignored. Valid theme preview takes precedence over preview date, then shared configuration, then the current date.
- The preview notice and **Exit preview** link distinguish a visit-specific preview from the live calendar.

For a sitewide manual override, edit `scripts/seasonal-config.js`, changing `mode: 'auto'` to any theme key above, and publish normally. Use `mode: 'standard'` to disable seasonal presentation for everyone. Return to `mode: 'auto'` to resume the calendar. A source configuration change follows the ordinary GitHub Pages deployment process.

Visitors can use **Use standard theme** to choose standard presentation on their own device. That preference and the **Pause effects** preference are stored locally when storage is available. They do not change the site for other people. Explicit preview links ignore the visitor's standard-theme preference. Device reduced-motion preferences always disable animated particles.

## Files and integration

- `scripts/seasonal-calendar.js`: pure date resolution, shared by browser and Node tests.
- `scripts/seasonal-config.js`: sitewide automatic/manual setting and effects switch.
- `scripts/seasonal.js`: seasonal copy, illustration selection, appearance controls, effects, and lifecycle cleanup.
- `styles/seasonal.css`: shared palettes and homepage presentation.
- `styles/training-seasonal.css`: permanent training layout with seasonal colors.
- `styles/thanksgiving.css`: retained Thanksgiving presentation, enabled only in that season.
- `images/kthq-christmas-tree.png`: new Christmas illustration with transparent background.
- `seasonal-preview.html`: preview controls using the actual pages.

The existing `scripts/thanksgiving.js` and `styles/training-season.css` remain available as reference; the two updated pages now use the shared controller instead of the former leaf script.

The music player can replace a page body without a full refresh. For that reason, seasonal CSS uses root-relative imports inside head style elements that the existing player copies, and shared scripts are loaded in the body in config/calendar/controller order. The controller detects the old hero being removed, stops its timers and animation, removes root/body theme attributes, and reinitializes only on pages with `data-season-surface`. Do not convert these imports to relative paths or head-only script tags without updating the navigation lifecycle.

Large Thanksgiving and Christmas images are loaded only when needed. Snow/leaves/sparks are limited to the themed hero surface, pause when offscreen or the tab is hidden, and cannot capture clicks. With JavaScript unavailable, the pages retain readable standard styling and their normal content.

## Verification

Run `node --test tests/seasonal-calendar.test.cjs`. The tests cover Eastern midnight boundaries, the November daylight-saving boundary, all seven possible weekdays for November 1, leap years and century rules, malformed dates, override precedence, and loading the same module in a browser context without DOM/timers.

Browser verification for this change covered desktop Christmas, phone widths for all eight themes, mobile training, pause/resume, visitor standard/seasonal switching, and navigation home → Working Theory → home → training. Shared content and existing links were compared against the original pages.

When pulling this change onto the Windows/OneDrive source checkout, use the existing repository workflow and preserve any local uncommitted edits. This cloud workspace cannot verify or update that Windows folder directly.
