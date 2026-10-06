// End-to-end smoke tests: load the real page in Chromium and play through every mode.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const Engine = require('../../www/js/engine.js');
const LEVELS = require('../../www/js/levels.js');

const URL = 'file://' + path.resolve(__dirname, '../../www/index.html');
const KEY = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };
const SHOTS = process.env.SCREENSHOT_DIR;

let browser;
test.before(async () => {
  const executablePath = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  browser = await chromium.launch({ executablePath });
});
test.after(async () => { if (browser) await browser.close(); });

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  page.errors = errors;
  return page;
}

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function playSolution(page, map) {
  const level = Engine.parseLevel({ name: 'x', map });
  for (const dir of Engine.solve(level)) {
    await page.keyboard.press(KEY[dir]);
    await page.waitForFunction(() => !window.__neo.play.anim);
  }
}

async function dismissIntro(page) {
  if (await page.isVisible('#modal')) await page.click('#modal-buttons .primary');
}

test('first launch shows how to play, then the home screen with 5 modes', async () => {
  const page = await newPage();
  assert.ok(await page.isVisible('#modal'));
  await shot(page, 'howto');
  await dismissIntro(page);
  assert.equal(await page.locator('#modes .mode').count(), 5);
  await shot(page, 'home');
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
  assert.equal(store.campaign[0], 6);
  // Progress survives a reload, and level 2 is unlocked.
  await page.reload();
  await page.click('#modes .mode >> nth=0');
  assert.equal(await page.locator('.world-grid button >> nth=1').isDisabled(), false);
  assert.equal(await page.locator('.world-grid button >> nth=2').isDisabled(), true);
  assert.deepEqual(page.errors, []);
});

test('campaign: every level can be finished in the real game', async () => {
  const page = await newPage();
  await dismissIntro(page);
  await page.evaluate((n) => {
    const s = window.__neo.store();
    for (let i = 0; i < n; i++) s.campaign[i] = 999;
  }, LEVELS.length);
  for (let i = 0; i < LEVELS.length; i++) {
    await page.evaluate(() => document.querySelector('[data-action=home]').click());
    await page.click('#modes .mode >> nth=0');
    await page.click(`.world-grid button[aria-label^="Level ${i + 1}:"]`);
    if (i === 20) await shot(page, 'level21');
    await playSolution(page, LEVELS[i].map);
    await page.waitForSelector('#modal:not([hidden])');
    assert.equal(await page.textContent('#modal-title'), 'Solved!', `level ${i + 1}`);
    await page.click('#modal-buttons button >> nth=0'); // close via Replay to keep the loop simple
  }
  assert.deepEqual(page.errors, []);
});

test('falling restarts the level', async () => {
  const page = await newPage();
  await dismissIntro(page);
  await page.click('#modes .mode >> nth=0');
  await page.click('.world-grid button >> nth=0');
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
  const map = await page.evaluate(() => window.__neo.play.level.slots);
  await playSolution(page, map);
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
  const map = await page.evaluate(() => window.__neo.play.level.slots);
  await playSolution(page, map);
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
  const map = await page.evaluate(() => window.__neo.play.level.slots);
  await playSolution(page, map);
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
    s.campaign[0] = 6;
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
  const page = await newPage();
  await dismissIntro(page);
  await page.click('#modes .mode >> nth=0');
  await page.click('.world-grid button >> nth=0');
  await page.click('#btn-hint');
  const hint = await page.evaluate(() => window.__neo.play.hint);
  assert.ok(['right', 'up'].includes(hint));
  await shot(page, 'hint');
  assert.deepEqual(page.errors, []);
});

test('settings toggle the on-screen arrows', async () => {
  const page = await newPage();
  await dismissIntro(page);
  await page.click('#btn-settings');
  await shot(page, 'settings');
  await page.locator('.settings input >> nth=2').uncheck();
  await page.click('#modal-buttons .primary');
  await page.click('#modes .mode >> nth=0');
  await page.click('.world-grid button >> nth=0');
  assert.equal(await page.isVisible('#dpad'), false);
  assert.deepEqual(page.errors, []);
});
