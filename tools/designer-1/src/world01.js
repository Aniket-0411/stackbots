'use strict';
// World 1 "Boot Up" source (designer-1). Built into levels/world01.json by tools/designer-1/build.js
const { M } = require('../lib.js');

const levels = [];
const L = (o) => levels.push(o);

// 1-1: walk, hop a bump, grab the cell, enter.
L({ id: '1-1', name: 'Power On', minPlayers: 2,
  hint: 'Carry the Power Cell to the hatch, then everyone press Up to enter!',
  build() {
    const m = new M(36, 15);
    m.ground(0, 35, 13);
    m.spawns(2, 12);
    m.fill(9, 12, 10, 12);           // 1-high bump
    m.set(14, 12, 'K');
    m.fill(19, 11, 20, 12);          // 2-high block
    m.set(19, 10, 'o');              // easy gear on top
    m.set(29, 12, 'D');
    m.fill(33, 10, 35, 12);          // 3-high pillar past the hatch (teaser: piggyback)
    m.set(34, 9, 'o');
    return m;
  } });

// 1-2: gaps of 1, 2, 3 over bottomless pits; a 2-high step.
L({ id: '1-2', name: 'Mind the Gap', minPlayers: 2,
  hint: 'Jump the gaps! Shiny gears are optional bonus loot.',
  build() {
    const m = new M(44, 16);
    m.ground(0, 43, 13);
    m.spawns(1, 12);
    m.clear(8, 13, 8, 15);           // gap 1
    m.clear(13, 13, 14, 15);         // gap 2
    m.fill(17, 11, 22, 12);          // plateau A (2 high)
    m.clear(23, 13, 25, 15);         // gap 3 between plateaus
    m.fill(26, 11, 29, 12);          // plateau B
    m.set(28, 10, 'K');
    m.set(24, 8, 'o');               // gear at the top of the big jump
    m.fill(30, 12, 31, 12);          // step down
    m.clear(34, 13, 35, 15);         // gap 2
    m.set(40, 12, 'D');
    m.fill(42, 10, 43, 12);          // 3-high pillar past the hatch
    m.set(43, 9, 'o');
    return m;
  } });

// 1-3: the cell sits on a 3-high pillar: piggyback.
L({ id: '1-3', name: 'Piggyback', minPlayers: 2,
  hint: 'Too high? Stand still and let a buddy jump on your head!',
  build() {
    const m = new M(34, 16);
    m.ground(0, 33, 13);
    m.fill(0, 9, 1, 12);             // 4-high back post
    m.fill(2, 10, 3, 12);            // 3-high cell pillar
    m.set(3, 9, 'K');
    m.set(1, 8, 'o');                // climber steps up one more for it
    m.spawns(6, 12);
    m.fill(14, 11, 15, 12);          // 2-high block
    m.clear(19, 13, 20, 15);         // gap 2
    m.set(27, 12, 'D');
    m.fill(31, 9, 33, 12);           // 4-high block: 3-bot tower gear
    m.set(32, 8, 'o');
    return m;
  } });

// 1-4: spikes of width 1, 2, 3, a spike trench between plateaus.
L({ id: '1-4', name: 'Pointy End', minPlayers: 2,
  hint: 'Spikes scrap bots! One oops and the whole team restarts.',
  build() {
    const m = new M(40, 16);
    m.ground(0, 39, 13);
    m.spawns(1, 12);
    m.set(8, 12, '^');
    m.fill(12, 12, 13, 12, '^');
    m.fill(17, 12, 19, 12, '^');
    m.set(18, 10, 'o');              // over the 3-wide strip
    m.fill(22, 11, 25, 12);          // plateau
    m.set(24, 10, 'K');
    m.fill(26, 12, 28, 12, '^');     // spike trench
    m.fill(29, 11, 31, 12);          // plateau
    m.set(33, 12, '^');
    m.set(35, 12, 'D');
    m.fill(38, 10, 39, 12);          // 3-high pillar: piggyback gear
    m.set(38, 9, 'o');
    return m;
  } });

// 1-5: the cell is on a floating shelf 4 tiles up: three-bot totem.
L({ id: '1-5', name: 'Totem Pole', minPlayers: 3,
  hint: 'Four tiles up? Build a three-bot totem pole!',
  build() {
    const m = new M(40, 18);
    m.ground(0, 39, 15);
    m.spawns(2, 14);
    m.fill(12, 11, 14, 11);          // shelf, 4 above ground
    m.set(13, 10, 'K');
    m.set(12, 10, 'o');
    m.clear(19, 15, 20, 17);         // gap 2
    m.fill(25, 10, 26, 10);          // shelf, 5 above ground (4-bot tower gear)
    m.set(25, 9, 'o');
    m.fill(30, 13, 39, 14);          // 2-high step to the hatch
    m.set(35, 12, 'D');
    return m;
  } });

// 1-6: a low ceiling stops towers; build the totem under the skylight.
L({ id: '1-6', name: 'Skylight', minPlayers: 3, hint: '',
  build() {
    const m = new M(40, 18);
    m.ground(0, 39, 15);
    m.spawns(1, 14);
    m.fill(8, 11, 31, 11);           // ceiling slab (top 4 above ground)
    m.clear(18, 11, 20, 11);         // skylight, 3 wide
    m.fill(7, 4, 7, 11);             // upper room walls (hang above the corridor)
    m.fill(32, 4, 32, 11);
    m.fill(12, 9, 13, 10);           // 2-high block in the upper room
    m.set(12, 8, 'o');
    m.set(29, 10, 'K');
    m.set(9, 10, 'o');
    m.fill(37, 12, 39, 14);          // 3-high pillar by the hatch
    m.set(38, 11, 'o');
    m.set(35, 14, 'D');
    return m;
  } });

// 1-7: three 3-high terraces. Each tower leaves its base bot behind;
//      the bots left behind walk through the tunnel to the hatch.
L({ id: '1-7', name: 'Bot Ladder', minPlayers: 4, hint: '',
  build() {
    const m = new M(40, 20);
    m.ground(0, 39, 17);
    m.spawns(2, 16);
    m.fill(10, 14, 13, 16);          // T1 (3 high)
    m.fill(14, 11, 17, 16);          // T2 (6 high)
    m.fill(18, 8, 23, 16);           // T3 (9 high)
    m.clear(10, 15, 23, 16);         // tunnel underneath
    m.set(22, 7, 'K');
    m.set(19, 5, 'o');               // jump for it on the summit
    m.set(33, 16, 'D');
    m.fill(37, 14, 38, 16);          // 3-high pillar for the left-behinds
    m.set(37, 13, 'o');
    return m;
  } });

// 1-8: five tiles up: all four bots in one tower.
L({ id: '1-8', name: 'All Hands Up', minPlayers: 4,
  hint: 'Five up? Stack all four! Tip: a pair can hop onto a pair.',
  build() {
    const m = new M(36, 18);
    m.ground(0, 35, 15);
    m.spawns(3, 14);
    m.fill(16, 10, 18, 10);          // shelf 5 above ground
    m.set(17, 9, 'K');
    m.set(18, 9, 'o');
    m.fill(24, 13, 25, 14);          // 2-high bump
    m.set(31, 14, 'D');
    m.fill(34, 10, 35, 14);          // 5-high pillar: another wobbly tower
    m.set(35, 9, 'o');
    return m;
  } });

// 1-9: spike sea with small islands; build the 4-tower on an island.
L({ id: '1-9', name: 'Spike Island', minPlayers: 4, hint: '',
  build() {
    const m = new M(44, 20);
    m.ground(0, 43, 18);
    m.fill(0, 17, 43, 17, '^');      // spike sea
    m.fill(0, 17, 5, 17);            // start platform
    m.spawns(1, 16);
    m.fill(9, 17, 10, 17);           // I1
    m.fill(13, 17, 16, 17);          // I2 (4 wide) - tower here
    m.fill(17, 12, 19, 12);          // floating shelf, 5 above the islands
    m.set(18, 11, 'K');
    m.fill(20, 17, 22, 17);          // I3
    m.fill(25, 17, 26, 17);          // I4
    m.set(28, 14, 'o');              // over the last spike strip
    m.fill(30, 17, 43, 17);          // goal platform
    m.set(38, 16, 'D');
    m.fill(42, 13, 43, 16);          // 4-high post
    m.set(42, 12, 'o');
    return m;
  } });

// 1-10: capstone. Spikes, a 4-high wall (3-tower, then the 4th bot
//       climbs the leftover pair), a 3-high wall, a spike pit on the summit.
L({ id: '1-10', name: 'Stack Overflow', minPlayers: 4, hint: '',
  build() {
    const m = new M(56, 22);
    m.ground(0, 55, 19);
    m.fill(0, 14, 1, 18);            // 5-high post: 4-bot tower gear
    m.set(0, 13, 'o');
    m.spawns(3, 18);
    m.fill(9, 18, 11, 18, '^');
    m.fill(14, 18, 15, 18, '^');
    m.fill(19, 15, 24, 18);          // T1, 4 high
    m.fill(25, 12, 27, 18);          // T2, 3 above T1
    m.fill(28, 14, 30, 14, '^');     // summit spike pit (3 wide)
    m.fill(28, 15, 30, 18);
    m.fill(31, 12, 33, 18);          // T2b
    m.set(32, 11, 'K');
    m.set(29, 9, 'o');               // over the summit pit
    m.clear(19, 16, 33, 18);         // low-road tunnel (3 tall)
    m.clear(40, 19, 42, 21);         // gap 3
    m.fill(46, 17, 55, 18);          // 2-high hatch deck
    m.set(50, 16, 'D');
    m.fill(54, 13, 55, 16);          // 4-high post on the deck
    m.set(54, 12, 'o');
    return m;
  } });

module.exports = { world: 1, name: 'Boot Up', theme: 'meadow', levels };
