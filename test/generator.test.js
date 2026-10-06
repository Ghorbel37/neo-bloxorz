const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../www/js/engine.js');
const G = require('../www/js/generator.js');

test('generation is deterministic for a seed', () => {
  assert.deepEqual(G.generateForDepth(7, 99).map, G.generateForDepth(7, 99).map);
  assert.notDeepEqual(G.generateForDepth(7, 99).map, G.generateForDepth(7, 100).map);
});

test('tile to slot mapping', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(G.tileToSlot), [0, 1, 1, 2, 3, 3, 4]);
});

test('generated levels are always solvable with the reported par', () => {
  for (let depth = 1; depth <= 25; depth += 2) {
    for (let seed = 0; seed < 12; seed++) {
      const g = G.generateForDepth(depth, seed * 7919 + depth);
      assert.ok(g && g.map, `depth ${depth} seed ${seed}`);
      const level = Engine.parseLevel({ name: 'g', map: g.map });
      assert.deepEqual(level.start, { x: 0, y: level.height - 1, w: 1, h: 1 });
      const path = Engine.solve(level);
      assert.ok(path, `solvable depth ${depth} seed ${seed}`);
      assert.equal(path.length, g.par);
    }
  }
});

test('deeper floors are bigger and harder on average', () => {
  const avg = (depth) => {
    let total = 0;
    for (let s = 0; s < 10; s++) total += G.generateForDepth(depth, s).par;
    return total / 10;
  };
  assert.ok(avg(15) > avg(1));
});

test('generated maps fit a phone screen', () => {
  for (let seed = 0; seed < 20; seed++) {
    const g = G.generateForDepth(30, seed);
    const level = Engine.parseLevel({ name: 'g', map: g.map });
    assert.ok(level.width <= 14 && level.height <= 20, `${level.width}x${level.height}`);
  }
});
