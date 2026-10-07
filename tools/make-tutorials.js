#!/usr/bin/env node
// Searches for small, clean boards that introduce one mechanic each (used for the
// tutorial levels in www/js/levels.js). Prints the best candidate per mechanic.
const Engine = require('../www/js/engine.js');
const { mulberry32 } = require('../www/js/generator.js');

const parse = (map) => Engine.parseLevel({ name: 'x', map });
function info(map) {
  const l = parse(map);
  const path = Engine.solve(l);
  if (!path) return null;
  return { par: path.length, bumps: Engine.minBumps(l), path };
}
const count = (map, re) => (map.join('').match(re) || []).length;
const without = (map, re) => info(map.map((r) => r.replace(re, '#')));
// The solution must stand on a bridge tile that a switch opened.
function crossesBridge(map, path) {
  const l = parse(map);
  let s = Engine.initialState(l);
  for (const d of path) {
    s = Engine.move(l, s, d).state;
    if (Engine.cellsOf(s).some(([x, y]) => l.tiles[y][x] === '=')) return true;
  }
  return false;
}

const SPECS = {
  rhythm: { w: [3, 5], h: [2, 3], tiles: { X: 0.2 }, goal: 'small-next-to-start',
    ok: (m, i) => i.bumps === 1 && i.par <= 6 && count(m, /X/g) <= 2 },
  glass: { w: [4, 5], h: [3, 5], tiles: { X: 0.12, '!': 0.3 },
    ok: (m, i) => i.par <= 12 && i.bumps >= 1 && (() => { const p = without(m, /!/g); return p && p.par < i.par; })() },
  shapes: { w: [4, 5], h: [3, 5], tiles: { X: 0.12, a: 0.06, b: 0.06, c: 0.06, d: 0.06 },
    ok: (m, i) => i.par <= 12 && i.bumps >= 1 && count(m, /[abcd]/g) <= 3 && (() => { const p = without(m, /[abcd]/g); return p && p.par < i.par; })() },
  switch: { w: [4, 5], h: [3, 5], tiles: { X: 0.1, o: 0.05, '=': 0.18, '.': 0.08 },
    ok: (m, i) => i.par <= 12 && i.bumps >= 1 && count(m, /o/g) === 1 && crossesBridge(m, i.path) },
  heavy: { w: [4, 5], h: [4, 5], tiles: { X: 0.1, O: 0.06, '=': 0.18, '.': 0.08 },
    ok: (m, i) => i.par <= 14 && i.bumps >= 1 && count(m, /O/g) === 1 && crossesBridge(m, i.path) },
};

function randomMap(rng, spec) {
  const W = spec.w[0] + Math.floor(rng() * (spec.w[1] - spec.w[0] + 1));
  const H = spec.h[0] + Math.floor(rng() * (spec.h[1] - spec.h[0] + 1));
  const g = Array.from({ length: H }, () => Array.from({ length: W }, () => {
    let v = rng();
    for (const [t, p] of Object.entries(spec.tiles)) { if (v < p) return t; v -= p; }
    return '#';
  }));
  g[H - 1][0] = 'S';
  let goal;
  if (spec.goal === 'small-next-to-start') goal = [[1, H - 1]];
  else {
    const gw = 1 + (rng() < 0.4 ? 1 : 0);
    const gh = 1 + (rng() < 0.4 ? 1 : 0);
    const gx = Math.floor(rng() * (W - gw + 1));
    const gy = Math.floor(rng() * (H - gh + 1));
    goal = [];
    for (let y = gy; y < gy + gh; y++) for (let x = gx; x < gx + gw; x++) goal.push([x, y]);
  }
  for (const [x, y] of goal) { if (g[y][x] === 'S') return null; g[y][x] = 'G'; }
  return g.map((r) => r.join(''));
}

for (const [name, spec] of Object.entries(SPECS)) {
  const rng = mulberry32(name.length * 1000 + 7);
  let best = null;
  for (let i = 0; i < 60000; i++) {
    const m = randomMap(rng, spec);
    if (!m) continue;
    const inf = info(m);
    if (!inf || !spec.ok(m, inf)) continue;
    const area = m.length * m[0].length;
    const clutter = count(m, /[^#SG]/g);
    const score = area + clutter * 2 + inf.par * 0.5;
    if (!best || score < best.score) best = { map: m, ...inf, score };
  }
  if (!best) { console.log(name, 'none'); continue; }
  console.log(`${name}: par ${best.par} bumps ${best.bumps} ${best.path.join(',')}`);
  console.log(best.map.map((r) => '  ' + r).join('\n'));
}
