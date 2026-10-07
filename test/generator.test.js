const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../www/js/engine.js');
const G = require('../www/js/generator.js');

test('generation is deterministic for a seed', () => {
  assert.deepEqual(G.generateForDepth(7, 99).map, G.generateForDepth(7, 99).map);
  assert.notDeepEqual(G.generateForDepth(7, 99).map, G.generateForDepth(7, 100).map);
});

test('generated levels are solvable puzzles with the reported par and bumps', () => {
  for (let depth = 1; depth <= 25; depth += 2) {
    for (let seed = 0; seed < 10; seed++) {
      const g = G.generateForDepth(depth, seed * 7919 + depth);
      assert.ok(g && g.map, `depth ${depth} seed ${seed}`);
      const level = Engine.parseLevel({ name: 'g', map: g.map });
      assert.deepEqual(level.start, { x: 0, y: level.height - 1, w: 1, h: 1 });
      const path = Engine.solve(level);
      assert.ok(path, `solvable depth ${depth} seed ${seed}`);
      assert.equal(path.length, g.par);
      const bumps = Engine.minBumps(level);
      assert.equal(bumps, g.bumps);
      assert.ok(bumps >= 1, `depth ${depth} seed ${seed} needs a bump`);
    }
  }
});

test('deeper floors need more bumps on average', () => {
  const avg = (depth) => {
    let total = 0;
    for (let s = 0; s < 10; s++) total += G.generateForDepth(depth, s).bumps;
    return total / 10;
  };
  assert.ok(avg(12) > avg(1));
});

test('generated maps fit a phone screen', () => {
  for (let seed = 0; seed < 20; seed++) {
    const level = Engine.parseLevel({ name: 'g', map: G.generateForDepth(30, seed).map });
    assert.ok(level.width <= 8 && level.height <= 10, `${level.width}x${level.height}`);
  }
});

test('generation is fast enough for a phone', () => {
  const t = Date.now();
  for (let seed = 0; seed < 20; seed++) G.generateForDepth(15, seed);
  assert.ok((Date.now() - t) / 20 < 150, 'average under 150 ms per level');
});
