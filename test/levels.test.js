const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../www/js/engine.js');
const LEVELS = require('../www/js/levels.js');

test('campaign has 30 levels in 3 worlds', () => {
  assert.equal(LEVELS.length, 30);
  assert.deepEqual([...new Set(LEVELS.map((l) => l.world))], [1, 2, 3]);
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

test('campaign difficulty ramps within each world', () => {
  for (const world of [2, 3]) {
    const pars = LEVELS.filter((l) => l.world === world).map((l) => Engine.solve(Engine.parseLevel(l)).length);
    assert.ok(pars[pars.length - 1] > pars[0], `world ${world} ends harder than it starts`);
  }
});
