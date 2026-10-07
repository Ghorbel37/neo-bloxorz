#!/usr/bin/env node
// Searches generator seeds for campaign levels and prints them so they can be frozen
// into www/js/levels.js. For each slot it keeps the candidate that needs the most bumps
// (within the slot's targets) while looking closest to the start on a compact board,
// and, for worlds 2-4, only levels where the world's mechanic changes the solution.
const Engine = require('../www/js/engine.js');
const G = require('../www/js/generator.js');

const parse = (map) => Engine.parseLevel({ name: 'x', map });
const stats = (map) => {
  const l = parse(map);
  const p = Engine.solve(l);
  return p ? { par: p.length, bumps: Engine.minBumps(l), solution: p } : null;
};
const replaced = (map, re) => map.map((r) => r.replace(re, '#'));
function mechanicMatters(world, map, s) {
  if (world === 1) return true;
  if (world === 2) {
    if (!/!/.test(map.join(''))) return false;
    const plain = stats(replaced(map, /!/g));
    return plain && (plain.par < s.par || plain.bumps < s.bumps);
  }
  if (world === 3) {
    if (!/[abcd]/.test(map.join(''))) return false;
    const plain = stats(replaced(map, /[abcd]/g));
    return plain && (plain.par < s.par || plain.bumps < s.bumps);
  }
  // world 4: the solution must flip switches.
  const l = parse(map);
  let st = Engine.initialState(l);
  let toggles = 0;
  for (const d of s.solution) { const r = Engine.move(l, st, d); if (r.toggled) toggles++; st = r.state; }
  return toggles >= 1;
}

// [world, count, settings(i), bumps range(i), par range(i)]
const PLAN = [
  [1, 7, (i) => ({ w: 4 + Math.floor(i / 3), h: 4 + Math.floor(i / 2), holes: 0.08 + i * 0.015, walls: 0.12, glass: 0, shapes: 0, bridges: 0, heavy: false }), (i) => [1 + Math.floor(i / 2), 1 + Math.floor(i / 2)], (i) => [4 + i, 8 + i * 2]],
  [2, 8, (i) => ({ w: 5 + Math.floor(i / 3), h: 6 + Math.floor(i / 3), holes: 0.12, walls: 0.12, glass: 0.18, shapes: 0, bridges: 0, heavy: false }), (i) => [2 + Math.floor(i / 2), 3 + Math.floor(i / 2)], (i) => [8 + i, 16 + i * 2]],
  [3, 8, (i) => ({ w: 5 + Math.floor(i / 3), h: 6 + Math.floor(i / 3), holes: 0.12, walls: 0.12, glass: 0.06, shapes: 2 + Math.floor(i / 3), bridges: 0, heavy: false }), (i) => [2 + Math.floor(i / 2), 3 + Math.floor(i / 2)], (i) => [10 + i, 18 + i * 2]],
  [4, 7, (i) => ({ w: 6 + Math.floor(i / 3), h: 7 + Math.floor(i / 3), holes: 0.16, walls: 0.12, glass: 0.06, shapes: i >= 4 ? 1 : 0, bridges: 1 + Math.floor(i / 3), heavy: i >= 4 }), (i) => [3 + Math.floor(i / 2), 4 + Math.floor(i / 2)], (i) => [12 + i, 22 + i * 2]],
];

const out = [];
for (const [world, count, settings, bumpRange, parRange] of PLAN) {
  for (let i = 0; i < count; i++) {
    const [bLo, bHi] = bumpRange(i);
    const [pLo, pHi] = parRange(i);
    const o = { ...settings(i), minBumps: bLo, minPar: pLo, maxPar: pHi };
    let best = null;
    for (let seed = 1; seed <= 400; seed++) {
      const l = G.generate(world * 1e6 + i * 1e4 + seed, o);
      if (!l || l.bumps < bLo || l.bumps > bHi || l.par < pLo || l.par > pHi) continue;
      if (!mechanicMatters(world, l.map, l)) continue;
      const area = l.map.length * l.map[0].length;
      const score = l.bumps * 3 - l.near * 0.6 - area / 6 + (l.par <= pHi ? 0 : -10);
      if (!best || score > best.score) best = { ...l, seed, score };
    }
    if (!best) { console.error(`no level for world ${world} #${i + 1}`); continue; }
    out.push({ world, par: best.par, bumps: best.bumps, map: best.map });
    console.error(`world ${world} #${i + 1}: par ${best.par}, bumps ${best.bumps}, near ${best.near}`);
  }
}
console.log(JSON.stringify(out));
