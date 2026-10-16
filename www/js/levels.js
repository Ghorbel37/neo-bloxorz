// Campaign levels. Legend (see engine.js):
//   . void   # floor   X wall   S start   G goal   ! cracked floor (breaks under the big square)
//   a b c d  shape tiles (small / horizontal / vertical / big only)
//   o switch   O heavy switch (big square only)   = bridge (closed)   + bridge (open)
// The S cells give the starting shape, the G cells the shape needed to finish.
// A level with an `intro` is the first to use a mechanic: the game shows the note and highlights
// the tiles ('goal', 'walls', 'cracks', 'shapes', 'switches', 'bridges' or a list of [x, y]) without
// limiting the player's moves. Levels were found with tools/make-campaign.js and frozen here.
//
// TUTORIAL is separate from the campaign: it plays on first launch and can be replayed from
// Settings. Its steps are { say, dir?, mark? }: a step with `dir` waits for that swipe (other
// swipes are ignored), a step without lets the player finish the stage.
(function (root) {
  const LEVELS = [
    {
      world: 1,
      name: 'The Sketch',
      intro: { say: 'Swipe to roll: ← → change the width, ↑ ↓ the height. Dark gaps are holes: don\'t roll into them. Land in the glowing goal as the big square.', mark: 'goal' },
      map: [
        '####GG',
        '####GG',
        '###.##',
        '#.####',
        '######',
        'S##...',
      ],
    },
    {
      world: 1,
      name: 'Sidestep',
      intro: { say: 'Rolling into a wall changes your shape in place. Use the walls to get in step with the goal.', mark: 'walls' },
      map: [
        'X##.',
        'X##.',
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
        '##X.',
        '#G#X',
        'SG##',
      ],
    },
    {
      world: 1,
      name: 'Rebound',
      map: [
        '..XX.',
        '..XXX',
        '..###',
        'X###.',
        'SG###',
      ],
    },
    {
      world: 1,
      name: 'Ricochet',
      map: [
        '...XXX',
        'X#####',
        'GGXX##',
        'S#####',
      ],
    },
    {
      world: 2,
      name: 'Cracks',
      intro: { say: 'Cracked floor holds the small square and the bars, but the big square is too heavy: it breaks through and falls.', mark: 'cracks' },
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
        '.X....',
        '#!#...',
        '.GG#X.',
        'SGG#XX',
      ],
    },
    {
      world: 2,
      name: 'Hairline',
      map: [
        'X....',
        'X!X##',
        '##.##',
        'GG###',
        'GG!##',
        'SX.X.',
        'XX...',
      ],
    },
    {
      world: 2,
      name: 'Cold Feet',
      map: [
        '#XX...',
        '#!#X..',
        'G###X.',
        'S###XX',
      ],
    },
    {
      world: 2,
      name: 'Shards',
      map: [
        '....XX',
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
        'X.....',
        '#.X!..',
        '##!!!#',
        '###X.#',
        'SX#GX#',
        'XX....',
      ],
    },
    {
      world: 2,
      name: 'Frozen Lake',
      map: [
        '..X....',
        '.XX....',
        'X!#....',
        '##!##XX',
        'GG###..',
        'S###...',
      ],
    },
    {
      world: 2,
      name: 'Splinter',
      map: [
        '..####',
        '##!##.',
        'X##XX.',
        '#!!XX.',
        '##X...',
        '#G#...',
        '!.!X!.',
        'S#####',
      ],
    },
    {
      world: 2,
      name: 'Fault Line',
      map: [
        '....##.',
        '.XX####',
        '.X!####',
        'X#!!#!#',
        'S##XG##',
        '...X...',
      ],
    },
    {
      world: 3,
      name: 'Shape Tiles',
      intro: { say: 'Colored tiles only hold the shape drawn on them. This pink one is for the big square only.', mark: 'shapes' },
      map: [
        '#G###.',
        '#G###.',
        'Sd##XX',
      ],
    },
    {
      world: 3,
      name: 'Fitting In',
      map: [
        '...X.',
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
        '##XX..',
        '##a#X.',
        '#####.',
        'GG###.',
        'SXb#XX',
      ],
    },
    {
      world: 3,
      name: 'Shape Shift',
      map: [
        '.X....',
        '.X....',
        '!#..X.',
        '.####.',
        '.Gb##.',
        'SG##XX',
        '....X.',
      ],
    },
    {
      world: 3,
      name: 'Keyhole',
      map: [
        '####XX',
        '###...',
        '####..',
        '##XX..',
        '##aX..',
        '##G#X.',
        'SXG#..',
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
        'X##X..',
        'X##XX#',
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
        '..X..',
        '..X!.',
        'XX#db',
        'XX##X',
        '.##G.',
        '.S##.',
      ],
    },
    {
      world: 3,
      name: 'Morphology',
      map: [
        '..X...',
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
      intro: { say: 'Dashed tiles are bridges. Landing on a switch (ring) flips every bridge: closed ones open, open ones close.', mark: 'switches' },
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
        'X...X..',
        '#..X#!.',
        '####oXX',
        'GG####X',
        'S#.=##.',
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
        '#####!',
        '.X+###',
        '###X.#',
        '#.###X',
        'o.#=XX',
        '###o#.',
        '.##X#X',
        'S#GG!#',
      ],
    },
    {
      world: 4,
      name: 'Heavy Switch',
      intro: { say: 'A heavy switch (thick ring) only clicks under the big square.', mark: 'switches' },
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
        '#+#X..',
        '#O##XX',
        '###...',
        '####X.',
        '###...',
        '##=...',
        '!XGG..',
        'S#GGX.',
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
        'X....',
        'XXO#X',
        '####X',
        '###X.',
        '#+X..',
        '=!#..',
        'O##X.',
        'G#X..',
        '##X..',
        'S#X..',
      ],
    },
  ];

  const TUTORIAL = [
    {
      name: 'Roll',
      steps: [
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
      name: 'Bump',
      steps: [
        { dir: 'right', say: 'Raised blocks are walls. Swipe → to roll toward this one.', mark: [[3, 0]] },
        { dir: 'right', say: 'The bar can\'t roll into the wall, so it bumps it and changes shape in place. Swipe → to bump!', mark: [[3, 0]] },
      ],
      map: [
        'S#GX',
      ],
    },
    {
      name: 'Out of Step',
      steps: [
        { dir: 'right', say: 'The goal is right next to you. Try rolling onto it: swipe →.', mark: 'goal' },
        { say: 'Rolled past it! Rolling keeps a rhythm, so you skip that spot. Bump the wall to get in step. Dashed outlines show where each swipe lands.', mark: [[0, 1]] },
      ],
      map: [
        '###',
        'X##',
        'SG#',
      ],
    },
  ];

  const WORLDS = ['Bump', 'Cracks', 'Shapes', 'Circuits'];

  if (typeof module !== 'undefined' && module.exports) module.exports = Object.assign(LEVELS, { WORLDS, TUTORIAL });
  else { root.LEVELS = LEVELS; root.WORLDS = WORLDS; root.TUTORIAL = TUTORIAL; }
})(typeof window !== "undefined" ? window : globalThis);
