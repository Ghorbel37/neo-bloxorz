## Neo Bloxorz 1.2.0: learn by playing

### In-game tutorial
- The game now opens straight into a coached tutorial. Each mechanic gets a short intro level
  right before it is needed: rolling, bumping walls, the rhythm idea, glass, shape tiles,
  switches and heavy switches.
- A speech bubble explains, an arrow shows which way to swipe (the matching on-screen button
  pulses), and the tiles being talked about are highlighted. First you are guided, then you
  finish the level on your own.

### Always solvable
- Generated levels (Descent, Rush, Daily) are built from positions the solver actually reached
  and re-solved on their final map. The generator can no longer fail: it retries with easier
  settings and has a tested fallback puzzle. The test suite now checks about 3,000 generated
  levels, including every Daily of a year.
- Fixed: tidying a generated board could remove a wall that a roll two tiles away would bump.
- New: if a move leaves no way to the goal (for example a switch flipped at the wrong time),
  the game tells you right away so you can undo or restart.

### Install
Download `neo-bloxorz-v1.2.0.apk` below and open it on your Android phone. It installs over
earlier versions and keeps your progress.
