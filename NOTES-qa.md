# NOTES-qa

## Tools
- `node tools/validate-levels.js [worldNN|N|W-L ...] [--examples] [--json] [--errors] [--no-heur]`
- `node tools/validate-levels.js --show 3-4:2` prints the map with a reachability overlay for slot 2 (+ reachable alone, digits = number of boosted climbs needed, ! = stranding pocket).
- `node test/run.js [-v] [filter]` runs test/*.test.js in child processes. `QA_ONLY=regex node test/mechanics.test.js` runs a subset; `QA_LEVELS=^3- node test/levels.test.js` runs a subset of levels.
- Shared helpers: test/qa-lib.js (MapB synthetic map builder, Sim input wrapper).

## Decisions / interpretations of SPEC
- Positions in validator output are [col,row] = entity x,y.
- Severity: ERROR = SPEC contract broken (exit 1). WARN = probably wrong. HEUR = output of the optimistic reachability model; needs a human check.
- Mechanic scope (§8): a mechanic used before its world → WARN (world 10 may use anything). Lasers are introduced in W8 and cycling lasers/saws in W9. World 1 with entities, a W7 level without tether, or a W8 level with tether → ERROR.
- Spawns: '#', '=', '<', '>' count as solid ground (as for D). A spawn on its own color wall → ERROR. A spawn on '-' or on another bot's color wall → WARN.
- Laser beam over a spawn while ON at start (always/cycling/channel inactive) → ERROR. Saw within radius-2 of a spawn → ERROR; within +20 px → WARN.
- Reachability model: standable = passable cell (not solid for that slot, not spikes/static saw/always-on laser) with solid / '-' / crate top (any position the crate can slide or fall to) / platform path cell below. Jumps are checked with real §3 flight times (apex 83.8 px, RUN 2.6, ceilings capping the apex). Tower climbs need k other bots able to reach the base cell. A climb is "safe" if every helper can still reach the hatch alone from the base. "stranded" = the hatch is only reachable through unsafe climbs. "pocket" = cells reachable alone from which the hatch can no longer be reached alone.
- Gates are treated as open and channel lasers as off (optimistic), so puzzles built on switches are not flagged. Moving saws and cycling lasers count as passable.
- Mechanics tests encode the SPEC literally. Some judgement calls: a crate that falls out of the map must disappear from entities or be flagged (dead/gone/removed/alive=false); coyote is checked at 3 and 8 ticks, the jump buffer at 3 and 12 ticks; the pit death limit is body top > rows*32+64 (tolerance 13 px).

## Round 1-2 decisions
- Round-1 mechanics disputes (8) were all test bugs, not engine bugs, and were fixed without loosening the SPEC numbers:
  - The apex was measured only after landing; the jump buffer counted fall height as rise.
  - The tunnel and gate tests had too few ticks to walk the distance.
  - The one-way test used a 1-tick jump tap, which JUMP_CUT turns into a ~24 px hop.
  - scripted() pressed keys for absent slots.
- `logic` is legal on every channel target (gate, platform, laser) per SPEC §6.
- Duplicate level names across worlds are a WARN (name-dup-global). Within a world they are an ERROR.
- Tether: hauling only works when the anchor stands ≥ 1 tile above the lip. Then "reel, ease off, hop (hold jump)". This is engine behaviour I accept as a design rule, not a SPEC bug: SPEC only promises that the anchor holds.
- Things the heuristic doesn't model (false alarms; the HEUR text now says so): rope hauls, crate-on-crate, crates riding lifts, 2-stack spring pogo.
- test/qa-proofs.js holds the sim proofs of key level moves. Re-run it after any level or engine change. "KNOWN" proofs assert the current bug (2-3 jam, 10-9 gear); flip them once the designers fix those levels.
- Script pitfall: always HOLD jump in sims for real climbs. A 1-tick press is a JUMP_CUT short hop.
