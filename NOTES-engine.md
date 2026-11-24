# NOTES — engine (dev-engine)

Files: `src/engine.js` (UMD → `globalThis.SB.Engine` + `module.exports`), `tools/sim.js`, `test/engine.smoke.test.js`.
Run: `node test/engine.smoke.test.js` (25 checks, exit 1 on failure) · `node tools/sim.js 0-1 --ticks 600` · `node test/run.js`.

## Tick order (`Engine.step`)
1. `events = []`, `tick++`; read inputs → press edges (held edge OR `jc`/`uc` counter increase). Runs in every phase so edges stay correct.
2. Phase `dead`: count down `phaseTimer`, then reset (same slots, `attempt++`). Phase `clear`: count down only. Otherwise `time++` and:
3. Interact: entered bots handle Down (step out). Active bots with an Up press: unlock if carrying the cell → enter an open hatch → toggle a lever → otherwise the press becomes a jump press.
4. Channels from source states → gates (open at once; close only when nothing overlaps; `openAmt` ±0.125/tick).
5. Platforms move along the path, carrying their rider stacks by the actual dx/dy (blocked riders slide off). They don't move a tick when a rider stack would hit a ceiling. Then saws.
6. Crates, lowest first: pushers (chains included), horizontal move (+ support/conveyor carry), gravity, landing, springs, pit removal.
7. Players, supports first (sorted by feet y descending, then front-most in move direction): X (own vx + support's real dx, leash), then Y (support dy, jump, gravity with midpoint integration). Upward moves lift the whole stack above via `liftY`, which stops at the first ceiling. Lifted riders are flagged so they don't apply the dy twice.
8. Tether, springs (players), crumble timers.
9. Pickups (cell; unlock on contact while carrying it; gears), laser on/off + beam geometry, hazards (pit, spikes, saws, beams), button loads/states, channels re-read, clear check (all present bots entered).

## Decisions on ambiguity
- **Jump physics:** midpoint integration (`y += vy + g/2`). The apex is 83.7 px, matching SPEC's 83.8. The jump-cut is not applied on the takeoff tick itself.
- **No jumping off an airborne support.** A bot may jump only if its support chain ends on something static or a platform. A bot that stands on a jumping or falling bot gets no coyote time. This keeps "2 + bots below" exact: a 2-tower's best timing exploit reaches 113.7 px, under 4 tiles.
- **Riders of a platform** are carried by the platform's step itself; `supportDx/Dy` ignore platforms, so riders are not carried twice.
- **Crates on bots:** a crate can rest on a bot but is not carried horizontally by it.
- **Button plate:** a 6 px tall rect at the tile bottom. Load comes from bodies whose feet are within 2 px of the tile bottom and overlap horizontally.
- **Timer button:** stays on for `time` ticks after release.
- **Gate events:** `gate` fires on each open/close change. `press`/`release` fire on pressed changes, not on `on`.
- **Springs:** the bounce surface is 20 px below the tile top (the spring is 12 px tall). Landing on it launches with SPRING_V. A bot pinned under something does not launch. Springs launch crates too.
- **Lasers:** beam width 6 px. A cycle uses `world.time`, which is ticks in play since the last reset. The beam stops at solids (color walls included), crates, and closed gates.
- **Tether:** position constraint. If both bots are grounded or both airborne, the correction is split half/half. Otherwise the airborne bot is pulled (it hangs, and its outward velocity is cancelled); the grounded anchor moves only if the rope is still more than 2 px over length. All corrections respect collisions.
- **Exit from the hatch:** the bot is placed in front of the hatch (offsets 0, ±26, ±52 px), using the first free spot.
- **`parseLevel`:** also throws if any spawn 1–4 is missing (SPEC: each digit exactly once).
- **Snapshot:** short keys, positions to 0.1 px, at most 32 pending events. It measures up to about 1 KB on all 32 current levels after 3000 fuzz ticks. `applySnapshot` restores players (slot set too), cell, door, entity runtime fields, crumble, gears, channels, beams, phase, phaseTimer, deadSlot, tick, and events.
- **World extras:** `world.time`, `attempt`, `deaths`, `chanAny`, `slots`, `nbots`; laser `x1,y1`; saw `cx,cy`; button `timer`; crate `gone`. Internal links (`sup`, `rest`, `def`, `path`) are non-enumerable, so `JSON.stringify(world.players/entities)` is safe.

## Verification
- Smoke: 25/25.
- QA mechanics: 80/88. The 8 remaining failures are test bugs, listed below.
- Random-input fuzz over all levels: 96k steps with no bot/solid, bot/bot, bot/crate or bot/gate overlap.
- Average step is about 0.015 ms on real levels and 0.06 ms on a 96×26 tether level with entities.

## QA tests that I believe misread SPEC / have harness bugs (test/mechanics.test.js)
1. *jump apex*: `best` is measured only after the 60-tick hold, when the bot has already landed. The apex during the hold is 83.7.
2. *jump buffer (12 before)*: "rise" is `FY - feet`, measured while the bot is still falling from 100 px, so it counts fall height. There is no jump.
3. *1-tile tunnel*: needs 412 px in 150 ticks at RUN 2.6. That is physically impossible (about 165 ticks needed). With 200 ticks the bot gets through.
4–6. *gate passes (3 tests)*: needs 188 px in 60 ticks at RUN 2.6 (about 75 ticks needed). With 120 ticks the bot passes.
7. *one-way plain Jump*: uses a one-tick `press` → JUMP_CUT → a 24 px hop, but the test asks for more than 40. Its own apex test expects a tap to be under 40. Holding jump rises 83.7.
8. *reset*: `scripted()` holds keys for slots 1 and 3, but this test's Sim has slots [0,2], so it hits a TypeError in qa-lib before reaching the engine. `Engine.reset` with [0,2] does restore positions, cell and crate.

## Known limitations
- Tether corrections ignore the leash, and the leash ignores the tether. Both are fine for designed levels.
- A crate riding a bot is not carried sideways.
- A platform moving sideways scrapes riders off against walls rather than refusing to move.
