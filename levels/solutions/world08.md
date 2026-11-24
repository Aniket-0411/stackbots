# World 8 "Foundry" — intended solutions (designer-1)

Bots: 1 Coral, 2 Teal, 3 Marigold, 4 Lilac. Every solution below was replayed in the real engine
(`node tools/designer-1/prove-w8.js`) with 4 bots and with `minPlayers` bots.
Emitters that a crate could reach are embedded in a wall tile, so a shield crate can never slide into the emitter.

## 8-1 On a Roll (min 2)
- Push the crate onto the `>` belt; the belt carries it to the foot of the 3-high wall on its own.
- Everyone hops belt -> crate -> wall top, walks against the `<` belt to the cell and enters the hatch.
- Gears: one above the lower belt (jump while riding); one on the floating block over the upper belt (piggyback).

## 8-2 Light Switch (min 2)
- Bot A stands on the left button (beam off), the others walk under the press; bot B stands on the right button so A can follow.
- Laser uses `"logic":"any"` on channel A (either button switches it off).
- Gears: one in the beam column (grab it while the beam is off); one on the 3-high post at the right (piggyback).

## 8-3 Shield Bearer (min 2)
- Walk right and drop into the corridor behind the crate. Push the crate right; the beam hits the crate, everyone walks behind it and picks up the cell on the way.
- Keep pushing until the crate is past the shaft (front pusher under col 28), then everyone jumps up the shaft (2 up) to the deck and the hatch.
- Gears: one hanging over the shaft (jump from the deck); one on the 4-high post at the far right (tower of 3).

## 8-4 Countdown (min 2)
- One bot stands under the shelf's left end; a buddy piggybacks onto the shelf and stands on the timer button (300 ticks).
- While it stands there everyone else walks under the three beams. Then the presser hops down and dashes, riding the `>` belt (about 2 s to spare).
- Gears: one between the 2nd and 3rd beam (jump mid-dash); one on the 4-high post past the hatch (tower of 3).

## 8-5 Shutter Bug (min 2)
- Climb the 2-high block. From the right, two bots push the crate left until it touches the shutter (gate).
- One bot climbs back onto the block and flips the lever: the shutter opens and the laser hits the crate (never flip it while a bot stands in the beam row).
- Push the crate through the shutter into the room to the back wall, grab the cell, walk back out over the block and enter the hatch.
- Gears: on the room roof (piggyback from the parked crate); on the 3-high post at the right (piggyback).

## 8-6 Dead Weight (min 2)
- One bot stands right of the floating shelf; a buddy piggybacks onto it and shoves the crate off the shelf's left end onto the `<` belt.
- The belt carries the crate through the always-on guard beam onto the button in the pocket; that switches the route's laser off for good.
- Everyone walks under the press to the cell and the hatch. Don't loiter on the belt: it carries bots into the guard beam.
- Gears: on the shelf (piggyback); in the route's beam column (jump once it is off); on the 4-high post (tower of 3).

## 8-7 Riot Shield (min 2)
- The 2x2 crate needs every bot (min(4, bots)). Everyone pushes it into the 2-tall corridor; the two stacked beams hit the crate.
- At the end wall the crate parks under the open shaft: hop onto it (2 up), then up onto the deck (1 up).
- A buddy stands under the 3-high pillar and the other piggybacks up for the cell; drop down, enter.
- Gears: in the shaft above the parked crate (piggyback on the crate); above the cell pillar (jump from its top).

## 8-8 Umbrella Lift (min 2)
- The lift (need 2, the crate counts as a rider) crosses two beams fired from the right wall. Riding without the crate = scrapped.
- Push the crate onto the lift; it parks against the right wall and can never be pushed off again, so it rides along forever as an umbrella.
- Ride up behind it (crate + 1 bot is enough), step off left; the lift goes back down with the crate for the next bot.
- Upstairs: piggyback onto the 3-high pillar for the cell, enter the hatch.
- Gears: above the top of the shaft (piggyback on the lift while it waits at the top); above the cell pillar (jump).

## 8-9 Punch the Clock (min 3)
- The beams are off only while ALL three timer buttons (480 ticks each) are on.
- Clock 3 (shelf 4 up): two bots make a tower left of the shelf, the third climbs onto the button.
- Clock 1 (shelf 3 up): one bot stands right of the shelf, another piggybacks onto it. Clock 2: hop into the pit. The 4th bot waits by the hood.
- Count down, everybody leaves their button together and runs; the pit can be jumped (3 wide). About 2 s spare for the far-left presser.
- Gears: between the 2nd and 3rd beam (jump); on the 5-high post at the far left (all four as a tower).

## 8-10 Pour Decisions (min 4)
- Push the step crate onto the `>` belt; it parks at the 3-high wall: everyone climbs belt -> crate -> upper level.
- The heavy shield (needs 3) waits at the corridor mouth with the beam on it. Push it all the way down the corridor until it sits on the button in front of the emitter (only a crate can press it: a bot there is in the beam).
- Hop up the shaft (2 up) to the deck. The crate on the button keeps the hallway beams off; walk under the hood against the `<` belt.
- Four-bot tower beside the 5-high pillar (a pair hops onto the pair); the top bot takes the cell, drops down, everyone enters.
- Gears: above the first belt (jump); between the hallway beams (jump against the belt); on the cell pillar (four-bot tower).
