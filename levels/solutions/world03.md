# World 3 "Switchyard": intended solutions (designer-2)

Bots: Coral = bot 1 (slot 0), Teal = bot 2, Marigold = bot 3, Lilac = bot 4. "A", "B" = any bot.
All 10 levels are verified in `src/engine.js` with 4 bots by `node tools/designer-2/solve.js`.

**3-1 Doorbell** (min 2)
A stands on the left button (13,11) so gate x17 opens and the others walk through and take the cell (24,11).
B stands on the far button (21,11) (same channel, `any`), A walks through, everyone enters the hatch.
Gear (33,8): 2-bot tower onto the 3-high block.

**3-2 Tall Order** (min 2)
Make a 2-bot tower at the 3-high ledge (x0-2). The top bot steps on the latch (1,9), and gate x20 opens for good.
Everybody walks through. Gear (34,8): 3-bot tower onto the 4-high block.

**3-3 Paperweights** (min 2)
The plates need a load of 3. A 2x2 crate weighs 2. Two bots push crate H (need 2) onto the left plate (14-16,12), and one bot stands on the plate's free tile: 2+1 = 3, so the gate opens.
The others pass, climb over crate J and push it left onto the right plate (24-26,12). One of them stands next to it, so the left plate's bot can leave and pass.
With 4 bots, 3 bots standing on the right plate also works. With 2 bots the need clamps to 2, so crate H alone holds the gate open.
Gear (1,8): 3-bot tower on the left wall.

**3-4 Countdown** (min 2)
Two bots stand on the timer plate (8-9,13). It needs 2 and stays on 7 s after they leave.
Then everyone runs: through gate x17, grab the cell (22,13), jump the two 2-wide spike pits, through gate x26 before it shuts.
Gears: (0,9) 3-bot tower; (42,10) 2-bot tower.

**3-5 Flip-Flop** (min 2)
Make a 2-bot tower under the floating block (22-24,11). The top bot flips the lever (23,10): gate x7 opens, but the inverted gate x29 closes.
Another bot fetches the cell from behind x7 and comes back out. The lever bot flips it back (x7 shuts, x29 opens) and hops down. Everyone goes to the hatch.
Gear (3,9): 3-bot tower onto the 4-high shelf.

**3-6 Handshake** (min 3)
Gate x14 is `all`, so two bots must stand on buttons (7,12) and (10,12) at the same time. The others pass, take the cell, and one presses the latch (26,12).
The latch opens the small gate (9,14) in the service tunnel. The two holders drop into the hole at (1,13), crawl right, and jump out of the shaft at x18.
Gears: (0,9) and (38,9), each a 2-bot tower.

**3-7 Stand-In** (min 2)
One bot holds button (9,12) and the others pass gate x12. The far plate (15-18,12) needs all 4, but only 3 bots are there.
A crate counts: hop over the crate (25,12), push it left onto the plate, and the 3 bots plus the crate open the gate for the holder.
(With 2 or 3 bots the need clamps: crate + 1, or crate + 2.) Gears: (0,9) 2-bot tower; (38,8) 3-bot tower.

**3-8 Bunk Bed Relay** (min 2)
Make a 2-bot tower at x5 to put one bot (or two) on the upper deck. The rest walk the lower corridor. Each deck's button opens the other deck's next gate:
the upper bot holds A (9,11) so the lower bots pass x12. A lower bot holds B (15,14) so the upper bot passes x18 and takes the cell (25,11).
The upper bot holds C (21,11) so the lower bots pass x24. A lower bot holds D (27,14) so the upper bot passes x30. Drop off the deck end and go to the hatch.
Gears: (22,7) needs 2 bots on the upper deck; (47,10) 3-bot tower.

**3-9 Prep Time** (min 2)
Prepare first: push the crate (need 2) right against the 3-high plateau at x21, so it is a step for everybody.
Then all 4 stand on the wide timer plate (6-9,14), which needs 4 and gives 10 s. Run, hop crate → plateau, grab the cell, jump the spike pit (26-27), through gate x30.
Gears: (0,10) 3-bot tower; (43,8) 2-bot tower on the plateau.

**3-10 Grand Central** (min 2, capstone)
Room 1: make a 2-bot tower onto slab (7-9,14). The top bot presses the latch, and gate x13 opens for good.
Room 2: both timer plates must be on together. Two bots stand on (16-17,16), which needs 2, and a tower puts one bot on slab (22-24,14) to press (23,13). Then everyone runs through x31.
Room 3: A holds button (36,16), so gate x40 opens and gate x48 (inverted, `any`) stays shut. The others go in, take the cell and flip the lever (46,16) ON.
Now A can let go and come in, because the lever keeps x40 open. Flip the lever OFF: x40 closes behind the team, x48 opens, and everyone goes to the hatch.
Gears: (8,9) needs two bots on slab 1; (44,11) 3-bot tower in room 3; (63,12) 3-bot tower.
