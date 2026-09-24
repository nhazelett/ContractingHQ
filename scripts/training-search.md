# Training search

The training landing page uses a small static index. Visitors load the index on search-field focus; matching then runs locally. Only linked training cards are indexed. Coming-soon cards are omitted.

After changing lesson content or track listings, run from the repository root:

```sh
python scripts/build_training_search.py
python scripts/build_training_search.py --check
node --test tests/training-search.test.mjs
```

Commit the regenerated training-search-index.js with the content changes. Bump the query version on the training-search.js reference in training.html when publishing an updated index; that version also identifies the index request. Bump the CSS version when changing styles.

Publish training.html, training-search.js, training-search.css, and training-search-index.js together. Keep the search script in the page body so the site's persistent music-player navigation initializes it when returning to Training. The generator and tests need no third-party packages. Index generation is currently a manual publishing step.

Search prioritizes titles and aliases, then descriptions, headings and selected body keywords. All query tokens must match. Limited typo recovery runs if ordinary matching finds nothing. It is topic search rather than exhaustive full-text search or question answering.
