(function () {
  const { parseLevel, initialState, tileAt, move, solve, slotSize } = Engine;
  const $ = (id) => document.getElementById(id);
  const css = getComputedStyle(document.documentElement);
  const SHAPE_COLORS = ['--shape0', '--shape1', '--shape2', '--shape3'].map((v) => css.getPropertyValue(v).trim());
  const shapeIndex = (w, h) => (w - 1) + (h - 1) * 2;

  const STORE_KEY = 'neo-bloxorz-progress';
  let progress = {};
  try { progress = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { progress = {}; }
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* storage unavailable */ }
  }

  const levels = LEVELS.map(parseLevel);
  const pars = levels.map((l) => solve(l).length);

  function starsFor(i, moves) {
    if (moves <= pars[i]) return 3;
    if (moves <= Math.ceil(pars[i] * 1.5)) return 2;
    return 1;
  }

  // ---------- Menu ----------
  function showMenu() {
    $('game').hidden = true;
    $('menu').hidden = false;
    const grid = $('levels');
    grid.innerHTML = '';
    levels.forEach((l, i) => {
      const best = progress[i];
      const unlocked = i === 0 || progress[i - 1] != null || best != null;
      const b = document.createElement('button');
      b.disabled = !unlocked;
      if (best != null) b.classList.add('done');
      const stars = best != null ? '★'.repeat(starsFor(i, best)) : '';
      b.innerHTML = `<span class="num">${i + 1}</span><span class="lvl-stars">${stars}</span>`;
      b.setAttribute('aria-label', `Level ${i + 1}: ${l.name}`);
      b.addEventListener('click', () => startLevel(i));
      grid.appendChild(b);
    });
  }

  // ---------- Game state ----------
  let current = 0;
  let level = null;
  let state = null;
  let history = [];
  let moves = 0;
  let anim = null; // { from, to, start, duration, kind }
  let queued = null;
  let broken = new Set();
  let finished = false;

  function startLevel(i) {
    current = i;
    level = levels[i];
    state = initialState(level);
    history = [];
    moves = 0;
    anim = null;
    queued = null;
    broken = new Set();
    finished = false;
    $('menu').hidden = true;
    $('game').hidden = false;
    $('win').hidden = true;
    $('level-name').textContent = `${i + 1}. ${level.name}`;
    $('hint').textContent = level.hint;
    updateStats();
    resize();
  }

  function updateStats() {
    const best = progress[current];
    $('level-stats').textContent = `Moves ${moves} · Par ${pars[current]}` + (best != null ? ` · Best ${best}` : '');
  }

  function tryMove(dir) {
    if (finished || !level) return;
    if (anim) { queued = dir; return; }
    const r = move(level, state, dir);
    const from = state;
    history.push(state);
    moves++;
    updateStats();
    if (r.outcome === 'fall') {
      r.broke.forEach(([x, y]) => broken.add(`${x},${y}`));
      animate(from, r.state, 'fall', () => {
        setTimeout(() => {
          state = initialState(level);
          history = [];
          moves = 0;
          broken = new Set();
          updateStats();
        }, 120);
      });
      vibrate(80);
    } else if (r.outcome === 'win') {
      animate(from, r.state, 'win', () => onWin());
      state = r.state;
    } else {
      state = r.state;
      if (r.toggled) vibrate(20);
      animate(from, r.state, 'move');
    }
  }

  function undo() {
    if (anim || finished || !history.length) return;
    state = history.pop();
    moves = Math.max(0, moves - 1);
    updateStats();
  }

  function restart() {
    if (finished) return;
    startLevel(current);
  }

  function onWin() {
    finished = true;
    const prev = progress[current];
    if (prev == null || moves < prev) progress[current] = moves;
    saveProgress();
    const stars = starsFor(current, moves);
    $('win-stars').innerHTML = '★'.repeat(stars) + `<span class="off">${'★'.repeat(3 - stars)}</span>`;
    $('win-text').textContent = `${moves} moves (par ${pars[current]})`;
    $('btn-next').textContent = current + 1 < levels.length ? 'Next' : 'Levels';
    $('win').hidden = false;
  }

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not supported */ }
  }

  // ---------- Rendering ----------
  const canvas = $('board');
  const ctx = canvas.getContext('2d');
  let unit = 32;

  function resize() {
    if (!level) return;
    const wrap = $('board-wrap');
    const pad = 8;
    const availW = wrap.clientWidth - pad * 2;
    const availH = wrap.clientHeight - pad * 2;
    unit = Math.floor(Math.min(availW / level.width, availH / level.height, 64));
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${unit * level.width}px`;
    canvas.style.height = `${unit * level.height}px`;
    canvas.width = Math.round(unit * level.width * dpr);
    canvas.height = Math.round(unit * level.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Slot geometry in tiles: slot column c spans tiles [colStart[c], colStart[c] + size).
  function slotRects() {
    const rows = level.slots.length;
    const out = [];
    let ty = level.height;
    for (let r = rows - 1; r >= 0; r--) {
      const sh = slotSize(rows - 1 - r);
      ty -= sh;
      let tx = 0;
      for (let c = 0; c < level.slots[r].length; c++) {
        const sw = slotSize(c);
        out.push({ x: tx, y: ty, w: sw, h: sh, t: level.slots[r][c] });
        tx += sw;
      }
    }
    return out;
  }

  function drawBoard(now) {
    const gap = Math.max(2, unit * 0.08);
    const open = state.open;
    for (const s of slotRects()) {
      if (s.t === '.') continue;
      const x = s.x * unit + gap / 2;
      const y = s.y * unit + gap / 2;
      const w = s.w * unit - gap;
      const h = s.h * unit - gap;
      const eff = tileAt(level, open, s.x, s.y);
      const isBridge = s.t === '=' || s.t === '+';
      if (broken.has(`${s.x},${s.y}`) || cellsBroken(s)) continue;
      roundRect(x, y, w, h, unit * 0.18);
      if (isBridge && eff === '.') {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#ffffff30';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      if (s.t === 'G') {
        const pulse = 0.55 + 0.45 * Math.sin(now / 300);
        const gs = level.goal;
        ctx.fillStyle = SHAPE_COLORS[shapeIndex(gs.w, gs.h)] + '33';
        ctx.fill();
        ctx.shadowColor = SHAPE_COLORS[shapeIndex(gs.w, gs.h)];
        ctx.shadowBlur = 14 * pulse;
        ctx.strokeStyle = SHAPE_COLORS[shapeIndex(gs.w, gs.h)];
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
        continue;
      }
      if (s.t === '!') {
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
      ctx.fillStyle = isBridge ? '#3a2f6b' : '#232a5c';
      ctx.fill();
      ctx.strokeStyle = isBridge ? '#8b7bff' : '#323b80';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (s.t === 'S') {
        ctx.strokeStyle = '#ffffff40';
        ctx.strokeRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.4);
      }
      if (s.t === 'o' || s.t === 'O') {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rad = Math.min(w, h) * (s.t === 'O' ? 0.3 : 0.22);
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.strokeStyle = open ? '#39f3c8' : '#8b7bff';
        ctx.lineWidth = s.t === 'O' ? 5 : 3;
        ctx.stroke();
      }
    }
  }

  function cellsBroken(s) {
    for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) if (broken.has(`${s.x + dx},${s.y + dy}`)) return true;
    return false;
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
    const color = b.color;
    roundRect(cx - sw / 2, cy - sh / 2, sw, sh, unit * 0.2);
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff40';
    roundRect(cx - sw / 2 + 4, cy - sh / 2 + 4, sw - 8, Math.max(4, sh * 0.25), unit * 0.12);
    ctx.fill();
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
    anim = { from, to, kind, done, start: performance.now(), duration: 150 };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!level || $('game').hidden) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard(now);

    let block = { ...state, color: SHAPE_COLORS[shapeIndex(state.w, state.h)] };
    let alpha = 1;
    let scale = 1;
    if (anim) {
      const t = Math.min(1, (now - anim.start) / anim.duration);
      const e = ease(t);
      const { from, to } = anim;
      // Interpolate the edges so the block visibly rolls over and stretches/squashes.
      const x1 = lerp(from.x, to.x, e);
      const x2 = lerp(from.x + from.w, to.x + to.w, e);
      const y1 = lerp(from.y, to.y, e);
      const y2 = lerp(from.y + from.h, to.y + to.h, e);
      block = {
        x: x1, y: y1, w: x2 - x1, h: y2 - y1,
        color: mixColor(SHAPE_COLORS[shapeIndex(from.w, from.h)], SHAPE_COLORS[shapeIndex(to.w, to.h)], e),
      };
      if (t >= 1) {
        if (anim.kind === 'move') {
          const d = anim.done;
          anim = null;
          if (d) d();
          if (queued) { const q = queued; queued = null; tryMove(q); }
        } else {
          // Second phase: fall or sink into the goal.
          const t2 = Math.min(1, (now - anim.start - anim.duration) / 380);
          scale = 1 - 0.75 * ease(t2);
          alpha = anim.kind === 'fall' ? 1 - t2 : 1 - t2 * 0.6;
          if (t2 >= 1) {
            const d = anim.done;
            anim = null;
            queued = null;
            if (d) d();
            return;
          }
        }
      }
    }
    drawBlock(block, alpha, scale);
  }
  requestAnimationFrame(frame);

  // ---------- Input ----------
  const KEYS = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down', q: 'left', z: 'up',
  };
  window.addEventListener('keydown', (e) => {
    if ($('game').hidden) return;
    const dir = KEYS[e.key] || KEYS[e.key.toLowerCase()];
    if (dir) { e.preventDefault(); tryMove(dir); }
    else if (e.key === 'Backspace' || (e.key.toLowerCase() === 'u')) undo();
    else if (e.key.toLowerCase() === 'r') restart();
    else if (e.key === 'Enter' && finished) $('btn-next').click();
  });

  let touchStart = null;
  const wrap = $('board-wrap');
  wrap.addEventListener('pointerdown', (e) => { touchStart = { x: e.clientX, y: e.clientY }; });
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

  document.querySelectorAll('.dpad button').forEach((b) =>
    b.addEventListener('click', () => tryMove(b.dataset.dir))
  );
  $('btn-undo').addEventListener('click', undo);
  $('btn-restart').addEventListener('click', () => { finished = false; startLevel(current); });
  $('btn-menu').addEventListener('click', showMenu);
  $('btn-replay').addEventListener('click', () => startLevel(current));
  $('btn-next').addEventListener('click', () => {
    if (current + 1 < levels.length) startLevel(current + 1);
    else showMenu();
  });
  window.addEventListener('resize', resize);

  // Android back button (Capacitor): leave the level, or the app from the menu.
  const capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (capApp) {
    capApp.addListener('backButton', () => {
      if (!$('game').hidden) showMenu();
      else capApp.exitApp();
    });
  }

  showMenu();
})();
