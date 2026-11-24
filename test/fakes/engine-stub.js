/* THROWAWAY engine stub for client development/testing only (NOT the real engine).
 * Implements the SPEC §9 surface with very simplified physics (no bot-bot collision,
 * static entities). build.js uses it only when src/engine.js is missing. */
(function (root) {
  'use strict';
  var C = { T: 32, PW: 24, PH: 30, GRAVITY: 0.55, MAX_FALL: 12, RUN: 2.6, ACC_GROUND: 0.5, DEC_GROUND: 0.6, ACC_AIR: 0.35,
    JUMP_V: -9.6, JUMP_CUT: -4, COYOTE: 4, JUMP_BUFFER: 6, SPRING_V: -14, CRATE_SPEED: 1.2, CONVEYOR: 1.4,
    PLATFORM_SPEED: 1.0, DEAD_TICKS: 60, CLEAR_TICKS: 120, LEASH_X: 1280 };
  function parseLevel(j, meta) {
    if (!j || !Array.isArray(j.map) || !j.map.length) throw new Error((j && j.id) + ': no map');
    var rows = j.map.length, cols = j.map[0].length, L = { id: j.id, name: j.name, hint: j.hint || '', cols: cols, rows: rows,
      map: j.map.slice(), spawns: {}, key: null, door: null, gears: [], entities: j.entities || [], tether: !!j.tether,
      tetherLength: j.tetherLength || 5, meta: meta || {} };
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var ch = j.map[r][c];
      if (ch >= '1' && ch <= '4') L.spawns[+ch - 1] = { c: c, r: r };
      else if (ch === 'K') L.key = { c: c, r: r };
      else if (ch === 'D') L.door = { c: c, r: r };
      else if (ch === 'o') L.gears.push({ c: c, r: r });
    }
    if (!L.door) throw new Error(j.id + ': no hatch');
    return L;
  }
  function createWorld(L, o) { var w = { level: L, slots: (o && o.slots || [0, 1, 2, 3]).slice(), evAcc: [] }; reset(w); return w; }
  function reset(w) {
    var L = w.level;
    w.tick = 0; w.phase = 'play'; w.phaseTimer = 0; w.deadSlot = -1; w.events = [];
    w.players = w.slots.map(function (s) {
      var sp = L.spawns[s] || L.spawns[0] || { c: 1, r: 1 };
      return { slot: s, x: sp.c * 32 + 4, y: sp.r * 32 + 2, w: 24, h: 30, vx: 0, vy: 0, onGround: false, facing: 1, state: 'active',
        hasKey: false, walk: 0, landed: 0, pj: false, pu: false, pd: false, coy: 0, buf: 0 };
    });
    w.key = L.key ? { x: L.key.c * 32 + 16, y: L.key.r * 32 + 16, holder: -1, used: false } : null;
    w.door = { x: L.door.c * 32, y: (L.door.r - 1) * 32, w: 32, h: 64, open: !L.key };
    w.entities = L.entities.map(function (e, i) {
      var o = { id: e.id || ('e' + i), type: e.type, x: e.x * 32, y: e.y * 32, w: (e.w || 1) * 32, h: (e.h || 1) * 32 };
      for (var k in e) if (!(k in o)) o[k] = e[k];
      if (e.type === 'platform') o.h = 12;
      if (e.type === 'button') { o.y = e.y * 32 + 26; o.h = 6; o.pressed = false; o.on = false; o.load = 0; o.need = e.need || 1; }
      if (e.type === 'gate') { o.open = false; o.openAmt = 0; }
      if (e.type === 'saw') { o.r = 14; o.angle = 0; o.cx = e.x * 32 + 16; o.cy = e.y * 32 + 16; o.x = o.cx - 14; o.y = o.cy - 14; o.w = o.h = 28; }
      if (e.type === 'laser') { o.beamOn = true; o.len = 96; var d = { r: [1, 0], l: [-1, 0], u: [0, -1], d: [0, 1] }[e.dir || 'r'];
        o.x2 = o.x + 16 + d[0] * 112; o.y2 = o.y + 16 + d[1] * 112; }
      if (e.type === 'crate') { o.vx = 0; o.vy = 0; o.need = e.need || 1; o.weight = e.weight || 1; o.pushers = 0; }
      if (e.type === 'lever') o.on = !!e.on;
      return o;
    });
    w.crumble = {}; w.gears = L.gears.map(function (g) { return { x: g.c * 32 + 16, y: g.r * 32 + 16, taken: false }; });
    w.gearsTaken = 0; w.channels = {};
    w.ropes = L.tether ? w.slots.slice(1).map(function (s, i) { return [w.slots[i], s]; }) : [];
  }
  function tileAt(w, c, r) { var L = w.level; if (c < 0 || c >= L.cols) return '#'; if (r < 0 || r >= L.rows) return '.'; return L.map[r][c]; }
  function isSolidFor(w, c, r, slot) {
    var ch = tileAt(w, c, r);
    if (ch === '#' || ch === '=' || ch === '<' || ch === '>') return true;
    if (ch >= 'a' && ch <= 'd') { var s = ch.charCodeAt(0) - 97; return slot !== s || w.slots.indexOf(s) < 0; }
    return false;
  }
  function ev(w, t, x, y, slot) { var e = { t: t, x: Math.round(x), y: Math.round(y), slot: slot }; w.events.push(e); w.evAcc.push(e); if (w.evAcc.length > 40) w.evAcc.shift(); }
  function hitSolid(w, x, y, ww, hh, slot) {
    for (var r = Math.floor(y / 32); r <= Math.floor((y + hh - 0.01) / 32); r++)
      for (var c = Math.floor(x / 32); c <= Math.floor((x + ww - 0.01) / 32); c++) if (isSolidFor(w, c, r, slot)) return true;
    return false;
  }
  function step(w, inputs) {
    w.events = []; w.tick++;
    if (w.phase === 'dead') { if (++w.phaseTimer >= C.DEAD_TICKS) { var acc = w.evAcc; reset(w); w.evAcc = acc; } return; }
    if (w.phase === 'clear') { w.phaseTimer++; return; }
    var L = w.level;
    w.players.forEach(function (p) {
      var i = (inputs && inputs[p.slot]) || {};
      var upPress = i.up && !p.pu, jumpPress = (i.jump && !p.pj), downPress = i.down && !p.pd;
      p.pu = !!i.up; p.pj = !!i.jump; p.pd = !!i.down;
      if (p.state === 'entered') { if (downPress) { p.state = 'active'; ev(w, 'exit', p.x + 12, p.y + 15, p.slot); } return; }
      var dir = (i.right ? 1 : 0) - (i.left ? 1 : 0);
      if (dir) p.facing = dir;
      var acc = p.onGround ? C.ACC_GROUND : C.ACC_AIR;
      if (dir) p.vx += Math.max(-acc, Math.min(acc, dir * C.RUN - p.vx));
      else if (p.onGround) p.vx = Math.abs(p.vx) <= C.DEC_GROUND ? 0 : p.vx - Math.sign(p.vx) * C.DEC_GROUND;
      var d = w.door, overDoor = p.x < d.x + d.w && p.x + p.w > d.x && p.y < d.y + d.h && p.y + p.h > d.y;
      if (upPress && overDoor && d.open) { p.state = 'entered'; ev(w, 'enter', p.x + 12, p.y + 15, p.slot); return; }
      if (upPress) jumpPress = true;
      var held = i.jump || i.up;
      if (jumpPress) p.buf = C.JUMP_BUFFER; else if (p.buf > 0) p.buf--;
      if (p.onGround) p.coy = C.COYOTE; else if (p.coy > 0) p.coy--;
      if (p.buf > 0 && p.coy > 0) { p.vy = C.JUMP_V; p.buf = 0; p.coy = 0; p.onGround = false; ev(w, 'jump', p.x + 12, p.y + 30, p.slot); }
      if (!held && p.vy < C.JUMP_CUT) p.vy = C.JUMP_CUT;
      p.vy = Math.min(C.MAX_FALL, p.vy + C.GRAVITY);
      var nx = p.x + p.vx;
      if (hitSolid(w, nx, p.y, p.w, p.h, p.slot)) { var s = Math.sign(p.vx); while (!hitSolid(w, p.x + s, p.y, p.w, p.h, p.slot) && Math.abs(nx - p.x) >= 1) p.x += s; p.vx = 0; } else p.x = nx;
      var ny = p.y + p.vy, wasG = p.onGround; p.onGround = false;
      if (hitSolid(w, p.x, ny, p.w, p.h, p.slot)) {
        if (p.vy > 0) { p.y = Math.floor((ny + p.h) / 32) * 32 - p.h; p.onGround = true; } else p.y = Math.ceil(ny / 32) * 32;
        p.vy = 0;
      } else {
        var fr = Math.floor((ny + p.h) / 32), oc = Math.floor((p.y + p.h - 0.01) / 32);
        if (p.vy > 0 && fr > oc && !(i.down && i.jump)) {
          var oneway = false;
          for (var c = Math.floor(p.x / 32); c <= Math.floor((p.x + p.w - 1) / 32); c++) if (tileAt(w, c, fr) === '-') oneway = true;
          if (oneway) { p.y = fr * 32 - p.h; p.vy = 0; p.onGround = true; } else p.y = ny;
        } else p.y = ny;
      }
      if (p.onGround && !wasG) { p.landed = w.tick; ev(w, 'land', p.x + 12, p.y + 30, p.slot); }
      p.walk = p.onGround && Math.abs(p.vx) > 0.2 ? p.walk + Math.abs(p.vx) : 0;
      // spikes
      for (var r = Math.floor(p.y / 32); r <= Math.floor((p.y + p.h) / 32); r++) for (var c2 = Math.floor(p.x / 32); c2 <= Math.floor((p.x + p.w) / 32); c2++)
        if (tileAt(w, c2, r) === '^' && p.x + p.w > c2 * 32 + 4 && p.x < c2 * 32 + 28 && p.y + p.h > r * 32 + 16) die(w, p);
      if (p.y > L.rows * 32 + 64) die(w, p);
      var k = w.key;
      if (k && k.holder < 0 && !k.used && Math.abs(p.x + 12 - k.x) < 24 && Math.abs(p.y + 15 - k.y) < 26) { k.holder = p.slot; p.hasKey = true; ev(w, 'key', k.x, k.y, p.slot); }
      if (p.hasKey && overDoor && !d.open) { d.open = true; p.hasKey = false; k.used = true; k.holder = -1; ev(w, 'unlock', d.x + 16, d.y + 32, p.slot); }
      w.gears.forEach(function (g) { if (!g.taken && Math.abs(p.x + 12 - g.x) < 22 && Math.abs(p.y + 15 - g.y) < 24) { g.taken = true; w.gearsTaken++; ev(w, 'gear', g.x, g.y, p.slot); } });
    });
    if (w.key && w.key.holder >= 0) { var h = w.players.filter(function (p) { return p.slot === w.key.holder; })[0]; if (h) { w.key.x = h.x + 12; w.key.y = h.y + 15; } }
    if (w.phase === 'play' && w.players.length && w.players.every(function (p) { return p.state === 'entered'; })) { w.phase = 'clear'; w.phaseTimer = 0; ev(w, 'clear', w.door.x + 16, w.door.y + 32, -1); }
  }
  function die(w, p) { if (w.phase !== 'play') return; w.phase = 'dead'; w.phaseTimer = 0; w.deadSlot = p.slot; ev(w, 'die', p.x + 12, p.y + 15, p.slot); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function snapshot(w) {
    var s = { t: w.tick, ph: w.phase, pt: w.phaseTimer, ds: w.deadSlot,
      p: w.players.map(function (p) { return [p.slot, r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), p.onGround ? 1 : 0, p.facing, p.state === 'entered' ? 1 : 0, p.hasKey ? 1 : 0]; }),
      k: w.key ? [r1(w.key.x), r1(w.key.y), w.key.holder, w.key.used ? 1 : 0] : null, d: w.door.open ? 1 : 0,
      g: w.gears.map(function (g) { return g.taken ? 1 : 0; }).join(''), ev: w.evAcc.map(function (e) { return [e.t, e.x, e.y, e.slot]; }) };
    w.evAcc = []; return s;
  }
  function applySnapshot(w, s) {
    w.tick = s.t; w.phase = s.ph; w.phaseTimer = s.pt; w.deadSlot = s.ds;
    s.p.forEach(function (a) { var p = w.players.filter(function (q) { return q.slot === a[0]; })[0]; if (!p) return;
      p.x = a[1]; p.y = a[2]; p.vx = a[3]; p.vy = a[4]; p.onGround = !!a[5]; p.facing = a[6]; p.state = a[7] ? 'entered' : 'active'; p.hasKey = !!a[8]; });
    if (w.key && s.k) { w.key.x = s.k[0]; w.key.y = s.k[1]; w.key.holder = s.k[2]; w.key.used = !!s.k[3]; }
    w.door.open = !!s.d; var n = 0;
    w.gears.forEach(function (g, i) { g.taken = s.g[i] === '1'; if (g.taken) n++; }); w.gearsTaken = n;
    w.events = (s.ev || []).map(function (e) { return { t: e[0], x: e[1], y: e[2], slot: e[3] }; });
  }
  var Engine = { C: C, parseLevel: parseLevel, createWorld: createWorld, reset: reset, step: step, snapshot: snapshot,
    applySnapshot: applySnapshot, tileAt: tileAt, isSolidFor: isSolidFor, STUB: true };
  root.SB = root.SB || {}; root.SB.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
