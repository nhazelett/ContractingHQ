import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playerPath = resolve(repoRoot, 'player.js');
const source = readFileSync(playerPath, 'utf8');

function yetTracks() {
  const match = source.match(/var SEP_2026_TRACKS = (\[[\s\S]*?\n  \]);/);
  assert.ok(match, 'player.js should define the Yet album track list');
  return vm.runInNewContext(match[1]);
}

test('player includes every Yet album track and audio file', () => {
  const tracks = yetTracks();
  const expectedTitles = [
    'Comparison is the Thief of Joy',
    'Curious, Not Judgmental',
    'Do the Next Right Thing',
    'Excel In, Airpower Out',
    'Hard Things Are Hard',
    'High T, Unlimited',
    'It Depends',
    'Kurban Olurum',
    'Look for the Helpers',
    'Not My Fault, Still My Problem',
    'Rewind the Tape',
    'Still My Move',
    'The Obstacle Is the Way',
    'Water the Plants',
    'Westbound',
    'Yet',
    "You Can't Buy Back Time"
  ];

  assert.equal(tracks.length, 17);
  assert.deepEqual(Array.from(tracks, (track) => track.title), expectedTitles);
  assert.equal(new Set(Array.from(tracks, (track) => track.id)).size, 17);

  for (const track of tracks) {
    assert.ok(existsSync(resolve(repoRoot, track.file)), `missing audio file: ${track.file}`);
  }
});

test('player appends and prioritizes the newest album without reindexing old tracks', () => {
  assert.match(source, /return tracks\.concat\(SEP_2026_TRACKS\);/);
  assert.match(source, /track\.releaseDate = '2026-09-11';/);
  assert.match(source, /function landingTrackIndex\(\)/);
  assert.match(source, /if \(\(TRACKS\[idx\]\.landingPriority \|\| 0\) > 0\) weighted\.push\(idx\);/);
  assert.match(source, /allTrackIndexes\(\)\.forEach\(function \(i, position\)/);
  assert.match(source, /allTrackIndexes\(\)\.forEach\(function \(idx, position\)/);
});
