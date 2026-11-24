# NOTES — Level Designer 3 (worlds 5 "Prism" and 6 "Bounce House")

## Files
- `levels/world05.json` and `levels/world06.json` are generated, so do not hand-edit them. Edit the sources in `tools/designer-3/w5.js` and `w6.js` and rerun them (`node tools/designer-3/w5.js`). The shared map builder is `lib.js`.
- `tools/designer-3/check.js` is a quick static checker. `--show` prints maps with rulers, and `--id=5-4` limits it to one level.
- `tools/designer-3/t_w5.js` and `t_w6.js` are closed-loop sim scripts (built on `tools/sim.js`) that prove the key maneuvers. Shared helpers are in `simhelp.js`. The `t_spring.js`, `t_stack.js` and `t_tower.js` files are engine probes.

## Engine facts measured with sim (designs rely on these)
- **Spring, alone:** feet rise about 5.94 tiles. A ledge 5 tiles above the spring's floor is reachable; 6 is not (it misses by about 2 px).
- **Spring with a passenger:** a 2-bot stack walking onto a spring launches together. The rider's feet reach about 6.9 tiles, so the rider can land on a 6-high ledge. Used in 6-1 (gear), 6-4, 6-8 (gear) and 6-10.
- **Springs keep bouncing:** a bot cannot stand on a spring. It bounces until it steers off. Only the bottom bot of a stack needs to walk onto the spring; the riders must not hold a direction.
- **Belts:**
  - Walking against a belt moves a bot at about 1.16 px/tick.
  - A belt carries crates by itself.
  - Pushing a crate upstream nets about -0.2 px/tick, so it can't be done.
  - A belt that runs toward a wall pins a crate on a plate there forever (6-9). A plate at the upstream end makes its holder run in place (6-6).
- **Crumble:** a tile goes 29-30 ticks after first contact. A crate pushed onto a crumble floor falls through (6-5). A single file of 3-4 bots on a long crumble bridge loses its tail; tight 2-stacks or a tower get across (6-8 and 6-10, verified).
- **Color walls:** a bot falls through its own color. Carry-and-swap on a color seam works in the engine (5-2 and 5-10 verified). A lift with a striped ceiling only rises when each rider is under its own stripe (5-8: confirmed it rises in the right order and stalls in the wrong order).

## Decisions
- `minPlayers` is 4 wherever a `c` or `d` wall must be passed: 5-1 and 5-5 through 5-10. 5-4 needs `c`, so it is 3. 5-2 and 5-3 are 2.
- Hints appear only on 5-1 (color walls), 5-2 (own color drops you), 6-1 (springs), 6-2 (crumble), 6-3 (belts) and 6-4 (spring with a passenger).
- Need-4 timer plates (6-8, 6-10) are 4 tiles wide so four bots fit. Their timers are 540 ticks: enough for one trip across as stacks, too short for two batches with a bridge respawn in between.

## Validator status
`node tools/validate-levels.js 5 6` reports 0 ERROR. The remaining notes are expected:
- WARN (5-8): the lift passes through color stripes. This is the intended mechanic.
- HEUR (6-8): the gear at (37,4) looks unreachable because the heuristic doesn't model a stacked spring launch. The sim script collects it.

## Open questions for the engine and QA
- Is the stacked spring launch (rider carried up with the bouncing bot) intended to stay? 6-4 and 6-10 depend on it. If it changes, those levels need a different way up.
- Lifts that pass through color-wall tiles (5-8, `need` 4) rely on the no-crush rule stopping the platform when a rider is under the wrong stripe. Please keep that behaviour.
