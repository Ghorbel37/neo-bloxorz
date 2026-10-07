(function () {
  const { parseLevel, initialState, tileAt, move, solve } = Engine;
  const $ = (id) => document.getElementById(id);
  const css = getComputedStyle(document.documentElement);
  const SHAPE_COLORS = ['--shape0', '--shape1', '--shape2', '--shape3'].map((v) => css.getPropertyValue(v).trim());
  const shapeIndex = (w, h) => (w - 1) + (h - 1) * 2;

  // ---------- Storage ----------
  const STORE_KEY = 'neo-bloxorz-v1';
  const STORE_VERSION = 3;
  // 1.1 (store version 2) saved campaign progress by level number, in this order.
  const V2_LEVEL_NAMES = ['The Sketch', 'Bump', 'Wrong Foot', 'Sidestep', 'Off Beat', 'Backspin', 'Double Take', 'Rebound',
    'Ricochet', 'Thin Ice', 'Hairline', 'Cold Feet', 'Shards', 'Crackle', 'Frozen Lake', 'Splinter', 'Hall of Glass',
    'Fitting In', 'Square Peg', 'Shape Shift', 'Keyhole', 'Mold', 'Silhouette', 'Jigsaw', 'Morphology', 'Circuit',
    'Live Wire', 'Relay', 'Flip Flop', 'Heavyweight', 'Overload', 'Blackout'];
  const DEFAULTS = {
    version: STORE_VERSION,
    campaign: {}, // level name -> best moves
    hinted: {}, // level name -> true if solved only with hints
    precision: {}, // level name -> best moves within the limit
    runBest: 0,
    sparksBest: 0,
    run: null, // saved roguelike run
    rushBest: 0,
    daily: {}, // date -> best moves
    seenIntro: {},
    settings: { sound: true, vibration: true, dpad: true, preview: true },
  };
  let store = load();
  function load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { data = null; }
    const base = JSON.parse(JSON.stringify(DEFAULTS));
    if (!data || typeof data !== 'object') return base;
    const merged = { ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } };
    if (data.version === 2) {
      // 1.1 -> 1.2: progress was keyed by level number; key it by level name instead.
      for (const key of ['campaign', 'hinted', 'precision']) {
        const byName = {};
        for (const [i, v] of Object.entries(merged[key] || {})) if (V2_LEVEL_NAMES[i]) byName[V2_LEVEL_NAMES[i]] = v;
        merged[key] = byName;
      }
      merged.version = STORE_VERSION;
    } else if (data.version !== STORE_VERSION) {
      // 1.0: a different game (no walls). Its level progress and runs no longer apply.
      Object.assign(merged, { campaign: {}, hinted: {}, precision: {}, run: null, daily: {}, version: STORE_VERSION });
      merged.seenIntro = {};
    }
    return merged;
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* storage unavailable */ }
  }

  const campaign = LEVELS.map(parseLevel);
  const lk = (i) => LEVELS[i].name; // progress is saved by level name
  const cleared = (i) => store.campaign[lk(i)] != null;
  const campaignPars = campaign.map((l) => solve(l).length);

  // ---------- Screens ----------
  const SCREENS = ['home', 'levels-screen', 'game'];
  function show(id) {
    SCREENS.forEach((s) => { $(s).hidden = s !== id; });
    if (id === 'game') requestAnimationFrame(resize);
  }

  function vibrate(ms) {
    if (!store.settings.vibration) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not supported */ }
  }

  function toast(text) {
    const t = $('toast');
    t.hidden = true;
    t.textContent = text;
    void t.offsetWidth; // restart the animation
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 1400);
  }

  // ---------- Modal ----------
  let modalOnClose = null;
  function modal({ title, html, buttons, node, onClose }) {
    $('modal-title').textContent = title;
    const body = $('modal-body');
    body.innerHTML = html || '';
    if (node) body.appendChild(node);
    const row = $('modal-buttons');
    row.innerHTML = '';
    (buttons || []).forEach((b) => {
      const el = document.createElement('button');
      el.textContent = b.label;
      if (b.primary) el.classList.add('primary');
      el.addEventListener('click', () => {
        Sound.tap();
        closeModal(true);
        if (b.action) b.action();
      });
      row.appendChild(el);
    });
    modalOnClose = onClose || null;
    $('modal').hidden = false;
  }
  function closeModal(silent) {
    $('modal').hidden = true;
    const cb = modalOnClose;
    modalOnClose = null;
    if (!silent && cb) cb();
  }
  const modalOpen = () => !$('modal').hidden;
  $('modal').addEventListener('click', (e) => {
    if (e.target === $('modal') && modalOnClose) closeModal(false);
  });

  // ---------- Home ----------
  function totalStars() {
    return LEVELS.reduce((n, _, i) => {
      const m = store.campaign[lk(i)];
      if (m == null) return n;
      const s = Modes.starsFor(m, campaignPars[i]);
      return n + (store.hinted[lk(i)] ? Math.min(2, s) : s);
    }, 0);
  }

  function showHome() {
    closeModal(true);
    session = null;
    const done = LEVELS.filter((_, i) => cleared(i)).length;
    const sealed = LEVELS.filter((_, i) => store.precision[lk(i)] != null).length;
    const today = Modes.dateKey();
    const streak = Modes.dailyStreak(Object.keys(store.daily));
    const cards = [
      {
        glyph: '▶', color: 'var(--shape0)', name: 'Campaign',
        desc: `${LEVELS.length} puzzles across ${WORLDS.length} worlds.`,
        meta: `${done}/${LEVELS.length}<br>★ ${totalStars()}`,
        action: () => openLevels('campaign'),
      },
      {
        glyph: '∞', color: 'var(--shape3)', name: 'Descent',
        desc: store.run ? `Run in progress: depth ${store.run.depth}, ${'♥'.repeat(store.run.hearts)}` : 'Roguelike. Endless floors, 3 hearts, perks.',
        meta: store.runBest ? `Best<br>depth ${store.runBest}` : 'New',
        action: startRunFlow,
      },
      {
        glyph: '⏱', color: 'var(--shape1)', name: 'Rush',
        desc: `${Modes.RUSH_START_SECONDS} seconds on the clock. Every solve buys time.`,
        meta: store.rushBest ? `Best<br>${store.rushBest} solved` : 'New',
        action: () => introThen('rush', 'Rush', `You have <b>${Modes.RUSH_START_SECONDS} seconds</b>. Each solved puzzle adds time (more for matching par). Falling costs 3 seconds. Puzzles get harder as you go.`, () => startSession(rushSession())),
      },
      {
        glyph: '☀', color: 'var(--shape2)', name: 'Daily',
        desc: store.daily[today] != null ? `Solved today in ${store.daily[today]} moves.` : 'A fresh puzzle every day.',
        meta: streak ? `🔥 ${streak}` : '',
        action: () => startSession(dailySession()),
      },
      {
        glyph: '◎', color: '#b48bff', name: 'Precision',
        desc: 'Campaign levels with a strict move limit. No undo, no hints.',
        meta: `${sealed}/${LEVELS.length}`,
        action: () => {
          if (!done) {
            modal({ title: 'Precision', html: 'Solve a campaign level first to unlock it here.', buttons: [{ label: 'OK', primary: true }] });
          } else openLevels('precision');
        },
      },
    ];
    const nav = $('modes');
    nav.innerHTML = '';
    cards.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'mode';
      b.innerHTML = `<span class="glyph" style="background:${c.color}">${c.glyph}</span>
        <span class="info"><span class="name">${c.name}</span><br><span class="desc">${c.desc}</span></span>
        <span class="meta">${c.meta}</span>`;
      b.addEventListener('click', () => { Sound.unlock(); Sound.tap(); c.action(); });
      nav.appendChild(b);
    });
    show('home');
  }

  function introThen(key, title, html, start) {
    if (store.seenIntro[key]) return start();
    store.seenIntro[key] = true;
    save();
    modal({ title, html, buttons: [{ label: 'Go!', primary: true, action: start }], onClose: start });
  }

  // ---------- Level select ----------
  let levelsMode = 'campaign';
  function openLevels(mode) {
    levelsMode = mode;
    const precision = mode === 'precision';
    $('levels-title').textContent = precision ? 'Precision' : 'Campaign';
    $('levels-sub').textContent = precision
      ? `${LEVELS.filter((_, i) => store.precision[lk(i)] != null).length}/${LEVELS.length} sealed`
      : `★ ${totalStars()} / ${LEVELS.length * 3}`;
    const wrap = $('levels');
    wrap.innerHTML = '';
    WORLDS.forEach((worldName, w) => {
      const h = document.createElement('div');
      h.className = 'world-title';
      h.textContent = `World ${w + 1} · ${worldName}`;
      wrap.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'world-grid';
      LEVELS.forEach((def, i) => {
        if (def.world !== w + 1) return;
        const best = store.campaign[lk(i)];
        const unlocked = precision ? best != null : i === 0 || cleared(i - 1) || best != null;
        const b = document.createElement('button');
        b.disabled = !unlocked;
        let label = '';
        if (precision) {
          if (store.precision[lk(i)] != null) { b.classList.add('sealed'); label = '◎'; }
          else label = `≤${Modes.precisionLimit(campaignPars[i])}`;
        } else if (best != null) {
          b.classList.add('done');
          const s = Modes.starsFor(best, campaignPars[i]);
          label = '★'.repeat(store.hinted[lk(i)] ? Math.min(2, s) : s);
        }
        b.innerHTML = `<span class="num">${i + 1}</span><span class="lvl-stars">${label}</span>`;
        b.setAttribute('aria-label', `Level ${i + 1}: ${def.name}`);
        b.addEventListener('click', () => { Sound.unlock(); startSession(campaignSession(i, precision)); });
        grid.appendChild(b);
      });
      wrap.appendChild(grid);
    });
    show('levels-screen');
  }

  // ---------- Sessions (one per mode) ----------
  let session = null;

  function startSession(s) {
    closeModal(true);
    session = s;
    play.particles = [];
    show('game');
    $('hint').textContent = s.hintText || '';
    loadLevel(s.level);
  }

  function campaignSession(i, precision) {
    const par = campaignPars[i];
    const limit = Modes.precisionLimit(par);
    let hinted = false;
    const retry = () => startSession(campaignSession(i, precision));
    const next = () => {
      if (precision) {
        const n = LEVELS.findIndex((_, k) => k > i && cleared(k) && store.precision[lk(k)] == null);
        if (n >= 0) startSession(campaignSession(n, true));
        else openLevels('precision');
      } else if (i + 1 < LEVELS.length) startSession(campaignSession(i + 1, false));
      else openLevels('campaign');
    };
    return {
      kind: precision ? 'precision' : 'campaign',
      title: `${i + 1}. ${LEVELS[i].name}`,
      hintText: precision ? `Solve in ${limit} moves or fewer.` : LEVELS[i].hint || '',
      tutorial: precision ? null : LEVELS[i].tutorial || null,
      level: campaign[i],
      limit: precision ? () => limit : null,
      canUndo: () => !precision,
      canHint: () => !precision,
      useHint() { hinted = true; },
      stats() {
        if (precision) return `Moves ${play.moves}/${limit} · Par ${par}`;
        const best = store.campaign[lk(i)];
        return `Moves ${play.moves} · Par ${par}` + (best != null ? ` · Best ${best}` : '');
      },
      chips: () => (precision ? [{ text: `${limit - play.moves} moves left`, warn: limit - play.moves <= 3 }] : []),
      quit: () => openLevels(precision ? 'precision' : 'campaign'),
      onFall() { toast('Fell! Try again'); setTimeout(() => resetLevel(), 250); },
      onOutOfMoves() {
        Sound.lose();
        modal({
          title: 'Out of moves',
          html: `The limit here is <b>${limit}</b> moves. The best solution takes <b>${par}</b>.`,
          buttons: [{ label: 'Levels', action: () => openLevels('precision') }, { label: 'Retry', primary: true, action: retry }],
          onClose: retry,
        });
      },
      onWin(moves) {
        let html;
        if (precision) {
          const prev = store.precision[lk(i)];
          if (prev == null || moves < prev) store.precision[lk(i)] = moves;
          html = `<div class="big-number">◎</div>Sealed in <b>${moves}</b> moves (limit ${limit}, par ${par}).`;
        } else {
          const prev = store.campaign[lk(i)];
          const firstClear = prev == null;
          if (firstClear || moves < prev) store.campaign[lk(i)] = moves;
          if (!hinted) delete store.hinted[lk(i)];
          else if (firstClear || store.hinted[lk(i)]) store.hinted[lk(i)] = true;
          let stars = Modes.starsFor(moves, par);
          if (hinted) stars = Math.min(2, stars);
          html = `<div class="stars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span></div>
            <b>${moves}</b> moves (par ${par})${hinted ? '<br>Hints used: max 2 stars' : ''}
            ${prev != null && moves < prev ? '<br>New best!' : ''}`;
          if (i === LEVELS.length - 1) html += '<br><br>You finished the campaign! Try Descent, Rush and Precision.';
        }
        save();
        modal({
          title: 'Solved!',
          html,
          buttons: [{ label: 'Replay', action: retry }, { label: 'Next', primary: true, action: next }],
          onClose: next,
        });
      },
    };
  }

  function startRunFlow() {
    const intro = 'Dive through endless generated floors. Each floor has a <b>move budget</b>. Falling or running out of moves costs a <b>heart</b>; lose all 3 and the run ends. After each floor, pick a <b>perk</b>.';
    if (store.run) {
      modal({
        title: 'Descent',
        html: `You have a run in progress at <b>depth ${store.run.depth}</b>.`,
        buttons: [
          { label: 'New run', action: () => newRun() },
          { label: 'Continue', primary: true, action: () => startSession(runSession(store.run)) },
        ],
        onClose: () => {},
      });
    } else {
      introThen('run', 'Descent', intro, newRun);
    }
  }

  function newRun() {
    const run = Modes.createRun((Math.random() * 4294967296) >>> 0);
    store.run = run;
    save();
    startSession(runSession(run));
  }

  function runSession(run) {
    let budget = 0;
    const persist = () => { store.run = run.over ? null : run; save(); };
    const s = {
      kind: 'run',
      title: '',
      hintText: '',
      level: null,
      limit: () => budget,
      canUndo: () => run.undos > 0,
      useUndo() { run.undos--; persist(); },
      undoLabel: () => `Undo (${run.undos})`,
      canHint: () => run.hints > 0,
      useHint() { run.hints--; persist(); },
      hintLabel: () => `Hint (${run.hints})`,
      canSkip: () => run.skips > 0,
      skip() {
        if (!Modes.runSkip(run)) return;
        toast(`⤼ Warped to depth ${run.depth}`);
        loadFloor();
        loadLevel(s.level);
      },
      stats: () => `Moves ${play.moves}/${budget} · Par ${s.par}`,
      chips() {
        const left = budget - play.moves;
        const out = [
          { text: '♥'.repeat(run.hearts) || '♡', cls: 'hearts' },
          { text: `${left} moves left`, warn: left <= 3 },
          { text: `✦ ${run.sparks}` },
        ];
        if (run.ghosts) out.push({ text: `👻 ${run.ghosts}` });
        if (run.stamina) out.push({ text: `⚡ +${run.stamina}` });
        return out;
      },
      quit: () => { persist(); showHome(); },
      restart() {
        modal({
          title: 'Restart floor?',
          html: 'Restarting costs a heart.',
          buttons: [{ label: 'Cancel' }, { label: 'Restart', primary: true, action: () => fail('restart') }],
          onClose: () => {},
        });
      },
      onFall() { fail('fall'); },
      onOutOfMoves() { fail('moves'); },
      onWin(moves) {
        const perks = Modes.runClear(run, moves, budget);
        persist();
        const list = document.createElement('div');
        list.className = 'perks';
        perks.forEach((p) => {
          const info = Modes.PERKS[p];
          const b = document.createElement('button');
          b.innerHTML = `<span class="p-icon">${info.icon}</span><span><span class="p-name">${info.name}</span><br><span class="p-text">${info.text}</span></span>`;
          b.addEventListener('click', () => {
            Modes.applyPerk(run, p);
            Sound.perk();
            closeModal(true);
            persist();
            loadFloor();
            loadLevel(s.level);
          });
          list.appendChild(b);
        });
        modal({ title: `Depth ${run.depth - 1} cleared`, html: 'Choose a perk:', node: list, buttons: [] });
      },
    };
    function loadFloor() {
      const floor = Modes.runFloor(run);
      s.par = floor.par;
      budget = Modes.runBudget(run, floor.par);
      s.level = parseLevel({ name: `Depth ${run.depth}`, map: floor.map });
      s.title = `Depth ${run.depth}`;
      persist();
    }
    function fail(kind) {
      const res = Modes.runFail(run, kind);
      persist();
      if (res === 'rewind') {
        toast('👻 Ghost! Rewound one move');
        rewind();
      } else if (res === 'retry') {
        Sound.lose();
        vibrate(120);
        toast({ fall: '−1 ♥  You fell', moves: '−1 ♥  Out of moves', restart: '−1 ♥  Restarted' }[kind]);
        setTimeout(() => resetLevel(), 300);
      } else {
        Sound.lose();
        const depth = run.depth;
        const newBest = depth > store.runBest;
        store.runBest = Math.max(store.runBest, depth);
        store.sparksBest = Math.max(store.sparksBest, run.sparks);
        store.run = null;
        save();
        modal({
          title: 'Run over',
          html: `<div class="big-number">${depth}</div>depth reached${newBest ? ' · <b>New best!</b>' : ''}<br>✦ ${run.sparks} sparks · best depth ${store.runBest}`,
          buttons: [{ label: 'Home', action: showHome }, { label: 'New run', primary: true, action: newRun }],
          onClose: showHome,
        });
      }
    }
    loadFloor();
    return s;
  }

  function rushSession() {
    const seed = (Math.random() * 4294967296) >>> 0;
    let solved = 0;
    let timeLeft = Modes.RUSH_START_SECONDS * 1000;
    let lastTick = 0;
    let over = false;
    let par = 0;
    const s = {
      kind: 'rush',
      title: 'Rush',
      hintText: 'Solve as many puzzles as you can!',
      level: null,
      limit: null,
      canUndo: () => true,
      canHint: () => false,
      stats: () => `Moves ${play.moves} · Par ${par}`,
      chips: () => [
        { text: `⏱ ${Math.max(0, timeLeft / 1000).toFixed(1)}s`, cls: 'timer', warn: timeLeft < 10000 },
        { text: `✓ ${solved}` },
      ],
      quit: () => {
        if (over) return showHome();
        modal({
          title: 'Quit Rush?',
          html: 'This run will end.',
          buttons: [{ label: 'Keep playing' }, { label: 'Quit', primary: true, action: () => { over = true; showHome(); } }],
          onClose: () => {},
        });
      },
      tick(dt) {
        if (over) return;
        timeLeft -= dt;
        const sec = Math.ceil(timeLeft / 1000);
        if (timeLeft < 5000 && sec !== lastTick) { lastTick = sec; Sound.tick(); }
        if (timeLeft <= 0) {
          over = true;
          play.frozen = true;
          Sound.lose();
          vibrate(200);
          const newBest = solved > store.rushBest;
          store.rushBest = Math.max(store.rushBest, solved);
          save();
          modal({
            title: "Time's up!",
            html: `<div class="big-number">${solved}</div>puzzles solved${newBest ? ' · <b>New best!</b>' : ''}<br>Best: ${store.rushBest}`,
            buttons: [{ label: 'Home', action: showHome }, { label: 'Again', primary: true, action: () => startSession(rushSession()) }],
            onClose: showHome,
          });
        }
        refreshHud();
      },
      onFall() {
        timeLeft -= 3000;
        toast('−3s');
        setTimeout(() => resetLevel(), 250);
      },
      onWin(moves) {
        const bonus = Modes.rushBonus(Modes.rushDepthFor(solved), moves, par);
        timeLeft += bonus * 1000;
        solved++;
        toast(`+${bonus}s`);
        setTimeout(() => { if (!over) { loadFloor(); loadLevel(s.level); } }, 350);
      },
    };
    function loadFloor() {
      const floor = Modes.rushFloor(seed, solved);
      par = floor.par;
      s.level = parseLevel({ name: 'Rush', map: floor.map });
      s.title = `Rush · Puzzle ${solved + 1}`;
    }
    loadFloor();
    return s;
  }

  function dailySession() {
    const key = Modes.dateKey();
    const floor = Modes.dailyFloor(key);
    const level = parseLevel({ name: 'Daily', map: floor.map });
    const retry = () => startSession(dailySession());
    return {
      kind: 'daily',
      title: `Daily · ${key}`,
      hintText: 'A new puzzle every day. Can you match par?',
      level,
      limit: null,
      canUndo: () => true,
      canHint: () => false,
      stats: () => `Moves ${play.moves} · Par ${floor.par}` + (store.daily[key] != null ? ` · Best ${store.daily[key]}` : ''),
      chips: () => [],
      quit: showHome,
      onFall() { toast('Fell! Try again'); setTimeout(() => resetLevel(), 250); },
      onWin(moves) {
        const prev = store.daily[key];
        if (prev == null || moves < prev) store.daily[key] = moves;
        save();
        const stars = Modes.starsFor(moves, floor.par);
        const streak = Modes.dailyStreak(Object.keys(store.daily));
        modal({
          title: 'Daily solved!',
          html: `<div class="stars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span></div>
            <b>${moves}</b> moves (par ${floor.par})<br>🔥 Streak: <b>${streak}</b> day${streak === 1 ? '' : 's'}<br>Come back tomorrow for a new one.`,
          buttons: [{ label: 'Home', action: showHome }, { label: 'Replay', primary: true, action: retry }],
          onClose: showHome,
        });
      },
    };
  }

  // ---------- Play state ----------
  const play = {
    level: null, state: null, history: [], moves: 0, anim: null, queued: null,
    broken: new Set(), frozen: true, hint: null, particles: [], shake: 0,
  };

  function loadLevel(level) {
    Object.assign(play, {
      level, state: initialState(level), history: [], moves: 0, anim: null, queued: null,
      broken: new Set(), frozen: false, hint: null,
      coach: session.tutorial ? { steps: session.tutorial, i: 0 } : null,
    });
    $('level-name').textContent = session.title;
    renderCoach();
    resize();
    refreshHud();
  }

  // ---------- Tutorial coach ----------
  // Tutorial steps are a run of guided swipes (`dir`) followed by free play. Guided steps
  // only accept the expected swipe; marked tiles pulse on the board.
  function coachStep() {
    const c = play.coach;
    return c && c.i < c.steps.length ? c.steps[c.i] : null;
  }

  function markedCells(mark) {
    if (!mark) return [];
    if (Array.isArray(mark)) return mark;
    const level = play.level;
    if (mark === 'goal') return level.goal ? Engine.cellsOf(level.goal) : [];
    const chars = { glass: '!', shapes: 'abcd', switches: 'oO', bridges: '=+' }[mark] || '';
    const out = [];
    level.tiles.forEach((row, y) => row.forEach((t, x) => { if (chars.includes(t)) out.push([x, y]); }));
    return out;
  }

  function renderCoach() {
    const step = coachStep();
    const box = $('coach');
    document.querySelectorAll('.dpad button').forEach((b) => b.classList.toggle('coach-pulse', !!step && b.dataset.dir === step.dir));
    if (!step) {
      box.hidden = true;
      $('hint').hidden = false;
      play.marks = [];
      return;
    }
    $('coach-text').textContent = step.say;
    const dots = $('coach-dots');
    dots.innerHTML = play.coach.steps.map((_, k) => `<span class="${k <= play.coach.i ? 'on' : ''}"></span>`).join('');
    box.hidden = false;
    $('hint').hidden = true;
    play.marks = markedCells(step.mark);
  }

  function nudgeCoach() {
    const box = $('coach');
    box.classList.remove('nudge');
    void box.offsetWidth;
    box.classList.add('nudge');
  }

  function resetLevel() {
    if (session) loadLevel(play.level);
  }

  function rewind() {
    if (!play.history.length) return resetLevel();
    play.state = play.history.pop();
    play.moves = Math.max(0, play.moves - 1);
    play.broken = new Set();
    play.anim = null;
    play.frozen = false;
    refreshHud();
  }

  function refreshHud() {
    if (!session) return;
    $('level-stats').textContent = session.stats();
    const chipList = session.chips() || [];
    const chipKey = JSON.stringify(chipList);
    const chips = $('chips');
    if (chips.dataset.key !== chipKey) {
      chips.dataset.key = chipKey;
      chips.innerHTML = '';
      chipList.forEach((c) => {
        const el = document.createElement('span');
        el.className = 'chip' + (c.cls ? ' ' + c.cls : '') + (c.warn ? ' warn' : '');
        el.textContent = c.text;
        chips.appendChild(el);
      });
    }
    const undo = $('btn-undo');
    undo.textContent = session.undoLabel ? session.undoLabel() : 'Undo';
    undo.disabled = !session.canUndo() || !play.history.length || play.frozen;
    undo.hidden = session.kind === 'precision';
    const hint = $('btn-hint');
    hint.hidden = !session.canHint() && !session.hintLabel;
    hint.textContent = session.hintLabel ? session.hintLabel() : 'Hint';
    const guided = coachStep() && coachStep().dir;
    hint.disabled = !session.canHint() || play.frozen || !!guided;
    const skip = $('btn-skip');
    skip.hidden = !(session.canSkip && session.canSkip());
    $('dpad').hidden = !store.settings.dpad;
  }

  function tryMove(dir) {
    if (!session || play.frozen || !play.level || modalOpen()) return;
    if (play.anim) { play.queued = dir; return; }
    Sound.unlock();
    const step = coachStep();
    if (step && step.dir && dir !== step.dir) {
      nudgeCoach();
      Sound.blocked();
      return;
    }
    const from = play.state;
    const r = move(play.level, from, dir);
    if (r.outcome === 'blocked') {
      play.shake = 0.4;
      Sound.blocked();
      return;
    }
    if (r.bumped) {
      const hit = Engine.cellsOf(Engine.roll(from, dir)).filter(([x, y]) => tileAt(play.level, from.open, x, y) === 'X');
      play.flash = { cells: new Set(hit.map(([x, y]) => `${x},${y}`)), at: performance.now() };
      Sound.bump();
      vibrate(10);
    }
    play.history.push(from);
    play.moves++;
    play.hint = null;
    if (step && step.dir && r.outcome !== 'fall') {
      play.coach.i++;
      renderCoach();
    }
    if (r.outcome === 'fall') {
      play.frozen = true;
      r.broke.forEach(([x, y]) => play.broken.add(`${x},${y}`));
      if (r.broke.length) { Sound.shatter(); spawnShards(r.broke); }
      Sound.fall();
      vibrate(80);
      animate(from, r.state, 'fall', () => session.onFall());
    } else if (r.outcome === 'win') {
      play.frozen = true;
      play.state = r.state;
      Sound.win();
      vibrate(30);
      animate(from, r.state, 'win', () => {
        spawnBurst(r.state);
        session.onWin(play.moves);
      });
    } else {
      play.state = r.state;
      Sound.move(shapeIndex(r.state.w, r.state.h));
      if (r.toggled) { Sound.toggle(); vibrate(15); }
      // Levels always start solvable, but a move (like a switch flipped at the wrong
      // time) can leave no way to the goal: say so instead of letting the player wander.
      if (!solve(play.level, play.state)) toast('No way to the goal from here — undo or restart');
      if (session.limit && play.moves >= session.limit()) {
        play.frozen = true;
        animate(from, r.state, 'move', () => session.onOutOfMoves());
      } else {
        animate(from, r.state, 'move');
      }
    }
    refreshHud();
  }

  function undo() {
    if (!session || play.anim || play.frozen || !play.history.length || !session.canUndo()) return;
    if (session.useUndo) session.useUndo();
    rewind();
    if (play.coach && play.coach.i > play.history.length) {
      play.coach.i = play.history.length;
      renderCoach();
    }
    Sound.tap();
  }

  function hint() {
    if (!session || play.anim || play.frozen || !session.canHint()) return;
    const path = solve(play.level, play.state);
    if (!path || !path.length) { toast('No way out from here. Restart!'); return; }
    if (session.useHint) session.useHint();
    play.hint = path[0];
    refreshHud();
  }

  // ---------- Rendering ----------
  const canvas = $('board');
  const ctx = canvas.getContext('2d');
  let unit = 32;

  function resize() {
    if (!play.level || $('game').hidden) return;
    const wrap = $('board-wrap');
    const availW = wrap.clientWidth - 8;
    const availH = wrap.clientHeight - 16;
    unit = Math.max(8, Math.floor(Math.min(availW / play.level.width, availH / play.level.height, 64)));
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${unit * play.level.width}px`;
    canvas.style.height = `${unit * play.level.height}px`;
    canvas.width = Math.round(unit * play.level.width * dpr);
    canvas.height = Math.round(unit * play.level.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function roundRect(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBoard(now) {
    const level = play.level;
    const gap = Math.max(2, unit * 0.08);
    const open = play.state.open;
    const r = unit * 0.18;
    for (let ty = 0; ty < level.height; ty++) {
      for (let tx = 0; tx < level.width; tx++) {
        const t = level.tiles[ty][tx];
        if (t === '.' || play.broken.has(`${tx},${ty}`)) continue;
        const x = tx * unit + gap / 2;
        const y = ty * unit + gap / 2;
        const w = unit - gap;
        const h = unit - gap;
        const isBridge = t === '=' || t === '+';
        if (t === 'X') {
          // Walls stand out as raised blocks.
          const flash = play.flash && play.flash.cells.has(`${tx},${ty}`) ? Math.max(0, 1 - (now - play.flash.at) / 300) : 0;
          roundRect(x, y + 3, w, h - 3, r);
          ctx.fillStyle = '#0b0e24';
          ctx.fill();
          roundRect(x, y, w, h - 3, r);
          ctx.fillStyle = flash ? mixColor('#6b74c9', '#ffffff', flash) : '#6b74c9';
          ctx.fill();
          ctx.fillStyle = '#ffffff22';
          roundRect(x + 3, y + 3, w - 6, (h - 3) * 0.3, r * 0.6);
          ctx.fill();
          continue;
        }
        roundRect(x, y, w, h, r);
        if (isBridge && tileAt(level, open, tx, ty) === '.') {
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = '#ffffff30';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
          continue;
        }
        if (t === '!') {
          ctx.fillStyle = '#9fe6ff22';
          ctx.fill();
          ctx.strokeStyle = '#9fe6ff99';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + w * 0.25, y + h * 0.2);
          ctx.lineTo(x + w * 0.5, y + h * 0.5);
          ctx.lineTo(x + w * 0.4, y + h * 0.8);
          ctx.moveTo(x + w * 0.5, y + h * 0.5);
          ctx.lineTo(x + w * 0.8, y + h * 0.4);
          ctx.stroke();
          continue;
        }
        const shape = Engine.SHAPE_TILES[t];
        if (shape) {
          // Shape tiles: tinted with the shape's color and show the shape they accept.
          const color = SHAPE_COLORS[shapeIndex(shape[0], shape[1])];
          ctx.fillStyle = color + '40';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          const iw = (w * 0.22) * shape[0];
          const ih = (h * 0.22) * shape[1];
          roundRect(x + (w - iw) / 2, y + (h - ih) / 2, iw, ih, 2);
          ctx.fillStyle = color;
          ctx.fill();
          continue;
        }
        ctx.fillStyle = isBridge ? '#3a2f6b' : '#232a5c';
        ctx.fill();
        ctx.strokeStyle = isBridge ? '#8b7bff' : '#323b80';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (t === 'S') {
          ctx.strokeStyle = '#ffffff40';
          ctx.strokeRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.4);
        }
        if (t === 'o' || t === 'O') {
          const rad = Math.min(w, h) * (t === 'O' ? 0.3 : 0.22);
          ctx.beginPath();
          ctx.arc(x + w / 2, y + h / 2, rad, 0, Math.PI * 2);
          ctx.strokeStyle = open ? '#39f3c8' : '#8b7bff';
          ctx.lineWidth = t === 'O' ? 5 : 3;
          ctx.stroke();
        }
      }
    }
    // The goal is drawn as one glowing outline with the shape it needs.
    const g = level.goal;
    if (g) {
      const color = SHAPE_COLORS[shapeIndex(g.w, g.h)];
      const pulse = 0.55 + 0.45 * Math.sin(now / 300);
      roundRect(g.x * unit + gap / 2, g.y * unit + gap / 2, g.w * unit - gap, g.h * unit - gap, r);
      ctx.fillStyle = color + '33';
      ctx.fill();
      ctx.shadowColor = color;
      ctx.shadowBlur = 14 * pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // Tiles highlighted by the tutorial coach pulse.
  function drawMarks(now) {
    if (!play.marks || !play.marks.length) return;
    const pulse = 0.5 + 0.5 * Math.sin(now / 220);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + 0.55 * pulse})`;
    for (const [x, y] of play.marks) {
      const inset = 2 + pulse;
      roundRect(x * unit + inset, y * unit + inset, unit - inset * 2, unit - inset * 2, unit * 0.2);
      ctx.stroke();
    }
  }

  // Faint outlines of where each swipe would land (moves that fall or are blocked are not shown).
  function drawPreview() {
    const inset = Math.max(3, unit * 0.12);
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.5;
    for (const dir of Object.keys(Engine.DIRS)) {
      const r = move(play.level, play.state, dir);
      if (r.outcome !== 'ok' && r.outcome !== 'win') continue;
      const n = r.state;
      roundRect(n.x * unit + inset, n.y * unit + inset, n.w * unit - inset * 2, n.h * unit - inset * 2, unit * 0.2);
      ctx.strokeStyle = SHAPE_COLORS[shapeIndex(n.w, n.h)] + (r.bumped ? 'cc' : '77');
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawBlock(b, alpha, scale) {
    const inset = Math.max(3, unit * 0.12);
    const w = b.w * unit - inset * 2;
    const h = b.h * unit - inset * 2;
    const cx = b.x * unit + inset + w / 2;
    const cy = b.y * unit + inset + h / 2;
    const sw = w * scale;
    const sh = h * scale;
    ctx.globalAlpha = alpha;
    roundRect(cx - sw / 2, cy - sh / 2, sw, sh, unit * 0.2);
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff40';
    roundRect(cx - sw / 2 + 4, cy - sh / 2 + 4, Math.max(0, sw - 8), Math.max(4, sh * 0.25), unit * 0.12);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawHint(b, dir, now) {
    const cx = (b.x + b.w / 2) * unit;
    const cy = (b.y + b.h / 2) * unit;
    const [dx, dy] = Engine.DIRS[dir];
    const bob = 4 + 3 * Math.sin(now / 150);
    const reach = (dx ? b.w : b.h) * unit / 2 + unit * 0.35 + bob;
    const tx = cx + dx * reach;
    const ty = cy + dy * reach;
    const size = unit * 0.38;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.6, -size * 0.8);
    ctx.lineTo(-size * 0.6, size * 0.8);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
  }

  // Particles
  function spawnBurst(s) {
    const cx = (s.x + s.w / 2) * unit;
    const cy = (s.y + s.h / 2) * unit;
    for (let i = 0; i < 48; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 1.5 + Math.random() * 4;
      play.particles.push({
        x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 1,
        color: SHAPE_COLORS[i % 4], size: 2 + Math.random() * 3, gravity: 0.08,
      });
    }
  }
  function spawnShards(cells) {
    for (const [x, y] of cells) {
      for (let i = 0; i < 8; i++) {
        play.particles.push({
          x: (x + Math.random()) * unit, y: (y + Math.random()) * unit,
          vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, life: 1,
          color: '#9fe6ff', size: 2 + Math.random() * 3, gravity: 0.15,
        });
      }
    }
    play.shake = 1;
  }
  function drawParticles() {
    play.particles = play.particles.filter((p) => p.life > 0);
    for (const p of play.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= 0.02;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  function mixColor(c1, c2, t) {
    const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const a = p(c1);
    const b = p(c2);
    return '#' + a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, '0')).join('');
  }

  function animate(from, to, kind, done) {
    play.anim = { from, to, kind, done, start: performance.now(), duration: 140 };
  }

  let lastFrame = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(100, now - lastFrame);
    lastFrame = now;
    if (!play.level || $('game').hidden || !session) return;
    if (session.tick && !modalOpen() && !document.hidden) session.tick(dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    let ox = 0;
    if (play.shake > 0) {
      ox = (Math.random() - 0.5) * 8 * play.shake;
      play.shake = Math.max(0, play.shake - 0.06);
    }
    ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, 0);
    drawBoard(now);

    const st = play.state;
    let block = { x: st.x, y: st.y, w: st.w, h: st.h, color: SHAPE_COLORS[shapeIndex(st.w, st.h)] };
    let alpha = 1;
    let scale = 1;
    const a = play.anim;
    if (a) {
      const t = Math.min(1, (now - a.start) / a.duration);
      const e = ease(t);
      const { from, to } = a;
      // Interpolate the edges so the block visibly rolls over and stretches.
      const x1 = lerp(from.x, to.x, e);
      const x2 = lerp(from.x + from.w, to.x + to.w, e);
      const y1 = lerp(from.y, to.y, e);
      const y2 = lerp(from.y + from.h, to.y + to.h, e);
      block = {
        x: x1, y: y1, w: x2 - x1, h: y2 - y1,
        color: mixColor(SHAPE_COLORS[shapeIndex(from.w, from.h)], SHAPE_COLORS[shapeIndex(to.w, to.h)], e),
      };
      if (t >= 1) {
        if (a.kind === 'move') {
          play.anim = null;
          if (a.done) a.done();
          if (play.queued && !play.frozen) { const q = play.queued; play.queued = null; tryMove(q); }
          play.queued = null;
        } else {
          const t2 = Math.min(1, (now - a.start - a.duration) / 380);
          scale = 1 - 0.75 * ease(t2);
          alpha = a.kind === 'fall' ? 1 - t2 : 1 - t2 * 0.6;
          if (t2 >= 1) {
            play.anim = null;
            play.queued = null;
            if (a.done) a.done();
            drawParticles();
            return;
          }
        }
      }
    }
    if (store.settings.preview && !play.anim && !play.frozen) drawPreview();
    drawMarks(now);
    drawBlock(block, alpha, scale);
    const guide = coachStep() && coachStep().dir;
    if ((guide || play.hint) && !play.anim && !play.frozen) drawHint(block, guide || play.hint, now);
    drawParticles();
  }
  requestAnimationFrame(frame);

  // ---------- Settings & help ----------
  function openSettings() {
    const node = document.createElement('div');
    node.className = 'settings';
    const items = [['preview', 'Show where each move lands'], ['sound', 'Sound'], ['vibration', 'Vibration'], ['dpad', 'On-screen arrows']];
    items.forEach(([key, label]) => {
      const l = document.createElement('label');
      l.innerHTML = `<span>${label}</span>`;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!store.settings[key];
      input.addEventListener('change', () => {
        store.settings[key] = input.checked;
        Sound.setEnabled(store.settings.sound);
        save();
      });
      l.appendChild(input);
      node.appendChild(l);
    });
    const reset = document.createElement('button');
    reset.textContent = 'Reset all progress';
    reset.addEventListener('click', () => {
      modal({
        title: 'Reset progress?',
        html: 'Stars, bests, streaks and your saved run will be erased.',
        buttons: [
          { label: 'Cancel', action: openSettings },
          { label: 'Reset', primary: true, action: () => { const keep = store.settings; store = JSON.parse(JSON.stringify(DEFAULTS)); store.settings = keep; store.seenIntro = { howto: true }; save(); showHome(); } },
        ],
        onClose: openSettings,
      });
    });
    node.appendChild(reset);
    modal({ title: 'Settings', node, buttons: [{ label: 'Done', primary: true, action: showHome }], onClose: showHome });
  }

  function openHowTo() {
    const node = $('howto-template').content.cloneNode(true);
    modal({ title: 'How to play', node, buttons: [{ label: 'Got it', primary: true }], onClose: () => {} });
  }

  // ---------- Input ----------
  const KEYS = {
    arrowleft: 'left', arrowright: 'right', arrowup: 'up', arrowdown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down', q: 'left', z: 'up',
  };
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (modalOpen()) {
      if (key === 'escape' && modalOnClose) closeModal(false);
      else if (key === 'enter') {
        const primary = $('modal-buttons').querySelector('.primary');
        if (primary) primary.click();
      }
      return;
    }
    if ($('game').hidden) return;
    const dir = KEYS[key];
    if (dir) { e.preventDefault(); tryMove(dir); }
    else if (key === 'backspace' || key === 'u') undo();
    else if (key === 'r') $('btn-restart').click();
    else if (key === 'h') hint();
    else if (key === 'escape') session && session.quit();
  });

  let touchStart = null;
  const wrap = $('board-wrap');
  wrap.addEventListener('pointerdown', (e) => { touchStart = { x: e.clientX, y: e.clientY }; Sound.unlock(); });
  wrap.addEventListener('pointerup', (e) => {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 'right' : 'left');
    else tryMove(dy > 0 ? 'down' : 'up');
  });
  wrap.addEventListener('pointercancel', () => { touchStart = null; });

  document.querySelectorAll('.dpad button').forEach((b) => b.addEventListener('click', () => tryMove(b.dataset.dir)));
  $('btn-undo').addEventListener('click', undo);
  $('btn-hint').addEventListener('click', hint);
  $('btn-skip').addEventListener('click', () => { if (session && session.skip && !play.anim) session.skip(); });
  $('btn-restart').addEventListener('click', () => {
    if (!session || play.anim || play.frozen) return;
    if (session.restart) session.restart();
    else resetLevel();
  });
  $('btn-quit').addEventListener('click', () => session && session.quit());
  document.querySelectorAll('[data-action=home]').forEach((b) => b.addEventListener('click', showHome));
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-howto').addEventListener('click', openHowTo);
  window.addEventListener('resize', resize);

  // Android back button (Capacitor).
  const capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (capApp) {
    capApp.addListener('backButton', () => {
      if (modalOpen()) { if (modalOnClose) closeModal(false); }
      else if (!$('game').hidden && session) session.quit();
      else if (!$('levels-screen').hidden) showHome();
      else capApp.exitApp();
    });
  }

  Sound.setEnabled(store.settings.sound);
  showHome();
  if (!store.seenIntro.howto) {
    // First launch: learn by playing, straight into the first tutorial level.
    store.seenIntro.howto = true;
    save();
    if (!cleared(0)) startSession(campaignSession(0, false));
  }

  // Exposed for automated tests.
  window.__neo = { play, get session() { return session; }, store: () => store, tryMove, campaignPars, coachStep };
})();
