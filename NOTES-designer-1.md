# NOTES — designer-1 (worlds 1, 2 and 8)

## Files
- Level sources: `tools/designer-1/src/world01.js`, `world02.js`, `world08.js` (tiny map DSL in `lib.js`).
  `node tools/designer-1/build.js` regenerates `levels/world01.json`, `world02.json`, `world08.json`. Edit the sources, not the JSON.
- `tools/designer-1/check.js`: my own structural + rough reachability checker (worlds 1-2).
- `tools/designer-1/drive.js`: closed-loop autopilot on top of `tools/sim.js` (walk to a column, jump to a column, push, enter).
- Proofs in the real engine: `prove-w1.js` (1-1), `prove-w2.js` (2-7, 2-8), `prove-w8.js` (all of world 8, with 4 bots and with minPlayers bots).

## Validator status (`node tools/validate-levels.js 1 2 8`): 0 ERROR
- W2 HEUR "stranded" on 2-7 and 2-10: false positives. The validator does not model a crate dropped onto another crate
  (2-7's A+B stairs, 2-10's fridge+box). 2-7 is proven in the engine with 2 bots; 2-10 uses the same move.
- W8 WARN 8-2 `laser.logic` "unknown field": SPEC §6 says every target (gate, platform, laser) reads its channel with its
  `logic`, and the engine honours it. The validator's allowed-field list for lasers lacks `logic`. **For QA.**
- W8 WARN 8-3 / 8-5 "beam crosses the Power Cell": intended. The cell sits in the beam and you shield your way to it.

## Decisions
- Laser emitters that a shield crate could reach are placed **inside a wall tile**. The engine starts the beam at the
  wall face, so a crate can never slide into the emitter tile, which would let the beam pass behind the crate.
- World 8 uses no cycling (on/off) lasers. SPEC §8 and the QA scope check introduce them in world 9, so W8 uses
  channel lasers (hold, timer and crate-held buttons, plus a lever/gate shutter) and always-on lasers.
- Timer windows were measured in the engine: 8-4 leaves about 130 ticks spare after a direct dash, and 8-9 leaves about 2 s
  even when the autopilot stumbles into the pit.
- 8-8 lift: `need: 2` with the crate counting as a rider. The crate parks against the right wall and can never be pushed
  off, so it shuttles up and down as a permanent umbrella. A higher need could strand the last bot (need clamps to the bot count).
- Hatch entry: only the cell carrier can open the hatch. If someone presses Up first while it is still locked, they just jump.

## Engine observations (no changes needed)
- A crate on a belt moves at belt speed with no pushers. Pushing against a belt nets -0.2 px/tick, so it is impossible. 8-1, 8-6 and 8-10 use this.
- A crate stops 0.3 px short of falling if the pushers stop exactly at the ledge, so push a hair past it. This is fine for players.
