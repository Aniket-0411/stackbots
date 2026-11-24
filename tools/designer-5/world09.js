'use strict';
// World 9 "Hazard Zone" builder (designer 5). Run: node tools/designer-5/world09.js [--print]
const path = require('path');
const { Lvl, writeWorld, ROOT } = require('./lib');

const L = [];

// ---------------------------------------------------------------- 9-1 Buzz Off
// Saw intro: hop the buzzing pit, walk under the rising blade, 2-stack for the cell.
{
  const v = new Lvl('9-1', 'Buzz Off', 40, 16, { hint: 'Saws bite! Watch where they swing, then slip past.', minPlayers: 2 });
  v.rect(0, 14, 40, 2);
  v.rect(8, 14, 2, 1, '.');            // saw pit (2 wide, 1 deep)
  v.rect(22, 11, 6, 1);                // cell shelf (stand row 10, 3 above floor)
  v.str(1, 13, '1234');
  v.set(25, 10, 'K'); v.set(37, 13, 'D');
  v.set(8, 11, 'o'); v.set(22, 10, 'o');
  v.saw(8, 14);                                    // static blade in the pit
  v.saw(15, 13, [[15, 13], [15, 9]], 1);           // rising blade: walk under when it is up
  L.push(v);
}

// ---------------------------------------------------------------- 9-2 Blink Tunnel
// Cycling-laser intro: four beams blink in a rolling wave down a 4-tall tunnel.
{
  const v = new Lvl('9-2', 'Blink Tunnel', 44, 16, { hint: 'These lasers blink. Learn the beat, then dash through together!', minPlayers: 2 });
  v.rect(0, 14, 44, 2);
  v.rect(10, 0, 24, 10);               // tunnel roof rows 0..9, tunnel rows 10..13
  const cols = [13, 18, 23, 28];
  cols.forEach((c, i) => { v.laser(c, 9, 'd', { on: 90, off: 90, phase: i * 45 }); });
  v.str(1, 13, '1234');
  v.set(20, 13, 'K'); v.set(42, 13, 'D');
  v.set(15, 11, 'o'); v.set(23, 11, 'o'); v.set(31, 11, 'o');   // middle gear sits in a beam column
  L.push(v);
}

// ---------------------------------------------------------------- 9-3 Elevator Etiquette
// Need-4 elevator up a 4-wide shaft; blades jut from alternating walls -> everyone squeezes into
// the middle two columns (two 2-stacks or one tall tower).
{
  const v = new Lvl('9-3', 'Elevator Etiquette', 32, 20, { minPlayers: 2 });
  v.rect(0, 18, 20, 2);
  v.rect(20, 19, 5, 1);                // shaft floor (platform sits in row 18)
  v.rect(19, 4, 1, 12);                // shaft left wall rows 4..15, entrance rows 16-17
  v.rect(25, 4, 7, 16);                // right block, top surface row 4
  v.rect(11, 16, 2, 2);                // 2-high box with the cell
  v.str(2, 17, '1234');
  v.set(11, 15, 'K'); v.set(29, 3, 'D');
  v.set(24, 11, 'o'); v.set(20, 6, 'o');
  v.platform(20, 18, 5, [[20, 18], [20, 4]], { speed: 1.0, need: 4 });
  v.saw(20, 13);                       // left-wall blade
  v.saw(24, 8);                        // right-wall blade: safe lane is the middle 3 columns
  L.push(v);
}

// ---------------------------------------------------------------- 9-4 Treadmill Duty
// Door buttons sit on conveyors that drift toward saws: holders must walk in place.
{
  const v = new Lvl('9-4', 'Running in Place', 44, 16, { minPlayers: 2 });
  v.rect(0, 14, 44, 2);
  v.rect(1, 14, 9, 1, '<');            // left treadmill drifts left toward the blade at col 1
  v.rect(34, 14, 9, 1, '>');           // right treadmill drifts right toward the blade at col 42
  v.rect(22, 0, 1, 10);                // dividing wall above the gate
  v.rect(28, 11, 4, 1);                // cell shelf (3 above floor)
  v.str(11, 13, '1234');
  v.set(30, 10, 'K'); v.set(25, 13, 'D');
  v.set(3, 11, 'o'); v.set(40, 11, 'o');
  v.saw(1, 13); v.saw(42, 13);
  v.button(6, 13, 'A', { w: 2 });
  v.button(36, 13, 'A', { w: 2 });
  v.gate(22, 10, 1, 4, 'A', { logic: 'any' });
  L.push(v);
}

// ---------------------------------------------------------------- 9-5 Blink Lift
// A low beam slices towers. Climb through it on the OFF beat; the climber then drives a lift
// for the others while they call the timing.
{
  const v = new Lvl('9-5', 'Blink Lift', 36, 16, { minPlayers: 2 });
  v.rect(0, 11, 9, 5);                 // start plateau, stand row 10
  v.rect(9, 14, 9, 2);                 // pit floor, stand row 13
  v.rect(18, 15, 3, 1);                // lift slot floor
  v.rect(21, 11, 15, 5);               // goal ledge, stand row 10
  v.str(1, 10, '1234');
  v.set(11, 13, 'K'); v.set(33, 10, 'D');
  v.set(14, 11, 'o'); v.set(10, 8, 'o');
  v.laser(8, 12, 'r', { on: 120, off: 120, phase: 0 });
  v.platform(18, 14, 3, [[18, 14], [18, 11]], { speed: 1.5, channel: 'A' });
  v.button(25, 10, 'A');
  L.push(v);
}

// ---------------------------------------------------------------- 9-6 Piggyback Express
// All four start a timer, then cross a crumbling bridge over spikes. Walk alone and it falls
// behind you; ride a friend's head and you all get across before the door shuts.
{
  const v = new Lvl('9-6', 'Piggyback Express', 40, 16, { minPlayers: 2 });
  v.rect(0, 13, 10, 3);                // start ground, stand row 12
  v.rect(10, 13, 8, 1, '=');           // crumble bridge
  v.rect(10, 14, 8, 1, '^');           // spikes under it
  v.rect(10, 15, 8, 1);
  v.rect(18, 13, 22, 3);               // island + goal ground
  v.rect(20, 0, 1, 10);                 // wall above the timed beam (emitter at row 9)
  v.str(1, 12, '1234');
  v.set(26, 12, 'K'); v.set(37, 12, 'D');
  v.set(14, 9, 'o'); v.set(19, 8, 'o');
  v.button(5, 12, 'A', { w: 4, need: 4, mode: 'timer', time: 300 });
  v.laser(20, 9, 'd', { channel: 'A' });   // beam off while the timer runs
  L.push(v);
}

// ---------------------------------------------------------------- 9-7 Crate Convoy
// An always-on floor laser fills the corridor; push the crate as a moving shield while blades
// bob from the ceiling. At the end the shield becomes the step.
{
  const v = new Lvl('9-7', 'Crate Convoy', 46, 16, { minPlayers: 2 });
  v.rect(0, 14, 46, 2);
  v.rect(8, 0, 31, 10);                // corridor roof cols 8..38 rows 0..9 (corridor rows 10..13)
  v.rect(42, 11, 4, 3);                // goal ledge cols 42..45, stand row 10
  v.str(1, 13, '1234');
  v.set(20, 13, 'K'); v.set(45, 10, 'D');
  v.set(27, 11, 'o'); v.set(12, 10, 'o');
  v.crate(6, 12, { h: 2, need: 2 });   // 2 tall: shields row 13 and is the final step
  v.laser(42, 13, 'l');
  v.saw(15, 10, [[15, 10], [15, 13]], 0.7);
  v.saw(23, 13, [[23, 13], [23, 10]], 0.7);
  v.saw(31, 10, [[31, 10], [31, 13]], 0.7);
  L.push(v);
}

// ---------------------------------------------------------------- 9-8 Flip Flop
// One lever swaps two sets of beams. The lever bot flips on command while the runners hop
// pocket to pocket; a second lever on the far side brings the operator over.
{
  const v = new Lvl('9-8', 'Flip Flop', 48, 16, { hint: 'One lever swaps the beams. Shout FLIP when your crew is ready!', minPlayers: 2 });
  v.rect(0, 14, 48, 2);
  v.rect(11, 0, 26, 10);               // tunnel roof cols 11..36 (tunnel rows 10..13)
  const beams = [13, 17, 21, 25, 29, 33];
  beams.forEach((c, i) => { v.laser(c, 9, 'd', { channel: 'A', invert: i % 2 === 1 }); });
  v.str(1, 13, '1234');
  v.set(23, 13, 'K'); v.set(45, 13, 'D');
  v.set(19, 10, 'o'); v.set(29, 11, 'o');
  v.lever(8, 13, 'A', false);          // near lever (starts off)
  v.lever(39, 13, 'A', true);          // far lever (starts on): channel A = near AND far
  L.push(v);
}

// ---------------------------------------------------------------- 9-9 Leapfrog Lanes
// Two stacked lanes. Every door is opened from the OTHER lane: upper and lower bots leapfrog,
// past bobbing blades above and blinking beams below.
{
  const v = new Lvl('9-9', 'Leapfrog Lanes', 48, 16, { minPlayers: 2 });
  v.rect(0, 14, 48, 2);
  v.rect(6, 13, 2, 1);                 // 1-high step in the start yard
  v.rect(8, 10, 34, 1);                // upper lane floor (stand 9) = lower lane ceiling
  v.rect(8, 6, 34, 1);                 // upper lane ceiling (lane rows 7..9)
  v.str(1, 13, '1234');
  v.set(39, 9, 'K'); v.set(46, 13, 'D');
  v.set(7, 9, 'o'); v.set(32, 12, 'o');
  // doors: upper (rows 7..9) and lower (rows 11..13); each opened by a plate in the other lane
  const pairs = [['A', 13, 11, 'U'], ['B', 18, 16, 'L'], ['C', 23, 21, 'U'], ['D', 28, 26, 'L'], ['E', 33, 31, 'U'], ['F', 38, 36, 'L']];
  for (const [ch, gx, bx, lane] of pairs) {
    if (lane === 'U') { v.gate(gx, 7, 1, 3, ch); v.button(bx, 13, ch); }
    else { v.gate(gx, 11, 1, 3, ch); v.button(bx, 9, ch); }
  }
  // lower lane: hanging emitters under the upper floor, beams down to the floor
  [[15, 0], [25, 60], [35, 120]].forEach(([c, ph]) => v.laser(c, 11, 'd', { on: 90, off: 90, phase: ph }));
  // upper lane: bobbing blades
  v.saw(20, 7, [[20, 7], [20, 9]], 0.6);
  v.saw(30, 9, [[30, 9], [30, 7]], 0.6);
  L.push(v);
}

// ---------------------------------------------------------------- 9-10 Hazard Pay
// Capstone. (1) A 3-bot tower at the cliff: a saw sweeps just over the top bot's head -- hold
// still while it passes, then jump. The climber latches the tunnel gate. (2) The rest ride a
// need-3 lift through a blinking beam (board on OFF). (3) Everyone on the timer plate, then run
// the twin-beam beat with the cell before the door shuts.
{
  const v = new Lvl('9-10', 'Hazard Pay', 56, 22, { minPlayers: 3 });
  v.rect(0, 20, 16, 2);                // ground, stand row 19
  v.rect(16, 16, 40, 6);               // cliff, surface row 16 (4 above ground), stand row 15
  v.rect(18, 16, 3, 5, '.');           // lift slot cols 18..20, rows 16..20 (floor row 21)
  v.rect(16, 18, 2, 2, '.');           // tunnel into the slot (gated)
  v.rect(31, 11, 12, 1);               // slab over the beat run (cols 31..42)
  v.rect(43, 0, 1, 12);                // wall above the final laser door (emitter at row 11)
  v.str(1, 19, '1234');
  v.set(35, 15, 'K'); v.set(52, 15, 'D');
  v.set(11, 17, 'o'); v.set(34, 13, 'o'); v.set(48, 12, 'o');
  v.saw(8, 16, [[8, 16], [15, 16]], 1.0);                       // sweeps 22 px over a 3-tower's head
  v.gate(16, 18, 2, 2, 'A');
  v.button(17, 15, 'A', { mode: 'latch' });                     // right where the climber lands
  v.platform(18, 20, 3, [[18, 20], [18, 16]], { speed: 1.0, need: 3 });
  v.laser(21, 17, 'l', { on: 90, off: 150, phase: 0 });
  v.button(25, 15, 'B', { w: 4, need: 4, mode: 'timer', time: 540 });
  v.laser(32, 12, 'd', { on: 70, off: 150, phase: 0 });
  v.laser(37, 12, 'd', { on: 70, off: 150, phase: 0 });
  v.laser(43, 11, 'd', { channel: 'B' });                       // laser door: off while the timer runs
  L.push(v);
}

module.exports = { levels: L };

if (require.main === module) {
  const world = { world: 9, name: 'Hazard Zone', theme: 'hazard', levels: L };
  writeWorld(world, path.join(ROOT, 'levels', 'world09.json'));
  if (process.argv.includes('--print')) for (const v of L) console.log(v.print() + '\n');
  console.log(`wrote world09.json (${L.length} levels)`);
}
