import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('ContractingFM resolves old playlist paths and escaped filenames on the music host', () => {
  const code = read('player.js').match(/function trackUrl\(idx\) \{[\s\S]*?\n  \}/)[0];
  const paths = ['audio/track-01.mp3', "audio/You Can't Buy Back Time.mp3", 'audio/cco/Good Enough _ Not Enough.mp3', 'Comparison is the Thief of Joy.mp3'];
  const resolve = vm.runInNewContext(`(${code})`, { URL, TRACKS: paths.map(file => ({ file })) });
  paths.forEach((path, i) => {
    const url = new URL(resolve(i));
    assert.equal(url.origin, 'https://music.kthq.org');
    assert.equal(decodeURIComponent(url.pathname), '/' + path);
  });
  assert.equal(resolve(999), '');
});

test('all separate music players use R2 rather than excluded local audio paths', () => {
  const files = ['ollie-music.js', 'first-light.html', 'far-cade.html', 'gao-smash.html', 'sat-warrant-board.html', 'warrant-board.html', 'acquisition-cycle.html'];
  for (const file of files) {
    const text = read(file);
    assert.match(text, /https:\/\/music\.kthq\.org\//, file);
    assert.doesNotMatch(text, /["']\/?audio\//, file);
  }
  assert.match(read('acquisition-cycle.html'), /src="https:\/\/music\.kthq\.org\/The_Frontier\.mp3"/);
});

test('every MP3 original is kept out of the Pages package', () => {
  const excluded = read('_config.yml').split('\n').filter(line => line.startsWith('  - ')).map(line => JSON.parse(line.slice(4)));
  const originals = [];
  const walk = (dir, recursive) => {
    for (const item of readdirSync(new URL(dir || './', root), { withFileTypes: true })) {
      const path = dir + item.name;
      if (recursive && item.isDirectory()) walk(path + '/', true);
      else if (item.isFile() && /\.mp3$/i.test(path)) originals.push(path);
    }
  };
  walk('', false); walk('audio/', true); walk('ollie/', false);
  assert.ok(originals.length >= 93);
  for (const path of originals) assert.ok(excluded.some(prefix => path === prefix || path.startsWith(prefix + '/')), path);
});
