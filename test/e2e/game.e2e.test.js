// End-to-end smoke tests: load the real page in Chromium and play through every mode.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const LEVELS = require('../../www/js/levels.js');
const Engine = require('../../www/js/engine.js');

const URL = 'file://' + path.resolve(__dirname, '../../www/index.html');
const KEY = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };
const SHOTS = process.env.SCREENSHOT_DIR;

let browser;
test.before(async () => {
  const executablePath = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  browser = await chromium.launch({ executablePath });
});
test.after(async () => { if (browser) await browser.close(); });

// Pages start as a returning player (first-launch tutorial already seen) unless `fresh`.
// `cleared` marks that many campaign levels as solved so later ones are unlocked.
// `ads` installs a fake AdMob backend that records calls in window.__adsLog.
async function newPage({ fresh = false, cleared = 0, ads = false, brand = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (!fresh) {
    await page.addInitScript((names) => {
      if (localStorage.getItem('neo-bloxorz-v1')) return;
      const campaign = {};
      for (const name of names) campaign[name] = 999;
      localStorage.setItem('neo-bloxorz-v1', JSON.stringify({ version: 3, seenIntro: { howto: true }, campaign }));
    }, LEVELS.slice(0, cleared).map((l) => l.name));
  }
  if (ads) {
    await page.addInitScript(() => {
      const log = (window.__adsLog = []);
      const call = (name, result) => async (arg) => { log.push(name); return typeof result === 'function' ? result(arg) : result; };
      window.__adsMock = {
        initialize: call('initialize'),
        requestConsentInfo: call('requestConsentInfo', { status: 'NOT_REQUIRED', isConsentFormAvailable: false, canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' }),
        showConsentForm: call('showConsentForm'),
        showPrivacyOptionsForm: call('showPrivacyOptionsForm'),
        addListener: () => ({ remove() {} }),
        showBanner: call('showBanner'),
        removeBanner: call('removeBanner'),
        prepareInterstitial: call('prepareInterstitial', { adUnitId: 'test' }),
        showInterstitial: call('showInterstitial'),
        prepareRewardVideoAd: call('prepareRewardVideoAd', { adUnitId: 'test' }),
        showRewardVideoAd: call('showRewardVideoAd', { type: 'reward', amount: 1 }),
      };
    });
  }
  await page.goto(URL);
  if (!brand) {
    // Skip the brand splash (it has its own test).
    await page.evaluate(() => { const b = document.getElementById('brand'); b.classList.add('out'); b.hidden = true; });
  }
  page.errors = errors;
  return page;
}

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

// Plays the current level to the end: the tutorial's guided swipe when there is one,
// otherwise the solver's best move from wherever the block is.
async function playSolution(page) {
  for (let i = 0; i < 200; i++) {
    const dir = await page.evaluate(() => {
      const { play, coachStep } = window.__neo;
      if (play.frozen) return null;
      const step = coachStep();
      if (step && step.dir) return step.dir;
      const path = Engine.solve(play.level, play.state);
      return path ? path[0] : null;
    });
    if (!dir) return;
    await page.keyboard.press(KEY[dir]);
    await page.waitForFunction(() => !window.__neo.play.anim);
  }
}

async function dismissIntro(page) {
  if (await page.isVisible('#modal')) await page.click('#modal-buttons .primary');
}

test('first launch starts the coached tutorial', async () => {
  const page = await newPage({ fresh: true });
  assert.ok(await page.isVisible('#game'));
  assert.ok(await page.isVisible('#coach'));
  assert.match(await page.textContent('#coach-text'), /Swipe right/);
  assert.ok(await page.locator('.dpad [data-dir=right]').evaluate((b) => b.classList.contains('coach-pulse')));
  await shot(page, 'tutorial-1');
  // A swipe other than the one asked for is ignored.
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.evaluate(() => window.__neo.play.moves), 0);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => !window.__neo.play.anim);
  assert.match(await page.textContent('#coach-text'), /again/);
  // Undo takes the coach back a step too.
  await page.click('#btn-undo');
  assert.match(await page.textContent('#coach-text'), /Swipe right/);
  assert.deepEqual(page.errors, []);
});

test('home screen lists 5 modes and how to play', async () => {
  const page = await newPage();
  assert.equal(await page.locator('#modes .mode').count(), 5);
  await shot(page, 'home');
  await page.click('#btn-howto');
  assert.equal(await page.textContent('#modal-title'), 'How to play');
  await shot(page, 'howto');
  assert.deepEqual(page.errors, []);
});

test('tutorial levels coach each mechanic', async () => {
  const page = await newPage({ cleared: LEVELS.length });
  for (const name of ['Out of Step', 'Glass', 'Switch']) {
    const i = LEVELS.findIndex((l) => l.name === name);
    await page.evaluate(() => document.querySelector('[data-action=home]').click());
    await page.click('#modes .mode >> nth=0');
    await page.click(`.world-grid button[aria-label^="Level ${i + 1}:"]`);
    assert.ok(await page.isVisible('#coach'), `${name} shows the coach`);
    assert.ok((await page.evaluate(() => window.__neo.play.marks.length)) > 0, `${name} highlights tiles`);
    await shot(page, `tutorial-${name.toLowerCase().replace(/ /g, '-')}`);
    await playSolution(page);
    await page.waitForSelector('#modal:not([hidden])');
    assert.equal(await page.textContent('#modal-title'), 'Solved!');
    await page.click('#modal-buttons button >> nth=0');
  }
  assert.deepEqual(page.errors, []);
});

test('campaign: solve level 1 with swipes and get 3 stars', async () => {
  const page = await newPage();
  await dismissIntro(page);
  await page.click('#modes .mode >> nth=0');
  await page.click('.world-grid button >> nth=0');
  await shot(page, 'level1');
  const box = await page.locator('#board').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const swipe = async (dx, dy) => {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(() => !window.__neo.play.anim);
  };
  for (let i = 0; i < 3; i++) await swipe(80, 0);
  for (let i = 0; i < 3; i++) await swipe(0, -80);
  await page.waitForSelector('#modal:not([hidden])');
  assert.equal(await page.textContent('#modal-title'), 'Solved!');
  assert.equal(await page.locator('#modal-body .stars').evaluate((e) => e.firstChild.textContent), '★★★');
  await shot(page, 'level1-solved');
  const store = await page.evaluate(() => window.__neo.store());
  assert.equal(store.campaign['The Sketch'], 6);
  // Progress survives a reload, and level 2 is unlocked.
  await page.reload();
  await page.click('#modes .mode >> nth=0');
  assert.equal(await page.locator('.world-grid button >> nth=1').isDisabled(), false);
  assert.equal(await page.locator('.world-grid button >> nth=2').isDisabled(), true);
  assert.deepEqual(page.errors, []);
});

test('campaign: every level can be finished in the real game', async () => {
  const page = await newPage({ cleared: LEVELS.length });
  for (let i = 0; i < LEVELS.length; i++) {
    await page.evaluate(() => document.querySelector('[data-action=home]').click());
    await page.click('#modes .mode >> nth=0');
    await page.click(`.world-grid button[aria-label^="Level ${i + 1}:"]`);
    if (i === 20) await shot(page, 'level21');
    await playSolution(page);
    await page.waitForSelector('#modal:not([hidden])');
    assert.equal(await page.textContent('#modal-title'), 'Solved!', `level ${i + 1}`);
    await page.click('#modal-buttons button >> nth=0'); // close via Replay to keep the loop simple
  }
  assert.deepEqual(page.errors, []);
});

test('falling restarts the level', async () => {
  const page = await newPage({ cleared: 4 });
  await page.click('#modes .mode >> nth=0');
  await page.click('.world-grid button >> nth=3');
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => !window.__neo.play.frozen && window.__neo.play.moves === 0, null, { timeout: 3000 });
  assert.deepEqual(page.errors, []);
});

test('descent: clear a floor, pick a perk, lose hearts until the run ends', async () => {
  const page = await newPage();
  await dismissIntro(page);
  await page.click('#modes .mode >> nth=1');
  await dismissIntro(page); // Descent intro
  await page.waitForFunction(() => window.__neo.session && window.__neo.session.kind === 'run');
  await shot(page, 'descent');
  await playSolution(page);
  await page.waitForSelector('.perks button');
  await shot(page, 'perks');
  assert.equal(await page.locator('.perks button').count(), 3);
  await page.click('.perks button >> nth=0');
  assert.equal(await page.textContent('#level-name'), 'Depth 2');
  // The run is saved for later.
  assert.equal((await page.evaluate(() => window.__neo.store().run)).depth, 2);
  // Fall until the run is over (ghosts may save us a few times).
  for (let i = 0; i < 12 && !(await page.isVisible('#modal')); i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => !window.__neo.play.anim && !window.__neo.play.frozen || !document.getElementById('modal').hidden);
    await page.waitForTimeout(350);
  }
  await page.waitForSelector('#modal:not([hidden])');
  assert.equal(await page.textContent('#modal-title'), 'Run over');
  await shot(page, 'run-over');
  const store = await page.evaluate(() => window.__neo.store());
  assert.equal(store.run, null);
  assert.equal(store.runBest, 2);
  assert.deepEqual(page.errors, []);
});

test('rush: solving adds time and the clock ends the game', async () => {
  const page = await newPage();
  await dismissIntro(page);
  await page.click('#modes .mode >> nth=2');
  await dismissIntro(page);
  await page.waitForFunction(() => window.__neo.session && window.__neo.session.kind === 'rush');
  await shot(page, 'rush');
  await playSolution(page);
  await page.waitForFunction(() => window.__neo.session.title === 'Rush · Puzzle 2');
  // Fast-forward the clock.
  await page.evaluate(() => window.__neo.session.tick(1e6));
  await page.waitForSelector('#modal:not([hidden])');
  assert.equal(await page.textContent('#modal-title'), "Time's up!");
  assert.equal((await page.evaluate(() => window.__neo.store())).rushBest, 1);
  assert.deepEqual(page.errors, []);
});

test('daily: solve today\'s puzzle and start a streak', async () => {
  const page = await newPage();
  await dismissIntro(page);
  await page.click('#modes .mode >> nth=3');
  await shot(page, 'daily');
  await playSolution(page);
  await page.waitForSelector('#modal:not([hidden])');
  assert.equal(await page.textContent('#modal-title'), 'Daily solved!');
  assert.match(await page.textContent('#modal-body'), /Streak: 1 day/);
  assert.deepEqual(page.errors, []);
});

test('precision: going over the move limit fails the level', async () => {
  const page = await newPage();
  await dismissIntro(page);
  await page.evaluate(() => {
    const s = window.__neo.store();
    s.campaign['The Sketch'] = 6;
    localStorage.setItem('neo-bloxorz-v1', JSON.stringify(s));
  });
  await page.reload();
  await page.click('#modes .mode >> nth=4');
  await page.click('.world-grid button >> nth=0');
  assert.equal(await page.isVisible('#btn-undo'), false);
  // Limit is 8: wander back and forth.
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => !window.__neo.play.anim);
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => !window.__neo.play.anim);
  }
  await page.waitForSelector('#modal:not([hidden])');
  assert.equal(await page.textContent('#modal-title'), 'Out of moves');
  await shot(page, 'precision-fail');
  assert.deepEqual(page.errors, []);
});

test('hint shows the best next move', async () => {
  const page = await newPage({ cleared: 4 });
  await page.click('#modes .mode >> nth=0');
  await page.click('.world-grid button >> nth=3');
  await page.click('#btn-hint');
  const hint = await page.evaluate(() => window.__neo.play.hint);
  const best = await page.evaluate(() => Engine.solve(window.__neo.play.level)[0]);
  assert.equal(hint, best);
  await shot(page, 'hint');
  assert.deepEqual(page.errors, []);
});

test('settings toggle the on-screen arrows', async () => {
  const page = await newPage();
  await dismissIntro(page);
  await page.click('#btn-settings');
  await shot(page, 'settings');
  await page.locator('.settings input >> nth=3').uncheck();
  await page.click('#modal-buttons .primary');
  await page.click('#modes .mode >> nth=0');
  await page.click('.world-grid button >> nth=0');
  assert.equal(await page.isVisible('#dpad'), false);
  assert.deepEqual(page.errors, []);
});

test('walking into a dead end tells the player', async () => {
  // Find the first non-tutorial level with a reachable dead end, and the moves to get there.
  let target = null;
  LEVELS.forEach((def, index) => {
    if (target || def.tutorial) return;
    const level = Engine.parseLevel(def);
    const start = Engine.initialState(level);
    const prev = new Map([[Engine.stateKey(start), null]]);
    const queue = [start];
    while (queue.length && !target) {
      const s = queue.shift();
      for (const dir of Object.keys(Engine.DIRS)) {
        const r = Engine.move(level, s, dir);
        if (r.outcome !== 'ok') continue;
        const key = Engine.stateKey(r.state);
        if (prev.has(key)) continue;
        prev.set(key, { from: Engine.stateKey(s), dir });
        if (!Engine.solve(level, r.state)) {
          const path = [];
          for (let k = key; prev.get(k); k = prev.get(k).from) path.unshift(prev.get(k).dir);
          target = { index, path };
          break;
        }
        queue.push(r.state);
      }
    }
  });
  assert.ok(target, 'some level has a dead end');
  const page = await newPage({ cleared: target.index });
  await page.click('#modes .mode >> nth=0');
  await page.click(`.world-grid button[aria-label^="Level ${target.index + 1}:"]`);
  for (const dir of target.path) {
    await page.keyboard.press(KEY[dir]);
    await page.waitForFunction(() => !window.__neo.play.anim);
  }
  assert.match(await page.textContent('#toast'), /No way to the goal/);
  assert.ok(await page.isVisible('#toast'));
  assert.deepEqual(page.errors, []);
});

test('progress saved by 1.1 is kept, mapped to the same levels by name', async () => {
  const page = await newPage({ fresh: true });
  await page.evaluate(() => localStorage.setItem('neo-bloxorz-v1', JSON.stringify({
    version: 2, seenIntro: { howto: true }, campaign: { 0: 6, 2: 4, 9: 12 }, hinted: { 9: true }, rushBest: 7,
  })));
  await page.reload();
  const store = await page.evaluate(() => window.__neo.store());
  assert.deepEqual(store.campaign, { 'The Sketch': 6, 'Wrong Foot': 4, 'Thin Ice': 12 });
  assert.deepEqual(store.hinted, { 'Thin Ice': true });
  assert.equal(store.rushBest, 7);
  assert.equal(store.version, 3);
  assert.deepEqual(page.errors, []);
});

test('the brand splash shows at launch, then the game', async () => {
  const page = await newPage({ brand: true });
  assert.ok(await page.isVisible('#brand'));
  assert.match(await page.textContent('#brand'), /GHORBEL\s*GAMES/);
  await shot(page, 'brand');
  await page.waitForSelector('#brand', { state: 'hidden', timeout: 4000 });
  assert.ok(await page.isVisible('#home'));
  await page.click('#btn-settings');
  assert.match(await page.textContent('.settings .about'), /Ghorbel Games/);
  assert.deepEqual(page.errors, []);
});

test('ads: banner on menus only, never during play', async () => {
  const page = await newPage({ ads: true, cleared: 4 });
  await page.waitForFunction(() => window.__adsLog.includes('showBanner'));
  await shot(page, 'home-with-banner-space');
  await page.click('#modes .mode >> nth=0');
  await page.click('.world-grid button >> nth=3');
  await page.waitForFunction(() => window.__adsLog.includes('removeBanner'));
  const before = await page.evaluate(() => window.__adsLog.filter((c) => c === 'showBanner').length);
  await page.click('#btn-quit');
  await page.waitForFunction((n) => window.__adsLog.filter((c) => c === 'showBanner').length > n, before);
  // Privacy choices are offered where consent rules apply.
  await page.click('[data-action=home]');
  await page.click('#btn-settings');
  assert.ok(await page.isVisible('text=Privacy choices (ads)'));
  assert.deepEqual(page.errors, []);
});

async function failPrecision(page) {
  await page.click('#modes .mode >> nth=4');
  await page.click('.world-grid button >> nth=0');
  for (let i = 0; i < 4; i++) {
    for (const key of ['ArrowRight', 'ArrowLeft']) {
      await page.keyboard.press(key);
      await page.waitForFunction(() => !window.__neo.play.anim);
    }
  }
  await page.waitForSelector('#modal:not([hidden])');
  assert.equal(await page.textContent('#modal-title'), 'Out of moves');
}

test('ads: a full-screen ad after losing, at most every other loss', async () => {
  const page = await newPage({ ads: true, cleared: 1 });
  await failPrecision(page);
  await page.click('#modal-buttons button >> nth=0'); // Levels (1st loss: no ad)
  await page.click('[data-action=home]');
  assert.equal(await page.evaluate(() => window.__adsLog.filter((c) => c === 'showInterstitial').length), 0);
  await failPrecision(page);
  await page.click('#modal-buttons button >> nth=0'); // 2nd loss: ad
  await page.waitForFunction(() => window.__adsLog.includes('showInterstitial'));
  assert.ok(await page.isVisible('#levels-screen'), 'continues after the ad');
  assert.deepEqual(page.errors, []);
});

test('ads: watch an ad to continue a Descent run, once', async () => {
  const page = await newPage({ ads: true });
  await page.click('#modes .mode >> nth=1');
  await dismissIntro(page);
  await page.waitForFunction(() => window.__neo.session && window.__neo.session.kind === 'run');
  const fallUntilModal = async () => {
    for (let i = 0; i < 12 && !(await page.isVisible('#modal')); i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(700);
    }
    await page.waitForSelector('#modal:not([hidden])');
  };
  await fallUntilModal();
  assert.equal(await page.textContent('#modal-title'), 'Out of hearts');
  await shot(page, 'revive-offer');
  await page.click('#modal-buttons .primary');
  await page.waitForFunction(() => window.__adsLog.includes('showRewardVideoAd'));
  await page.waitForFunction(() => !window.__neo.play.frozen);
  assert.equal(await page.evaluate(() => window.__neo.store().run.hearts), 1);
  await fallUntilModal();
  assert.equal(await page.textContent('#modal-title'), 'Run over', 'no second revive');
  assert.deepEqual(page.errors, []);
});

test('ads: watch an ad for more time in Rush, once', async () => {
  const page = await newPage({ ads: true });
  await page.click('#modes .mode >> nth=2');
  await dismissIntro(page);
  await page.waitForFunction(() => window.__neo.session && window.__neo.session.kind === 'rush');
  await page.evaluate(() => window.__neo.session.tick(1e6));
  await page.waitForSelector('#modal:not([hidden])');
  assert.match(await page.textContent('#modal-body'), /\+30 s/);
  await page.click('#modal-buttons .primary');
  await page.waitForFunction(() => window.__adsLog.includes('showRewardVideoAd'));
  await page.waitForFunction(() => document.getElementById('modal').hidden);
  assert.match(await page.textContent('#chips'), /⏱ (29|30)\./);
  await page.evaluate(() => window.__neo.session.tick(1e6));
  await page.waitForSelector('#modal:not([hidden])');
  assert.match(await page.textContent('#modal-body'), /puzzles solved/);
  assert.doesNotMatch(await page.textContent('#modal-body'), /\+30 s/, 'only once');
  assert.deepEqual(page.errors, []);
});

test('ads: out of hints in Descent, an ad gives one', async () => {
  const page = await newPage({ ads: true });
  await page.click('#modes .mode >> nth=1');
  await dismissIntro(page);
  await page.waitForFunction(() => window.__neo.session && window.__neo.session.kind === 'run');
  await page.evaluate(() => { window.__neo.store().run.hints = 0; });
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => !window.__neo.play.anim);
  assert.equal(await page.textContent('#btn-hint'), 'Hint ▶ ad');
  await page.click('#btn-hint');
  await page.waitForFunction(() => window.__neo.play.hint);
  assert.ok((await page.evaluate(() => window.__adsLog)).includes('showRewardVideoAd'));
  assert.deepEqual(page.errors, []);
});

test('ads: "Remove ads" turns off banners and full-screen ads', async () => {
  const page = await newPage({ ads: true, cleared: 1 });
  await page.waitForFunction(() => window.__adsLog.includes('showBanner'));
  await page.click('#btn-settings');
  await page.click('text=Remove ads');
  assert.equal(await page.textContent('#modal-title'), 'Remove ads');
  await page.click('#modal-buttons .primary');
  await page.evaluate(() => window.__neo.setAdsRemoved(true));
  await page.waitForFunction(() => window.__adsLog.includes('removeBanner'));
  await page.click('#modal-buttons .primary'); // close settings
  await failPrecision(page);
  await page.click('#modal-buttons button >> nth=0');
  await page.click('[data-action=home]');
  await failPrecision(page);
  await page.click('#modal-buttons button >> nth=0');
  await page.waitForTimeout(300);
  const log = await page.evaluate(() => window.__adsLog);
  assert.equal(log.filter((c) => c === 'showInterstitial').length, 0);
  assert.equal(log.lastIndexOf('showBanner') < log.lastIndexOf('removeBanner'), true, 'no banner after removing ads');
  assert.deepEqual(page.errors, []);
});

test('without an ad backend (web), no ad offers appear', async () => {
  const page = await newPage();
  await page.click('#modes .mode >> nth=2');
  await dismissIntro(page);
  await page.waitForFunction(() => window.__neo.session && window.__neo.session.kind === 'rush');
  await page.evaluate(() => window.__neo.session.tick(1e6));
  await page.waitForSelector('#modal:not([hidden])');
  assert.doesNotMatch(await page.textContent('#modal-body'), /ad/);
  assert.deepEqual(page.errors, []);
});
