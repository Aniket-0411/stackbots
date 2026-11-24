'use strict';
// World 10 "Summit" builder (designer 5). Run: node tools/designer-5/world10.js [--print]
const path = require('path');
const { Lvl, writeWorld, ROOT } = require('./lib');

const L = [];
const spawns = (v, x, y) => v.str(x, y, '1234');

// ---------------------------------------------------------------- 10-1 Base Camp
// Warm-up remix: 2-stack to a latch that uncaps a spring; spring up the cliff; crate step.
{
  const v = new Lvl('10-1', 'Base Camp', 48, 18, { hint: 'The summit mixes it all. Stack, bounce and shove your way up!', minPlayers: 2 });
  v.rect(0, 16, 21, 2);                // ground, stand row 15
  v.rect(21, 11, 27, 7);               // cliff, stand row 10 (5 above ground)
  v.rect(7, 13, 3, 1);                 // floating shelf, stand row 12 (3 above ground, walk under it)
  v.set(20, 15, '*');                  // spring hugging the cliff face
  v.set(24, 10, '#');                  // bump: keeps the crate from sliding off the cliff
  v.rect(36, 8, 12, 3);                // upper wall, stand row 7 (3 above the cliff)
  spawns(v, 1, 15);
  v.set(9, 12, 'K'); v.set(44, 7, 'D');
  v.set(20, 9, 'o'); v.set(11, 11, 'o'); v.set(40, 5, 'o');
  v.button(7, 12, 'A', { mode: 'latch' });
  v.gate(20, 14, 1, 1, 'A');           // lid over the spring
  v.crate(28, 10, { need: 2 });
  L.push(v);
}

// ---------------------------------------------------------------- 10-2 Box Fort Ferry
// A lever ferry carries a tall crate across a laser pit: hide behind it. Pick up the cell en route.
{
  const v = new Lvl('10-2', 'Box Fort Ferry', 48, 18, { minPlayers: 2 });
  v.rect(0, 11, 8, 7);                 // start ledge, stand row 10
  v.rect(8, 17, 19, 1);                // pit floor
  v.rect(8, 16, 19, 1, '^');           // spikes
  v.rect(27, 10, 21, 8);               // far ledge, stand row 9
  v.rect(39, 8, 2, 2);                 // little block on the far ledge
  spawns(v, 1, 10);
  v.set(16, 11, 'K'); v.set(44, 9, 'D');
  v.set(18, 7, 'o'); v.set(39, 6, 'o');
  v.laser(27, 11, 'l');
  v.platform(8, 12, 3, [[8, 12], [24, 12]], { speed: 1.2, channel: 'A' });
  v.crate(10, 10, { h: 2, need: 4 });  // rides the platform's front end
  v.lever(6, 10, 'A', false);
  L.push(v);
}

// ---------------------------------------------------------------- 10-3 Trapdoor Freight
// Push the crate onto the cracked tile: it drops into the beam corridor. Follow it down, push it
// toward the emitter as a shield, and it ends up as the step out.
{
  const v = new Lvl('10-3', 'Trapdoor Freight', 46, 18, { minPlayers: 2 });
  v.rect(0, 12, 46, 6);                // deck, stand row 11
  v.rect(10, 13, 30, 2, '.');          // corridor cols 10..39 rows 13..14 (floor row 15)
  v.set(12, 12, '=');                  // trapdoor
  v.set(13, 11, '#');                  // stopper: the crate always comes to rest on the trapdoor
  v.rect(24, 0, 2, 12);                // wall splitting the deck
  v.rect(36, 12, 4, 1, '.');           // exit opening above the corridor end
  spawns(v, 1, 11);
  v.set(30, 14, 'K'); v.set(44, 11, 'D');
  v.set(12, 8, 'o'); v.set(27, 13, 'o');
  v.crate(7, 11, { need: 2 });
  v.laser(40, 14, 'l');
  L.push(v);
}

// ---------------------------------------------------------------- 10-4 Stand-In
// The lift needs everyone, but someone must hold the beam off. A crate rides in their place;
// up top it goes onto a second plate so the holder can follow.
{
  const v = new Lvl('10-4', 'Crate Mate', 46, 22, { minPlayers: 2 });
  v.rect(0, 20, 46, 2);                // floor, stand row 19
  v.rect(20, 20, 4, 1, '.');           // elevator slot (platform rests in row 20)
  v.rect(19, 9, 1, 9);                 // shaft left wall rows 9..17 (entrance rows 18-19)
  v.rect(24, 8, 22, 12);               // upper block, stand row 7
  v.set(10, 19, '#');                  // plinth under the beam switch (crates can't reach it)
  spawns(v, 1, 19);
  v.set(13, 17, 'K'); v.set(42, 7, 'D');
  v.set(21, 11, 'o'); v.set(30, 5, 'o'); v.set(5, 16, 'o');
  v.button(10, 18, 'A');
  v.button(27, 7, 'A');
  v.laser(24, 13, 'l', { channel: 'A', logic: 'any' });
  v.platform(20, 20, 4, [[20, 20], [20, 8]], { speed: 1.0, need: 4 });
  v.crate(16, 19, { need: 1 });
  L.push(v);
}

// ---------------------------------------------------------------- 10-5 Lane Change
// Split up: each bot takes its own coloured lane (saws / blinking beams / belt + ceiling saw /
// crumble over spikes), then everyone regroups on a need-4 lift that sweeps up past the cell.
{
  const v = new Lvl('10-5', 'Lane Change', 50, 25, { minPlayers: 2 });
  v.rect(0, 0, 50, 25);
  v.rect(0, 0, 12, 23, '.');           // lobby (ground rows 23-24, stand row 22)
  v.rect(0, 0, 50, 3, '.');            // sky over the lane roof
  // lanes: interiors rows 4-6, 8-10, 12-14, 16-18 (floors 7, 11, 15, 19)
  [[4, 'a'], [8, 'b'], [12, 'c'], [16, 'd']].forEach(([r, ch]) => { v.rect(13, r, 29, 3, '.'); v.rect(12, r, 1, 3, ch); });
  v.rect(42, 0, 4, 24, '.');           // lift shaft cols 42-45 (floor row 24)
  v.rect(46, 0, 4, 4, '.');            // air above the exit ledge (stand row 3)
  // lobby one-way ladder, every 2 rows, alternating sides
  [[21, 6, 11], [19, 0, 11], [17, 0, 5], [15, 0, 11], [13, 6, 11], [11, 0, 11], [9, 0, 5], [7, 0, 11]].forEach(([r, a, b]) => v.box(a, r, b, r, '-'));
  // lane 3 (Marigold): belt against you, three bumps, a saw patrolling the ceiling
  v.rect(13, 15, 29, 1, '<'); [21, 27, 33].forEach(c => v.set(c, 14, '#'));
  // lane 4 (Lilac): crumble bridge over a spike trench
  v.rect(24, 19, 6, 1, '='); v.rect(24, 20, 6, 1, '^');
  spawns(v, 2, 22);
  v.set(43, 13, 'K'); v.set(48, 3, 'D');
  v.set(25, 5, 'o'); v.set(30, 9, 'o'); v.set(26, 17, 'o');
  v.saw(21, 4, [[21, 4], [21, 6]], 0.7); v.saw(29, 6, [[29, 6], [29, 4]], 0.7); v.saw(37, 4, [[37, 4], [37, 6]], 0.7);
  [[20, 0], [27, 60], [34, 120]].forEach(([c, ph]) => v.laser(c, 8, 'd', { on: 90, off: 90, phase: ph }));
  v.saw(17, 12, [[17, 12], [39, 12]], 1.0);
  v.saw(36, 16, [[36, 16], [36, 18]], 0.6);
  v.platform(42, 23, 4, [[42, 23], [42, 4]], { speed: 1.5, need: 4 });
  L.push(v);
}

// ---------------------------------------------------------------- 10-6 Special Delivery
// 2-stack to the lever shelf; the lever drops a tall crate onto a belt that carries it under
// bobbing saws to the cliff face, where it becomes everybody's step.
{
  const v = new Lvl('10-6', 'Special Delivery', 46, 20, { minPlayers: 2 });
  v.rect(0, 18, 46, 2);                // ground, stand row 17
  v.rect(3, 15, 4, 1);                 // floating lever shelf, stand row 14 (3 up)
  v.rect(10, 11, 1, 3); v.rect(12, 11, 1, 3);   // crate hopper walls
  v.rect(11, 18, 25, 1, '>');          // belt cols 11-35
  v.rect(36, 14, 10, 6);               // cliff, stand row 13 (4 above the belt)
  spawns(v, 1, 17);
  v.set(3, 14, 'K'); v.set(43, 13, 'D');
  v.set(21, 15, 'o'); v.set(28, 15, 'o'); v.set(40, 10, 'o');
  v.lever(5, 14, 'A', false);
  v.gate(11, 13, 1, 1, 'A');           // hopper floor
  v.crate(11, 11, { h: 2, need: 2 });
  v.saw(18, 14, [[18, 14], [18, 17]], 0.8); v.saw(25, 17, [[25, 17], [25, 14]], 0.8); v.saw(31, 14, [[31, 14], [31, 17]], 0.8);
  L.push(v);
}

// ---------------------------------------------------------------- 10-7 Pinball Peak
// Four floors; each spring sits under a lid and fires up through a one-way hatch in the floor
// above. A lid opens while a friend holds a plate; a plate upstairs lets the holder follow.
{
  const v = new Lvl('10-7', 'Pinball Peak', 36, 26, { minPlayers: 2 });
  v.rect(0, 24, 36, 2);                // ground, stand row 23
  // floors (stand rows 18, 13, 8, 3), each with a 3-wide one-way hatch over the spring below
  [[19, 16], [14, 29], [9, 4], [4, 29]].forEach(([r, h]) => { v.rect(0, r, 36, 1); v.rect(h, r, 3, 1, '-'); });
  v.set(17, 23, '*'); v.set(30, 18, '*'); v.set(5, 13, '*'); v.set(30, 8, '*');
  spawns(v, 2, 23);
  v.set(26, 8, 'K'); v.set(14, 3, 'D');
  v.set(33, 21, 'o'); v.set(2, 11, 'o'); v.set(34, 1, 'o');
  v.gate(17, 22, 1, 1, 'A'); v.gate(30, 17, 1, 1, 'B'); v.gate(5, 12, 1, 1, 'C'); v.gate(30, 7, 1, 1, 'E');
  v.button(8, 23, 'A'); v.button(24, 18, 'A');
  v.button(10, 18, 'B'); v.button(22, 13, 'B');
  v.button(14, 13, 'C'); v.button(20, 8, 'C');
  v.button(12, 8, 'E'); v.button(6, 3, 'E');
  v.saw(18, 10, [[18, 10], [18, 13]], 0.8);
  v.saw(16, 5, [[16, 5], [16, 8]], 0.8);
  for (const g of v.ents) if (g.type === 'gate') g.logic = 'any';
  L.push(v);
}

// ---------------------------------------------------------------- 10-8 Call the Lift
// A lever lift climbs a shaft crossed by two blinking beams. Riders shout UP / DOWN, the
// operator flips. At the top a second lever hands the controls over for the operator's ride.
{
  const v = new Lvl('10-8', 'Call the Lift', 40, 26, { minPlayers: 2 });
  v.rect(0, 24, 40, 2);                // ground, stand row 23
  v.rect(18, 24, 4, 1, '.');           // lift slot (shaft floor row 25)
  v.rect(17, 5, 1, 17);                // shaft left wall rows 5-21 (entrance rows 22-23)
  v.rect(22, 5, 18, 21);               // right block, stand row 4
  v.rect(8, 21, 3, 1);                 // little shelf on the ground floor (gear)
  spawns(v, 2, 23);
  v.set(20, 14, 'K'); v.set(36, 4, 'D');
  v.set(19, 8, 'o'); v.set(9, 19, 'o'); v.set(30, 2, 'o');
  v.lever(12, 23, 'A', false);
  v.lever(25, 4, 'A', true);
  v.platform(18, 24, 4, [[18, 24], [18, 5]], { speed: 1.0, channel: 'A' });
  v.laser(22, 17, 'l', { on: 100, off: 140, phase: 0 });
  v.laser(22, 11, 'l', { on: 100, off: 140, phase: 20 });   // ~75-tick straight-ride window
  L.push(v);
}

// ---------------------------------------------------------------- 10-9 Two-Track Mind
// The team splits: a pair rides the lift to the upper track, the rest walk the lower one.
// Every obstacle is cleared from the OTHER track: beam door, drawbridge, gate. Regroup at the end.
{
  const v = new Lvl('10-9', 'Two-Track Mind', 64, 22, { minPlayers: 2 });
  v.rect(0, 19, 64, 3);                // ground / lower track floor, stand row 18
  v.rect(12, 9, 40, 6);                // separation block cols 12-51: upper track stand row 8, lower track rows 15-18
  v.rect(9, 19, 3, 1, '.');            // lift slot
  v.rect(24, 9, 6, 5, '.');            // chasm in the upper track (drawbridge parks at row 13)
  v.rect(40, 19, 5, 1, '='); v.rect(40, 20, 5, 1, '^');   // crumble run over spikes (lower track)
  spawns(v, 2, 18);
  v.set(46, 8, 'K'); v.set(61, 18, 'D');
  v.set(26, 6, 'o'); v.set(20, 17, 'o'); v.set(54, 14, 'o');   // last one: a 2-tower on the floor reaches it (QA: (54,11) was unreachable)
  v.platform(9, 19, 3, [[9, 19], [9, 9]], { speed: 1.0, need: 2 });
  v.button(15, 8, 'A');                // upper: switches the lower beam door off
  v.laser(18, 15, 'd', { channel: 'A' });
  v.button(27, 18, 'B');               // lower: raises the drawbridge
  v.platform(24, 13, 6, [[24, 13], [24, 9]], { speed: 1.0, channel: 'B' });
  v.button(33, 8, 'C');                // upper: opens the lower gate
  v.gate(36, 15, 1, 4, 'C');
  v.saw(38, 5, [[38, 5], [38, 8]], 0.8); v.saw(44, 8, [[44, 8], [44, 5]], 0.8);
  L.push(v);
}

// ---------------------------------------------------------------- 10-10 Top of the World
// Finale (4 bots). (1) A full 4-bot totem pops the top bot through the one-way walkway; it
// latches the spring closet open. (2) All four shove the shield crate up the beam to the cell;
// it becomes the step. (3) Everyone squeezes into the saw-lined lift together. (4) The summit!
{
  const v = new Lvl('10-10', 'Top of the World', 72, 26, { minPlayers: 4 });
  v.rect(0, 24, 15, 2);                // ground, stand row 23
  v.rect(0, 19, 15, 1, '-');           // one-way walkway, stand row 18 (5 above ground)
  v.rect(15, 19, 20, 7);               // B1: cols 15-34, stand row 18
  v.rect(35, 16, 37, 10);              // B2: cols 35-71, stand row 15 (3 above B1)
  v.rect(44, 16, 5, 1, '.');           // lift slot cols 44-48 (floor row 17)
  v.rect(43, 6, 1, 8);                 // shaft left wall rows 6-13 (entrance rows 14-15)
  v.rect(49, 6, 23, 10);               // summit block cols 49-71, stand row 5
  v.set(3, 23, '*');                   // spring in the closet
  spawns(v, 9, 23);
  v.set(27, 18, 'K'); v.set(62, 5, 'D');
  v.set(1, 16, 'o'); v.set(46, 9, 'o'); v.set(68, 2, 'o');
  v.gate(7, 20, 1, 4, 'A');            // closet door
  v.button(17, 18, 'A', { mode: 'latch' });
  v.crate(19, 18, { need: 4 });
  v.laser(35, 18, 'l');
  v.platform(44, 16, 5, [[44, 16], [44, 6]], { speed: 1.0, need: 4 });
  v.saw(44, 11); v.saw(48, 9);
  L.push(v);
}

module.exports = { levels: L };

if (require.main === module) {
  const world = { world: 10, name: 'Summit', theme: 'summit', levels: L };
  writeWorld(world, path.join(ROOT, 'levels', 'world10.json'));
  if (process.argv.includes('--print')) for (const v of L) console.log(v.print() + '\n');
  console.log(`wrote world10.json (${L.length} levels)`);
}
