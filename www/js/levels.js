// Campaign levels. Legend (see engine.js):
//   . void   # floor   X wall   S start   G goal   ! glass (breaks under the big square)
//   a b c d  shape tiles (small / horizontal / vertical / big only)
//   o switch   O heavy switch (big square only)   = bridge (closed)   + bridge (open)
// The S cells give the starting shape, the G cells the shape needed to finish.
// After the two tutorials, levels were found with tools/make-campaign.js and frozen here.
(function (root) {
  const LEVELS = [
    {
      world: 1,
      name: 'The Sketch',
      hint: 'Swipe → ← to roll sideways (width changes), ↑ ↓ to roll up or down (height changes). Reach the goal as the big square.',
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
      hint: 'Rolling into a wall (the raised block) makes the block change shape in place. Bump it to stop on the goal.',
      map: [
        'S#GX',
      ],
    },
    {
      world: 1,
      name: 'Wrong Foot',
      hint: 'Walls let you change shape without moving forward. Use them to get in step with the goal.',
      map: [
        'X###',
        'X###',
        '.###',
        'SG##',
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
      name: 'Thin Ice',
      hint: 'Glass holds every shape except the big square.',
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
      name: 'Fitting In',
      hint: 'Colored tiles only hold the matching shape: teal small, amber horizontal, blue vertical, pink big.',
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
      name: 'Circuit',
      hint: 'Land on a switch to flip every bridge: hidden ones appear, solid ones vanish.',
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
      name: 'Heavyweight',
      hint: 'A heavy switch (thick ring) only clicks under the big square.',
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
