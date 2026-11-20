import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(repoRoot, 'player.js'), 'utf8');
const pickNextIndex = vm.runInNewContext(
  '(' + source.match(/function pickNextIndex\([^)]*\) \{[\s\S]*?\n  \}/)[0] + ')'
);

function seeded(seed) {
  let x = seed;
  return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
}

test('a visit plays every newest song before anything else, then picks from the whole pool', () => {
  const pool = Array.from({ length: 30 }, (_, i) => i);
  const newest = [20, 21, 22, 23, 24];
  for (let seed = 1; seed <= 25; seed += 1) {
    const rand = seeded(seed);
    let current = 22;
    const heard = [current];
    const order = [current];
    for (let n = 0; n < 40; n += 1) {
      const next = pickNextIndex(pool, current, newest, heard, false, rand);
      assert.notEqual(next, current, 'never repeats the song that just played');
      if (heard.indexOf(next) === -1) heard.push(next);
      order.push(next);
      current = next;
    }
    assert.deepEqual([...order.slice(0, 5)].sort((a, b) => a - b), newest, `seed ${seed}: newest first`);
    assert.ok(order.slice(5).some((idx) => idx < 20), `seed ${seed}: then the rest of the pool`);
  }
});

test('the newest songs come in random order, not list order', () => {
  const pool = Array.from({ length: 30 }, (_, i) => i);
  const newest = [20, 21, 22, 23, 24];
  const firsts = new Set();
  for (let seed = 1; seed <= 40; seed += 1) {
    firsts.add(pickNextIndex(pool, 20, newest, [20], false, seeded(seed)));
  }
  assert.ok(firsts.size >= 3, 'next newest song varies');
});

test('after the newest songs, nothing from the last ten songs comes back', () => {
  const pool = Array.from({ length: 40 }, (_, i) => i);
  for (let seed = 1; seed <= 30; seed += 1) {
    const rand = seeded(seed);
    const history = [];
    let current = 0;
    for (let n = 0; n < 60; n += 1) {
      const recent = history.slice(-10);
      const next = pickNextIndex(pool, current, [0], [0], false, rand, recent);
      assert.ok(!recent.includes(next) && next !== current, `seed ${seed}: ${next} repeated too soon`);
      history.push(current);
      current = next;
    }
  }
});

test('shuffle stays pure random and skipped songs are never chosen', () => {
  const pool = [0, 1, 2, 3, 4, 5];
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed += 1) seen.add(pickNextIndex(pool, 0, [4, 5], [0], true, seeded(seed)));
  assert.ok([...seen].some((idx) => idx < 4), 'shuffle ignores the newest-first rule');
  const unskipped = [0, 1, 3];
  for (let seed = 1; seed <= 30; seed += 1) {
    assert.ok(unskipped.includes(pickNextIndex(unskipped, 0, [2, 3], [0], false, seeded(seed))));
  }
});

test('player wires the order into next, list picks and previous', () => {
  assert.match(source, /var next = pickNextIndex\(pool, state\.idx, newestInPool\(pool\), state\.heardNew \|\| \[\], state\.shuffle, null,\s*state\.shuffle \? null : playHistory\.slice\(-10\)\);/);
  assert.match(source, /state\.heardNew = \[state\.idx\];/);
  assert.equal((source.match(/pickTrack\(idx\);/g) || []).length, 2);
  assert.match(source, /while \(playHistory\.length\)/);
});
