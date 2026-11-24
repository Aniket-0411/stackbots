# World 4 "Skyway": intended solutions (designer-2)

All 10 levels are verified in `src/engine.js` with 4 bots by `node tools/designer-2/solve.js`.
Moving platforms are one-way: walk under them, jump up through them, and Down+Jump to drop off.

**4-1 Cloud Hopper** (min 2)
The 4-wide ferry (row 12) swings between two spots, each 1 tile above a ground ledge. Hop onto it while it is over the left ground (all 4 fit, or go in turns). The ride passes through the cell.
Step off over the right ground. Jump up through the one-way ledges (31-34,11) and (33-34,9), then jump onto the hatch block.
Gears: (0,9) 2-bot tower; (20,7) a 2-bot stack on the moving ferry, top bot jumps.

**4-2 All Aboard** (min 2)
Make a 2-bot tower to fetch the cell from the 3-high ledge (1,13). The lift (14-17) only climbs while all 4 ride it, so everyone piles on.
At the top, walk off onto the plateau and go to the hatch. Gears: (1,9) needs 2 bots on the ledge; (16,2) top-of-tower jump from the lift.

**4-3 Trapdoor Tango** (min 2)
A drops through the thin floor (Down+Jump), takes the cell (3,15) and holds button (9,15), so gate x26 opens and the others walk across the top.
B holds the far button (29,9). A climbs back up the one-way steps (17-19,14) → (13-15,12) → through the top floor, and walks through the gate.
Gears: (8,5) and (35,5), each a 2-bot tower.

**4-4 Call Button** (min 2)
The platform moves right only while button (2,12) OR button (33,12) is pressed (`any`), and slides back when both are released.
A holds the left button while 3 bots ride over. A steps off, so the empty platform returns. A boards it, and a bot on the right presses (33,12) to fetch A.
Gears: (0,9) 2-bot tower; (19,8) 2-bot stack on the platform.

**4-5 Totem Lift** (min 2)
Make a 2-bot tower for the cell (1,15). The lift is only 1 tile wide but needs 4 riders, and stacked bots count.
One bot jumps on the lift. The other three build a 3-stack on the floor beside it, and its bottom bot jumps onto the lift bot's head (the stack jumps together). The totem rides up and walks off onto the plateau.
Gears: (13,2) top of the totem jumps near the summit; (34,3) 2-bot tower.

**4-6 Freight Elevator** (min 2)
Two bots push the crate (need 2) onto the elevator (16-19,19), which is flush with the floor. Everybody boards (crate + 4 bots) and rides up.
At the top, push the crate along to x32 against the 3-high block, so it is the step. Everyone climbs crate → block to the hatch.
Validator HEUR "stranded" is a false positive: it does not model crates riding elevators. The engine run confirms it.
Gears: (0,14) 3-bot tower; (39,1) 2-bot tower on the top block.

**4-7 Paternoster** (min 2)
Four 2-wide cabins circle the spike pit nonstop (up the left side, across the top through the cell, down the right).
Gate x30 needs both timer plates on (16 s each). Ride across, hop off onto the right block, and one bot keeps the right plate (26-27,6) pressed.
The last bot on the left steps on the left plate (8-9,16), hops on the next cabin and rides across. Everyone goes through x30.
Gears: (15,2) 2-bot stack on a cabin's top run; (38,2) 2-bot tower.

**4-8 Stage Dive** (min 2)
Ride the ferry over the spike pit and drop (Down+Jump) onto the pillars: one bot on each timer pillar (13-14) and (23-24), one on the cell pillar (18-19).
One bot rides on to the right ground. When the ferry next passes heading right, the pillar bots jump back up through it (make room for each other!) and ride to the end. Both timers (10 s) are still on, so the team goes through gate x37.
Gears: (0,4) 2-bot tower; (19,3) 2-bot stack on the ferry, top bot jumps.

**4-9 Ballast** (min 2)
The lift needs 4 riders, but someone must hold the step button (3,15) to open the top gate. Crates count as riders, and crates cannot be pushed up the step.
Trip 1: A holds the button. 3 bots push the crate onto the lift and ride up, then press the latch (25,7) upstairs (or push the crate over it).
Trip 2: three bots drop back down the shaft (3 riders, so the lift sinks), A climbs aboard, and 4 riders go up. Through the gate, cell (23,7), hatch.
Gears: (0,12) 3-bot tower; (39,3) 2-bot tower.

**4-10 Skyline Express** (min 2, capstone)
Ferry: only 2 wide. Two trips, or (better) two 2-bot stacks ride together. The cell is at (23,18).
Lift (28-29): needs all 4, so two bots stand on it and two stack on their heads (or the stacks jump on).
Trolley (38-45, row 9): moves only with 2 riders and returns when empty, so cross in pairs (a 2-stack counts as 2).
Finale: Down+Jump through the one-way roof (50-55,9) into the hatch room below.
Gears: (0,15) 2-bot tower; (42,4) 2-bot stack on the trolley; (57,4) 2-bot tower on the roof edge.
