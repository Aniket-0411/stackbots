'use strict';
// World 2 "Heavy Lifting" source (designer-1). Built into levels/world02.json by tools/designer-1/build.js
const { M } = require('../lib.js');

const levels = [];
const L = (o) => levels.push(o);

// 2-1: one light crate becomes the step up a 3-high wall.
L({ id: '2-1', name: 'Box Step', minPlayers: 2,
  hint: 'Walk into a crate to push it. Crates make handy steps!',
  build() {
    const m = new M(36, 16);
    m.ground(0, 35, 13);
    m.spawns(2, 12);
    m.crate(9, 12);
    m.set(13, 8, 'o');               // jump from the crate as it passes
    m.fill(18, 10, 25, 12);          // 3-high plateau
    m.fill(21, 7, 22, 7);            // perch 3 above the plateau (piggyback)
    m.set(22, 6, 'o');
    m.set(24, 9, 'K');
    m.set(31, 12, 'D');
    return m;
  } });

// 2-2: a 2x2 crate needs two pushers (a pushing chain counts).
L({ id: '2-2', name: 'Heave Ho', minPlayers: 2,
  hint: 'Dots on a crate = pushers needed. Team up and shove!',
  build() {
    const m = new M(40, 17);
    m.ground(0, 39, 14);
    m.spawns(2, 13);
    m.crate(8, 12, 2, 2, 2);
    m.set(13, 8, 'o');               // hop off the big crate on the way
    m.fill(20, 10, 27, 13);          // 4-high wall
    m.set(25, 9, 'K');
    m.set(34, 13, 'D');
    m.fill(38, 10, 39, 13);          // 4-high post: tower of 3
    m.set(39, 9, 'o');
    return m;
  } });

// 2-3: fill a spike trench with crates; push a crate off a ledge for the second one.
L({ id: '2-3', name: 'Pit Crew', minPlayers: 2,
  hint: 'Shove crates into a trench to pave it over.',
  build() {
    const m = new M(44, 16);
    m.ground(0, 43, 13);
    m.spawns(1, 12);
    m.crate(8, 12, 2, 1);           // one 2-wide crate (two 1x1 crates could jam each other)
    m.fill(15, 13, 19, 13, '^');     // trench 1, 5 wide (sunken spikes)
    m.set(18, 10, 'o');
    m.fill(24, 11, 27, 12);          // 2-high block with a crate on top
    m.crate(26, 10);
    m.set(25, 10, 'K');
    m.fill(28, 13, 31, 13, '^');     // trench 2, 4 wide, right at the block's foot
    m.set(40, 12, 'D');
    m.fill(42, 10, 43, 12);          // 3-high post: piggyback
    m.set(43, 9, 'o');
    return m;
  } });

// 2-4: tower & rescue with crates: the top bot shoves crates DOWN to build the stairs.
L({ id: '2-4', name: 'Return to Sender', minPlayers: 2,
  hint: 'Shove a crate off the ledge so your friends below can climb up.',
  build() {
    const m = new M(40, 18);
    m.ground(0, 39, 15);
    m.spawns(2, 14);
    m.fill(12, 12, 39, 14);          // terrace 1 (3 high)
    m.crate(14, 11);
    m.fill(20, 9, 39, 11);           // terrace 2 (3 above terrace 1)
    m.crate(22, 8);
    m.set(16, 7, 'o');               // piggyback jump on terrace 1
    m.set(30, 8, 'K');
    m.set(36, 8, 'D');
    m.fill(38, 6, 39, 8);            // 3-high pillar: piggyback
    m.set(39, 5, 'o');
    return m;
  } });

// 2-5: a 4-wide crate that needs everyone; the lip squares it up over the pit: instant bridge.
L({ id: '2-5', name: 'Heavy Metal', minPlayers: 2,
  hint: 'Four dots? Everybody shove at once!',
  build() {
    const m = new M(44, 18);
    m.ground(0, 43, 14);
    m.spawns(1, 13);
    m.crate(6, 12, 4, 2, 4);
    m.set(8, 8, 'o');                // jump from the big crate before pushing
    m.clear(16, 14, 19, 15);         // pit 4 wide, 2 deep
    m.fill(16, 15, 19, 15, '^');
    m.fill(20, 13, 43, 13);          // far lip, 1 higher
    m.fill(27, 10, 29, 10);          // cell shelf, 3 above the lip
    m.set(28, 9, 'K');
    m.set(37, 12, 'D');
    m.fill(42, 8, 43, 12);           // 5-high post: 4-bot tower
    m.set(43, 7, 'o');
    return m;
  } });

// 2-6: no room to stack in the tunnel: three bots push in a line.
L({ id: '2-6', name: 'Conga Line', minPlayers: 2,
  hint: 'No room to stack? Line up and push together, conga style!',
  build() {
    const m = new M(44, 18);
    m.ground(0, 43, 15);
    m.spawns(2, 14);
    m.fill(10, 7, 23, 13);           // the mountain (7 high, unclimbable)
    m.crate(12, 14, 1, 1, 3);        // tunnel crate, needs 3
    m.set(17, 13, 'o');              // nook in the tunnel ceiling (2 wide)
    m.set(18, 13, '.');
    m.set(19, 14, 'K');
    m.fill(27, 15, 30, 15, '^');     // trench, 4 wide
    m.set(37, 14, 'D');
    m.fill(41, 11, 43, 14);          // 4-high post: tower of 3
    m.set(42, 10, 'o');
    return m;
  } });

// 2-7: crates stack. Park crate A at the wall first, then drop crate B onto it.
L({ id: '2-7', name: 'Double Decker', minPlayers: 2,
  hint: 'Crates stack! Drop one onto another for a taller step.',
  build() {
    const m = new M(40, 20);
    m.ground(0, 39, 17);
    m.spawns(2, 16);
    m.crate(8, 16, 2, 1, 2);         // crate A (2 wide, needs 2)
    m.fill(13, 14, 14, 14);          // little floating shelf, 3 up
    m.set(13, 13, 'o');
    m.fill(20, 13, 39, 16);          // the wall, 4 high
    m.crate(22, 12);                 // crate B up top
    m.set(30, 12, 'K');
    m.set(33, 12, 'D');
    m.fill(37, 9, 39, 12);           // 4-high pillar past the hatch: tower of 3
    m.set(38, 8, 'o');
    return m;
  } });

// 2-8: plug the pothole with the little crate BEFORE the big one gets there.
L({ id: '2-8', name: 'Pothole Patrol', minPlayers: 2, hint: '',
  build() {
    const m = new M(44, 18);
    m.ground(0, 43, 15);
    m.spawns(1, 14);
    m.fill(8, 13, 19, 13);           // shelf, 2 up, with a crawl tunnel underneath
    m.crate(9, 14);                  // little crate in the tunnel
    m.crate(12, 11, 2, 2, 2);        // big crate on the shelf (needs 2)
    m.set(12, 7, 'o');               // jump from the big crate before it goes
    m.clear(26, 15, 27, 15);         // pothole at the cliff foot, 2 wide 1 deep
    m.fill(28, 11, 43, 14);          // cliff, 4 high
    m.set(31, 10, 'K');
    m.set(38, 10, 'D');
    m.fill(42, 8, 43, 10);           // 3-high pillar past the hatch: piggyback
    m.set(43, 7, 'o');
    return m;
  } });

// 2-9: the cell is 7 up: crate on crate, then a wobbly four-bot tower on top.
L({ id: '2-9', name: 'Tall Order', minPlayers: 4, hint: '',
  build() {
    const m = new M(40, 22);
    m.ground(0, 39, 19);
    m.spawns(2, 18);
    m.crate(8, 18, 3, 1, 2);         // crate A (3 wide, needs 2)
    m.fill(14, 16, 19, 16);          // floating ledge, 3 up
    m.crate(15, 15, 3, 1, 1);        // crate B (3 wide)
    m.set(17, 11, 'o');              // piggyback on the ledge
    m.set(23, 18, '#');              // bump: stops crate A right under the ledge's end
    m.fill(23, 12, 25, 12);          // cell shelf, 7 up
    m.set(24, 11, 'K');
    m.set(31, 18, 'D');
    m.fill(36, 15, 37, 18);          // 4-high post past the hatch: tower of 3
    m.set(37, 14, 'o');
    return m;
  } });

// 2-10: capstone. Conga tunnel, crate in the trench, all four shove the fridge,
//       drop the box onto it, climb the wall, four-bot tower to the cell.
L({ id: '2-10', name: 'Moving Day', minPlayers: 4, hint: '',
  build() {
    const m = new M(58, 22);
    m.ground(0, 57, 19);
    m.spawns(1, 18);
    m.fill(8, 11, 17, 17);           // mountain with a crawl tunnel underneath
    m.crate(9, 18, 1, 1, 3);         // tunnel crate, needs 3
    m.set(13, 17, 'o');              // nook gear (2-wide nook)
    m.set(14, 17, '.');
    m.fill(20, 19, 23, 19, '^');     // trench, 4 wide
    m.set(22, 16, 'o');              // over the trench
    m.crate(26, 17, 3, 2, 4);        // the fridge: needs all four
    m.fill(38, 14, 57, 18);          // the big wall, 5 high
    m.crate(40, 13);                 // box up top
    m.set(44, 13, 'D');
    m.fill(51, 9, 52, 13);           // 5-high pillar at the far end with the cell
    m.set(51, 8, 'K');
    m.set(52, 8, 'o');
    return m;
  } });

module.exports = { world: 2, name: 'Heavy Lifting', theme: 'workshop', levels };
