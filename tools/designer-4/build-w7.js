'use strict';
// World 7 "Tied Together" builder (designer-4). Run: node tools/designer-4/build-w7.js
const { grid, writeWorld } = require('./lib.js');
const L = [];
const lvl = (o) => L.push(Object.assign({ hint: '', minPlayers: 2, tether: true, tetherLength: 5, entities: [] }, o));

// 7-1 Roped In: hop two spike pits (lips give a run-up); a slipped bot is reeled up from the higher floor.
{
  const g = grid(44, 21);
  g.fill(0, 12, 10, 20, '#');                 // start floor (stand row 11)
  g.fill(11, 13, 12, 20, '#');                // lip (1 lower, 2 wide)
  g.fill(13, 19, 14, 19, '^'); g.fill(13, 20, 14, 20, '#');
  g.fill(15, 13, 16, 20, '#');                // lip
  g.fill(17, 12, 26, 20, '#');                // middle floor (kept clear so anchors can haul)
  g.fill(27, 13, 28, 20, '#');
  g.fill(29, 19, 30, 19, '^'); g.fill(29, 20, 30, 20, '#');
  g.fill(31, 13, 32, 20, '#');
  g.fill(33, 12, 43, 20, '#');                // end floor
  g.put(2, 11, '1234'); g.put(21, 9, 'K'); g.put(40, 11, 'D');
  g.put(13, 10, 'o'); g.put(22, 7, 'o'); g.put(30, 10, 'o');
  lvl({ id: '7-1', name: 'Roped In', hint: 'Roped together! Slipped? Your buddy on higher ground reels you in.', tetherLength: 6, map: g.rows() });
}

// 7-2 Down the Well: lower a buddy into a spiky 1-wide well to grab the cell; the anchor on the terrace hauls them out.
{
  const g = grid(36, 22);
  g.fill(0, 9, 10, 21, '#');                  // terrace (stand 8)
  g.fill(11, 10, 12, 21, '#');                // lip (stand 9)
  g.put(13, 20, '^'); g.put(13, 21, '#');     // well col 13
  g.fill(14, 10, 35, 21, '#');                // plateau (stand 9)
  g.fill(33, 7, 35, 9, '#');                  // side pillar (gear)
  g.put(3, 8, '1234'); g.put(13, 12, 'K'); g.put(28, 9, 'D');
  g.put(13, 13, 'o'); g.put(34, 6, 'o'); g.put(2, 5, 'o');
  lvl({ id: '7-2', name: 'Down the Well', hint: 'Lower a buddy into the well, then walk back up to haul them out.', tetherLength: 6, map: g.rows() });
}

// 7-3 Heave Ho: a 3-tall wall; tower one bot up, then it walks up the terrace and hauls the base bot up.
{
  const g = grid(36, 20);
  g.fill(0, 16, 15, 19, '#');                 // low floor (stand 15)
  g.fill(6, 14, 7, 15, '#');                  // 2-tall block with the cell
  g.fill(16, 13, 17, 19, '#');                // lip (3 above the floor)
  g.fill(18, 12, 35, 19, '#');                // terrace (1 above the lip)
  g.fill(34, 9, 35, 11, '#');                 // side pillar (gear)
  g.put(9, 15, '1234'); g.put(6, 13, 'K'); g.put(30, 11, 'D');
  g.put(7, 9, 'o'); g.put(35, 8, 'o');
  lvl({ id: '7-3', name: 'Winch Time', hint: 'Top bot winches the bottom one up: reel in, ease off, hop up!', tetherLength: 6, map: g.rows() });
}

// 7-4 Full Stretch: the END bot of the chain must hold the button so the chain reaches past the gate.
{
  const g = grid(40, 16);
  g.fill(0, 13, 39, 15, '#');
  g.fill(14, 0, 16, 8, '#');                  // wall above the gate
  g.fill(27, 11, 28, 12, '#');                // 2-tall block (gear)
  g.fill(33, 11, 39, 12, '#');                // step to the hatch
  g.put(2, 12, '1234'); g.put(18, 12, 'K'); g.put(36, 10, 'D');
  g.put(11, 8, 'o'); g.put(28, 6, 'o');
  lvl({
    id: '7-4', name: 'Full Stretch', minPlayers: 4, tetherLength: 4, map: g.rows(), entities: [
      { type: 'button', x: 8, y: 12, w: 1, channel: 'A', need: 1, mode: 'hold' },
      { type: 'gate', x: 15, y: 9, w: 1, h: 4, channel: 'A', logic: 'any' },
      { type: 'button', x: 19, y: 12, w: 1, channel: 'A', need: 1, mode: 'hold' },
    ],
  });
}

// 7-5 Fifth Wheel: the button is too far from the gate for any rope; push the crate onto it. Then heave ho up the shelf.
{
  const g = grid(46, 18);
  g.fill(0, 15, 45, 17, '#');                 // floor (stand 14)
  g.fill(0, 10, 2, 14, '#');                  // left wall: the crate stops on the button
  g.fill(29, 0, 31, 9, '#');                  // wall above the gate
  g.fill(37, 12, 38, 14, '#');                // lip (3 tall)
  g.fill(39, 11, 45, 14, '#');                // terrace (stand 10)
  g.put(11, 14, '1234'); g.put(34, 14, 'K'); g.put(43, 10, 'D');
  g.put(20, 10, 'o'); g.put(44, 7, 'o');
  lvl({
    id: '7-5', name: 'Fifth Wheel', tetherLength: 6, map: g.rows(), entities: [
      { type: 'button', x: 3, y: 14, w: 1, channel: 'A', need: 1, mode: 'hold' },
      { type: 'crate', x: 8, y: 14, w: 1, h: 1, need: 2, weight: 1 },
      { type: 'gate', x: 30, y: 10, w: 1, h: 5, channel: 'A', logic: 'all' },
    ],
  });
}

// 7-6 Totem Dash: a crumble bridge longer than the whole chain; a line of 4 is too slow, so pair up and piggyback.
{
  const g = grid(44, 18);
  g.fill(0, 12, 13, 17, '#');                 // start floor (stand 11)
  g.put(2, 11, '#');                          // 1-tile step for building towers
  g.put(14, 12, '='.repeat(14));              // crumble bridge cols 14-27
  g.fill(14, 16, 27, 16, '^'); g.fill(14, 17, 27, 17, '#');
  g.fill(28, 12, 31, 17, '#');                // landing (same level as the bridge)
  g.fill(32, 11, 43, 17, '#');                // far terrace (stand 10)
  g.put(5, 11, '1234'); g.put(21, 10, 'K'); g.put(40, 10, 'D');
  g.put(16, 8, 'o'); g.put(26, 8, 'o');
  lvl({ id: '7-6', name: 'Totem Dash', tetherLength: 4, map: g.rows() });
}

// 7-7 Door Duty: a timer button at the bottom of a 3-deep pit holds the gate; the team passes, then hauls the
// door-holder (who also grabbed the cell down there) out and through before the timer runs out.
{
  const g = grid(40, 18);
  g.fill(0, 12, 14, 17, '#');                 // start floor (stand 11)
  g.fill(15, 15, 16, 17, '#');                // pit floor (stand 14), 3 below
  g.fill(17, 12, 18, 17, '#');                // lip (stand 11), gate stands on col 18
  g.fill(18, 0, 18, 8, '#');                  // wall above the gate
  g.fill(19, 11, 39, 17, '#');                // terrace (stand 10), 1 above the lip
  g.fill(37, 8, 39, 10, '#');                 // side pillar (gear)
  g.put(3, 11, '1234'); g.put(16, 14, 'K'); g.put(33, 10, 'D');
  g.put(15, 13, 'o'); g.put(38, 5, 'o'); g.put(10, 7, 'o');
  lvl({
    id: '7-7', name: 'Door Duty', tetherLength: 6, map: g.rows(), entities: [
      { type: 'button', x: 15, y: 14, w: 2, channel: 'A', need: 1, mode: 'timer', time: 300 },
      { type: 'gate', x: 18, y: 9, w: 1, h: 3, channel: 'A', logic: 'all' },
    ],
  });
}

// 7-8 Pile On: the ferry is longer than the whole rope chain, so nobody can ride in shifts: stack up on it.
{
  const g = grid(48, 18);
  g.fill(0, 12, 11, 17, '#');                 // start floor (stand 11)
  g.fill(12, 16, 21, 16, '^'); g.fill(12, 17, 21, 17, '#');
  g.fill(22, 12, 47, 17, '#');                // far floor
  g.fill(45, 9, 47, 11, '#');                 // side pillar (gear)
  g.put(3, 11, '1234'); g.put(16, 10, 'K'); g.put(40, 11, 'D');
  g.put(18, 6, 'o'); g.put(46, 6, 'o');
  lvl({
    id: '7-8', name: 'Pile On', tetherLength: 4, map: g.rows(), entities: [
      { type: 'lever', x: 11, y: 11, channel: 'A', on: false },
      { type: 'platform', x: 12, y: 12, w: 2, path: [[12, 12], [20, 12]], speed: 1.0, channel: 'A' },
    ],
  });
}

// 7-9 Lid Fishing: the well's lid opens only while someone stands on the lip button, the anchor must stand on
// the higher terrace to haul, and a third bot dives: three jobs, and the diver's rope buddy must be the anchor.
{
  const g = grid(38, 22);
  g.fill(0, 9, 10, 21, '#');                  // terrace (stand 8)
  g.fill(11, 10, 12, 21, '#');                // lip (stand 9) with the lid button
  g.put(13, 20, '^'); g.put(13, 21, '#');     // well col 13 (lid gate in row 10)
  g.fill(14, 10, 37, 21, '#');                // plateau (stand 9)
  g.fill(35, 7, 37, 9, '#');                  // side pillar (gear)
  g.put(3, 8, '1234'); g.put(13, 12, 'K'); g.put(31, 9, 'D');
  g.put(13, 14, 'o'); g.put(36, 6, 'o'); g.put(1, 5, 'o');
  lvl({
    id: '7-9', name: 'Lid Fishing', minPlayers: 3, tetherLength: 6, map: g.rows(), entities: [
      { type: 'button', x: 11, y: 9, w: 1, channel: 'A', need: 1, mode: 'hold' },
      { type: 'gate', x: 13, y: 10, w: 1, h: 1, channel: 'A', logic: 'all' },
    ],
  });
}

// 7-10 Grand Traverse: fish the cell from the well, totem across the crumble bridge, heave ho up the cliff,
// then everybody piles onto the ferry to the hatch.
{
  const g = grid(72, 22);
  g.fill(0, 9, 10, 21, '#');                  // A: start terrace (stand 8)
  g.fill(11, 10, 12, 21, '#');                // lip (stand 9)
  g.put(13, 20, '^'); g.put(13, 21, '#');     // well col 13
  g.fill(14, 10, 19, 21, '#');                // plateau (stand 9)
  g.put(20, 10, '='.repeat(14));              // B: crumble bridge cols 20-33
  g.fill(20, 19, 33, 19, '^'); g.fill(20, 20, 33, 21, '#');
  g.fill(34, 10, 37, 21, '#');                // landing (stand 9)
  g.fill(38, 7, 39, 21, '#');                 // C: lip 3 above the landing (stand 6)
  g.fill(40, 6, 45, 21, '#');                 // terrace (stand 5)
  g.fill(46, 20, 55, 20, '^'); g.fill(46, 21, 55, 21, '#'); // D: ferry pit cols 46-55
  g.fill(56, 6, 71, 21, '#');                 // far terrace (stand 5)
  g.put(3, 8, '1234'); g.put(13, 12, 'K'); g.put(66, 5, 'D');
  g.put(13, 13, 'o'); g.put(27, 6, 'o'); g.put(50, 2, 'o');
  lvl({
    id: '7-10', name: 'Grand Traverse', tetherLength: 6, map: g.rows(), entities: [
      { type: 'lever', x: 45, y: 5, channel: 'A', on: false },
      { type: 'platform', x: 46, y: 6, w: 2, path: [[46, 6], [54, 6]], speed: 1.0, channel: 'A' },
    ],
  });
}

module.exports = L;
if (require.main === module) writeWorld('world07.json', 7, 'Tied Together', 'ropeway', L);
