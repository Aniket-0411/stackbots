'use strict';
// World 8 "Foundry" source (designer-1). Built into levels/world08.json by tools/designer-1/build.js
// Laser emitters that crates could otherwise be pushed into sit embedded in a wall tile ('#'):
// the beam starts at the wall face, so a shield crate can never slide into the emitter tile.
const { M } = require('../lib.js');

const levels = [];
const L = (o) => levels.push(o);

// 8-1: belts carry crates: push the crate onto the belt and it delivers itself as a step.
L({ id: '8-1', name: 'On a Roll', minPlayers: 2,
  hint: 'Belts carry bots and crates. Let the belt do the pushing!',
  build() {
    const m = new M(40, 16);
    m.ground(0, 39, 13);
    m.spawns(2, 12);
    m.crate(8, 12);
    m.fill(10, 13, 21, 13, '>');     // belt toward the wall
    m.set(16, 10, 'o');              // jump for it while riding the belt
    m.fill(22, 10, 39, 12);          // 3-high wall
    m.fill(25, 10, 31, 10, '<');     // upper belt running back toward the edge
    m.fill(28, 7, 29, 7);            // floating block over the belt (piggyback)
    m.set(29, 6, 'o');
    m.set(34, 9, 'K');
    m.set(37, 9, 'D');
    return m;
  } });

// 8-2: a ceiling laser and two hold buttons, one on each side: hold it for each other.
L({ id: '8-2', name: 'Light Switch', minPlayers: 2,
  hint: 'Lasers scrap bots! Stand on a button to switch its beam off.',
  build() {
    const m = new M(40, 16);
    m.ground(0, 39, 13);
    m.spawns(2, 12);
    m.fill(17, 0, 19, 8);            // the press: hangs from the top of the map
    m.laser(18, 8, 'd', { channel: 'A', logic: 'any' });
    m.button(14, 12, 'A');
    m.button(22, 12, 'A');
    m.set(18, 11, 'o');              // in the beam column: grab it while the beam is off
    m.fill(26, 11, 27, 12);          // 2-high step
    m.set(30, 12, 'K');
    m.set(35, 12, 'D');
    m.fill(38, 10, 39, 12);          // 3-high post: piggyback
    m.set(39, 9, 'o');
    return m;
  } });

// 8-3: always-on laser down a low corridor: push the crate ahead as a shield, cell in the beam.
L({ id: '8-3', name: 'Shield Bearer', minPlayers: 2,
  hint: 'Crates block lasers. Push one ahead of you as a shield!',
  build() {
    const m = new M(44, 18);
    m.ground(0, 43, 13);
    m.fill(0, 11, 11, 12);           // start deck
    m.spawns(2, 10);
    m.fill(14, 5, 26, 11);           // the building over the corridor (corridor = row 12)
    m.fill(29, 11, 43, 12);          // right deck (corridor continues under it to col 31)
    m.clear(29, 12, 31, 12);
    m.laser(32, 12, 'l');            // embedded in the corridor's end wall
    m.crate(17, 12);
    m.set(23, 12, 'K');
    m.set(28, 7, 'o');               // hangs over the escape shaft
    m.set(40, 10, 'D');
    m.fill(42, 7, 43, 10);           // 4-high post: tower of 3
    m.set(43, 6, 'o');
    return m;
  } });

// 8-4: a timer button on a high shelf; the presser rides the belt to dash under the beams in time.
L({ id: '8-4', name: 'Hot Foot', minPlayers: 2,
  hint: 'The timer plate cools the beams for a moment. Everyone run!',
  build() {
    const m = new M(44, 16);
    m.ground(0, 43, 13);
    m.spawns(1, 12);
    m.fill(6, 10, 8, 10);            // floating shelf, 3 up (walk under it)
    m.button(7, 9, 'A', { mode: 'timer', time: 300 });
    m.fill(12, 0, 30, 8);            // the hood over the hallway
    m.fill(12, 13, 30, 13, '>');     // belt: ride it to beat the clock
    for (const x of [16, 21, 26]) m.laser(x, 8, 'd', { channel: 'A' });
    m.set(23, 10, 'o');              // jump for it mid-dash
    m.set(35, 12, 'K');
    m.set(39, 12, 'D');
    m.fill(42, 9, 43, 12);           // 4-high post: tower of 3
    m.set(43, 8, 'o');
    return m;
  } });

// 8-5: a lever opens the shutter holding back a laser: park the crate in front FIRST, then open up.
L({ id: '8-5', name: 'Shutter Bug', minPlayers: 2, hint: '',
  build() {
    const m = new M(44, 16);
    m.ground(0, 43, 13);
    m.fill(0, 9, 18, 10);            // roof of the laser room
    m.fill(0, 11, 3, 12);            // back wall with the emitter
    m.laser(3, 12, 'r');
    m.gate(18, 11, 1, 2, 'A');       // the shutter
    m.set(7, 12, 'K');
    m.set(10, 8, 'o');               // on the roof: piggyback from the crate
    m.crate(21, 12, 1, 1, 2);
    m.fill(24, 11, 25, 12);          // 2-high block, stops the beam
    m.lever(24, 10, 'A');
    m.set(29, 12, 'D');
    m.spawns(33, 12);
    m.fill(40, 10, 41, 12);          // 3-high post: piggyback
    m.set(41, 9, 'o');
    return m;
  } });

// 8-6: the button sits behind an always-on beam; only a crate can get there: let the belt ferry it.
L({ id: '8-6', name: 'Dead Weight', minPlayers: 2,
  hint: 'Lasers cannot hurt crates. Buttons cannot tell a crate from a bot.',
  build() {
    const m = new M(44, 18);
    m.ground(0, 43, 15);
    m.fill(0, 0, 6, 11);             // slab over the button pocket
    m.laser(5, 11, 'd');             // guard beam (always on)
    m.button(0, 14, 'A');
    m.fill(0, 15, 8, 15, '<');       // belt into the pocket
    m.fill(9, 12, 12, 12);           // floating shelf, 3 up
    m.crate(11, 11);
    m.set(9, 9, 'o');                // piggyback on the shelf
    m.spawns(14, 14);
    m.fill(22, 0, 24, 10);           // press over the route
    m.laser(23, 10, 'd', { channel: 'A' });
    m.set(23, 13, 'o');              // in the beam column
    m.set(30, 14, 'K');
    m.set(37, 14, 'D');
    m.fill(41, 11, 43, 14);          // 4-high post: tower of 3
    m.set(42, 10, 'o');
    return m;
  } });

// 8-7: a huge shield that needs all four; at the end of the corridor it becomes the step into the shaft.
L({ id: '8-7', name: 'Riot Shield', minPlayers: 2, hint: '',
  build() {
    const m = new M(44, 18);
    m.ground(0, 43, 14);
    m.spawns(1, 13);
    m.crate(7, 12, 2, 2, 4);         // the riot shield: needs everyone
    m.fill(12, 4, 30, 11);           // the building over the 2-tall corridor (rows 12-13)
    m.fill(34, 11, 43, 13);          // right deck
    m.laser(34, 12, 'l');            // two stacked beams from the corridor's end wall
    m.laser(34, 13, 'l');
    m.set(32, 7, 'o');               // over the parked shield: piggyback
    m.set(38, 10, 'D');
    m.fill(42, 8, 43, 10);           // 3-high pillar with the cell: piggyback
    m.set(42, 7, 'K');
    m.set(43, 4, 'o');               // jump from the pillar top
    return m;
  } });

// 8-8: two beams cross the lift shaft. Ride up with the crate on board as an umbrella.
L({ id: '8-8', name: 'Umbrella Lift', minPlayers: 2, hint: '',
  build() {
    const m = new M(32, 22);
    m.ground(0, 31, 19);
    m.clear(12, 19, 16, 19);         // shallow pit the lift sits in
    m.fill(17, 0, 31, 21);           // machinery block (right)
    m.fill(0, 8, 11, 14);            // upper deck (left), start hall underneath
    m.laser(17, 14, 'l');
    m.laser(17, 10, 'l');
    m.ent({ type: 'platform', x: 12, y: 19, w: 5, path: [[12, 19], [12, 8]], speed: 1.5, need: 2 });
    m.spawns(2, 18);
    m.crate(8, 18);
    m.set(14, 4, 'o');               // piggyback on the lift at the top
    m.set(6, 7, 'D');
    m.fill(0, 5, 1, 7);              // 3-high pillar with the cell: piggyback
    m.set(0, 4, 'K');
    m.set(1, 2, 'o');                // jump from the pillar top
    return m;
  } });

// 8-9: three timer buttons must ALL be on at once to kill the beams: press, count down, release together, run!
L({ id: '8-9', name: 'Punch the Clock', minPlayers: 3, hint: '',
  build() {
    const m = new M(44, 20);
    m.ground(0, 43, 17);
    m.fill(0, 12, 1, 16);            // 5-high post: four-bot tower gear
    m.set(0, 11, 'o');
    m.fill(4, 14, 6, 14);            // shelf for clock 1, 3 up (walk under it)
    m.button(5, 13, 'A', { mode: 'timer', time: 480 });
    m.spawns(7, 16);
    m.fill(11, 17, 18, 17, '>');     // belt toward the hallway
    m.clear(14, 17, 16, 18);         // pit with clock 2 at the bottom
    m.button(15, 18, 'A', { mode: 'timer', time: 480 });
    m.fill(21, 13, 23, 13);          // shelf for clock 3, 4 up (walk under it)
    m.button(22, 12, 'A', { mode: 'timer', time: 480 });
    m.fill(27, 0, 37, 12);           // hood over the hallway
    for (const x of [29, 32, 35]) m.laser(x, 12, 'd', { channel: 'A' });
    m.set(33, 14, 'o');              // jump for it mid-dash
    m.set(40, 16, 'K');
    m.set(42, 16, 'D');
    return m;
  } });

// 8-10: capstone. Belt step, heavy shield down the corridor ONTO the button that kills the next beams,
//       a slow-mo walk against the belt, and a four-bot tower for the cell.
L({ id: '8-10', name: 'Pour Decisions', minPlayers: 4, hint: '',
  build() {
    const m = new M(60, 22);
    m.ground(0, 13, 20);
    m.spawns(1, 19);
    m.crate(6, 19);
    m.fill(7, 20, 13, 20, '>');      // belt delivers the step crate
    m.set(10, 16, 'o');              // jump for it from the belt
    m.fill(14, 17, 59, 21);          // upper level (3 up)
    m.fill(20, 9, 33, 15);           // building over the corridor (corridor = row 16)
    m.crate(20, 16, 1, 1, 3);        // heavy shield at the corridor mouth
    m.fill(36, 15, 59, 16);          // deck (row 15) over the corridor's last tile
    m.clear(36, 16, 36, 16);
    m.button(36, 16, 'A');           // only a crate can sit here
    m.laser(37, 16, 'l');            // corridor beam, embedded in the end wall
    m.fill(40, 0, 49, 9);            // hood over the deck hallway
    m.fill(40, 15, 49, 15, '<');     // belt against you under the hood
    m.laser(43, 9, 'd', { channel: 'A' });
    m.laser(47, 9, 'd', { channel: 'A' });
    m.set(45, 12, 'o');              // between the beams
    m.set(53, 14, 'D');
    m.fill(57, 10, 58, 14);          // 5-high pillar with the cell: four-bot tower
    m.set(57, 9, 'K');
    m.set(58, 9, 'o');
    return m;
  } });

module.exports = { world: 8, name: 'Foundry', theme: 'foundry', levels };
