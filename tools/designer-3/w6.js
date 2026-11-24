'use strict';
/* World 6 "Bounce House" source. Run: node tools/designer-3/w6.js  -> levels/world06.json */
const { grid, level, writeWorld } = require('./lib.js');
const L = [];
const btn = (x, y, channel, mode, extra) => Object.assign({ type: 'button', x, y, w: 1, channel, need: 1, mode: mode || 'hold' }, extra || {});
const gate = (x, y, h, channel, extra) => Object.assign({ type: 'gate', x, y, w: 1, h, channel }, extra || {});

// 6-1 Boing!: three springs, three heights. A lone bounce reaches 5 tiles; the gear ledge (6) needs a passenger.
{
  const G = grid(36, 16);
  G.rect(0, 14, 35, 15, '#');
  G.rect(9, 9, 10, 13, '#').put(8, 13, '*');
  G.rect(16, 8, 17, 8, '#').put(15, 13, '*').put(17, 7, 'o');
  G.rect(21, 9, 23, 9, '#').put(20, 13, '*');
  G.rect(29, 9, 35, 13, '#').put(28, 13, '*').put(31, 4, 'o');
  G.put(1, 13, '1234').put(22, 8, 'K').put(33, 8, 'D');
  L.push(level('6-1', 'Boing!', 'Springs fling you up to 5 tiles. Steer onto the ledge!', 2, G));
}

// 6-2 Half-Baked Bridge: crumble bridges over spikes; cross one or two at a time, then hop the crumble step.
{
  const G = grid(40, 16);
  G.rect(0, 12, 9, 15, '#');
  G.rect(10, 15, 25, 15, '#').rect(10, 14, 25, 14, '^');
  G.rect(10, 12, 17, 12, '=').rect(18, 12, 19, 15, '#').rect(20, 12, 25, 12, '=');
  G.rect(26, 12, 39, 15, '#').rect(34, 8, 39, 11, '#').rect(32, 10, 33, 10, '=');
  G.rect(4, 9, 5, 9, '=').put(5, 8, 'o').put(14, 9, 'o');
  G.put(2, 11, '1234').put(18, 11, 'K').put(37, 7, 'D');
  L.push(level('6-2', 'Half-Baked Bridge', 'Crumble blocks fall away soon after you step on them. Hurry!', 2, G));
}

// 6-3 Walkalator: push the heavy crate onto the belt; it rides into the spike slot and becomes a stepping stone.
{
  const G = grid(40, 16);
  G.rect(0, 12, 39, 15, '#');
  G.rect(10, 12, 19, 12, '>').rect(20, 12, 23, 12, '^').rect(29, 12, 35, 12, '<');
  G.rect(0, 9, 0, 11, '#').put(0, 8, 'o').put(22, 9, 'o');
  G.e({ type: 'crate', x: 7, y: 11, w: 1, h: 1, need: 2 });
  G.put(1, 11, '1234').put(27, 11, 'K').put(37, 11, 'D');
  L.push(level('6-3', 'Walkalator', 'Conveyors carry bots and crates. Walking against one is a slog!', 2, G));
}

// 6-4 Piggyback Pogo: only a 2-bot stack on the spring reaches the 6-high slab; the flyer works the lever
// that lifts everyone else out of the pit.
{
  const G = grid(34, 20);
  G.rect(0, 16, 33, 19, '#');
  G.rect(15, 10, 33, 12, '#').put(14, 15, '*');
  G.rect(26, 10, 28, 12, '.').rect(26, 16, 28, 17, '.');
  G.e({ type: 'platform', x: 26, y: 17, w: 3, path: [[26, 17], [26, 10]], speed: 1.0, channel: 'A' });
  G.e({ type: 'lever', x: 30, y: 9, channel: 'A', on: false });
  G.rect(19, 6, 20, 6, '#').put(20, 5, 'o');
  G.rect(0, 13, 1, 15, '#').put(0, 12, 'o');
  G.put(3, 15, '1234').put(21, 15, 'K').put(32, 9, 'D');
  L.push(level('6-4', 'Piggyback Pogo', 'Ride a spring with a buddy on your head to bounce extra high!', 2, G));
}

// 6-5 Trapdoor Delivery: the crate has to go downstairs to hold the hatch gate open, and the only way down
// is the crumbly trapdoor. Push it on, fall with it, then push it onto the button below.
{
  const G = grid(40, 20);
  G.rect(0, 9, 27, 9, '#').rect(12, 9, 15, 9, '=');
  G.rect(0, 17, 39, 19, '#');
  G.rect(31, 9, 39, 9, '#').rect(31, 10, 31, 11, '#').e(gate(31, 12, 5, 'A'));
  G.e({ type: 'crate', x: 7, y: 8, w: 1, h: 1, need: 2 });
  G.e(btn(24, 16, 'A'));
  G.rect(0, 14, 1, 16, '#').put(0, 13, 'o').put(25, 8, 'o');
  G.put(1, 8, '1234').put(8, 16, 'K').put(37, 16, 'D');
  L.push(level('6-5', 'Trapdoor Delivery', '', 2, G));
}

// 6-6 Treadmill Duty: every hold plate sits at the upstream end of a belt, so holders must keep running
// in place (leaning on a wall or the little bump). Hold-the-door twice, with sweaty treadmill shifts.
{
  const G = grid(44, 16);
  G.rect(0, 12, 43, 15, '#').rect(0, 4, 1, 11, '#');
  G.rect(2, 12, 8, 12, '>').e(btn(2, 11, 'A'));
  G.rect(16, 2, 16, 6, '#').e(gate(16, 7, 5, 'A', { logic: 'any' }));
  G.rect(18, 12, 23, 12, '<').e(btn(23, 11, 'A')).rect(24, 10, 24, 11, '#');
  G.rect(25, 12, 31, 12, '>').e(btn(25, 11, 'B'));
  G.rect(33, 2, 33, 6, '#').e(gate(33, 7, 5, 'B', { logic: 'any' })).e(btn(35, 11, 'B'));
  G.rect(38, 9, 39, 9, '#').put(39, 8, 'o').put(24, 6, 'o');
  G.put(10, 11, '1234').put(28, 11, 'K').put(41, 11, 'D');
  L.push(level('6-6', 'Treadmill Duty', '', 2, G));
}

// 6-7 Pop Goes the Bot: the only ways upstairs are two springs under gated holes in the ceiling.
// A plate downstairs pops the left hole open; a plate upstairs pops the right one for the last bot.
{
  const G = grid(36, 20);
  G.rect(0, 17, 35, 19, '#').rect(0, 12, 35, 12, '#').put(8, 12, '..').put(27, 12, '..');
  G.e(gate(8, 12, 1, 'A', { w: 2 })).e(gate(27, 12, 1, 'B', { w: 2 }));
  G.put(8, 16, '**').put(27, 16, '**');
  G.e(btn(19, 16, 'A')).e(btn(21, 11, 'B'));
  G.rect(16, 10, 17, 11, '#');
  G.rect(1, 8, 2, 8, '#').put(2, 7, 'o').put(28, 14, 'o');
  G.put(11, 16, '1234').put(4, 11, 'K').put(33, 11, 'D');
  L.push(level('6-7', 'Pop Goes the Bot', '', 2, G));
}

// 6-8 Conga Crumble: a need-4 timer plate opens the far gate, so the whole team must cross the long crumble
// bridge in one go. Single file? The tail falls. Piggyback in pairs (or one tall tower) and run!
{
  const G = grid(44, 18);
  G.rect(0, 12, 9, 17, '#');
  G.rect(10, 17, 25, 17, '#').rect(10, 16, 25, 16, '^').rect(10, 12, 25, 12, '=');
  G.rect(26, 12, 43, 17, '#');
  G.e(btn(4, 11, 'A', 'timer', { w: 4, need: 4, time: 540 }));
  G.rect(29, 2, 29, 7, '#').e(gate(29, 8, 4, 'A'));
  G.put(37, 11, '*').put(37, 4, 'o').put(18, 9, 'o');
  G.put(0, 11, '1234').put(33, 11, 'K').put(41, 11, 'D');
  L.push(level('6-8', 'Conga Crumble', '', 2, G));
}

// 6-9 Baggage Claim: the hatch gate needs both plates held, and nobody inside can hold them. Belts pin
// crates on plates for you: shove one onto the left belt, and drop the other off the spring-shelf.
{
  const G = grid(44, 20);
  G.rect(0, 15, 43, 19, '#').rect(0, 3, 1, 14, '#').rect(42, 3, 43, 14, '#');
  G.rect(2, 15, 7, 15, '<').e(btn(2, 14, 'A'));
  G.e({ type: 'crate', x: 10, y: 14, w: 1, h: 1, need: 2 });
  G.put(18, 14, '*').rect(19, 10, 25, 10, '#');
  G.e({ type: 'crate', x: 21, y: 9, w: 1, h: 1, need: 1 });
  G.rect(20, 15, 29, 15, '>').e(btn(29, 14, 'A')).rect(30, 13, 30, 14, '#');
  G.rect(32, 10, 41, 10, '#').rect(32, 2, 32, 9, '#').e(gate(32, 11, 4, 'A', { logic: 'all' }));
  G.put(5, 10, 'o').put(24, 5, 'o');
  G.put(12, 14, '1234').put(24, 9, 'K').put(38, 14, 'D');
  L.push(level('6-9', 'Baggage Claim', '', 2, G));
}

// 6-10 Bounce House (capstone): pogo a passenger onto the slab and run the lift; all four on the timer plate,
// then piggyback over the crumble bridge before the gate shuts; finally everyone shoves the big crate onto
// the belt, which parks it at the hatch ledge as the last step.
{
  const G = grid(60, 22);
  G.rect(0, 18, 27, 21, '#');
  G.rect(15, 12, 27, 14, '#').put(14, 17, '*');
  G.rect(21, 12, 23, 14, '.').rect(21, 18, 23, 19, '.');
  G.e({ type: 'platform', x: 21, y: 19, w: 3, path: [[21, 19], [21, 12]], speed: 1.0, channel: 'A' });
  G.e({ type: 'lever', x: 16, y: 11, channel: 'A', on: false });
  G.e(btn(24, 11, 'B', 'timer', { w: 4, need: 4, time: 540 }));
  G.rect(28, 21, 41, 21, '#').rect(28, 20, 41, 20, '^').rect(28, 12, 41, 12, '=');
  G.rect(42, 12, 59, 21, '#');
  G.rect(45, 2, 45, 7, '#').e(gate(45, 8, 4, 'B'));
  G.e({ type: 'crate', x: 50, y: 11, w: 1, h: 1, need: 4 });
  G.rect(51, 12, 54, 12, '>').rect(55, 9, 59, 11, '#');
  G.rect(18, 8, 19, 8, '#').put(19, 7, 'o').put(35, 9, 'o').put(57, 4, 'o');
  G.put(2, 17, '1234').put(18, 17, 'K').put(58, 8, 'D');
  L.push(level('6-10', 'Bounce House', '', 4, G));
}

module.exports = L;
if (require.main === module) writeWorld(6, 'Bounce House', 'bouncy', L);
