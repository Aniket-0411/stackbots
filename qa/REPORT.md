# QA REPORT — STACKBOTS (round 2, fixes applied)

## Summary
- `node test/run.js`: **327/327 pass** (mechanics 91, levels 211, engine smoke 25). step() < 0.02 ms/tick.
- `node test/qa-proofs.js`: **23/23** sim proofs of key level moves (2-3 proof now asserts the fix).
- `node tools/validate-levels.js`: **100 levels, 0 ERROR**, 9 WARN (all intended: cell-in-beam shield puzzles, 10-5 minPlayers, 5-8 colour stripes).
- `python3 test/client/run_all.py`: 8/8 browser suites (smoke, render, online over tabs / claude.ai room / PeerJS / MQTT relay, flow, unavailable).
- Verdict: **all 100 levels solvable as intended** (reasoning against SPEC §3.1 + sim proofs for risky moves).

## Real problems found in round 2 — all fixed
| # | Level | Problem | Fix applied |
|---|---|---|---|
| 1 | 2-3 | Soft-lock: near crate jams on far crate | One 2×1 crate at x=8 (sim: drops into trench 1, paves it) |
| 2 | 3-2 | Name dup of 2-9 "Tall Order" | Renamed "Leg Up" |
| 3 | 5-7 | Name dup of 1-5 "Totem Pole" | Renamed "Lilac on Top" |
| 4 | 7-3 | Name dup of 2-2 "Heave Ho" | Renamed "Winch Time"; hint teaches "reel in, ease off, hop up" |
| 5 | 8-4 | Name + hint dup of 3-4 "Countdown" | Renamed "Hot Foot", new hint |
| 6 | 9-4 | Name dup of 6-6 "Treadmill Duty" | Renamed "Running in Place" |
| 7 | 10-4 | Name dup of 3-7 "Stand-In" | Renamed "Crate Mate" |
| 8 | 10-9 | Gear at (54,11) unreachable | Moved to (54,14) |
| 9 | 10-10 | Solution text described an unnecessary mid-air swap | Text: pair-on-pair tower |
| 10 | 9-9 | Solution text said solo climb to upper lane | Text: piggyback (3 tiles) |

Fixes were made in the designers' generator sources (tools/designer-N/…) and the worlds regenerated; a diff confirmed only these changes.

## False alarms (heuristic can't model these)
Rope hauls & dives (7-2, 7-3, 7-7, 7-9, 7-10), crates dropped on crates (2-7, 2-10), crates riding lifts (4-6), spring bounce with a rider (6-8), crate-as-trapdoor step (10-3), crate in pit under ferry (10-2).

## Design rule learned
A rope can haul a bot over a lip only if the anchor stands ≥ 1 tile higher than the lip. All world-7 hauls follow it.

## Notes / residual risk
- Designer 2 retuned 4-7…4-10 after QA's round-2 read (ferries now overlap both ledges); all 20 world 3–4 levels clear with 4 bots in scripted engine runs, validator clean.
- Timing-tight spots: 8-9 (~1.5 s spare), 9-10 lift boarding (105/240-tick slice), 10-8 (80/240). Fair, but beta should confirm feel.
- Not engine-modelled: a crate resting on a bot does not count as an elevator rider (no level needs it).
