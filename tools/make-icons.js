#!/usr/bin/env node
// Renders www/icon.svg into the Android launcher icons (run after editing the icon).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const svg = fs.readFileSync(path.join(__dirname, '../www/icon.svg'), 'utf8');
const res = path.join(__dirname, '../android/app/src/main/res');
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

(async () => {
  const executablePath = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  const browser = await chromium.launch({ executablePath });
  const page = await browser.newPage();
  async function render(file, size, { round = false, crop = 1, transparent = false } = {}) {
    // crop < 1 zooms into the middle of the 108dp canvas (legacy icons use the 72dp center).
    const inner = transparent ? svg.replace('<rect width="108" height="108" fill="#0b0d1a"/>', '') : svg;
    const scale = 1 / crop;
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">
      <div style="width:${size}px;height:${size}px;overflow:hidden;border-radius:${round ? '50%' : `${size * 0.18}px`};${transparent ? 'border-radius:0' : ''}">
        <div style="width:${size}px;height:${size}px;transform:scale(${scale})">${inner.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>
      </div></body></html>`);
    await page.screenshot({ path: file, omitBackground: true });
  }
  for (const [d, m] of Object.entries(DENSITIES)) {
    const dir = path.join(res, `mipmap-${d}`);
    await render(path.join(dir, 'ic_launcher.png'), Math.round(48 * m), { crop: 0.72 });
    await render(path.join(dir, 'ic_launcher_round.png'), Math.round(48 * m), { crop: 0.72, round: true });
    await render(path.join(dir, 'ic_launcher_foreground.png'), Math.round(108 * m), { transparent: true });
  }
  // Splash screens: dark background with the logo, same size as the existing files.
  for (const dir of fs.readdirSync(res).filter((d) => d.startsWith('drawable'))) {
    const file = path.join(res, dir, 'splash.png');
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const logo = Math.round(Math.min(width, height) * 0.45);
    await page.setViewportSize({ width, height });
    await page.setContent(`<html><body style="margin:0;background:#0b0d1a;display:flex;align-items:center;justify-content:center;width:${width}px;height:${height}px">
      ${svg.replace('<svg ', `<svg width="${logo}" height="${logo}" `)}</body></html>`);
    await page.screenshot({ path: file });
  }
  await browser.close();
  console.log('icons written');
})();
