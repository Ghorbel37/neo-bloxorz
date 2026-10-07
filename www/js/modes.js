// Game-mode rules, kept free of DOM code so they can be unit tested.
(function (root) {
  const Generator = root.Generator || require('./generator.js');

  // ---------- Campaign ----------
  function starsFor(moves, par) {
    if (moves <= par) return 3;
    if (moves <= Math.ceil(par * 1.5)) return 2;
    return 1;
  }

  // ---------- Precision: campaign levels with a strict move limit ----------
  function precisionLimit(par) {
    return par + Math.max(2, Math.ceil(par * 0.1));
  }

  // ---------- Descent: roguelike run ----------
  const PERKS = {
    heart: { name: 'Extra Heart', icon: '♥', text: '+1 heart (max 5).' },
    undo: { name: 'Rewind', icon: '↶', text: '+3 undo charges.' },
    stamina: { name: 'Stamina', icon: '⚡', text: '+3 moves on every floor.' },
    ghost: { name: 'Ghost', icon: '👻', text: 'Your next fall rewinds one move instead of costing a heart.' },
    compass: { name: 'Compass', icon: '🧭', text: '+2 hints. A hint shows the best next move.' },
    skip: { name: 'Warp', icon: '⤼', text: 'Skip one floor whenever you like.' },
  };
  const MAX_HEARTS = 5;

  function createRun(seed) {
    return {
      seed: seed >>> 0,
      depth: 1,
      hearts: 3,
      undos: 1,
      hints: 1,
      stamina: 0,
      ghosts: 0,
      skips: 0,
      sparks: 0, // score: leftover moves banked across floors
      over: false,
    };
  }

  function runFloorSeed(run, depth) {
    return Generator.hashString(`${run.seed}:${depth || run.depth}`);
  }

  function runFloor(run) {
    return Generator.generateForDepth(run.depth, runFloorSeed(run));
  }

  function runBudget(run, par) {
    return par + Math.max(3, 10 - Math.floor(run.depth / 2)) + run.stamina;
  }

  // Called when the block falls or the move budget runs out.
  // Returns 'rewind' (ghost used, undo the fatal move), 'retry' or 'dead'.
  function runFail(run, kind) {
    if (kind === 'fall' && run.ghosts > 0) {
      run.ghosts--;
      return 'rewind';
    }
    run.hearts--;
    if (run.hearts <= 0) {
      run.over = true;
      return 'dead';
    }
    return 'retry';
  }

  // Called when a floor is cleared. Returns the perks offered for the next floor.
  function runClear(run, movesUsed, budget) {
    run.sparks += Math.max(0, budget - movesUsed) + run.depth;
    run.depth++;
    return perkChoices(run);
  }

  function perkChoices(run) {
    const rng = Generator.mulberry32(runFloorSeed(run, run.depth) ^ 0x9e3779b9);
    const pool = Object.keys(PERKS).filter((k) => !(k === 'heart' && run.hearts >= MAX_HEARTS));
    const out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return out;
  }

  function applyPerk(run, perk) {
    if (perk === 'heart') run.hearts = Math.min(MAX_HEARTS, run.hearts + 1);
    else if (perk === 'undo') run.undos += 3;
    else if (perk === 'stamina') run.stamina += 3;
    else if (perk === 'ghost') run.ghosts++;
    else if (perk === 'compass') run.hints += 2;
    else if (perk === 'skip') run.skips++;
    else throw new Error('Unknown perk ' + perk);
  }

  // One second chance per run (offered for watching a rewarded ad): back to 1 heart.
  function canRevive(run) {
    return run.over && !run.revived;
  }
  function runRevive(run) {
    if (!canRevive(run)) return false;
    run.revived = true;
    run.over = false;
    run.hearts = 1;
    return true;
  }

  function runSkip(run) {
    if (run.skips <= 0) return false;
    run.skips--;
    run.depth++;
    return true;
  }

  // ---------- Rush: time attack ----------
  const RUSH_START_SECONDS = 90;
  const RUSH_EXTRA_SECONDS = 30; // one rewarded "more time" per session
  function rushBonus(depth, moves, par) {
    return 10 + Math.min(15, depth * 2) + (moves <= par ? 5 : 0);
  }
  function rushDepthFor(solved) {
    return 1 + Math.floor(solved * 0.75);
  }
  function rushFloor(seed, solved) {
    return Generator.generateForDepth(rushDepthFor(solved), Generator.hashString(`rush:${seed}:${solved}`));
  }

  // ---------- Daily puzzle ----------
  function dateKey(date) {
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function dailyFloor(key) {
    return Generator.generateForDepth(9, Generator.hashString(`daily:${key}`));
  }
  // Consecutive days solved, ending today (or yesterday if today is not solved yet).
  function dailyStreak(solvedKeys, today) {
    const set = new Set(solvedKeys);
    const d = new Date(today || new Date());
    if (!set.has(dateKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (set.has(dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  const api = {
    starsFor, precisionLimit,
    PERKS, MAX_HEARTS, createRun, runFloor, runFloorSeed, runBudget, runFail, runClear, perkChoices, applyPerk, runSkip, canRevive, runRevive,
    RUSH_START_SECONDS, RUSH_EXTRA_SECONDS, rushBonus, rushDepthFor, rushFloor,
    dateKey, dailyFloor, dailyStreak,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Modes = api;
})(typeof window !== 'undefined' ? window : globalThis);
