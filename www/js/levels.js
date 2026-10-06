// Levels are drawn on a slot grid (see Engine.expandSlots). Counting from the bottom-left,
// even columns/rows are thin (1 tile) and odd ones thick (2 tiles), so a slot's position
// decides the block's shape there: small square, horizontal bar, vertical bar or big square.
// The block always starts as a small square in the bottom-left slot.
//
// Legend:
//   .  void        #  floor        S  start          G  goal
//   !  glass: breaks under the big square
//   o  switch: flips every bridge when the block lands on it
//   O  heavy switch: flips the bridges only under the big square
//   =  bridge, closed at start     +  bridge, open at start
(function (root) {
  const LEVELS = [
    {
      name: 'The Sketch',
      hint: 'Swipe → ← to change width, ↑ ↓ to change height. Reach the goal.',
      map: [
        '###G',
        '####',
        '####',
        'S###',
      ],
    },
    {
      name: 'Long Way Round',
      hint: 'Fall off the edge and you start again.',
      map: [
        '#####',
        '#...#',
        '#.G.#',
        '#.#.#',
        'S.###',
      ],
    },
    {
      name: 'Zigzag',
      map: [
        '..###G',
        '..#...',
        '###...',
        '#.....',
        '###...',
        '..#...',
        'S##...',
      ],
    },
    {
      name: 'Thin Ice',
      hint: 'Glass ! cracks under the big square. The other shapes are light enough.',
      map: [
        '#!#!#',
        '!!!!!',
        '#!#!G',
        '!!!!.',
        'S!#!.',
      ],
    },
    {
      name: 'The Bridge',
      hint: 'Land on a switch o to open the bridges =.',
      map: [
        '##o..',
        '#....',
        '#....',
        '#..#G',
        'S===#',
      ],
    },
    {
      name: 'Heavy',
      hint: 'A heavy switch O only clicks under the big square.',
      map: [
        '...###',
        '...##O',
        '...###',
        '...#..',
        'G==#..',
        '...#..',
        'S###..',
      ],
    },
    {
      name: 'Back and Forth',
      hint: 'Switches flip every bridge, every time you land on them: = opens, + closes.',
      map: [
        '#=#+G',
        '#.#..',
        '#.o..',
        '#.#..',
        'S##..',
      ],
    },
    {
      name: 'Spiral',
      map: [
        '#########',
        '#.......#',
        '#.#####.#',
        '#.#...#.#',
        '#.#.G.#.#',
        '#.#.#.#.#',
        '#.###.#.#',
        '#.....#.#',
        'S######.#',
      ],
    },
    {
      name: 'Glass Garden',
      map: [
        '!!!!!!G',
        '!#!.!#!',
        '!!!.!!!',
        '.!!!!!.',
        '#!#!#!#',
        '!.!!!.!',
        'S!#.#!#',
      ],
    },
    {
      name: 'Lock Step',
      map: [
        '#o#####',
        '#..#..#',
        '#..+..#',
        '=..G..+',
        '#.....#',
        '#.....#',
        'S##o###',
      ],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.LEVELS = LEVELS;
})(this);
