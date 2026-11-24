'use strict';
// Scripted checks of world 7 maneuvers: node tools/designer-4/sim-w7.js [id-filter]
const { play, report } = require('./play.js');
const F = process.argv[2] || '';
const T = {};
const J = (n, d) => ['jump', n || 36, d];
const key = (w) => w.key && w.key.holder >= 0;

T['7-1 2p'] = () => play('7-1', {
  1: [['go', 11.6], ['sync', 'a'], ['go', 12.6], J(30, 'right'), ['go', 16.4], ['sync', 'b'], J(20, 'right'), ['go', 21.5], J(20), ['go', 24.5], ['sync', 'c'], ['go', 27.4], ['go', 28.6], J(30, 'right'), ['go', 32.4], J(24, 'right'), ['go', 40.5], ['up']],
  0: [['go', 10.5], ['sync', 'a'], ['wait', 70], ['go', 11.4], ['go', 12.6], J(30, 'right'), ['go', 15.6], ['sync', 'b'], ['wait', 20], J(20, 'right'), ['go', 23.3], ['sync', 'c'], ['wait', 30], ['go', 26.5], ['wait', 30], ['go', 27.4], ['go', 28.6], J(30, 'right'), ['go', 32.4], J(24, 'right'), ['go', 39.5], ['until', w => w.players[1].state === 'entered'], ['go', 40.5], ['up']],
});
T['7-1 slip'] = () => play('7-1', {   // bot 1 walks into pit 1 on purpose; bot 0 on the start floor reels it in
  1: [['go', 13.6], ['wait', 100], ['until', w => w.players[0].x / 32 < 6.5], ['until', w => w.players[1].onGround], ['jump', 24, 'left'], ['go', 8]],
  0: [['go', 10.0], ['wait', 100], ['go', 6.0], ['wait', 40], ['go', 7.5], ['wait', 60]],
}, { ticks: 900 });
T['7-2 2p'] = () => play('7-2', {
  1: [['go', 12.0], ['sync', 'a'], ['go', 13.5], ['until', key], ['sync', 'b'], ['until', w => w.players[0].x / 32 < 7.2], ['hold', 'left', 30], ['sync', 'c'], ['go', 11.6], J(30, 'right'), ['go', 16], ['until', w => w.players[0].x / 32 > 14.5 && w.players[0].onGround], ['go', 28.5], ['up']],
  0: [['go', 10.6], ['sync', 'a'], ['sync', 'b'], ['wait', 30], ['go', 7.0], ['wait', 30], ['go', 8.5], ['wait', 30], ['sync', 'c'], ['until', w => w.players[1].x / 32 > 15], ['go', 12.0], J(30, 'right'), ['go', 27.5], ['until', w => w.players[1].state === 'entered'], ['go', 28.5], ['up']],
});

T['7-3 2p'] = () => play('7-3', {
  1: [['go', 15.6], ['sync', 'tower'], ['until', w => w.players[0].x / 32 > 18.6 && w.players[0].onGround], ['until', w => w.players[1].y / 32 < 12.8], ['until', w => w.players[1].onGround], J(24, 'right'), ['go', 29.5], ['until', w => w.players[0].state === 'entered'], ['go', 30.5], ['up']],
  0: [['go', 8.4], J(24, 'left'), ['go', 6.6], ['go', 13.0], ['sync', 'tower'], J(30, 'right'), ['go', 15.6], ['wait', 15], J(30, 'right'), ['go', 17.2], ['wait', 10], J(24, 'right'), ['go', 19.0], ['go', 23.5], ['wait', 30], ['go', 21.5], ['wait', 60], ['go', 30.5], ['up']],
});

for (const k of Object.keys(T)) if (k.includes(F)) report(k, T[k]());
// --- 7-6: two piggyback pairs cross the crumble bridge; a plain line of four does not
const T2 = {};
T2['7-6 pairs'] = () => play('7-6', {
  1: [['jump', 12], ['go', 5.55], ['wait', 600]],
  3: [['jump', 12], ['go', 7.55], ['wait', 600]],
  0: [['wait', 60], ['go', 6.7], ['sync', 'go'], ['go', 30.0], ['wait', 300]],
  2: [['wait', 60], ['sync', 'go'], ['go', 31.4], ['wait', 300]],
}, { ticks: 600 });
T2['7-6 line4'] = () => play('7-6', {
  0: [['go', 28.6]], 1: [['go', 29.6]], 2: [['go', 30.6]], 3: [['go', 31.6]],
}, { ticks: 600 });
T2['7-6 line3'] = () => play('7-6', {
  0: [['go', 28.6]], 1: [['go', 29.6]], 2: [['go', 30.6]],
}, { ticks: 600 });
T2['7-6 2p'] = () => play('7-6', {
  1: [['jump', 12], ['go', 5.55], ['until', w => cxs(w, 0) > 37.5], J(20, 'right'), ['go', 40.5], ['up']],
  0: [['wait', 60], ['go', 30.4], J(24, 'right'), ['go', 38.0], ['until', w => P(w, 1).state === 'entered'], ['go', 40.5], ['up']],
});
const P = (w, s) => w.players.find(p => p.slot === s);
const cxs = (w, s) => (P(w, s).x + 12) / 32;
const gateOpen = w => w.entities.find(e => e.type === 'gate').open;
T2['7-4 4p'] = () => play('7-4', {
  3: [['go', 14.3], ['until', gateOpen], ['go', 19.6], ['sync', 'held'], ['until', w => cxs(w, 0) > 16.0], ['goj', 33.6], J(20, 'right'), ['go', 36.5], ['sync', 'top'], ['up']],
  2: [['go', 13.2], ['until', gateOpen], ['go', 16.0], ['sync', 'held'], ['go', 18.5], ['until', w => cxs(w, 3) > 22], ['goj', 32.6], J(20, 'right'), ['go', 35.4], ['sync', 'top'], ['until', w => P(w, 3).state === 'entered'], ['go', 36.5], ['up']],
  1: [['go', 12.0], ['sync', 'held'], ['wait', 20], ['go', 17.3], ['until', w => cxs(w, 2) > 21], ['goj', 31.6], ['until', w => cxs(w, 2) > 33.2], J(20, 'right'), ['go', 34.3], ['sync', 'top'], ['until', w => P(w, 2).state === 'entered'], ['go', 36.5], ['up']],
  0: [['wait', 60], ['go', 8.5], ['sync', 'held'], ['wait', 50], ['go', 16.1], ['until', w => cxs(w, 1) > 20], ['goj', 30.6], ['until', w => cxs(w, 1) > 32.2], J(20, 'right'), ['go', 33.4], ['sync', 'top'], ['until', w => P(w, 1).state === 'entered'], ['go', 36.5], ['up']],
}, { ticks: 4000 });
T2['7-5 2p'] = () => play('7-5', {
  1: [['hold', 'left', 150], ['sync', 'cr'], ['go', 36.4], ['sync', 'tower'], ['until', w => cxs(w, 0) > 39.4 && P(w, 0).onGround], ['until', w => P(w, 1).y / 32 < 11.8], ['until', w => P(w, 1).onGround], J(24, 'right'), ['go', 43.5], ['up']],
  0: [['hold', 'left', 150], ['sync', 'cr'], ['wait', 30], ['go', 35.0], ['until', w => cxs(w, 1) > 36.2], ['sync', 'tower'], J(30, 'right'), ['go', 36.5], ['wait', 15], J(30, 'right'), ['go', 38.2], ['wait', 10], J(24, 'right'), ['go', 40.0], ['go', 44.6], ['wait', 30], ['go', 42.5], ['wait', 30], ['go', 44.6], ['until', w => P(w, 1).state === 'entered'], ['go', 43.5], ['up']],
}, { ticks: 4000 });
T2['7-7 2p'] = () => play('7-7', {
  1: [['go', 15.6], ['wait', 30], J(20), ['wait', 30], ['go', 16.3], ['sync', 'in'], ['until', w => cxs(w, 0) > 21.5], ['until', w => P(w, 1).y / 32 < 10.9], ['until', w => P(w, 1).onGround], J(24, 'right'), ['go', 33.5], ['up']],
  0: [['go', 13.5], ['sync', 'in'], ['go', 14.6], J(30, 'right'), ['go', 18.6], J(24, 'right'), ['go', 20.0], ['go', 24.0], ['wait', 30], ['go', 21.8], ['until', w => cxs(w, 1) > 16.9 && P(w, 1).onGround], ['go', 35.0], ['until', w => P(w, 1).state === 'entered'], ['go', 33.5], ['up']],
}, { ticks: 3000 });
T2['7-8 2p'] = () => play('7-8', {
  1: [['go', 5.0], J(14), ['go', 4.5], ['until', w => P(w, 0).state === 'entered'], ['wait', 30], ['up']],
  0: [['go', 4.5], ['wait', 40], ['go', 11.5], ['up'], ['go', 13.3], ['until', w => w.entities.find(e => e.type === 'platform').x / 32 > 19.9], ['go', 40.5], ['up']],
}, { ticks: 3000 });
T2['7-9 3p'] = () => play('7-9', {
  2: [['go', 11.6], ['until', w => w.key.holder >= 0 && P(w, 1).onGround && cxs(w, 1) < 13], ['wait', 30], ['go', 30.5], ['until', w => P(w, 1).state === 'entered'], ['go', 31.5], ['up']],
  1: [['go', 9.6], ['until', w => w.channels.A], ['go', 13.5], ['until', w => w.key.holder >= 0], ['until', w => cxs(w, 0) < 8.5], ['until', w => P(w, 1).y / 32 < 8.6], ['wait', 20], ['until', w => P(w, 1).onGround], ['wait', 40], J(30, 'right'), ['go', 31.5], ['up']],
  0: [['go', 8.4], ['until', w => w.channels.A], ['go', 10.9], ['until', w => w.key.holder >= 0], ['wait', 30], ['go', 6.4], ['wait', 30], ['go', 8.0], ['until', w => P(w, 1).onGround], ['wait', 60], ['go', 12.0], J(30, 'right'), ['go', 30.5], ['until', w => P(w, 2).state === 'entered'], ['go', 31.5], ['up']],
}, { ticks: 3000 });
for (const k of Object.keys(T2)) if (k.includes(F)) report(k, T2[k]());
const T3 = {};
const plat = w => w.entities.find(e => e.type === 'platform');
T3['7-10 2p'] = () => play('7-10', {
  1: [['go', 13.5], ['until', key], ['until', w => cxs(w, 0) < 6.6], ['until', w => P(w, 1).onGround], ['wait', 20], J(24, 'right'), ['go', 16.0], ['until', w => cxs(w, 0) > 14.5 && P(w, 0).onGround], ['go', 19.6], ['sync', 'bridge'], ['go', 37.4], ['sync', 'wall'],
      ['until', w => P(w, 0).onGround && cxs(w, 0) > 40.3], ['until', w => P(w, 1).y / 32 < 5.9], ['until', w => P(w, 1).onGround], J(24, 'right'), ['go', 45.5], ['sync', 'lever'], ['up'], ['go', 47.0],
      ['until', w => plat(w).x / 32 > 53.9], ['go', 66.5], ['up']],
  0: [['go', 10.9], ['until', key], ['wait', 30], ['go', 6.4], ['wait', 30], ['go', 8.0], ['until', w => P(w, 1).onGround], ['wait', 40], ['go', 12.0], J(24, 'right'), ['go', 18.6], ['sync', 'bridge'], ['go', 36.3], ['sync', 'wall'],
      J(30, 'right'), ['go', 37.4], ['wait', 10], J(30, 'right'), ['go', 39.0], ['wait', 10], J(24, 'right'), ['go', 40.5], ['go', 44.7], ['wait', 30], ['go', 43.0], ['until', w => cxs(w, 1) > 40.2 && P(w, 1).onGround], ['go', 47.5], ['sync', 'lever'],
      ['until', w => plat(w).x / 32 > 53.9], ['go', 68.5], ['until', w => P(w, 1).state === 'entered'], ['go', 66.5], ['up']],
}, { ticks: 5000 });
for (const k of Object.keys(T3)) if (k.includes(F)) report(k, T3[k]());
// 7-3 with four: the chain climbs from its end: 3 climbs on 2, hauls 2; 2 hauls 1; 1 hauls 0 (who carries the cell)
const T4 = {};
const onTer = (s) => (w) => P(w, s).onGround && P(w, s).y / 32 < 11.2 && cxs(w, s) > 18.2;
const landed = (s) => (w) => P(w, s).onGround && P(w, s).y / 32 < 12.2 && cxs(w, s) > 16.0;
const hauled = (s, by, x) => [['until', w => cxs(w, by) > x - 0.3], ['until', landed(s)], ['wait', 10], J(24, 'right')];
T4['7-3 4p'] = () => play('7-3', {
  0: [['go', 8.4], J(24, 'left'), ['go', 6.6], ['go', 9.0], ['wait', 30], ['until', onTer(2)], ['go', 14.6], ['until', landed(1)], ['go', 15.6], ...hauled(0, 1, 23), ['until', w => cxs(w, 1) > 31.3], ['go', 30.5], ['up']],
  1: [['wait', 20], ['go', 13.0], ['until', onTer(2)], ['go', 15.6], ...hauled(1, 2, 23), ['go', 19.5], ['go', 23.0], ['wait', 30], ['go', 21.0], ['until', onTer(0)], ['until', w => cxs(w, 2) > 32.2], ['go', 31.5], ['until', w => P(w, 0).state === 'entered'], ['go', 30.5], ['up']],
  2: [['go', 14.6], ['sync', 't'], ['until', w => cxs(w, 3) > 18.2 && P(w, 3).onGround], ...hauled(2, 3, 23), ['go', 19.5], ['go', 23.0], ['wait', 30], ['go', 21.0], ['until', onTer(1)], ['go', 25.5], ['until', onTer(0)], ['until', w => cxs(w, 3) > 33.1], ['go', 32.4], ['until', w => P(w, 1).state === 'entered'], ['go', 30.5], ['up']],
  3: [['go', 15.6], ['sync', 't'], J(16, 'left'), ['go', 14.7], ['wait', 20], J(30, 'right'), ['go', 16.8], ['wait', 10], J(24, 'right'), ['go', 19.0], ['go', 23.0], ['wait', 30], ['go', 21.0], ['until', onTer(2)], ['go', 27.0], ['until', onTer(0)], ['go', 33.3], ['until', w => P(w, 2).state === 'entered'], ['go', 30.5], ['up']],
}, { ticks: 6000 });
for (const k of Object.keys(T4)) if (k.includes(F)) report(k, T4[k]());
T4['7-8 4p'] = () => play('7-8', {
  3: [['go', 13.6], ['until', w => plat(w).x / 32 > 19.9], ['go', 26.0], ['wait', 600]],
  2: [['wait', 15], ['go', 12.6], J(12, null), ['go', 13.6], ['wait', 900]],
  1: [['wait', 25], ['go', 11.3], ['until', w => P(w, 2).y / 32 < 10.5 && P(w, 2).onGround], ['go', 12.5], ['until', w => plat(w).x / 32 > 19.9], ['go', 24.8], ['wait', 600]],
  0: [['wait', 35], ['go', 10.2], ['until', w => cxs(w, 1) > 12.3], ['go', 11.5], ['up'], J(12, 'right'), ['go', 12.9], ['wait', 900]],
}, { ticks: 900 });
for (const k of Object.keys(T4)) if (k === '7-8 4p' && k.includes(F)) { const r = T4[k](); report(k, r); console.log('   cell holder', r.world.key.holder); }
