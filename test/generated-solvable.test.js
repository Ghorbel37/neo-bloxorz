// Exhaustive-ish checks that every generated level a player can get is solvable and is
// exactly what the generator reports. Covers the real call paths of each mode.
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../www/js/engine.js');
const G = require('../www/js/generator.js');
const M = require('../www/js/modes.js');

let fallbacks = 0;
function verify(g, label) {
  assert.ok(g && Array.isArray(g.map), `${label}: a level was produced`);
  if (g.fallback) fallbacks++;
  const level = Engine.parseLevel({ name: label, map: g.map });
  assert.deepEqual(level.start, { x: 0, y: level.height - 1, w: 1, h: 1 }, `${label}: starts bottom-left`);
  assert.ok(level.goal, `${label}: has a goal`);
  assert.ok(level.width <= 8 && level.height <= 10, `${label}: fits the screen`);
  const path = Engine.solve(level);
  assert.ok(path, `${label}: solvable`);
  assert.equal(path.length, g.par, `${label}: par matches`);
  // Replay the reported solution on the real rules.
  let s = Engine.initialState(level);
  g.solution.forEach((dir, k) => {
    const r = Engine.move(level, s, dir);
    assert.equal(r.outcome, k === g.solution.length - 1 ? 'win' : 'ok', `${label}: solution move ${k + 1}`);
    s = r.state;
  });
  const bumps = Engine.minBumps(level);
  assert.equal(bumps, g.bumps, `${label}: bumps match`);
  assert.ok(bumps >= 1, `${label}: is a puzzle (needs a bump)`);
}

test('every depth from 1 to 40 across many seeds', () => {
  for (let depth = 1; depth <= 40; depth++) {
    for (let seed = 0; seed < 25; seed++) verify(G.generateForDepth(depth, seed * 104729 + depth), `depth ${depth} seed ${seed}`);
  }
});

test('Descent: the first 15 floors of 20 runs', () => {
  for (let r = 0; r < 20; r++) {
    const run = M.createRun(r * 2654435761);
    for (let depth = 1; depth <= 15; depth++) {
      run.depth = depth;
      const floor = M.runFloor(run);
      verify(floor, `run ${r} depth ${depth}`);
      assert.ok(M.runBudget(run, floor.par) > floor.par, 'the move budget leaves room to solve');
    }
  }
});

test('Rush: 60 puzzles in a row for 5 sessions', () => {
  for (let seed = 0; seed < 5; seed++) {
    for (let solved = 0; solved < 60; solved++) verify(M.rushFloor(seed * 31337, solved), `rush ${seed} #${solved}`);
  }
});

test('Daily: every day of a year', () => {
  const d = new Date(2026, 0, 1);
  for (let i = 0; i < 366; i++) {
    const key = M.dateKey(d);
    verify(M.dailyFloor(key), `daily ${key}`);
    d.setDate(d.getDate() + 1);
  }
});

test('the fallback puzzle is valid and was never needed', () => {
  verify(G.fallbackLevel(), 'fallback');
  fallbacks--; // the line above counted itself
  assert.equal(fallbacks, 0);
});
