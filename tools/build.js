#!/usr/bin/env node
// Builds one version of the game into dist/<target>: a copy of www/ in which the files
// under platforms/<target>/ replace their www/js counterparts (for example platform.js).
//
//   node tools/build.js web       -> dist/web      (GitHub Pages)
//   node tools/build.js android   -> dist/android  (packaged into the APK by Capacitor)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['web', 'android'];

function build(target) {
  if (!TARGETS.includes(target)) throw new Error(`Unknown target "${target}" (use ${TARGETS.join(' or ')})`);
  const out = path.join(ROOT, 'dist', target);
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'www'), out, { recursive: true });
  const overrides = path.join(ROOT, 'platforms', target);
  if (fs.existsSync(overrides)) {
    for (const file of fs.readdirSync(overrides)) fs.copyFileSync(path.join(overrides, file), path.join(out, 'js', file));
  }
  return out;
}

if (require.main === module) {
  const targets = process.argv.slice(2);
  if (!targets.length) targets.push(...TARGETS);
  for (const t of targets) console.log(`built ${path.relative(ROOT, build(t))}`);
}
module.exports = { build, TARGETS };
