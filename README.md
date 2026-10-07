# Neo Bloxorz

A 2D mobile puzzle game about a block that changes shape every time it moves.

The block starts as a **small square** in the bottom-left corner:

| Shape | ← / → (toggle width) | ↑ / ↓ (toggle height) |
|---|---|---|
| small square 1×1 | horizontal bar 2×1 | vertical bar 1×2 |
| horizontal bar 2×1 | small square | big square 2×2 |
| vertical bar 1×2 | big square | small square |
| big square 2×2 | vertical bar | horizontal bar |

**Rolling.** The block tips over its own edge, so rolling keeps a fixed rhythm
(thin, thick, thin…): on open floor a spot can only be reached in one shape.

**Bumping.** Rolling into a wall `X` makes the block change shape in place, pressed against
the wall. That shifts its rhythm. Land exactly in the glowing goal, in the shape its outline
shows: working out which walls to bump, and in what order, is the puzzle.

### Tiles
- **Wall** `X` blocks rolling; bump it to change shape in place.
- **Glass** `!` breaks under the big square.
- **Shape tiles** `a` `b` `c` `d` only hold the small square, horizontal bar, vertical bar or big square.
- **Switch** `o` flips every bridge each time the block lands on it.
- **Heavy switch** `O` only clicks under the big square.
- **Bridges**: `=` starts closed, `+` starts open.

## Modes
- **Campaign**: 36 puzzles in 4 worlds (Bump, Glass, Shapes, Circuits), with stars and hints.
  Every mechanic is introduced by a short coached tutorial level (guided swipes, highlighted
  tiles) right before it is needed; the game opens straight into the first one.
- **Descent**: a roguelike run through endless generated floors. 3 hearts, a move budget per floor,
  and a perk to pick after each floor (Extra Heart, Rewind, Stamina, Ghost, Compass, Warp).
- **Rush**: time attack. 90 seconds, each solve buys more time, puzzles get harder.
- **Daily**: one generated puzzle per day (the same for everyone), with a streak counter.
- **Precision**: campaign levels with a strict move limit, no undo and no hints.

Because every move toggles the shape, the board is a grid of slots that alternate thin and
thick, and each slot only fits one shape.

### Tiles
- **Glass** `!` cracks under the big square.
- **Switch** `o` flips every bridge each time the block lands on it.
- **Heavy switch** `O` only clicks under the big square.
- **Bridges**: `=` starts closed, `+` starts open.

## Controls
Swipe on the board, use the on-screen pad, or press the arrow keys/WASD. `U` undoes, `R` restarts, `H` shows a hint.
Dashed outlines show where each swipe would land (can be turned off in Settings).

## Project layout
- `www/` — the game (plain HTML/CSS/JS, no build step)
  - `js/engine.js` — rules and a breadth-first solver (shared with node)
  - `js/levels.js` — campaign level maps (see the legend at the top of the file)
  - `js/generator.js` — seeded procedural puzzles for Descent, Rush and Daily. The goal is
    placed on a position the solver reached, every level is re-solved on its final map, and a
    level is only kept if it needs wall bumps (`Engine.minBumps`). `generateSafe` retries with
    easier settings and ends with a fixed puzzle, so a mode always gets a solvable level.
  - `js/modes.js` — mode rules (hearts, perks, budgets, timers, streaks)
  - `js/audio.js` — synthesized sound effects
  - `js/game.js` — rendering, input, menus, saved progress
- `android/` — Capacitor Android project
- `test/` — unit tests (`npm test`) and Playwright end-to-end tests (`npm run test:e2e`).
  `generated-solvable.test.js` checks ~3,000 generated levels across every mode (all depths
  1–40, Descent runs, Rush sessions and every Daily of a year) with the solver.
- `tools/check-levels.js` — prints every campaign level's par and solution
- `tools/make-campaign.js` — searches generator seeds for campaign levels (where each world's mechanic matters)
- `tools/make-tutorials.js` — searches for the small boards used by the tutorial levels
- `tools/make-icons.js` — renders `www/icon.svg` into the Android icons and splash screens

## Develop
```sh
npm install
npm run serve          # play in the browser at http://localhost:8080
npm test               # unit tests
npm run test:e2e       # end-to-end tests in Chromium
npm run check-levels   # after editing levels
npx cap sync android   # copy www/ into the Android project
npx cap open android   # open in Android Studio
```

## CI and releases
`.github/workflows/ci.yml` runs the unit and end-to-end tests, then builds the APK and uploads it
as the `neo-bloxorz-apk` artifact. To release, bump `version` in `package.json` (the Android
versionName/versionCode follow it), update `RELEASE_NOTES.md`, then either push a matching tag
(`v1.0.0`) or run the CI workflow manually from the Actions tab with **release** ticked. The APK is
attached to the GitHub release.
