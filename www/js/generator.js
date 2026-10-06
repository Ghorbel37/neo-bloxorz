// Procedural level generator. Levels are built on the slot grid (see engine.js),
// explored with a breadth-first search, and the goal is placed on the reachable
// slot that is furthest from the start, so every generated level is solvable.
(function (root) {
  const Engine = root.Engine || require('./engine.js');

  // Small, fast, seedable PRNG.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // Difficulty settings for a given depth (1, 2, 3...).
  function settingsFor(depth) {
    const d = Math.max(1, depth);
    return {
      cols: Math.min(9, 5 + 2 * Math.floor((d - 1) / 4)),
      rows: Math.min(13, 7 + 2 * Math.floor((d - 1) / 3)),
      loops: 1 + Math.floor(d / 3),
      bigs: Math.min(4, Math.floor(d / 2)),
      glass: d >= 3 ? Math.min(0.35, 0.08 + d * 0.02) : 0,
      bridges: d >= 4 ? Math.min(3, 1 + Math.floor((d - 4) / 4)) : 0,
      heavy: d >= 8,
      minPar: Math.min(40, 8 + d * 2),
    };
  }

  function generate(seed, opts) {
    const rng = mulberry32(seed);
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    let best = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const cand = attemptGenerate(rng, pick, opts);
      if (!cand) continue;
      if (!best || cand.par > best.par) best = cand;
      if (best.par >= opts.minPar) break;
    }
    return best;
  }

  function attemptGenerate(rng, pick, o) {
    const { cols, rows } = o;
    // g[r][c], r counted from the bottom.
    const g = Array.from({ length: rows }, () => Array(cols).fill('.'));
    const inside = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;

    // 1. Perfect maze between "rooms" on even/even slots.
    const stack = [[0, 0]];
    g[0][0] = '#';
    while (stack.length) {
      const [c, r] = stack[stack.length - 1];
      const options = NEIGHBORS
        .map(([dc, dr]) => [c + dc * 2, r + dr * 2, c + dc, r + dr])
        .filter(([nc, nr]) => inside(nc, nr) && g[nr][nc] === '.');
      if (!options.length) { stack.pop(); continue; }
      const [nc, nr, mc, mr] = pick(options);
      g[mr][mc] = '#';
      g[nr][nc] = '#';
      stack.push([nc, nr]);
    }

    // 2. Extra openings make loops; big squares (odd/odd) only appear this way.
    const voids = () => {
      const out = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (g[r][c] === '.') out.push([c, r]);
      return out;
    };
    for (let i = 0; i < o.loops; i++) {
      const v = voids().filter(([c, r]) => (c % 2) + (r % 2) === 1);
      if (v.length) { const [c, r] = pick(v); g[r][c] = '#'; }
    }
    for (let i = 0; i < o.bigs; i++) {
      const v = voids().filter(([c, r]) => c % 2 === 1 && r % 2 === 1);
      if (v.length) { const [c, r] = pick(v); g[r][c] = '#'; }
    }

    const floors = () => {
      const out = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (g[r][c] === '#' && (c || r)) out.push([c, r]);
      return out;
    };

    // 3. Glass.
    for (const [c, r] of floors()) if (rng() < o.glass) g[r][c] = '!';

    // 4. Bridges and switches.
    if (o.bridges) {
      const f = floors().filter(([c, r]) => (c % 2) + (r % 2) === 1);
      for (let i = 0; i < o.bridges && f.length; i++) {
        const [c, r] = f.splice(Math.floor(rng() * f.length), 1)[0];
        g[r][c] = rng() < 0.7 ? '=' : '+';
      }
      const rooms = floors();
      const switches = 1 + (rng() < 0.3 ? 1 : 0);
      for (let i = 0; i < switches && rooms.length; i++) {
        const [c, r] = rooms.splice(Math.floor(rng() * rooms.length), 1)[0];
        g[r][c] = o.heavy && c % 2 === 1 && r % 2 === 1 && rng() < 0.6 ? 'O' : 'o';
      }
    }

    g[0][0] = 'S';
    const toMap = () => g.slice().reverse().map((row) => row.join(''));
    const level = Engine.parseLevel({ name: 'gen', map: toMap() });

    // 5. Explore and place the goal on the furthest plain-floor slot.
    const seen = Engine.explore(level);
    const slotOfTile = (tx, ty) => slotIndex(tx, ty, rows, level.height);
    let far = -1;
    let goals = [];
    const visited = new Set();
    for (const { state, dist } of seen.values()) {
      for (const [tx, ty] of Engine.cellsOf(state)) visited.add(slotOfTile(tx, ty).join(','));
      const [c, r] = slotOfTile(state.x, state.y);
      if (g[r][c] !== '#') continue;
      if (dist > far) { far = dist; goals = [[c, r]]; }
      else if (dist === far) goals.push([c, r]);
    }
    if (far < 1) return null;
    const [gc, gr] = pick(goals);
    g[gr][gc] = 'G';

    // 6. Prune what can never be reached (glass next to the path stays as a trap).
    const isVisited = (c, r) => visited.has(`${c},${r}`);
    let bridgeUsed = false;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const t = g[r][c];
      if (t === '.' || isVisited(c, r)) {
        if ((t === '=' || t === '+') && isVisited(c, r)) bridgeUsed = true;
        continue;
      }
      if (t === '!' && NEIGHBORS.some(([dc, dr]) => inside(c + dc, r + dr) && isVisited(c + dc, r + dr))) continue;
      if (t === '=' || t === '+') {
        // A bridge that is never crossed but still blocks or opens nothing: drop it.
        g[r][c] = '.';
        continue;
      }
      g[r][c] = '.';
    }
    if (!bridgeUsed) {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (g[r][c] === 'o' || g[r][c] === 'O') g[r][c] = '#';
    }

    const map = trimMap(toMap());
    const final = Engine.parseLevel({ name: 'gen', map });
    const path = Engine.solve(final);
    if (!path) return null;
    return { map, par: path.length, solution: path };
  }

  // Tile coordinates -> [slot column, slot row from the bottom].
  function slotIndex(tx, ty, rows, height) {
    const fromBottom = height - 1 - ty;
    return [tileToSlot(tx), tileToSlot(fromBottom)];
  }
  function tileToSlot(t) {
    // Slots are 1,2,1,2... tiles wide: every 3 tiles hold 2 slots.
    return Math.floor(t / 3) * 2 + (t % 3 === 0 ? 0 : 1);
  }

  // Drop empty rows at the top and empty columns at the right (bottom-left is fixed).
  // Only pairs are dropped so the slot parity stays anchored at the start.
  function trimMap(map) {
    let rowsArr = map.slice();
    while (rowsArr.length > 2 && /^\.*$/.test(rowsArr[0]) && /^\.*$/.test(rowsArr[1])) rowsArr = rowsArr.slice(2);
    let width = Math.max(...rowsArr.map((r) => r.length));
    while (width > 2 && rowsArr.every((r) => /^\.*$/.test(r.slice(width - 2, width)))) width -= 2;
    return rowsArr.map((r) => r.slice(0, width));
  }

  function generateForDepth(depth, seed) {
    const s = settingsFor(depth);
    return { ...generate(seed, s), depth };
  }

  const api = { mulberry32, hashString, settingsFor, generate, generateForDepth, tileToSlot, trimMap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Generator = api;
})(typeof window !== 'undefined' ? window : globalThis);
