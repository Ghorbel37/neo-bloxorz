// Core rules of Neo Bloxorz, shared by the game (browser) and the solver (node).
//
// The block is a rectangle of width w and height h, each 1 or 2:
//   1x1 small square, 2x1 horizontal rectangle, 1x2 vertical rectangle, 2x2 big square.
// Moving left/right rolls the block over its side and toggles its width.
// Moving up/down rolls the block over its side and toggles its height.
//
// Tiles:
//   .  void            #  floor          S  start (floor)    G  goal (floor)
//   !  glass: breaks under the big square
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

  function boundsOf(cells, what, name) {
    if (!cells.length) throw new Error(`Level "${name}" has no ${what} cells`);
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

  // Levels are drawn on a grid of slots. Because every move toggles the shape, the
  // block's shape is fixed by the slot it is in: counting from the bottom-left slot,
  // even columns are 1 tile wide and odd columns 2 tiles wide; same for rows from the bottom.
  function slotSize(i) {
    return i % 2 === 0 ? 1 : 2;
  }

  // Expands a slot map into a tile map. Only the bottom-left tile of an S slot is the start.
  function expandSlots(slots) {
    const cols = Math.max(...slots.map((r) => r.length));
    const rows = slots.length;
    const tiles = [];
    for (let r = rows - 1; r >= 0; r--) {
      const fromBottom = rows - 1 - r;
      const line = [];
      for (let c = 0; c < cols; c++) {
        const t = slots[r][c] || '.';
        for (let k = 0; k < slotSize(c); k++) line.push(t);
      }
      for (let k = 0; k < slotSize(fromBottom); k++) tiles.unshift(line.slice());
    }
    return tiles;
  }

  function parseLevel(def) {
    const tiles = expandSlots(def.map);
    const width = tiles[0].length;
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
      slots: def.map.map((r) => r.padEnd(Math.max(...def.map.map((q) => q.length)), '.')),
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

  // Returns { state, outcome: 'ok' | 'fall' | 'win', toggled, broke: [[x,y]...] }
  function move(level, s, dir) {
    let { x, y, w, h } = s;
    if (dir === 'right') { x += w; w = 3 - w; }
    else if (dir === 'left') { w = 3 - w; x -= w; }
    else if (dir === 'down') { y += h; h = 3 - h; }
    else if (dir === 'up') { h = 3 - h; y -= h; }
    else throw new Error('Unknown direction ' + dir);

    const n = { x, y, w, h, open: s.open };
    const cells = cellsOf(n);
    const tiles = cells.map(([cx, cy]) => tileAt(level, s.open, cx, cy));

    if (tiles.includes('.')) return { state: n, outcome: 'fall', toggled: false, broke: [] };
    if (isBig(n)) {
      const broke = cells.filter((_, i) => tiles[i] === '!');
      if (broke.length) return { state: n, outcome: 'fall', toggled: false, broke };
    }

    const g = level.goal;
    if (n.x === g.x && n.y === g.y && n.w === g.w && n.h === g.h) {
      return { state: n, outcome: 'win', toggled: false, broke: [] };
    }

    const toggled = tiles.includes('o') || (isBig(n) && tiles.includes('O'));
    if (toggled) {
      n.open = !n.open;
      // A bridge may vanish under the block itself.
      if (cells.some(([cx, cy]) => tileAt(level, n.open, cx, cy) === '.')) {
        return { state: n, outcome: 'fall', toggled, broke: [] };
      }
    }
    return { state: n, outcome: 'ok', toggled, broke: [] };
  }

  function stateKey(s) {
    return `${s.x},${s.y},${s.w},${s.h},${s.open ? 1 : 0}`;
  }

  // Breadth-first search for the shortest solution. Returns an array of directions or null.
  function solve(level) {
    const start = initialState(level);
    const seen = new Map([[stateKey(start), null]]);
    let frontier = [start];
    while (frontier.length) {
      const next = [];
      for (const s of frontier) {
        for (const dir of Object.keys(DIRS)) {
          const r = move(level, s, dir);
          if (r.outcome === 'fall') continue;
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

  const api = { DIRS, slotSize, expandSlots, parseLevel, initialState, tileAt, cellsOf, isBig, move, solve, stateKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(this);
