'use strict';
/* World 5 "Prism" source. Run: node tools/designer-3/w5.js  -> levels/world05.json */
const { grid, level, writeWorld } = require('./lib.js');
const L = [];
const btn = (x, y, channel, mode, extra) => Object.assign({ type: 'button', x, y, w: 1, channel, need: 1, mode: mode || 'hold' }, extra || {});
const gate = (x, y, h, channel, extra) => Object.assign({ type: 'gate', x, y, w: 1, h, channel }, extra || {});

// 5-1 Paint by Bots: four huts, each door tinted for one bot; every bot latches its own button.
{
  const G = grid(40, 16);
  G.rect(0, 14, 39, 15, '#');
  [[7, 'c'], [13, 'a'], [19, 'd'], [25, 'b']].forEach(([x, col]) => {
    G.rect(x, 12, x + 4, 12, '#').put(x, 13, col).put(x + 4, 13, '#');
    G.e(btn(x + 2, 13, 'A', 'latch'));
  });
  G.rect(34, 4, 34, 9, '#').e(gate(34, 10, 4, 'A', { logic: 'all' }));
  G.rect(1, 10, 2, 10, '#').put(1, 9, 'o');
  G.rect(20, 9, 21, 9, '#').put(21, 8, 'o');
  G.put(1, 13, '1234').put(31, 13, 'K').put(37, 13, 'D');
  L.push(level('5-1', 'Paint by Bots', 'Tinted walls let only the matching bot through. Find your hut!', 4, G));
}

// 5-2 Piggyback Bridge: a bridge of 'a' then 'b' tiles over spikes. Coral falls through 'a', Teal through 'b'.
{
  const G = grid(40, 16);
  G.rect(0, 12, 9, 15, '#');
  G.rect(10, 15, 21, 15, '#').rect(10, 14, 21, 14, '^');
  G.rect(10, 12, 14, 12, 'a').rect(15, 12, 16, 15, '#').rect(17, 12, 21, 12, 'b');
  G.rect(22, 12, 39, 15, '#');
  G.put(19, 9, 'o');
  G.rect(32, 9, 33, 9, '#').put(33, 8, 'o');
  G.put(2, 11, '1234').put(28, 11, 'K').put(37, 11, 'D');
  L.push(level('5-2', 'Piggyback Bridge', 'Your own color won\'t hold you up. Hitch a ride on a friend!', 2, G));
}

// 5-3 Teal's Secret Tunnel: everyone is penned in; only Teal can drop through the tinted floor,
// grab the cell in the tunnel and latch the button that opens the pen.
{
  const G = grid(36, 19);
  G.rect(0, 15, 35, 18, '#');
  G.rect(5, 16, 16, 16, '.').rect(5, 15, 6, 15, 'b').rect(15, 15, 16, 15, '.');
  G.rect(0, 8, 11, 8, '#').rect(11, 9, 11, 11, '#').e(gate(11, 12, 3, 'A'));
  G.rect(0, 11, 1, 11, '#').put(1, 10, 'o');
  G.rect(21, 13, 22, 14, '#').rect(23, 11, 24, 14, '#').e(btn(24, 10, 'A', 'latch'));
  G.rect(26, 8, 27, 8, '#').put(27, 7, 'o');
  G.put(2, 14, '12').put(8, 14, '34').put(10, 16, 'K').put(33, 14, 'D');
  L.push(level('5-3', 'Teal\'s Secret Tunnel', '', 2, G));
}

// 5-4 Who's on Top?: a 3-bot tower in a nook whose floor is Teal-tinted (Teal can't be the base)
// and whose ceiling is Marigold-tinted (only Marigold on top gets through). Marigold latches the stair gate.
{
  const G = grid(28, 19);
  G.rect(0, 15, 27, 18, '#');
  G.rect(17, 16, 18, 16, '.').rect(17, 15, 18, 15, 'b');
  G.rect(8, 11, 16, 11, '#').rect(17, 11, 18, 11, 'c').rect(19, 11, 27, 11, '#');
  G.rect(19, 12, 27, 18, '#');
  G.rect(8, 5, 27, 5, '#').e(gate(8, 6, 5, 'A'));
  G.rect(6, 13, 7, 14, '#');
  G.e(btn(10, 10, 'A', 'latch'));
  G.rect(21, 8, 22, 8, '#').put(22, 7, 'o').put(17, 16, 'o');
  G.put(1, 14, '1234').put(13, 10, 'K').put(25, 10, 'D');
  L.push(level('5-4', 'Who\'s on Top?', '', 3, G));
}

// 5-5 Hold That Hue: four tinted lanes. Coral holds A (opens Teal's gate), Teal holds B, Marigold holds C,
// Lilac holds D which finally opens Coral's gate.
{
  const G = grid(38, 20);
  G.rect(0, 16, 37, 19, '#');
  G.rect(8, 13, 29, 13, '#').rect(8, 10, 29, 10, '#').rect(8, 7, 29, 7, '#').rect(8, 0, 29, 4, '#');
  G.rect(5, 13, 7, 13, '-').rect(5, 10, 7, 10, '-').rect(5, 7, 7, 7, '-');
  G.rect(1, 14, 3, 14, '-').rect(1, 11, 3, 11, '-').rect(1, 8, 3, 8, '-');
  [[5, 'a'], [8, 'b'], [11, 'c'], [14, 'd']].forEach(([r, col]) => { G.rect(8, r, 8, r + 1, col).rect(29, r, 29, r + 1, col); });
  G.e(btn(12, 6, 'A')).e(gate(20, 5, 2, 'D'));
  G.e(gate(12, 8, 2, 'A')).e(btn(18, 9, 'B'));
  G.e(gate(12, 11, 2, 'B')).e(btn(18, 12, 'C'));
  G.e(gate(12, 14, 2, 'C')).e(btn(18, 15, 'D'));
  G.rect(34, 12, 35, 12, '#').put(35, 11, 'o').put(24, 6, 'o');
  G.put(2, 15, '1234').put(24, 15, 'K').put(35, 15, 'D');
  L.push(level('5-5', 'Hold That Hue', '', 4, G));
}

// 5-6 Courier Code: Marigold (boosted) is the only one who can enter the cell vault; Lilac is the only one
// who can hold the cellar button that opens the gate; someone on the far side holds it open for Lilac.
{
  const G = grid(40, 18);
  G.rect(0, 15, 39, 17, '#');
  G.rect(0, 12, 5, 14, '#').rect(0, 9, 5, 9, '#').rect(5, 10, 5, 11, 'c').put(0, 11, 'o');
  G.rect(20, 15, 21, 15, 'd').rect(20, 16, 21, 16, '.').e(btn(21, 16, 'A'));
  G.rect(28, 2, 28, 10, '#').e(gate(28, 11, 4, 'A', { logic: 'any' })).e(btn(31, 14, 'A'));
  G.rect(34, 12, 35, 12, '#').put(35, 11, 'o').put(14, 10, 'o');
  G.put(8, 14, '1234').put(2, 11, 'K').put(37, 14, 'D');
  L.push(level('5-6', 'Courier Code', '', 4, G));
}

// 5-7 Totem Pole: a 5-high climb whose lip is Lilac-tinted, so Lilac must top the 4-bot totem.
// Lilac latches the gate below; the other three ride a 3-rider lift. Teal fetches the cell.
{
  const G = grid(36, 18);
  G.rect(0, 15, 35, 17, '#');
  G.rect(0, 11, 3, 11, '#').rect(3, 12, 3, 14, 'b').put(1, 10, 'o');
  G.rect(18, 2, 18, 6, '#').rect(18, 7, 18, 9, 'd').rect(18, 10, 28, 10, '#').rect(32, 10, 35, 10, '#');
  G.e(gate(18, 11, 4, 'A')).e(btn(24, 9, 'A', 'latch'));
  G.e({ type: 'platform', x: 29, y: 14, w: 3, path: [[29, 14], [29, 10]], speed: 1.0, need: 3 });
  G.rect(25, 7, 26, 7, '#').put(26, 6, 'o');
  G.put(6, 14, '1234').put(1, 14, 'K').put(34, 9, 'D');
  L.push(level('5-7', 'Lilac on Top', '', 4, G));
}

// 5-8 Line Up!: a 4-rider lift rises through a striped ceiling; each bot must ride under its own stripe.
{
  const G = grid(32, 22);
  G.rect(0, 19, 31, 21, '#');
  G.rect(0, 15, 1, 18, '#').put(0, 14, 'o');
  G.rect(11, 4, 11, 16, '#').rect(20, 6, 31, 6, '#').rect(20, 7, 20, 16, '#');
  G.put(12, 12, 'bbddaacc');
  G.e({ type: 'platform', x: 12, y: 18, w: 8, path: [[12, 18], [12, 6]], speed: 1.0, need: 4 });
  G.rect(25, 3, 26, 3, '#').put(26, 2, 'o');
  G.put(3, 18, '1234').put(23, 5, 'K').put(29, 5, 'D');
  L.push(level('5-8', 'Line Up!', '', 4, G));
}

// 5-9 Countdown Doors: a sealed room with four tinted exits at heights 5/4/2/1. The 5-high door needs the
// other three as a tower, so Coral leaves first, then Teal on a 2-tower; each side climbs one-way ladders to the roof.
{
  const G = grid(32, 22);
  G.rect(0, 18, 31, 21, '#').rect(0, 16, 10, 17, '#').rect(21, 17, 31, 17, '#');
  G.rect(11, 6, 20, 6, '#').rect(11, 7, 11, 17, '#').rect(20, 7, 20, 17, '#');
  G.rect(4, 13, 10, 13, '#').rect(21, 14, 27, 14, '#');
  G.put(11, 11, 'a').put(11, 12, 'a').put(11, 14, 'c').put(11, 15, 'c');
  G.put(20, 12, 'b').put(20, 13, 'b').put(20, 15, 'd').put(20, 16, 'd');
  [14, 12, 10, 8].forEach(r => G.rect(1, r, 3, r, '-'));
  [15, 13, 11, 9, 7].forEach(r => G.rect(28, r, 30, r, '-'));
  G.rect(4, 6, 10, 6, '#').rect(21, 6, 27, 6, '#');
  G.put(16, 13, 'o').rect(15, 3, 16, 3, '#').put(16, 2, 'o');
  G.put(13, 17, '12').put(17, 17, '34').put(19, 17, 'K').put(25, 5, 'D');
  L.push(level('5-9', 'Countdown Doors', '', 4, G));
}

// 5-10 Prism Break (capstone): Lilac fetches the cell from her closet; Coral tops a 4-totem through a
// Coral-only window and latches the gate; the team relays itself across a four-color trapdoor bridge
// (every bot must be carried over its own color); finally each bot drops into its own cellar onto a
// timer button and everyone rushes the gate together.
{
  const G = grid(60, 22);
  G.rect(0, 18, 59, 21, '#');
  G.rect(0, 14, 3, 14, '#').rect(3, 15, 3, 17, 'd').put(1, 13, 'o');
  G.rect(14, 3, 14, 9, '#').rect(14, 10, 14, 12, 'a').rect(14, 13, 19, 13, '#');
  G.e(gate(14, 14, 4, 'A')).e(btn(17, 12, 'A', 'latch'));
  G.rect(24, 18, 39, 20, '.').rect(24, 20, 39, 20, '^').put(24, 18, 'aaaabbbbccccdddd');
  G.put(31, 13, 'o');
  [[43, 'a'], [46, 'b'], [49, 'c'], [52, 'd']].forEach(([x, col]) => {
    G.rect(x, 18, x + 1, 18, col).rect(x, 19, x + 1, 19, '.');
    G.e(btn(x + 1, 19, 'B', 'timer', { time: 300 }));
  });
  G.put(50, 13, 'o');
  G.rect(56, 3, 56, 13, '#').e(gate(56, 14, 4, 'B'));
  G.put(5, 17, '1234').put(1, 17, 'K').put(58, 17, 'D');
  L.push(level('5-10', 'Prism Break', '', 4, G));
}

module.exports = L;
if (require.main === module) {
  writeWorld(5, 'Prism', 'prism', L);
}
