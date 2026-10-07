// Procedural puzzle generator.
//
// A random compact board is built (holes, walls, glass, shape tiles, switches and bridges),
// every reachable state is explored, and the goal is placed on a reachable spot. What makes
// a level a puzzle rather than a path is how many wall bumps it takes to get into the
// right rhythm for the goal (Engine.minBumps), so goals are chosen to need several bumps,
// preferably while looking close to the start.
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

  // Difficulty settings for a given depth (1, 2, 3...).
  function settingsFor(depth) {
    const d = Math.max(1, depth);
    return {
      w: Math.min(8, 5 + Math.floor(d / 3)),
      h: Math.min(10, 6 + Math.floor(d / 2)),
      holes: Math.min(0.22, 0.12 + d * 0.01),
      walls: Math.min(0.16, 0.1 + d * 0.005),
      glass: d >= 3 ? Math.min(0.12, 0.04 + d * 0.01) : 0,
      shapes: d >= 5 ? Math.min(3, 1 + Math.floor((d - 5) / 4)) : 0,
      bridges: d >= 7 ? Math.min(3, 1 + Math.floor((d - 7) / 5)) : 0,
      heavy: d >= 10,
      minBumps: Math.min(6, 1 + Math.floor(d / 2)),
      minPar: Math.min(30, 6 + d * 2),
      maxPar: Math.min(48, 16 + d * 3),
    };
  }

  function generate(seed, opts) {
    const rng = mulberry32(seed);
    let best = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      const cand = attemptGenerate(rng, opts);
      if (!cand) continue;
      const good = cand.bumps >= opts.minBumps && cand.par >= opts.minPar && cand.par <= opts.maxPar;
      cand.score = (good ? 1000 : 0) + Math.min(cand.bumps, opts.minBumps) * 20 + Math.min(cand.par, opts.maxPar) - cand.near;
      if (!best || cand.score > best.score) best = cand;
      if (good) break;
    }
    if (best) { delete best.score; return best; }
    return null;
  }

  // Last resort if a seed produces nothing even with easier settings: a fixed puzzle that
  // is checked by the tests. In practice this is never reached.
  const FALLBACK_MAP = ['##X###', '######', '#X##X#', '######', 'SG##X#'];
  function fallbackLevel() {
    const level = Engine.parseLevel({ name: 'fallback', map: FALLBACK_MAP });
    const solution = Engine.solve(level);
    return { map: FALLBACK_MAP.slice(), par: solution.length, solution, bumps: Engine.minBumps(level), near: 1, fallback: true };
  }

  // Always returns a solvable level: tries the wanted settings, then up to three easier
  // versions of them, then the fixed fallback puzzle.
  function generateSafe(seed, opts) {
    let o = opts;
    for (let tries = 0; tries < 4; tries++) {
      const l = generate(seed + tries * 7919, o);
      if (l) return l;
      o = { ...o, holes: o.holes * 0.6, minPar: Math.max(4, o.minPar - 6), minBumps: Math.max(1, o.minBumps - 1) };
    }
    return fallbackLevel();
  }

  function attemptGenerate(rng, o) {
    const W = o.w;
    const H = o.h;
    const g = Array.from({ length: H }, () => Array(W).fill('#'));
    const startX = 0;
    const startY = H - 1;
    const isStart = (x, y) => x === startX && y === startY;
    const pickFrom = (arr) => arr.splice(Math.floor(rng() * arr.length), 1)[0];
    const cellsWhere = (pred) => {
      const out = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (pred(g[y][x], x, y)) out.push([x, y]);
      return out;
    };
    const plain = () => cellsWhere((t, x, y) => t === '#' && !isStart(x, y));

    let f = plain();
    for (let i = Math.round(W * H * o.holes); i > 0 && f.length; i--) { const [x, y] = pickFrom(f); g[y][x] = '.'; }
    f = plain();
    for (let i = Math.round(W * H * o.walls); i > 0 && f.length; i--) { const [x, y] = pickFrom(f); g[y][x] = 'X'; }
    for (const [x, y] of plain()) if (rng() < o.glass) g[y][x] = '!';
    f = plain();
    for (let i = 0; i < o.shapes && f.length; i++) { const [x, y] = pickFrom(f); g[y][x] = 'abcd'[Math.floor(rng() * 4)]; }
    if (o.bridges) {
      const voids = cellsWhere((t) => t === '.');
      for (let i = 0; i < o.bridges && voids.length; i++) { const [x, y] = pickFrom(voids); g[y][x] = rng() < 0.7 ? '=' : '+'; }
      f = plain();
      const switches = 1 + (rng() < 0.3 ? 1 : 0);
      for (let i = 0; i < switches && f.length; i++) { const [x, y] = pickFrom(f); g[y][x] = o.heavy && rng() < 0.5 ? 'O' : 'o'; }
    }
    g[startY][startX] = 'S';

    const toMap = () => g.map((row) => row.join(''));
    const level = Engine.parseLevel({ name: 'gen', map: toMap() });
    const seen = Engine.explore(level);

    const visited = new Set();
    let all = [];
    for (const { state, dist } of seen.values()) {
      const cells = Engine.cellsOf(state);
      cells.forEach(([x, y]) => visited.add(`${x},${y}`));
      if (dist >= 4 && cells.every(([x, y]) => g[y][x] === '#')) all.push({ state, dist });
    }
    if (!all.length) return null;
    let cands = all.filter((c) => c.dist >= o.minPar && c.dist <= o.maxPar);
    if (!cands.length) cands = all.sort((a, b) => b.dist - a.dist).slice(0, 12);

    // Tidy the board: tiles the block can never touch become void. That never changes the
    // puzzle (any move onto them falls anyway), except for walls, which matter whenever a
    // roll would hit them, even two tiles away. So walls that some reachable position can
    // bump stay, and so do walls and traps next to reachable tiles (they show what to avoid).
    const usedWalls = new Set();
    for (const { state } of seen.values()) {
      for (const dir of Object.keys(Engine.DIRS)) {
        for (const [x, y] of Engine.cellsOf(Engine.roll(state, dir))) {
          if (g[y] && g[y][x] === 'X') usedWalls.add(`${x},${y}`);
        }
      }
    }
    const touched = (x, y) => visited.has(`${x},${y}`);
    const nearPath = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => touched(x + dx, y + dy));
    let bridgeUsed = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = g[y][x];
      if (t === '.') continue;
      if (touched(x, y)) { if (t === '=' || t === '+') bridgeUsed = true; continue; }
      if (t === 'X' && usedWalls.has(`${x},${y}`)) continue;
      if ((t === 'X' || t === '!' || 'abcd'.includes(t)) && nearPath(x, y)) continue;
      g[y][x] = '.';
    }
    if (!bridgeUsed) for (const [x, y] of cellsWhere((t) => t === 'o' || t === 'O')) g[y][x] = '#';

    // Try a few goals; keep the one needing the most bumps, then looking nearest.
    const near = (c) => Math.abs(c.state.x - startX) + Math.abs(c.state.y + c.state.h - 1 - startY);
    const sample = [];
    for (let i = 0; i < 8 && cands.length; i++) sample.push(pickFrom(cands));
    let best = null;
    for (const c of sample) {
      const { x, y, w, h } = c.state;
      const map = trimMap(toMap().map((row, ry) => row.split('').map((t, rx) => (rx >= x && rx < x + w && ry >= y && ry < y + h ? 'G' : t)).join('')));
      const lvl = Engine.parseLevel({ name: 'gen', map });
      const bumps = Engine.minBumps(lvl);
      if (bumps == null) continue;
      const path = Engine.solve(lvl);
      const cand = { map, par: path.length, solution: path, bumps, near: near(c) };
      if (!best || cand.bumps > best.bumps || (cand.bumps === best.bumps && cand.near < best.near)) best = cand;
    }
    return best;
  }

  // Drop empty rows at the top and empty columns at the right (the start stays bottom-left).
  function trimMap(map) {
    let rows = map.slice();
    while (rows.length > 1 && /^\.*$/.test(rows[0])) rows = rows.slice(1);
    let width = Math.max(...rows.map((r) => r.length));
    while (width > 1 && rows.every((r) => r[width - 1] === '.' || r[width - 1] === undefined)) width--;
    return rows.map((r) => r.slice(0, width));
  }

  function generateForDepth(depth, seed) {
    return { ...generateSafe(seed, settingsFor(depth)), depth };
  }

  const api = { mulberry32, hashString, settingsFor, generate, generateSafe, generateForDepth, fallbackLevel, trimMap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Generator = api;
})(typeof window !== 'undefined' ? window : globalThis);
