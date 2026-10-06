const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../www/js/engine.js');

const lvl = (map) => Engine.parseLevel({ name: 't', map });
const at = (x, y, w, h, open = false) => ({ x, y, w, h, open });

test('slot grid expands thin/thick columns and rows from the bottom-left', () => {
  const tiles = Engine.expandSlots(['##', 'S#']);
  // Columns: 1 + 2 tiles. Rows from the bottom: 1 + 2 tiles.
  assert.deepEqual(tiles.map((r) => r.join('')), ['###', '###', 'S##']);
});

test('start is a small square in the bottom-left', () => {
  const l = lvl(['###G', '####', '####', 'S###']);
  assert.deepEqual(Engine.initialState(l), at(0, 5, 1, 1));
  assert.deepEqual(l.goal, { x: 4, y: 0, w: 2, h: 2 });
});

test('shape transitions follow the sketch', () => {
  const l = lvl(['#####', '#####', '#####', '#####', 'S####']);
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
      assert.deepEqual([r.state.w, r.state.h], horiz, `${w}x${h} ${dir}`);
    }
    for (const dir of ['up', 'down']) {
      const r = Engine.move(l, s, dir);
      assert.deepEqual([r.state.w, r.state.h], vert, `${w}x${h} ${dir}`);
    }
  }
});

test('the block rolls over its own edge', () => {
  const l = lvl(['#####', '#####', '#####', '#####', 'S####']);
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

test('moves are reversible', () => {
  const l = lvl(['#####', '#####', '#####', '#####', 'S####']);
  const opposite = { left: 'right', right: 'left', up: 'down', down: 'up' };
  for (const [w, h] of [[1, 1], [2, 1], [1, 2], [2, 2]]) {
    for (const dir of Object.keys(opposite)) {
      const s = at(3, 3, w, h);
      const there = Engine.move(l, s, dir).state;
      const back = Engine.move(l, there, opposite[dir]).state;
      assert.deepEqual(back, s);
    }
  }
});

test('falling off the board or into a hole', () => {
  const l = lvl(['#.G', 'S##']);
  const s = Engine.initialState(l);
  assert.equal(Engine.move(l, s, 'left').outcome, 'fall');
  assert.equal(Engine.move(l, s, 'down').outcome, 'fall');
  // up from S lands on the vertical slot at column 0 which is floor
  assert.equal(Engine.move(l, s, 'up').outcome, 'ok');
});

test('win needs the exact goal shape and position', () => {
  const l = lvl(['##', 'SG']);
  const s = Engine.initialState(l);
  assert.equal(Engine.move(l, s, 'right').outcome, 'win');
  assert.equal(Engine.move(l, s, 'up').outcome, 'ok');
});

test('glass breaks only under the big square', () => {
  const l = lvl(['#!#', '!!!', 'S!#']);
  const s = Engine.initialState(l);
  assert.equal(Engine.move(l, s, 'right').outcome, 'ok'); // horizontal bar on glass
  assert.equal(Engine.move(l, s, 'up').outcome, 'ok'); // vertical bar on glass
  const bar = Engine.move(l, s, 'right').state;
  const r = Engine.move(l, bar, 'up'); // big square on glass
  assert.equal(r.outcome, 'fall');
  assert.equal(r.broke.length, 4);
});

test('switches toggle bridges every time', () => {
  const l = lvl(['=.', 'So']);
  // S -> right lands as a horizontal bar on the switch slot
  const s = Engine.initialState(l);
  const on = Engine.move(l, s, 'right');
  assert.equal(on.toggled, true);
  assert.equal(on.state.open, true);
  assert.equal(Engine.tileAt(l, true, 0, 0), '#');
  assert.equal(Engine.tileAt(l, false, 0, 0), '.');
  const off = Engine.move(l, on.state, 'left');
  assert.equal(off.toggled, false);
  const again = Engine.move(l, off.state, 'right');
  assert.equal(again.state.open, false);
});

test('heavy switches only respond to the big square', () => {
  const l2 = lvl(['#O', 'S#']);
  const s = Engine.initialState(l2);
  const bar = Engine.move(l2, s, 'up').state; // vertical bar at column 0
  const big = Engine.move(l2, bar, 'right'); // big square onto O
  assert.equal(big.toggled, true);
  const hbar = Engine.move(l2, s, 'right').state; // horizontal bar on '#'
  assert.equal(Engine.move(l2, hbar, 'left').toggled, false);
});

test('a bridge closing under the block makes it fall', () => {
  const l = lvl(['S+o']);
  // Right: bar covers the '+' slot (tiles 1-2). Right again: small square on 'o' at tile 3.
  const s = Engine.initialState(l);
  const a = Engine.move(l, s, 'right');
  assert.equal(a.outcome, 'ok');
  const b = Engine.move(l, a.state, 'right');
  assert.equal(b.toggled, true);
  // Bridge is now closed; rolling back onto it falls.
  assert.equal(Engine.move(l, b.state, 'left').outcome, 'fall');
});

test('solver finds shortest solutions', () => {
  const l = lvl(['###G', '####', '####', 'S###']);
  const path = Engine.solve(l);
  assert.equal(path.length, 6);
  assert.equal(Engine.solve(lvl(['S.G'])), null);
});

test('solver can start from any state', () => {
  const l = lvl(['###G', '####', '####', 'S###']);
  const mid = Engine.move(l, Engine.initialState(l), 'right').state;
  assert.equal(Engine.solve(l, mid).length, 5);
});

test('invalid start or goal shapes are rejected', () => {
  assert.throws(() => lvl(['S#S']));
  assert.throws(() => lvl(['#', '#']));
});
