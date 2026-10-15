const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../www/js/engine.js');
const LEVELS = require('../www/js/levels.js');

const { TUTORIAL } = LEVELS;
const MARKS = ['goal', 'walls', 'gates', 'shapes', 'switches', 'bridges'];

function checkMark(level, mark) {
  if (!mark) return;
  if (Array.isArray(mark)) {
    mark.forEach(([x, y]) => assert.ok(level.tiles[y] && level.tiles[y][x] && level.tiles[y][x] !== '.', `mark ${x},${y} is on the board`));
  } else assert.ok(MARKS.includes(mark), `known mark ${mark}`);
}

test('the tutorial is separate from the campaign: roll, bump, rhythm', () => {
  assert.deepEqual(TUTORIAL.map((t) => t.name), ['Roll', 'Bump', 'Out of Step']);
  const names = new Set(LEVELS.map((l) => l.name));
  assert.ok(!names.has('Bump') && !names.has('Out of Step'), 'teaching-only boards are not campaign levels');
});

TUTORIAL.forEach((stage, i) => {
  test(`tutorial stage ${i + 1} "${stage.name}": guided steps are playable and lead to a solvable position`, () => {
    const level = Engine.parseLevel({ name: stage.name, map: stage.map });
    const steps = stage.steps;
    assert.ok(steps.length >= 1);
    const firstFree = steps.findIndex((s) => !s.dir);
    if (firstFree >= 0) assert.ok(steps.slice(firstFree).every((s) => !s.dir), 'guided steps come first');
    let s = Engine.initialState(level);
    let won = false;
    for (const step of steps) {
      assert.ok(step.say && step.say.length > 10, 'each step explains something');
      checkMark(level, step.mark);
      if (!step.dir) continue;
      assert.ok(!won, 'no guided step after the stage is won');
      const r = Engine.move(level, s, step.dir);
      assert.ok(r.outcome === 'ok' || r.outcome === 'win', `guided ${step.dir} must not fall (${r.outcome})`);
      won = r.outcome === 'win';
      s = r.state;
    }
    if (!won) assert.ok(Engine.solve(level, s), 'still solvable after the guided steps');
    if (won) assert.ok(steps.every((st) => st.dir), 'a stage won by guided steps has no free step');
  });
});

test('campaign levels never restrict moves: no guided steps, only notes', () => {
  for (const def of LEVELS) {
    assert.equal(def.tutorial, undefined, `${def.name} has no guided tutorial`);
    if (def.intro) {
      assert.equal(def.intro.dir, undefined, `${def.name}: an intro never waits for a swipe`);
      assert.ok(def.intro.say.length > 10);
      checkMark(Engine.parseLevel(def), def.intro.mark);
    }
  }
});

test('the first campaign level using each mechanic explains it', () => {
  const cases = [
    [/X/, 'walls'],
    [/!/, 'gates'],
    [/[abcd]/, 'shape tiles'],
    [/[o=+]/, 'switches'],
    [/O/, 'heavy switches'],
  ];
  for (const [re, what] of cases) {
    const first = LEVELS.find((l) => re.test(l.map.join('')));
    assert.ok(first.intro, `${first.name} (first with ${what}) has an intro note`);
  }
});
