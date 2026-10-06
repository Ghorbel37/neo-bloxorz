const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../www/js/modes.js');

test('stars', () => {
  assert.equal(M.starsFor(10, 10), 3);
  assert.equal(M.starsFor(15, 10), 2);
  assert.equal(M.starsFor(16, 10), 1);
});

test('precision limit gives a small margin over par', () => {
  assert.equal(M.precisionLimit(6), 8);
  assert.equal(M.precisionLimit(38), 42);
});

test('run: hearts, ghost and death', () => {
  const run = M.createRun(1);
  assert.equal(run.hearts, 3);
  run.ghosts = 1;
  assert.equal(M.runFail(run, 'fall'), 'rewind');
  assert.equal(run.hearts, 3);
  assert.equal(M.runFail(run, 'moves'), 'retry');
  assert.equal(M.runFail(run, 'fall'), 'retry');
  assert.equal(M.runFail(run, 'fall'), 'dead');
  assert.equal(run.over, true);
});

test('run: ghost does not save you from running out of moves', () => {
  const run = M.createRun(1);
  run.ghosts = 1;
  assert.equal(M.runFail(run, 'moves'), 'retry');
  assert.equal(run.ghosts, 1);
});

test('run: clearing a floor banks sparks and offers 3 distinct perks', () => {
  const run = M.createRun(5);
  const perks = M.runClear(run, 10, 15);
  assert.equal(run.depth, 2);
  assert.equal(run.sparks, 5 + 1);
  assert.equal(perks.length, 3);
  assert.equal(new Set(perks).size, 3);
  perks.forEach((p) => assert.ok(M.PERKS[p]));
  assert.deepEqual(M.perkChoices(run), perks, 'perk offer is deterministic');
});

test('run: perks apply', () => {
  const run = M.createRun(5);
  M.applyPerk(run, 'heart');
  M.applyPerk(run, 'heart');
  M.applyPerk(run, 'heart');
  assert.equal(run.hearts, M.MAX_HEARTS);
  M.applyPerk(run, 'stamina');
  assert.equal(M.runBudget(run, 10), 10 + 10 + 3);
  M.applyPerk(run, 'skip');
  assert.equal(M.runSkip(run), true);
  assert.equal(run.depth, 2);
  assert.equal(M.runSkip(run), false);
  assert.throws(() => M.applyPerk(run, 'nope'));
});

test('run: full hearts are never offered', () => {
  const run = M.createRun(3);
  run.hearts = M.MAX_HEARTS;
  for (let d = 1; d < 30; d++) {
    run.depth = d;
    assert.ok(!M.perkChoices(run).includes('heart'));
  }
});

test('run: floors are seeded by run and depth', () => {
  const a = M.createRun(77);
  const b = M.createRun(77);
  assert.deepEqual(M.runFloor(a).map, M.runFloor(b).map);
  b.depth = 2;
  assert.notDeepEqual(M.runFloor(a).map, M.runFloor(b).map);
});

test('run: move budget shrinks with depth but stays above par', () => {
  const run = M.createRun(1);
  const early = M.runBudget(run, 20);
  run.depth = 30;
  const late = M.runBudget(run, 20);
  assert.ok(late < early);
  assert.ok(late > 20);
});

test('rush: bonus time rewards par and depth', () => {
  assert.ok(M.rushBonus(5, 10, 10) > M.rushBonus(5, 11, 10));
  assert.ok(M.rushBonus(6, 20, 10) > M.rushBonus(1, 20, 10));
  assert.ok(M.rushDepthFor(10) > M.rushDepthFor(0));
});

test('daily: same puzzle for the same date', () => {
  assert.equal(M.dateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.deepEqual(M.dailyFloor('2026-10-07').map, M.dailyFloor('2026-10-07').map);
  assert.notDeepEqual(M.dailyFloor('2026-10-07').map, M.dailyFloor('2026-10-08').map);
});

test('daily: streak counts consecutive days', () => {
  const today = new Date(2026, 9, 7);
  assert.equal(M.dailyStreak(['2026-10-05', '2026-10-06', '2026-10-07'], today), 3);
  assert.equal(M.dailyStreak(['2026-10-05', '2026-10-06'], today), 2, 'today not played yet');
  assert.equal(M.dailyStreak(['2026-10-04', '2026-10-06', '2026-10-07'], today), 2);
  assert.equal(M.dailyStreak([], today), 0);
});
