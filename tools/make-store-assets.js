#!/usr/bin/env node
// Renders the Google Play store assets into docs/play-store/: phone screenshots
// (1080x1920), the feature graphic (1024x500) and the 512x512 icon.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const LEVELS = require('../www/js/levels.js');

const OUT = path.join(__dirname, '../docs/play-store');
const URL = 'file://' + path.join(__dirname, '../www/index.html');
const ICON = fs.readFileSync(path.join(__dirname, '../www/icon.svg'), 'utf8');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const executablePath = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  const browser = await chromium.launch({ executablePath });

  async function phone(cleared, setup) {
    const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
    await page.addInitScript((names) => {
      const campaign = {};
      names.forEach((n, i) => { campaign[n] = [6, 2, 4, 5, 8, 9, 8, 13, 11, 8][i % 10]; });
      localStorage.setItem('neo-bloxorz-v1', JSON.stringify({ version: 3, seenIntro: { howto: true, run: true, rush: true }, campaign, runBest: 7, rushBest: 12, settings: { sound: false } }));
    }, LEVELS.slice(0, cleared).map((l) => l.name));
    await page.goto(URL);
    await page.evaluate(() => { const b = document.getElementById('brand'); b.classList.add('out'); b.hidden = true; });
    await setup(page);
    await page.waitForTimeout(500);
    return page;
  }
  const openLevel = async (page, name, moves = []) => {
    const i = LEVELS.findIndex((l) => l.name === name);
    await page.click('#modes .mode >> nth=0');
    await page.click(`.world-grid button[aria-label^="Level ${i + 1}:"]`);
    for (const key of moves) { await page.keyboard.press(key); await page.waitForTimeout(250); }
  };
  const shots = [
    ['1-home', 14, async () => {}],
    ['2-tutorial', 0, async (p) => { await p.evaluate(() => document.querySelector('[data-action=home]').click()); await openLevel(p, 'The Sketch'); }],
    ['3-bump', 3, async (p) => openLevel(p, 'Bump', ['ArrowRight'])],
    ['4-glass', 20, async (p) => openLevel(p, 'Shards', ['ArrowUp', 'ArrowUp', 'ArrowRight'])],
    ['5-levels', 20, async (p) => p.click('#modes .mode >> nth=0')],
    ['6-descent', 0, async (p) => { await p.click('#modes .mode >> nth=1'); await p.waitForTimeout(300); }],
    ['7-switch', 36, async (p) => openLevel(p, 'Relay', ['ArrowRight', 'ArrowUp'])],
    ['8-howto', 0, async (p) => { await p.click('#btn-howto'); await p.waitForTimeout(300); }],
  ];
  for (const [name, cleared, setup] of shots) {
    const page = await phone(cleared, setup);
    await page.screenshot({ path: path.join(OUT, `screenshot-${name}.png`) });
    await page.close();
  }

  // Feature graphic 1024x500.
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
  await page.setContent(`<html><body style="margin:0;width:1024px;height:500px;overflow:hidden;
    background:radial-gradient(80% 90% at 30% 40%,#1b2050,#0b0d1a);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e8ebff">
    <div style="position:absolute;left:70px;top:110px">
      <div style="font-size:24px;letter-spacing:6px;color:#8a91c4">GHORBEL GAMES</div>
      <div style="font-size:92px;font-weight:900;letter-spacing:6px;line-height:1.05;margin-top:8px">NEO<br><span style="color:#39f3c8;text-shadow:0 0 30px #39f3c880">BLOXORZ</span></div>
      <div style="font-size:28px;color:#8a91c4;margin-top:14px">Roll. Morph. Fit.</div>
    </div>
    <div style="position:absolute;right:70px;top:70px;width:360px;height:360px">${ICON.replace('<rect width="108" height="108" fill="#0b0d1a"/>', '').replace('<svg ', '<svg width="360" height="360" ')}</div>
  </body></html>`);
  await page.screenshot({ path: path.join(OUT, 'feature-graphic.png') });
  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(`<html><body style="margin:0">${ICON.replace('<svg ', '<svg width="512" height="512" ')}</body></html>`);
  await page.screenshot({ path: path.join(OUT, 'icon-512.png') });
  await browser.close();
  console.log('store assets written to docs/play-store/');
})();
