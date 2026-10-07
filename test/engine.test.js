const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../www/js/engine.js');

const lvl = (map) => Engine.parseLevel({ name: 't', map });
const at = (x, y, w, h, open = false) => ({ x, y, w, h, open });
const OPEN = ['#######', '#######', '#######', '#######', '#######', '#######', 'S######'];

test('start is a small square in the bottom-left', () => {
  const l = lvl(['####GG', '####GG', '######', '######', '######', 'S#####']);
  assert.deepEqual(Engine.initialState(l), at(0, 5, 1, 1));
  assert.deepEqual(l.goal, { x: 4, y: 0, w: 2, h: 2 });
});

test('shape transitions follow the sketch', () => {
  const l = lvl(OPEN);
  const cases = [
    // [from w,h] -> [left/right], [up/down]
    [[1, 1], [2, 1], [1, 2]],
    [[2, 1], [1, 1], [2, 2]],
    [[1, 2], [2, 2], [1, 1]],
    [[2, 2], [1, 2], [2, 1]],
  ];
  for (const [[w, h], horiz, vert] of cases) {
    const s = at(3, 3, w, h);
    for (const dir of ['left', 'right']) {
      const r = Engine.move(l, s, dir);
      assert.equal(r.outcome, 'ok');
      assert.deepEqual([r.state.w, r.state.h], horiz, `${w}x${h} ${dir}`);
    }
    for (const dir of ['up', 'down']) {
      const r = Engine.move(l, s, dir);
      assert.deepEqual([r.state.w, r.state.h], vert, `${w}x${h} ${dir}`);
    }
  }
});

test('the block rolls over its own edge', () => {
  const l = lvl(OPEN);
  const s = Engine.initialState(l);
  const right = Engine.move(l, s, 'right').state;
  assert.deepEqual([right.x, right.w], [1, 2]);
  const right2 = Engine.move(l, right, 'right').state;
  assert.deepEqual([right2.x, right2.w], [3, 1]);
  const back = Engine.move(l, right2, 'left').state;
  assert.deepEqual([back.x, back.w], [1, 2]);
  const up = Engine.move(l, s, 'up').state;
  assert.deepEqual([up.y, up.h], [s.y - 2, 2]);
});

test('rolling without walls is reversible', () => {
  const l = lvl(OPEN);
  const opposite = { left: 'right', right: 'left', up: 'down', down: 'up' };
  for (const [w, h] of [[1, 1], [2, 1], [1, 2], [2, 2]]) {
    for (const dir of Object.keys(opposite)) {
      const s = at(3, 3, w, h);
      const there = Engine.move(l, s, dir).state;
      assert.deepEqual(Engine.move(l, there, opposite[dir]).state, s);
    }
  }
});

test('rolling alone keeps the rhythm: a small square only stops on every third column', () => {
  const l = lvl(['##########', 'S#########']);
  const smallXs = new Set();
  for (const { state } of Engine.explore(l).values()) if (state.w === 1 && state.h === 1) smallXs.add(state.x);
  assert.deepEqual([...smallXs].sort((a, b) => a - b), [0, 3, 6, 9]);
});

test('bumping a wall changes shape in place', () => {
  // Small square at x=2, wall at x=3: rolling right would hit the wall, so it stretches back.
  const l = lvl(['S##X']);
  const small = at(2, 0, 1, 1);
  const r = Engine.move(l, small, 'right');
  assert.equal(r.outcome, 'ok');
  assert.equal(r.bumped, true);
  assert.deepEqual(r.state, at(1, 0, 2, 1));
  // A bar next to the wall shrinks into its half against the wall.
  const r2 = Engine.move(l, at(1, 0, 2, 1), 'right');
  assert.equal(r2.bumped, true);
  assert.deepEqual(r2.state, at(2, 0, 1, 1));
});

test('bumps work in every direction', () => {
  const l = lvl(['##X##', '#####', 'X####', '#####', 'S#X##']);
  // Left: rolling from x=1 would cover the wall at x=0, so the square stretches right instead.
  assert.deepEqual(Engine.move(l, at(1, 2, 1, 1), 'left').state, at(1, 2, 2, 1));
  // Up: the wall at (2,0) stops the roll, the square stretches downward in place.
  assert.deepEqual(Engine.move(l, at(2, 2, 1, 1), 'up').state, at(2, 2, 1, 2));
  // Down: the wall at (2,4) stops the roll, the square stretches upward.
  assert.deepEqual(Engine.move(l, at(2, 3, 1, 1), 'down').state, at(2, 2, 1, 2));
  // A vertical bar against a wall shrinks into its half next to it.
  assert.deepEqual(Engine.move(l, at(2, 2, 1, 2), 'down').state, at(2, 3, 1, 1));
  assert.deepEqual(Engine.move(l, at(2, 1, 1, 2), 'up').state, at(2, 1, 1, 1));
});

test('bumps shift the rhythm', () => {
  const l = lvl(['S#GX']);
  const path = Engine.solve(l);
  assert.deepEqual(path, ['right', 'right']);
  assert.equal(Engine.minBumps(l), 1);
  // Without the wall the goal tile can't be reached as a small square.
  assert.equal(Engine.solve(lvl(['S#G#'])), null);
});

test('a block wedged between walls does not move', () => {
  const l = lvl(['XS#X']);
  const r = Engine.move(l, at(1, 0, 2, 1), 'left');
  // Rolling left hits the wall at x=0, the bump shrinks to x=1 which is fine.
  assert.equal(r.outcome, 'ok');
  const wedged = lvl(['X#X', 'XSX']);
  const s = Engine.initialState(wedged);
  const r2 = Engine.move(wedged, s, 'left');
  // Rolling left from x=1 lands on the wall; bumping would stretch into x=2, also a wall.
  assert.equal(r2.outcome, 'blocked');
  assert.deepEqual(r2.state, s);
});

test('falling off the board or into a hole', () => {
  const l = lvl(['#.#', '#.#', 'S#.']);
  const s = Engine.initialState(l);
  assert.equal(Engine.move(l, s, 'left').outcome, 'fall');
  assert.equal(Engine.move(l, s, 'down').outcome, 'fall');
  assert.equal(Engine.move(l, s, 'right').outcome, 'fall'); // bar on (1,2),(2,2): (2,2) is a hole
  assert.equal(Engine.move(l, s, 'up').outcome, 'ok');
});

test('win needs the exact goal shape and position', () => {
  const l = lvl(['####', '####', 'SGG#']);
  const s = Engine.initialState(l);
  assert.equal(Engine.move(l, s, 'right').outcome, 'win');
  assert.equal(Engine.move(l, s, 'up').outcome, 'ok');
});

test('glass breaks only under the big square', () => {
  const l = lvl(['#!!', '#!!', 'S!!']);
  const s = Engine.initialState(l);
  assert.equal(Engine.move(l, s, 'right').outcome, 'ok'); // horizontal bar on glass
  const bar = Engine.move(l, s, 'right').state;
  const r = Engine.move(l, bar, 'up'); // big square on glass
  assert.equal(r.outcome, 'fall');
  assert.equal(r.broke.length, 4);
});

test('shape tiles only hold their own shape', () => {
  const l = lvl(['#bb', 'Sbb']);
  const s = Engine.initialState(l);
  assert.equal(Engine.move(l, s, 'right').outcome, 'ok'); // horizontal bar on b tiles
  const r = Engine.move(l, Engine.move(l, s, 'right').state, 'up');
  assert.equal(r.outcome, 'fall'); // big square on b tiles
  const l2 = lvl(['#a#', 'S#a']);
  assert.equal(Engine.move(l2, Engine.initialState(l2), 'right').outcome, 'fall'); // bar over an 'a' tile
});

test('switches toggle bridges every time', () => {
  const l = lvl(['==', 'So#']);
  const s = Engine.initialState(l);
  const on = Engine.move(l, s, 'right');
  assert.equal(on.toggled, true);
  assert.equal(on.state.open, true);
  assert.equal(Engine.tileAt(l, true, 0, 0), '#');
  assert.equal(Engine.tileAt(l, false, 0, 0), '.');
  const off = Engine.move(l, on.state, 'left');
  assert.equal(off.toggled, false);
  assert.equal(Engine.move(l, off.state, 'right').state.open, false);
});

test('heavy switches only respond to the big square', () => {
  const l = lvl(['#OO', '#OO', 'S##']);
  const s = Engine.initialState(l);
  const bar = Engine.move(l, s, 'right').state; // horizontal bar on plain floor
  const big = Engine.move(l, bar, 'up'); // big square onto the heavy switch
  assert.equal(big.toggled, true);
  const vbar = Engine.move(l, s, 'up');
  assert.equal(vbar.toggled, false);
});

test('a bridge closing under the block makes it fall', () => {
  const l = lvl(['S+o']);
  const a = Engine.move(l, Engine.initialState(l), 'right'); // bar over '+' and 'o'
  assert.equal(a.outcome, 'fall');
});

test('solver finds shortest solutions', () => {
  const l = lvl(['####GG', '####GG', '######', '######', '######', 'S#####']);
  assert.equal(Engine.solve(l).length, 6);
  assert.equal(Engine.solve(lvl(['S.G'])), null);
});

test('solver can start from any state', () => {
  const l = lvl(['####GG', '####GG', '######', '######', '######', 'S#####']);
  const mid = Engine.move(l, Engine.initialState(l), 'right').state;
  assert.equal(Engine.solve(l, mid).length, 5);
});

test('minBumps counts the fewest bumps of any solution', () => {
  assert.equal(Engine.minBumps(lvl(['####GG', '####GG', '######', '######', '######', 'S#####'])), 0);
  assert.equal(Engine.minBumps(lvl(['S#GX'])), 1);
  assert.equal(Engine.minBumps(lvl(['S.G'])), null);
});

test('invalid start or goal shapes are rejected', () => {
  assert.throws(() => lvl(['S#S']));
  assert.throws(() => lvl(['#', '#']));
});
