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

function seasonFns(search = '') {
  const live = source.match(/function christmasSeasonLive\(\) \{[\s\S]*?\n  \}/)[0];
  const season = source.match(/function isChristmasSeason\(date\) \{[\s\S]*?\n  \}/)[0];
  return vm.runInNewContext(`${live}\n${season}\n({ live: christmasSeasonLive, season: isChristmasSeason })`, {
    Date, Intl, Number, window: { location: { search } }
  });
}
const inSeason = (iso) => seasonFns().season(new Date(iso));

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

test('the seasonal songs follow the site Christmas theme every year', () => {
  assert.equal(inSeason('2026-11-27T04:59:59Z'), false); // Thanksgiving night, Eastern
  assert.equal(inSeason('2026-11-27T05:00:00Z'), true);  // day after Thanksgiving
  assert.equal(inSeason('2026-12-25T12:00:00Z'), true);
  assert.equal(inSeason('2027-01-01T04:59:59Z'), true);  // Dec 31, 11:59 PM Eastern
  assert.equal(inSeason('2027-01-01T05:00:00Z'), false); // New Year's Day
  assert.equal(inSeason('2027-07-04T12:00:00Z'), false);
  assert.equal(inSeason('2027-11-25T12:00:00Z'), false); // Thanksgiving 2027
  assert.equal(inSeason('2027-11-26T12:00:00Z'), true);
  assert.equal(seasonFns('?xmas-preview').live(), true);
  assert.equal(seasonFns('?xmas-previewer').live(), inSeason(new Date().toISOString()));
});

test('two year-round songs play now; the rest wait for release and keep album order', () => {
  const yearRound = vm.runInNewContext(source.match(/var CHRISTMAS_2026_YEAR_ROUND = (\[[^\]]*\]);/)[1]);
  assert.deepEqual(Array.from(yearRound), ['First Time on Earth', 'Give Yourself Some Grace']);
  const titles = christmasTracks().map((track) => track.title);
  for (const title of yearRound) assert.ok(titles.includes(title), title);
  assert.match(source, /return tracks\.concat\(yearRound, CHRISTMAS_SEASON_LIVE \? seasonal : \[\]\);/);
  assert.match(source, /track\.releaseDate = CHRISTMAS_SEASON_LIVE \? '2026-11-27' : '';/);
  assert.match(source, /\(TRACKS\[a\]\.albumTrack \|\| 0\) - \(TRACKS\[b\]\.albumTrack \|\| 0\)/);
  assert.ok('2026-11-27' > '2026-09-11');
});

test('Christmas audio is published to the music host', () => {
  assert.match(readFileSync(resolve(repoRoot, 'scripts/sync-music-r2.mjs'), 'utf8'), /await collect\('audio\/Christmas 2026', false\);/);
});
