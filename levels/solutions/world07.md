# World 7 "Tied Together" — intended solutions

Rope rules that every solution leans on (measured in tools/sim.js): the rope is rigid (no swing). A grounded bot holds a dangling partner. To haul a dangler out, the anchor walks away on ground at least 1 tile HIGHER than the lip, and the dangler ends up about one rope length from the anchor. An anchor holding a taut dangler cannot jump.
Scripted checks: `node tools/designer-4/sim-w7.js` (every level clears at its minPlayers; 7-3, 7-4 and 7-8 also checked with 4 bots).

**7-1 Roped In** (2+): Drop to each 2-wide lip, hop the 2-wide spike pits, then jump up to the next floor. Jump for the floating cell on the middle floor. A bot that falls in hangs from its partner, and the partner walks back across the higher floor to reel it up onto the lip.

**7-2 Down the Well** (2+): Bot A stands at the terrace edge (col 10). Bot B walks off the lip into the 1-wide well, grabbing the cell (and the gear at row 13) on the way down. A walks left about 4 tiles to pull B over the lip, then steps back so B lands on it. Everyone else stays on the terrace until then, and hops the well to the hatch.

**7-3 Heave Ho** (2+): The rope means nobody gets stranded. The chain-end bot climbs onto its neighbour at the wall base, gets up onto the lip and the 1-high terrace, and walks right until the base bot is pulled over the lip. Repeat down the chain: with four, 3 hauls 2, 2 hauls 1, and 1 hauls 0, the last one being whoever fetched the cell from the left block. Waiting bots stand at the wall base so their rope stays slack.

**7-4 Full Stretch** (4 only): An END bot (Coral) holds the left button. Teal, Marigold and Lilac pass the gate, and Lilac stretches to the far button at col 19, picking up the cell. Coral walks through, and everyone hops the 2-high step to the hatch. If a middle bot holds the button, the chain falls one rope short of the cell.

**7-5 Fifth Wheel** (2+): The button is 27 tiles from its gate, too far for any rope. Two bots push the crate left against the wall onto the button. Then grab the cell and do a heave ho at the 3-high shelf: tower up one bot, which hauls the base from the terrace.

**7-6 Totem Dash** (2+): The 14-tile crumble bridge is longer than the whole chain, and four bots in a line are too slow (the rear ones fall). Pair up piggyback (two 2-stacks running close together) or build a totem using the 1-tile step. A stack top passing col 21 grabs the cell. Two players can run side by side, or stack.

**7-7 Door Duty** (2+): One bot drops into the 3-deep pit, grabs the cell and stands on the timer plate, which opens the gate for 5 s after it is released. The others jump the pit, pass the gate and climb the terrace. The nearest rope buddy walks right on the terrace to haul the plate holder out, and the holder hops through before the gate shuts.

**7-8 Pile On** (2+): The lever ferry crosses a 10-wide spike pit, farther than the rope reaches, so nobody can ride in shifts. Two bottom bots plus a rider go on the 2-wide platform. The last bot stands on the lever at the edge, flips it and hops onto the free head. A stack top grabs the floating cell over the pit.

**7-9 Lid Fishing** (3+): Three jobs. The Holder stands on the lip button, which opens the well lid. The Anchor waits at the terrace edge. The Diver (a rope neighbour of the Anchor) walks over the Holder into the well and grabs the cell. The Anchor walks left about 4 tiles until the Diver comes up beside the Holder, then eases off. The Holder steps off, the lid closes and becomes a bridge, and everyone goes to the hatch.

**7-10 Grand Traverse** (2+): (1) Fish the cell out of the well as in 7-2, with the anchor on the start terrace. (2) Cross the crumble bridge in pairs or a totem. (3) Heave ho up the 3-high cliff: the haul anchor walks to about col 44. (4) Everyone boards the ferry, the last bot flips the lever at col 45 and jumps on, and they ride to the hatch.
