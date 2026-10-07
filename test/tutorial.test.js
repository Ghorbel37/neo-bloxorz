const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../www/js/engine.js');
const LEVELS = require('../www/js/levels.js');

const tutorials = LEVELS.map((def, index) => ({ def, index })).filter(({ def }) => def.tutorial);
const MARKS = ['goal', 'glass', 'shapes', 'switches', 'bridges'];

test('each mechanic is introduced by a tutorial level before it is needed', () => {
  const firstUse = (re) => LEVELS.findIndex((l) => re.test(l.map.join('')));
  const introOf = (name) => LEVELS.findIndex((l) => l.name === name && l.tutorial);
  const cases = [
    ['The Sketch', /./],
    ['Bump', /X/],
    ['Glass', /!/],
    ['Shape Tiles', /[abcd]/],
    ['Switch', /[o=+]/],
    ['Heavy Switch', /O/],
  ];
  for (const [name, re] of cases) {
    const intro = introOf(name);
    assert.ok(intro >= 0, `${name} tutorial exists`);
    assert.equal(firstUse(re), Math.min(firstUse(re), intro), `${name} comes no later than the first level using it`);
    assert.ok(firstUse(re) >= intro, `${name} is introduced before it is used`);
  }
  assert.equal(LEVELS[0].tutorial && LEVELS[0].name, 'The Sketch', 'the game starts with a tutorial');
});

for (const { def, index } of tutorials) {
  test(`tutorial ${index + 1} "${def.name}": guided steps are playable and lead to a solvable position`, () => {
    const level = Engine.parseLevel(def);
    const steps = def.tutorial;
    assert.ok(steps.length >= 1);
    // Guided steps come first, free play after.
    const firstFree = steps.findIndex((s) => !s.dir);
    if (firstFree >= 0) assert.ok(steps.slice(firstFree).every((s) => !s.dir), 'guided steps are a prefix');
    let s = Engine.initialState(level);
    let won = false;
    for (const step of steps) {
      assert.ok(step.say && step.say.length > 10, 'each step explains something');
      if (step.mark) {
        if (Array.isArray(step.mark)) {
          step.mark.forEach(([x, y]) => assert.ok(level.tiles[y] && level.tiles[y][x] && level.tiles[y][x] !== '.', `mark ${x},${y} is on the board`));
        } else assert.ok(MARKS.includes(step.mark), `known mark ${step.mark}`);
      }
      if (!step.dir) continue;
      assert.ok(!won, 'no guided step after the level is won');
      const r = Engine.move(level, s, step.dir);
      assert.ok(r.outcome === 'ok' || r.outcome === 'win', `guided ${step.dir} must not fall (${r.outcome})`);
      won = r.outcome === 'win';
      s = r.state;
    }
    if (!won) assert.ok(Engine.solve(level, s), 'still solvable after the guided steps');
    if (won) assert.ok(steps.every((st) => st.dir), 'a level won by guided steps has no free step');
  });
}
