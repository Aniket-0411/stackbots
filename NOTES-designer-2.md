# NOTES: designer-2 (worlds 3 "Switchyard" and 4 "Skyway")

## Files
- Sources: `tools/designer-2/w03.js` and `w04.js`. Maps are drawn either as rows with entity marker letters plus a legend, or as
  `draw` rectangles plus an `ents` list. `node tools/designer-2/build.js [3|4] [--show]` regenerates
  `levels/world03.json` and `world04.json`. **Edit the sources, not the JSON.** `--show` prints maps with a column ruler.
- `tools/designer-2/drive.js` is a goal-driven autopilot on `src/engine.js`. Its tasks are go, runjump, leap, drop, up, enter, until and mark.
- `tools/designer-2/solve.js` holds scripted solutions for all 20 levels. `node tools/designer-2/solve.js [ids]` reports CLEARED or not.
  **All 20 levels clear with 4 bots in the real engine.** Spot checks with 2 bots: 4-9 cleared; in 3-3 the crate alone
  opens the gate (need clamps to 2).

## Validator status (`node tools/validate-levels.js 3 4`): 0 ERROR, 0 WARN
- The 4-6 HEUR "stranded" (4 bots and 2 bots) is a false positive. The heuristic cannot model a crate riding an elevator.
  In 4-6 the crate is pushed onto the floor-flush elevator, rides up as a rider, and becomes the step to the top block.
  It is proven in the engine by `solve.js 4-6`.

## Decisions
- Moving platforms that run nonstop and swap between two ledges (4-1, 4-8, and the 4-10 ferry) run **one row above the ground and
  overlap both ledges by 2-4 tiles**. Pingpong reverses with no pause, so a platform that only touches a ledge edge
  gave too short a boarding window and bots fell (seen in the engine). Now you just hop up 1 tile while it is over the ground.
- 4-7 loop lift: four cabins at speed 1.25 (one every ~4 s). The timers are 960 ticks; the last rider used ~720 in the engine run.
  Both buttons are need 1, so the level also works with 2 bots.
- Spike strips on flat floors (2 wide) are hard to clear from a standstill (the jump covers ~91 px, and clearing needs ~80 px).
  I use spike *pits* instead (spikes one row down), which play like ordinary gaps.
- Tunnel openings (3-6) sit off the main walking line: the entry is behind the spawns, and the exit is a 1-wide hole on the far side.
- `logic: "any"` is used on platforms (4-4). SPEC §6 allows it, the engine honours it, and the updated validator accepts it.
- Timer margins measured in the engine (4-bot runs): 3-4 has about 150 ticks spare (420), 3-9 about 190 (600), 3-10 about 230 (420),
  and 4-8 about 180 (600).

## Engine observations (for dev-engine, nothing blocking)
- A stack jumps together, and a 3-stack can jump onto a 4th bot's head. 4-5's 1-wide "totem lift" relies on this, and it works.
- `ridersOf` does not count a crate resting on a *bot* (`if (!b.isP)`). So a crate that falls onto a stacked bot on an
  elevator is not a rider. This is an edge case; none of my intended solutions need it.
- Several bots all pressing Up at the same hatch can block each other while it is locked (Up = jump). That is fine; it is just a note.
