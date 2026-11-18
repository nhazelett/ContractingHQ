'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fireworks = require('../scripts/seasonal-fireworks.js');

function context() {
  const properties = ['globalCompositeOperation', 'globalAlpha', 'lineCap', 'lineWidth',
    'strokeStyle', 'fillStyle', 'shadowBlur'];
  const stack = [];
  const ctx = {
    globalCompositeOperation: 'source-over', globalAlpha: .7, lineCap: 'square',
    lineWidth: 9, strokeStyle: 'green', fillStyle: 'red', shadowBlur: 3,
    operations: [], strokes: 0, fills: 0,
    save() { stack.push(Object.fromEntries(properties.map(key => [key, this[key]]))); },
    restore() { Object.assign(this, stack.pop()); },
    beginPath() { this.operations.push(['begin']); },
    moveTo(x, y) { this.operations.push(['move', x, y]); },
    quadraticCurveTo(...points) { this.operations.push(['curve', ...points]); },
    arc(...points) { this.operations.push(['arc', ...points]); },
    stroke() { this.strokes += 1; this.operations.push(['stroke', this.strokeStyle, this.globalAlpha, this.lineWidth]); },
    fill() { this.fills += 1; this.operations.push(['fill', this.fillStyle, this.globalAlpha]); },
    clearLog() { this.operations = []; this.strokes = 0; this.fills = 0; },
    state() { return Object.fromEntries(properties.map(key => [key, this[key]])); }
  };
  return ctx;
}

function isolated(seed = 12345) {
  const source = fs.readFileSync(path.join(__dirname, '../scripts/seasonal-fireworks.js'), 'utf8');
  const math = Object.create(Math);
  math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const prohibited = () => { throw new Error('The engine must not schedule work or access the page'); };
  const sandbox = {
    window: {}, Math: math, setTimeout: prohibited, setInterval: prohibited,
    requestAnimationFrame: prohibited, fetch: prohibited,
    document: new Proxy({}, { get: prohibited })
  };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.KTHQSeasonFireworks;
}

test('the first explicitly drawn frame contains a bloom and restores canvas state', () => {
  const ctx = context();
  const before = ctx.state();
  const engine = fireworks.create(ctx);
  engine.resize(1440, 800);
  engine.draw(0, 0);
  assert.ok(ctx.strokes >= 60, 'a visible firework should not wait for the first launch');
  assert.ok(ctx.fills >= 30);
  assert.deepEqual(ctx.state(), before);
  for (const operation of ctx.operations) {
    for (const value of operation.slice(1)) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value));
    }
  }
});

test('sustained shows stay within desktop and phone drawing limits', () => {
  for (const [width, sparkLimit, rocketLimit] of [[1440, 240, 3], [390, 110, 2]]) {
    const ctx = context();
    const engine = isolated().create(ctx);
    engine.resize(width, 2400);
    const colors = new Set();
    for (let frame = 0; frame < 1200; frame += 1) {
      ctx.clearLog();
      engine.draw(frame * 1000 / 24, 1 / 24);
      assert.ok(ctx.strokes <= (sparkLimit + rocketLimit) * 2);
      assert.ok(ctx.fills <= sparkLimit + rocketLimit);
      for (const op of ctx.operations) if (op[0] === 'stroke') colors.add(op[1]);
    }
    assert.ok(colors.has('#ffd477'), 'gold blooms are present');
    assert.ok(colors.has('#b9e4ff'), 'icy-blue blooms are present');
    assert.ok(colors.has('#d1b5ff'), 'violet blooms are present');
  }
});

test('same-size resize preserves animation; wall-clock jumps do not fast-forward it', () => {
  const a = context();
  const b = context();
  const first = isolated().create(a);
  const second = isolated().create(b);
  first.resize(1280, 720);
  second.resize(1280, 720);
  for (let frame = 0; frame < 20; frame += 1) {
    first.draw(frame * 40, .04);
    second.draw(frame * 40, .04);
  }
  a.clearLog();
  b.clearLog();
  first.resize(1280, 720);
  first.draw(3600000, .04);
  second.draw(800, .04);
  assert.deepEqual(a.operations, b.operations);
  a.clearLog();
  b.clearLog();
  first.draw(7200000, 3600);
  second.draw(840, .06);
  assert.deepEqual(a.operations, b.operations, 'large dt is clamped to one safe animation step');
});

test('reset is idempotent and does not paint or schedule work by itself', () => {
  const ctx = context();
  const engine = isolated().create(ctx);
  engine.resize(1440, 800);
  engine.draw(0, 0);
  ctx.clearLog();
  engine.reset();
  engine.reset();
  assert.deepEqual(ctx.operations, []);
  engine.draw(999999, 0);
  assert.ok(ctx.fills > 0, 'an explicit draw can restart with a visible first bloom');
});

test('zero or invalid dimensions do no work and later resizing recovers', () => {
  const ctx = context();
  const engine = fireworks.create(ctx);
  for (const [width, height] of [[0, 800], [-1, 800], [390, 0], [Infinity, 800], [390, NaN]]) {
    engine.resize(width, height);
    engine.draw(1000, .04);
    assert.deepEqual(ctx.operations, []);
  }
  engine.resize(390, 800);
  engine.draw(1000, .04);
  assert.ok(ctx.fills > 0);
  assert.doesNotThrow(() => {
    const empty = fireworks.create(null);
    empty.resize(390, 800);
    empty.draw(1000, .04);
    empty.reset();
  });
});

test('canvas state is restored even when a drawing operation fails', () => {
  const ctx = context();
  const before = ctx.state();
  ctx.stroke = () => { throw new Error('lost drawing surface'); };
  const engine = fireworks.create(ctx);
  engine.resize(1440, 800);
  assert.throws(() => engine.draw(0, 0), /lost drawing surface/);
  assert.deepEqual(ctx.state(), before);
});
