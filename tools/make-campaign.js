#!/usr/bin/env node
// Searches generator seeds for campaign levels where the world's mechanic matters,
// and prints them so they can be frozen into www/js/levels.js.
const Engine = require('../www/js/engine.js');
const G = require('../www/js/generator.js');

function glassMatters(map, par) {
  const plain = Engine.solve(Engine.parseLevel({ name: 'x', map: map.map((r) => r.replace(/!/g, '#')) }));
  return plain && plain.length < par;
}
function switchUsed(map, solution) {
  const level = Engine.parseLevel({ name: 'x', map });
  let s = Engine.initialState(level);
  let toggles = 0;
  for (const d of solution) { const r = Engine.move(level, s, d); if (r.toggled) toggles++; s = r.state; }
  return toggles;
}

function search(world, count, settings, accept) {
  const out = [];
  for (let seed = 1; out.length < count && seed < 50000; seed++) {
    const i = out.length;
    const lvl = G.generate(world * 100000 + seed, settings(i));
    if (!lvl || !accept(lvl, i)) continue;
    out.push({ seed, ...lvl });
  }
  return out;
}

const glass = search(2, 10,
  (i) => ({ cols: i < 5 ? 5 : 7, rows: 7 + 2 * Math.floor(i / 3), loops: 2 + Math.floor(i / 2), bigs: 2 + Math.floor(i / 3), glass: 0.25, bridges: 0, heavy: false, minPar: 14 + i * 2 }),
  (l, i) => l.par >= 12 + i * 2 && l.par <= 24 + i * 3 && glassMatters(l.map, l.par));
const circuits = search(3, 10,
  (i) => ({ cols: i < 4 ? 5 : 7, rows: 7 + 2 * Math.floor(i / 3), loops: 2 + Math.floor(i / 3), bigs: 2 + Math.floor(i / 3), glass: i >= 5 ? 0.15 : 0, bridges: 1 + Math.floor(i / 4), heavy: i >= 6, minPar: 14 + i * 2 }),
  (l, i) => l.par >= 14 + i * 2 && l.par <= 26 + i * 3 && switchUsed(l.map, l.solution) >= (i < 3 ? 1 : 2) && (i < 6 || l.map.join('').includes('O')));

for (const [name, list] of [['glass', glass], ['circuits', circuits]]) {
  console.log(`// ${name}`);
  list.forEach((l) => console.log(JSON.stringify({ par: l.par, seed: l.seed, map: l.map })));
}
