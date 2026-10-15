const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { build } = require('../tools/build.js');

const platformOf = (dir) => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(dir, 'js/platform.js'), 'utf8'), ctx);
  return ctx.window.PLATFORM;
};

test('the web build: arrows, no ads', () => {
  const p = platformOf(build('web'));
  assert.deepEqual([p.id, p.arrows, p.ads], ['web', true, false]);
});

test('the Android build: no arrows, ads', () => {
  const p = platformOf(build('android'));
  assert.deepEqual([p.id, p.arrows, p.ads], ['android', false, true]);
});

test('both builds contain the whole game, only platform.js differs', () => {
  const list = (dir) => fs.readdirSync(dir, { recursive: true }).sort();
  const www = path.join(__dirname, '../www');
  const web = build('web');
  const android = build('android');
  assert.deepEqual(list(web), list(www));
  assert.deepEqual(list(android), list(www));
  for (const f of list(www)) {
    if (fs.statSync(path.join(www, f)).isDirectory() || f === path.join('js', 'platform.js')) continue;
    assert.ok(fs.readFileSync(path.join(android, f)).equals(fs.readFileSync(path.join(www, f))), f);
  }
});

test('Capacitor packages the Android build', () => {
  assert.equal(require('../capacitor.config.json').webDir, 'dist/android');
});
