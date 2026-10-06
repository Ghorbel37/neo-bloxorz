#!/usr/bin/env node
// Verifies every level parses, starts bottom-left and is solvable; prints the par (shortest solution).
const Engine = require('../www/js/engine.js');
const LEVELS = require('../www/js/levels.js');

let ok = true;
LEVELS.forEach((def, i) => {
  try {
    const level = Engine.parseLevel(def);
    const path = Engine.solve(level);
    if (!path) { ok = false; console.log(`${i + 1}. ${def.name}: UNSOLVABLE`); return; }
    const g = level.goal; console.log(`${i + 1}. ${def.name}: goal ${g.w}x${g.h} par ${path.length}  ${path.map((d) => ({ left: '←', right: '→', up: '↑', down: '↓' })[d]).join('')}`);
  } catch (e) {
    ok = false;
    console.log(`${i + 1}. ${def.name}: ERROR ${e.message}`);
  }
});
process.exit(ok ? 0 : 1);
