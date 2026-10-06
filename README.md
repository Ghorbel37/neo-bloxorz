# Neo Bloxorz

A 2D mobile puzzle game about a block that changes shape every time it moves.

The block starts as a **small square** in the bottom-left corner:

| Shape | ← / → (toggle width) | ↑ / ↓ (toggle height) |
|---|---|---|
| small square 1×1 | horizontal bar 2×1 | vertical bar 1×2 |
| horizontal bar 2×1 | small square | big square 2×2 |
| vertical bar 1×2 | big square | small square |
| big square 2×2 | vertical bar | horizontal bar |

Land exactly in the glowing goal (its outline shows the shape it needs). Don't fall off the board.

## Modes
- **Campaign**: 30 puzzles in 3 worlds (Basics, Glass, Circuits), with stars and hints.
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

## Project layout
- `www/` — the game (plain HTML/CSS/JS, no build step)
  - `js/engine.js` — rules and a breadth-first solver (shared with node)
  - `js/levels.js` — campaign level maps (see the legend at the top of the file)
  - `js/generator.js` — seeded procedural levels for Descent, Rush and Daily
  - `js/modes.js` — mode rules (hearts, perks, budgets, timers, streaks)
  - `js/audio.js` — synthesized sound effects
  - `js/game.js` — rendering, input, menus, saved progress
- `android/` — Capacitor Android project
- `test/` — unit tests (`npm test`) and Playwright end-to-end tests (`npm run test:e2e`)
- `tools/check-levels.js` — prints every campaign level's par and solution
- `tools/make-campaign.js` — searches generator seeds for new campaign levels
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
