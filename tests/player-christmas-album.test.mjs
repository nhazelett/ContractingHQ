import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(repoRoot, 'player.js'), 'utf8');

function christmasTracks() {
  const match = source.match(/var CHRISTMAS_2026_TRACKS = (\[[\s\S]*?\n  \]);/);
  assert.ok(match, 'player.js should define the Christmas album track list');
  return vm.runInNewContext(match[1]);
}

function liveAt(isoTime, search = '') {
  const release = source.match(/var CHRISTMAS_2026_RELEASE = (Date\.UTC\([^)]*\));/)[1];
  const fn = source.match(/function christmas2026Live\(\) \{[\s\S]*?\n  \}/)[0];
  const RealDate = Date;
  const FakeDate = { UTC: RealDate.UTC, now: () => new RealDate(isoTime).getTime() };
  return vm.runInNewContext(`var CHRISTMAS_2026_RELEASE = ${release}; ${fn}; christmas2026Live();`, {
    Date: FakeDate, window: { location: { search } }
  });
}

test('player includes every Christmas album track and audio file', () => {
  const tracks = christmasTracks();
  assert.equal(tracks.length, 16);
  assert.equal(tracks[0].title, 'A Firm-Fixed Christmas');
  assert.equal(new Set(Array.from(tracks, (track) => track.id)).size, 16);
  for (const track of tracks) {
    assert.equal(track.subtitle, 'A Firm-Fixed Christmas');
    assert.ok(track.file.startsWith('audio/Christmas 2026/'), track.file);
    assert.ok(existsSync(resolve(repoRoot, track.file)), `missing audio file: ${track.file}`);
  }
});

test('Christmas album joins the playlist at midnight Eastern on November 27, 2026', () => {
  assert.equal(liveAt('2026-11-27T04:59:59Z'), false);
  assert.equal(liveAt('2026-11-27T05:00:00Z'), true);
  assert.equal(liveAt('2026-12-25T12:00:00Z'), true);
  assert.equal(liveAt('2026-11-20T12:00:00Z', '?xmas-preview'), true);
  assert.equal(liveAt('2026-11-20T12:00:00Z', '?xmas-previewer'), false);
});

test('Christmas album is appended last and carries the newest release date', () => {
  assert.match(source, /return christmas2026Live\(\) \? tracks\.concat\(CHRISTMAS_2026_TRACKS\) : tracks;/);
  assert.match(source, /track\.releaseDate = '2026-11-27';/);
  assert.ok('2026-11-27' > '2026-09-11');
});

test('Christmas audio is published to the music host', () => {
  assert.match(readFileSync(resolve(repoRoot, 'scripts/sync-music-r2.mjs'), 'utf8'), /await collect\('audio\/Christmas 2026', false\);/);
});
