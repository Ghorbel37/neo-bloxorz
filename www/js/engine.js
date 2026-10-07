// Core rules of Neo Bloxorz, shared by the game (browser) and the tools/tests (node).
//
// The block is a rectangle of width w and height h, each 1 or 2:
//   1x1 small square, 2x1 horizontal bar, 1x2 vertical bar, 2x2 big square.
// Every move changes its shape: left/right toggles the width, up/down toggles the height.
//
// Rolling: the block tips over its edge, so a small square moving right becomes a
// horizontal bar on the next two tiles, and that bar moving right becomes a small square
// just past it. Rolling alone keeps a fixed rhythm (thin, thick, thin...), so a spot can
// only be reached in one shape.
//
// Bumping: if the block would roll into a wall, it changes shape in place instead,
// pressed against the wall (a bar shrinks into its half next to the wall, a small square
// stretches away from it). Bumps shift the rhythm, which is what the puzzles are about.
// If even the bump would hit a wall, the block does not move.
//
// Tiles:
//   .  void            #  floor          X  wall           S  start      G  goal
//   !  glass: breaks under the big square
//   a  b  c  d  shape tiles: only hold the small square (a), horizontal bar (b),
//               vertical bar (c) or big square (d); any other shape falls through
//   o  switch: toggles the bridges whenever the block lands on it
//   O  heavy switch: toggles the bridges only under the big square
//   =  bridge, closed at start          +  bridge, open at start
(function (root) {
  const DIRS = {
    left: [-1, 0],
    right: [1, 0],
    up: [0, -1],
    down: [0, 1],
  };
  const SHAPE_TILES = { a: [1, 1], b: [2, 1], c: [1, 2], d: [2, 2] };

  function boundsOf(cells, what, name) {
    if (!cells.length) {
      if (what === 'goal') return null;
      throw new Error(`Level "${name}" has no ${what} cells`);
    }
    const xs = cells.map((c) => c[0]);
    const ys = cells.map((c) => c[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const w = Math.max(...xs) - x + 1;
    const h = Math.max(...ys) - y + 1;
    if (w > 2 || h > 2 || w * h !== cells.length) {
      throw new Error(`Level "${name}": ${what} cells must form a 1x1, 2x1, 1x2 or 2x2 block`);
    }
    return { x, y, w, h };
  }

  function parseLevel(def) {
    const width = Math.max(...def.map.map((r) => r.length));
    const tiles = def.map.map((r) => r.padEnd(width, '.').split(''));
    const starts = [];
    const goals = [];
    tiles.forEach((row, y) =>
      row.forEach((t, x) => {
        if (t === 'S') starts.push([x, y]);
        if (t === 'G') goals.push([x, y]);
      })
    );
    return {
      name: def.name,
      hint: def.hint || '',
      width,
      height: tiles.length,
      tiles,
      map: def.map.slice(),
      start: boundsOf(starts, 'start', def.name),
      goal: boundsOf(goals, 'goal', def.name),
    };
  }

  function initialState(level) {
    const { x, y, w, h } = level.start;
    return { x, y, w, h, open: false };
  }

  // Effective tile at (x, y), taking the bridge state into account.
  function tileAt(level, open, x, y) {
    if (y < 0 || y >= level.height || x < 0 || x >= level.width) return '.';
    const t = level.tiles[y][x];
    if (t === '=') return open ? '#' : '.';
    if (t === '+') return open ? '.' : '#';
    return t;
  }

  function cellsOf(s) {
    const cells = [];
    for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) cells.push([s.x + dx, s.y + dy]);
    return cells;
  }

  function isBig(s) {
    return s.w === 2 && s.h === 2;
  }

  // Where the block lands when it rolls over its edge (ignoring the board).
  function roll(s, dir) {
    let { x, y, w, h } = s;
    if (dir === 'right') { x += w; w = 3 - w; }
    else if (dir === 'left') { w = 3 - w; x -= w; }
    else if (dir === 'down') { y += h; h = 3 - h; }
    else if (dir === 'up') { h = 3 - h; y -= h; }
    else throw new Error('Unknown direction ' + dir);
    return { x, y, w, h, open: s.open };
  }

  // Where the block ends up when it bumps into a wall on side `dir`: it changes shape in
  // place, staying pressed against that side.
  function bump(s, dir) {
    let { x, y, w, h } = s;
    if (dir === 'right') { if (w === 1) { x -= 1; w = 2; } else { x += 1; w = 1; } }
    else if (dir === 'left') { w = 3 - w; }
    else if (dir === 'down') { if (h === 1) { y -= 1; h = 2; } else { y += 1; h = 1; } }
    else if (dir === 'up') { h = 3 - h; }
    else throw new Error('Unknown direction ' + dir);
    return { x, y, w, h, open: s.open };
  }

  function hitsWall(level, s) {
    return cellsOf(s).some(([cx, cy]) => tileAt(level, s.open, cx, cy) === 'X');
  }

  // Cells under the block that can't hold it (void, glass under the big square, wrong shape tile).
  function badCells(level, s, open) {
    return cellsOf(s).filter(([cx, cy]) => {
      const t = tileAt(level, open, cx, cy);
      if (t === '.') return true;
      if (t === '!') return isBig(s);
      const shape = SHAPE_TILES[t];
      return shape ? shape[0] !== s.w || shape[1] !== s.h : false;
    });
  }

  // Returns { state, outcome: 'ok' | 'fall' | 'win' | 'blocked', bumped, toggled, broke }.
  // 'blocked' means nothing happened (the block is wedged between walls).
  // `broke` lists the tiles that gave way (glass or shape tiles) when the block fell.
  function move(level, s, dir) {
    let n = roll(s, dir);
    let bumped = false;
    if (hitsWall(level, n)) {
      n = bump(s, dir);
      bumped = true;
      if (hitsWall(level, n)) return { state: s, outcome: 'blocked', bumped, toggled: false, broke: [] };
    }
    const bad = badCells(level, n, s.open);
    if (bad.length) {
      const broke = bad.filter(([cx, cy]) => tileAt(level, s.open, cx, cy) !== '.');
      return { state: n, outcome: 'fall', bumped, toggled: false, broke };
    }

    const g = level.goal;
    if (g && n.x === g.x && n.y === g.y && n.w === g.w && n.h === g.h) {
      return { state: n, outcome: 'win', bumped, toggled: false, broke: [] };
    }

    const tiles = cellsOf(n).map(([cx, cy]) => tileAt(level, s.open, cx, cy));
    const toggled = tiles.includes('o') || (isBig(n) && tiles.includes('O'));
    if (toggled) {
      n.open = !n.open;
      // A bridge may vanish under the block itself.
      if (badCells(level, n, n.open).length) return { state: n, outcome: 'fall', bumped, toggled, broke: [] };
    }
    return { state: n, outcome: 'ok', bumped, toggled, broke: [] };
  }

  const dead = (r) => r.outcome === 'fall' || r.outcome === 'blocked';

  function stateKey(s) {
    return `${s.x},${s.y},${s.w},${s.h},${s.open ? 1 : 0}`;
  }

  // Breadth-first search for the shortest solution. Returns an array of directions or null.
  function solve(level, from) {
    const start = from || initialState(level);
    const seen = new Map([[stateKey(start), null]]);
    let frontier = [start];
    while (frontier.length) {
      const next = [];
      for (const s of frontier) {
        for (const dir of Object.keys(DIRS)) {
          const r = move(level, s, dir);
          if (dead(r)) continue;
          const key = stateKey(r.state);
          if (seen.has(key)) continue;
          seen.set(key, { prev: stateKey(s), dir });
          if (r.outcome === 'win') {
            const path = [];
            for (let k = key; seen.get(k); k = seen.get(k).prev) path.unshift(seen.get(k).dir);
            return path;
          }
          next.push(r.state);
        }
      }
      frontier = next;
    }
    return null;
  }

  // Breadth-first exploration of every reachable state (ignoring the goal).
  // Returns Map(stateKey -> { state, dist }).
  function explore(level) {
    const free = { ...level, goal: null };
    const start = initialState(level);
    const seen = new Map([[stateKey(start), { state: start, dist: 0 }]]);
    let frontier = [start];
    let dist = 0;
    while (frontier.length) {
      dist++;
      const next = [];
      for (const s of frontier) {
        for (const dir of Object.keys(DIRS)) {
          const r = move(free, s, dir);
          if (dead(r)) continue;
          const key = stateKey(r.state);
          if (seen.has(key)) continue;
          seen.set(key, { state: r.state, dist });
          next.push(r.state);
        }
      }
      frontier = next;
    }
    return seen;
  }

  // Fewest wall bumps any solution needs (0-1 breadth-first search). A level that needs no
  // bumps can be solved by just rolling along a route: it is a path, not a puzzle.
  // Returns null if the level is unsolvable.
  function minBumps(level) {
    const start = initialState(level);
    const best = new Map([[stateKey(start), 0]]);
    const deque = [[start, 0]];
    while (deque.length) {
      const [s, b] = deque.shift();
      if (s.won) return b;
      if (best.get(stateKey(s)) < b) continue;
      for (const dir of Object.keys(DIRS)) {
        const r = move(level, s, dir);
        if (dead(r)) continue;
        const nb = b + (r.bumped ? 1 : 0);
        const next = r.outcome === 'win' ? { ...r.state, won: true } : r.state;
        const key = r.outcome === 'win' ? 'win' : stateKey(r.state);
        if (best.has(key) && best.get(key) <= nb) continue;
        best.set(key, nb);
        if (r.bumped) deque.push([next, nb]);
        else deque.unshift([next, nb]);
      }
    }
    return null;
  }

  const api = { DIRS, SHAPE_TILES, parseLevel, initialState, tileAt, cellsOf, isBig, roll, bump, move, solve, explore, minBumps, stateKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
