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

Because every move toggles the shape, the board is a grid of slots that alternate thin and
thick, and each slot only fits one shape.

### Tiles
- **Glass** `!` cracks under the big square.
- **Switch** `o` flips every bridge each time the block lands on it.
- **Heavy switch** `O` only clicks under the big square.
- **Bridges**: `=` starts closed, `+` starts open.

## Controls
Swipe on the board, use the on-screen pad, or press the arrow keys/WASD. `U` undoes, `R` restarts.

## Project layout
- `www/` — the game (plain HTML/CSS/JS, no build step)
  - `js/engine.js` — rules and a breadth-first solver (shared with node)
  - `js/levels.js` — level maps (see the legend at the top of the file)
  - `js/game.js` — rendering, input, menus, saved progress
- `android/` — Capacitor Android project
- `tools/check-levels.js` — verifies every level is solvable and prints its par

## Develop
```sh
npm install
npm run serve          # play in the browser at http://localhost:8080
npm run check-levels   # after editing levels
npx cap sync android   # copy www/ into the Android project
npx cap open android   # open in Android Studio
```

## CI
`.github/workflows/android.yml` builds a debug APK on every push and uploads it as the
`neo-bloxorz-apk` artifact. Pushing a `v*` tag also attaches the APK to a GitHub release.
