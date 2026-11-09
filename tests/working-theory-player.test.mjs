import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../player.js', import.meta.url), 'utf8');
test('the leadership directory index uses the floating player rather than the homepage player', () => {
  const code = source.match(/function isHomePath\(value\) \{[\s\S]*?\n  \}/)[0];
  const detect = vm.runInNewContext('(' + code + ')');
  assert.equal(detect('/'), true);
  assert.equal(detect('/index.html'), true);
  assert.equal(detect('/working-theory/'), false);
  assert.equal(detect('/working-theory/index.html'), false);
});
const start = source.indexOf('  function softPageName(url)');
const end = source.indexOf('  function markCurrentSoftHead()', start);
const context = vm.createContext({ SOFT_NAV_PAGES: ['index.html', 'about.html'], window: { location: { protocol: 'https:', origin: 'https://kthq.org', pathname: '/index.html', search: '' } } });
vm.runInContext(source.slice(start, end), context);
test('all public section pages join the persistent player; admin and handoff do not', () => {
  const files = readdirSync(new URL('../working-theory/', import.meta.url)).filter(name => name.endsWith('.html') && !['admin.html', 'HANDOFF.html'].includes(name));
  for (const file of files) assert.equal(context.isSoftPage(new URL('https://kthq.org/working-theory/' + file)), true, file);
  assert.equal(context.isSoftPage(new URL('https://kthq.org/working-theory/')), true);
  for (const path of ['working-theory/admin.html', 'working-theory/HANDOFF.html', 'working-theory/unknown.html', 'unrelated/index.html']) assert.equal(context.isSoftPage(new URL('https://kthq.org/' + path)), false);
  assert.equal(context.isSoftPage(new URL('https://kthq.org/about.html')), true);
});
test('section navigation preserves same origin and full-reload exclusions', () => {
  const link = { hasAttribute: () => false, target: '' };
  assert.equal(context.canSoftNavigate(link, new URL('https://kthq.org/working-theory/')), true);
  assert.equal(context.canSoftNavigate(link, new URL('https://elsewhere.test/working-theory/')), false);
  assert.equal(context.canSoftNavigate({ ...link, hasAttribute: () => true }, new URL('https://kthq.org/working-theory/')), false);
  assert.equal(context.canSoftNavigate({ ...link, target: '_blank' }, new URL('https://kthq.org/working-theory/')), false);
});

test('soft navigation waits for the section stylesheet before removing the previous head', async () => {
  const start = source.indexOf('  function markCurrentSoftHead()');
  const end = source.indexOf('  function shouldSkipSoftScript', start);
  let removed = false;
  let incoming;
  const previous = { parentNode: { removeChild() { removed = true; } } };
  const stylesheet = {
    cloneNode() {
      return { tagName: 'LINK', rel: 'stylesheet', setAttribute() {} };
    }
  };
  const selectors = [];
  const document = {
    title: 'Previous page',
    querySelectorAll(selector) { selectors.push(selector); return selector === '[data-kthq-soft-head]' ? [previous] : []; },
    head: { appendChild(node) { incoming = node; } }
  };
  const doc = { title: 'Leadership essay', querySelectorAll(selector) { selectors.push(selector); return [stylesheet]; } };
  const context = vm.createContext({ document, softHeadMarked: false });
  vm.runInContext(source.slice(start, end), context);
  context.markCurrentSoftHead();
  const ready = context.updateSoftHead(doc);
  assert.equal(removed, false, 'previous styles remain while the new CSS loads');
  assert.ok(incoming);
  incoming.onload();
  await ready;
  assert.equal(removed, true);
  assert.equal(document.title, 'Leadership essay');
  assert.ok(selectors.filter(s => s !== '[data-kthq-soft-head]').every(s => s.includes('head link[rel="stylesheet"][href^="/working-theory/"]')));
  assert.match(source, /await updateSoftHead\(doc\)/);
});

test('a failed section stylesheet rejects so soft navigation can fall back to a full page load', async () => {
  const start = source.indexOf('  async function updateSoftHead(doc)');
  const end = source.indexOf('  function shouldSkipSoftScript', start);
  let incoming;
  let removed = false;
  const document = {
    querySelectorAll() { return [{ parentNode: { removeChild() { removed = true; } } }]; },
    head: { appendChild(node) { incoming = node; } }
  };
  const doc = { title: 'Essay', querySelectorAll() { return [{ cloneNode() { return { tagName: 'LINK', rel: 'stylesheet', setAttribute() {} }; } }]; } };
  const context = vm.createContext({ document });
  vm.runInContext(source.slice(start, end), context);
  const ready = context.updateSoftHead(doc);
  incoming.onerror();
  await assert.rejects(ready, /Section stylesheet failed to load/);
  assert.equal(removed, false);
});
