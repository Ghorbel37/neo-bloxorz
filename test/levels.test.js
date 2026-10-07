const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../www/js/engine.js');
const LEVELS = require('../www/js/levels.js');

test('campaign has 36 levels in 4 worlds', () => {
  assert.equal(LEVELS.length, 36);
  assert.deepEqual([...new Set(LEVELS.map((l) => l.world))], [1, 2, 3, 4]);
  assert.equal(LEVELS.WORLDS.length, 4);
  assert.equal(new Set(LEVELS.map((l) => l.name)).size, LEVELS.length, 'names are unique');
});

LEVELS.forEach((def, i) => {
  test(`level ${i + 1} "${def.name}" starts bottom-left and is solvable`, () => {
    const level = Engine.parseLevel(def);
    assert.deepEqual(level.start, { x: 0, y: level.height - 1, w: 1, h: 1 });
    assert.ok(level.goal, 'has a goal');
    const path = Engine.solve(level);
    assert.ok(path, 'solvable');
    // Replaying the solution must win on the last move and never fall.
    let s = Engine.initialState(level);
    path.forEach((dir, k) => {
      const r = Engine.move(level, s, dir);
      assert.equal(r.outcome, k === path.length - 1 ? 'win' : 'ok');
      s = r.state;
    });
  });
});

test('every level after the first tutorial is a puzzle: it needs wall bumps', () => {
  LEVELS.slice(1).forEach((def, i) => {
    const bumps = Engine.minBumps(Engine.parseLevel(def));
    assert.ok(bumps >= 1, `level ${i + 2} "${def.name}" needs ${bumps} bumps`);
  });
});

test('puzzles get harder: later worlds need more bumps on average', () => {
  const avg = (w) => {
    const ls = LEVELS.filter((l) => l.world === w).map((l) => Engine.minBumps(Engine.parseLevel(l)));
    return ls.reduce((a, b) => a + b, 0) / ls.length;
  };
  assert.ok(avg(4) > avg(1));
  assert.ok(avg(2) > avg(1));
});

test('each world uses its mechanic', () => {
  // The first tutorial only teaches rolling, so it has no walls.
  const has = (w, re) => LEVELS.slice(1).filter((l) => l.world === w).every((l) => re.test(l.map.join('')));
  assert.ok(has(1, /X/), 'walls in world 1');
  assert.ok(LEVELS.filter((l) => l.world === 2).every((l) => /!/.test(l.map.join(''))), 'glass in world 2');
  assert.ok(has(3, /[abcd]/), 'shape tiles in world 3');
  assert.ok(has(4, /[oO]/), 'switches in world 4');
});
