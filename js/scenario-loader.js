/* ==========================================================================
   CCO CAPSTONE — SCENARIO LOADER
   v0.2.10

   Runs AFTER content/content-bundle.js but BEFORE any engine / view scripts.
   The stock Iron Meridian content is already loaded into window.__CCO_DATA
   by the bundle script. This file checks localStorage for an "active
   scenario" authored in the Builder (builder.html) and, if one is active,
   swaps the content in place.

   LocalStorage keys owned by this module:

   'cco-active-scenario-pointer'
       { mode: 'stock' | 'builder', title, updated_at }
       If mode === 'builder', the loader replaces __CCO_DATA.injects with
       the translated Builder bundle. Otherwise it does nothing.

   'cco-active-scenario-bundle'
       { injects: {...}, contacts: [...], phoneScripts: {...}, meta: {...} }
       The fully-translated bundle that the Builder produces via
       Builder.publishToApp(). Keeping it separate from the pointer means
       we can flip back to stock without losing the custom bundle.

   Design notes:
   - Loader is synchronous and idempotent. Multiple page loads are fine.
   - If the active scenario is malformed, we log to console and silently
     fall through to the stock bundle so the app keeps working.
   - Contacts from the custom bundle are UNIONED with stock contacts so
     the shipped characters (Ramsey, Dooley, Perez, etc.) remain available
     as role-play fallbacks even in custom scenarios.
   - phoneScripts and docs from the custom bundle override stock on ID
     collision.
   - __CCO_DATA.meta.clock_mode is set so engine.startExercise() can pick
     it up as a default.
   ========================================================================== */

(function () {
  'use strict';

  const POINTER_KEY = 'cco-active-scenario-pointer';
  const BUNDLE_KEY  = 'cco-active-scenario-bundle';

  // Expose a small API on window so the Builder + STARTEX can read/write
  // the active scenario without reimplementing the storage shape.
  window.CCOScenario = {
    POINTER_KEY,
    BUNDLE_KEY,

    // Read the currently active pointer. Always returns an object with mode.
    getActive() {
      try {
        const raw = localStorage.getItem(POINTER_KEY);
        if (!raw) return { mode: 'stock' };
        const parsed = JSON.parse(raw);
        return parsed && parsed.mode ? parsed : { mode: 'stock' };
      } catch (e) { return { mode: 'stock' }; }
    },

    // Read the saved custom bundle (if any). Returns null if nothing stored.
    getBundle() {
      try {
        const raw = localStorage.getItem(BUNDLE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { return null; }
    },

    // Write a custom bundle AND set pointer to 'builder'. Called by the
    // Builder's Publish button.
    publishBundle(bundle, title) {
      try {
        localStorage.setItem(BUNDLE_KEY, JSON.stringify(bundle));
        localStorage.setItem(POINTER_KEY, JSON.stringify({
          mode: 'builder',
          title: title || 'Custom scenario',
          updated_at: new Date().toISOString()
        }));
        return true;
      } catch (e) { console.error('publishBundle failed:', e); return false; }
    },

    // Flip the pointer back to the stock bundle. Bundle blob is preserved
    // so switching back to custom later is free.
    useStock() {
      localStorage.setItem(POINTER_KEY, JSON.stringify({
        mode: 'stock', title: 'Iron Meridian (stock)', updated_at: new Date().toISOString()
      }));
    },

    // Wipe the custom bundle entirely (used by Builder "unpublish" flow).
    clearBundle() {
      localStorage.removeItem(BUNDLE_KEY);
      localStorage.setItem(POINTER_KEY, JSON.stringify({
        mode: 'stock', title: 'Iron Meridian (stock)', updated_at: new Date().toISOString()
      }));
    }
  };

  // ---- Apply active scenario NOW if one is set ----
  try {
    const pointer = window.CCOScenario.getActive();
    if (pointer.mode !== 'builder') return;

    const bundle = window.CCOScenario.getBundle();
    if (!bundle || !bundle.injects) {
      console.warn('[scenario-loader] active=builder but no bundle found, falling back to stock');
      return;
    }

    if (!window.__CCO_DATA) window.__CCO_DATA = {};

    // Replace injects wholesale
    window.__CCO_DATA.injects = bundle.injects;

    // Merge contacts — stock contacts stay available; custom-authored
    // personas get appended under any new IDs. We keep the stock contacts
    // list as the outer shape (__CCO_DATA.contacts.contacts[]).
    const stockContacts = (window.__CCO_DATA.contacts && window.__CCO_DATA.contacts.contacts) || [];
    const customContacts = bundle.contacts || [];
    const seen = new Set(stockContacts.map((c) => c.id));
    const merged = stockContacts.slice();
    customContacts.forEach((c) => {
      if (!seen.has(c.id)) {
        merged.push(c);
        seen.add(c.id);
      }
    });
    window.__CCO_DATA.contacts = { contacts: merged };

    // Merge phone scripts — custom overrides stock on collision
    if (bundle.phoneScripts) {
      window.__CCO_DATA.phoneScripts = Object.assign(
        {}, window.__CCO_DATA.phoneScripts || {}, bundle.phoneScripts
      );
    }

    // Preserve meta for downstream consumers (engine reads clock_mode)
    window.__CCO_DATA.meta = bundle.meta || {};

    // Small breadcrumb so the title shows in devtools / status pill
    window.__CCO_DATA._activeTitle = pointer.title;
    window.__CCO_DATA._activeMode = 'builder';
    console.info(`[scenario-loader] loaded custom scenario "${pointer.title}" (${Object.keys(bundle.injects).length} injects)`);
  } catch (e) {
    console.error('[scenario-loader] failed:', e);
  }
})();
