// Campaign levels. Legend (see engine.js):
//   . void   # floor   X wall   S start   G goal   ! glass (breaks under the big square)
//   a b c d  shape tiles (small / horizontal / vertical / big only)
//   o switch   O heavy switch (big square only)   = bridge (closed)   + bridge (open)
// The S cells give the starting shape, the G cells the shape needed to finish.
// Levels with a `tutorial` introduce a mechanic with coached steps (boards found with
// tools/make-tutorials.js); the others were found with tools/make-campaign.js and frozen here.
// Tutorial steps: { say, dir?, mark? }. A step with `dir` waits for that swipe; one without
// lets the player finish the level. `mark` highlights tiles: a list of [x, y] or one of
// 'goal', 'glass', 'shapes', 'switches', 'bridges'.
(function (root) {
  const LEVELS = [
    {
      world: 1,
      name: 'The Sketch',
      tutorial: [
        { dir: 'right', say: 'Swipe right → to roll. The small square tips over and becomes a horizontal bar.' },
        { dir: 'right', say: 'Swipe → again: the bar rolls over and becomes a small square.' },
        { dir: 'right', say: 'Every move changes the shape. Swipe → once more.' },
        { dir: 'up', say: 'Up and down change the height. Swipe ↑: the bar becomes the big square.' },
        { say: 'Keep going up and land exactly in the glowing goal, in its shape.', mark: 'goal' },
      ],
      map: [
        '####GG',
        '####GG',
        '######',
        '######',
        '######',
        'S#####',
      ],
    },
    {
      world: 1,
      name: 'Bump',
      tutorial: [
        { dir: 'right', say: 'Raised blocks are walls. Swipe → to roll toward this one.', mark: [[3, 0]] },
        { dir: 'right', say: 'The bar can\'t roll into the wall, so it bumps it and changes shape in place. Swipe → to bump!', mark: [[3, 0]] },
      ],
      map: [
        'S#GX',
      ],
    },
    {
      world: 1,
      name: 'Out of Step',
      tutorial: [
        { dir: 'right', say: 'The goal is right next to you. Try rolling onto it: swipe →.', mark: 'goal' },
        { say: 'Rolled past it! Rolling keeps a rhythm, so you skip that spot. Bump the wall to get in step. Dashed outlines show where each swipe lands.', mark: [[0, 1]] },
      ],
      map: [
        '###',
        'X##',
        'SG#',
      ],
    },
    {
      world: 1,
      name: 'Sidestep',
      map: [
        'X##.',
        '.##.',
        'S#GG',
      ],
    },
    {
      world: 1,
      name: 'Off Beat',
      map: [
        'X...',
        '###X',
        'G###',
        'S###',
      ],
    },
    {
      world: 1,
      name: 'Backspin',
      map: [
        '##X.',
        '##..',
        '##..',
        'SG#X',
      ],
    },
    {
      world: 1,
      name: 'Double Take',
      map: [
        'X...',
        'GG..',
        'GG#X',
        'S##.',
      ],
    },
    {
      world: 1,
      name: 'Rebound',
      map: [
        '...XX',
        '..###',
        'X###.',
        'SG###',
      ],
    },
    {
      world: 1,
      name: 'Ricochet',
      map: [
        '...X.X',
        'X#####',
        'GG.X##',
        'S#####',
      ],
    },
    {
      world: 2,
      name: 'Glass',
      tutorial: [
        { say: 'Glass holds the small square and the bars, but the big square is too heavy: it breaks through. Find a way around.', mark: 'glass' },
      ],
      map: [
        'X###',
        '#!GG',
        '##GG',
        'S###',
      ],
    },
    {
      world: 2,
      name: 'Thin Ice',
      map: [
        '.X...',
        '#!#..',
        '.GG#.',
        'SGG#X',
      ],
    },
    {
      world: 2,
      name: 'Hairline',
      map: [
        'X!X##',
        '##.##',
        'GG###',
        'GG!##',
        'SX.X.',
      ],
    },
    {
      world: 2,
      name: 'Cold Feet',
      map: [
        '#XX..',
        '#!#X.',
        'G###.',
        'S###X',
      ],
    },
    {
      world: 2,
      name: 'Shards',
      map: [
        '....X.',
        '...##X',
        '##!X##',
        '##!X!#',
        '#XGG!#',
        'S#GG##',
      ],
    },
    {
      world: 2,
      name: 'Crackle',
      map: [
        'X.....',
        '#.X!..',
        '##!!!#',
        '###X.#',
        'SX#GX#',
      ],
    },
    {
      world: 2,
      name: 'Frozen Lake',
      map: [
        '.XX...',
        'X!#...',
        '##!##X',
        'GG###.',
        'S###..',
      ],
    },
    {
      world: 2,
      name: 'Splinter',
      map: [
        '..####',
        '##!##.',
        'X##XX.',
        '#!!X..',
        '##X...',
        '#G#...',
        '!.!X!.',
        'S#####',
      ],
    },
    {
      world: 2,
      name: 'Hall of Glass',
      map: [
        '....##.',
        '..X####',
        '.X!####',
        'X#!!#!#',
        'S##XG##',
      ],
    },
    {
      world: 3,
      name: 'Shape Tiles',
      tutorial: [
        { say: 'Colored tiles only hold the shape drawn on them. This pink one is for the big square only.', mark: 'shapes' },
      ],
      map: [
        '#G###',
        '#G###',
        'Sd##X',
      ],
    },
    {
      world: 3,
      name: 'Fitting In',
      map: [
        '...X.',
        'X..#.',
        '####.',
        'G#b#b',
        'SX.#.',
      ],
    },
    {
      world: 3,
      name: 'Square Peg',
      map: [
        '##X..',
        '##a#X',
        '#####',
        'GG###',
        'SXb#X',
      ],
    },
    {
      world: 3,
      name: 'Shape Shift',
      map: [
        '.X...',
        '!#..X',
        '.####',
        '.Gb##',
        'SG##X',
      ],
    },
    {
      world: 3,
      name: 'Keyhole',
      map: [
        '####X',
        '###..',
        '####.',
        '##...',
        '##aX.',
        '##G#X',
        'SXG#.',
      ],
    },
    {
      world: 3,
      name: 'Mold',
      map: [
        '###...',
        'Xb#b#X',
        '.##!##',
        '###.##',
        '#GX###',
        'SG##XX',
      ],
    },
    {
      world: 3,
      name: 'Silhouette',
      map: [
        '.##X..',
        'X##.X#',
        '###!.#',
        '##cX!c',
        '######',
        '#G#..X',
        'SG##c.',
      ],
    },
    {
      world: 3,
      name: 'Jigsaw',
      map: [
        '.X!.',
        'X#db',
        'X##X',
        '##G.',
        'S##.',
      ],
    },
    {
      world: 3,
      name: 'Morphology',
      map: [
        '..X..a',
        '.!#!##',
        '..!##!',
        '.##Xc#',
        '####X.',
        '#X!#c.',
        '#G!b#X',
        'SG..#X',
      ],
    },
    {
      world: 4,
      name: 'Switch',
      tutorial: [
        { dir: 'up', say: 'Dashed tiles are bridges, closed for now. Swipe ↑ onto the switch.', mark: 'switches' },
        { say: 'The bridge appeared! Each time you land on a switch, every bridge flips: open ones close, closed ones open.', mark: 'bridges' },
      ],
      map: [
        'o#=#',
        '#GG#',
        'SX##',
      ],
    },
    {
      world: 4,
      name: 'Circuit',
      map: [
        'X...X.',
        '#..X#!',
        '####oX',
        'GG####',
        'S#.=##',
      ],
    },
    {
      world: 4,
      name: 'Live Wire',
      map: [
        '###.',
        '###X',
        'o##X',
        'X##.',
        '+##.',
        '##..',
        'SG#.',
      ],
    },
    {
      world: 4,
      name: 'Relay',
      map: [
        '..#.X#',
        '.X!o##',
        '#.X#+!',
        '##!##X',
        '####X#',
        'G#####',
        'S##.##',
      ],
    },
    {
      world: 4,
      name: 'Flip Flop',
      map: [
        '.#...',
        '.#!..',
        '.#...',
        '##X..',
        '##X..',
        '#=#..',
        '####X',
        'SGo##',
      ],
    },
    {
      world: 4,
      name: 'Heavy Switch',
      tutorial: [
        { say: 'A heavy switch (thick ring) only clicks under the big square. Open the bridge to reach the goal.', mark: 'switches' },
      ],
      map: [
        'X=GG',
        '####',
        '.O##',
        'S###',
      ],
    },
    {
      world: 4,
      name: 'Heavyweight',
      map: [
        '#+#X.',
        '#O##X',
        '###..',
        '####X',
        '###..',
        '##=..',
        '!XGG.',
        'S#GGX',
      ],
    },
    {
      world: 4,
      name: 'Overload',
      map: [
        '.#.....',
        'X#.....',
        '#O.#..X',
        '#####X#',
        '#X=#!##',
        'GG####=',
        'S.c#O##',
      ],
    },
    {
      world: 4,
      name: 'Blackout',
      map: [
        'X.O#X',
        '####.',
        '###X.',
        '#+X..',
        '=!#..',
        'O##X.',
        'G#...',
        '##X..',
        'S#X..',
      ],
    },
  ];

  const WORLDS = ['Bump', 'Glass', 'Shapes', 'Circuits'];

  if (typeof module !== 'undefined' && module.exports) module.exports = Object.assign(LEVELS, { WORLDS });
  else { root.LEVELS = LEVELS; root.WORLDS = WORLDS; }
})(typeof window !== "undefined" ? window : globalThis);
