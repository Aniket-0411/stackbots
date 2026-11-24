/* STACKBOTS engine — deterministic fixed-step simulation (SPEC §2–§6, §9).
 * Plain ES2019, no dependencies, no DOM, no Math.random / Date.
 * UMD: globalThis.SB.Engine and module.exports. */
(function (root, factory) {
  var E = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = E;
  var g = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : root);
  if (g) { g.SB = g.SB || {}; g.SB.Engine = E; }
})(this, function () {
  'use strict';

  var C = {
    T: 32, PW: 24, PH: 30, GRAVITY: 0.55, MAX_FALL: 12, RUN: 2.6, ACC_GROUND: 0.5, DEC_GROUND: 0.6,
    ACC_AIR: 0.35, JUMP_V: -9.6, JUMP_CUT: -4, COYOTE: 4, JUMP_BUFFER: 6, SPRING_V: -14,
    CRATE_SPEED: 1.2, CONVEYOR: 1.4, PLATFORM_SPEED: 1.0, DEAD_TICKS: 60, CLEAR_TICKS: 120, LEASH_X: 1280,
    // engine extras (documented in NOTES-engine.md)
    PLAT_H: 12, SAW_R: 14, SAW_SPEED: 1.5, DROP_TICKS: 8, CRUMBLE_DELAY: 30, CRUMBLE_RESPAWN: 180,
    BEAM_W: 6, GATE_ANIM: 0.125, PUSH_OVERLAP: 8, BUTTON_TOL: 2, TIMER_DEFAULT: 180
  };
  var T = 32, EPS = 0.01, TINY = 1e-6;
  var EVENTS = ['jump', 'land', 'key', 'unlock', 'enter', 'exit', 'die', 'clear', 'press', 'release',
    'lever', 'spring', 'gear', 'crumble', 'gate', 'reset'];
  var PHASES = ['play', 'dead', 'clear'];
  var NOIN = {};

  // tile categories
  var K_EMPTY = 0, K_SOLID = 1, K_ONEWAY = 2, K_SPIKE = 3, K_SPRING = 4, K_CRUMBLE = 5, K_CONVL = 6, K_CONVR = 7, K_COLOR = 8; // 8..11
  var CAT = { '.': 0, '#': 1, '-': 2, '^': 3, '*': 4, '=': 5, '<': 6, '>': 7, 'a': 8, 'b': 9, 'c': 10, 'd': 11 };

  // ------------------------------------------------------------------ parsing
  function isCh(v) { return typeof v === 'string' && /^[A-H]$/.test(v); }
  function fnum(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  function parseLevel(json, meta) {
    if (!json || typeof json !== 'object') throw new Error('?: level is not an object');
    var id = json.id != null ? String(json.id) : '?';
    function fail(m) { throw new Error(id + ': ' + m); }
    var map = json.map;
    if (!Array.isArray(map) || !map.length) fail('map missing or empty');
    var rows = map.length, cols = typeof map[0] === 'string' ? map[0].length : 0;
    if (!cols) fail('map row 0 is empty or not a string');
    var tiles = new Array(rows * cols), cat = new Uint8Array(rows * cols);
    var spawns = [null, null, null, null], key = null, door = null, gears = [];
    for (var r = 0; r < rows; r++) {
      var row = map[r];
      if (typeof row !== 'string') fail('map row ' + r + ' is not a string');
      if (row.length !== cols) fail('map row ' + r + ' has length ' + row.length + ', expected ' + cols);
      for (var c = 0; c < cols; c++) {
        var ch = row[c], t = ch;
        if (ch >= '1' && ch <= '4') {
          var k = ch.charCodeAt(0) - 49;
          if (spawns[k]) fail('spawn ' + ch + ' appears more than once');
          spawns[k] = { c: c, r: r }; t = '.';
        } else if (ch === 'K') {
          if (key) fail('more than one Power Cell K'); key = { c: c, r: r }; t = '.';
        } else if (ch === 'D') {
          if (door) fail('more than one hatch D'); door = { c: c, r: r }; t = '.';
        } else if (ch === 'o') {
          gears.push({ c: c, r: r }); t = '.';
        } else if (!(ch in CAT)) {
          fail('unknown map char ' + JSON.stringify(ch) + ' at ' + c + ',' + r);
        }
        tiles[r * cols + c] = t; cat[r * cols + c] = CAT[t];
      }
    }
    if (!door) fail('no hatch D in map');
    if (door.r < 1) fail('hatch D needs a tile above it');
    for (var q = 0; q < 4; q++) if (!spawns[q]) fail('spawn ' + (q + 1) + ' missing');
    var src = json.entities == null ? [] : json.entities;
    if (!Array.isArray(src)) fail('entities must be an array');
    var ents = [];
    for (var i = 0; i < src.length; i++) ents.push(normEntity(src[i], i, fail));
    var lvl = {
      id: id, name: json.name != null ? String(json.name) : id, hint: json.hint ? String(json.hint) : '',
      minPlayers: fnum(json.minPlayers, 2), tether: !!json.tether, tetherLength: fnum(json.tetherLength, 5),
      cols: cols, rows: rows, map: map.slice(), tiles: tiles, cat: cat,
      spawns: spawns, key: key, door: door, gears: gears, entities: ents
    };
    if (meta) for (var m in meta) if (Object.prototype.hasOwnProperty.call(meta, m)) lvl[m] = meta[m];
    return lvl;
  }

  function normPath(e, n, fail, label) {
    var p = e.path;
    if (p == null) return [[n.x, n.y]];
    if (!Array.isArray(p) || !p.length) fail(label + ': path must be a non-empty array');
    var out = [];
    for (var i = 0; i < p.length; i++) {
      var w = p[i];
      if (!Array.isArray(w) || w.length < 2 || !isFinite(w[0]) || !isFinite(w[1])) fail(label + ': bad waypoint ' + i);
      out.push([+w[0], +w[1]]);
    }
    if (out[0][0] !== n.x || out[0][1] !== n.y) fail(label + ': first waypoint must equal (x, y)');
    return out;
  }

  function normEntity(e, i, fail) {
    if (!e || typeof e !== 'object' || typeof e.type !== 'string') fail('entity ' + i + ' has no type');
    var label = 'entity ' + i + ' (' + e.type + ')';
    if (!isFinite(e.x) || !isFinite(e.y)) fail(label + ': x/y missing');
    var n = { type: e.type, id: e.id != null ? String(e.id) : e.type + i, x: +e.x, y: +e.y };
    function chan(req) {
      if (e.channel == null) { if (req) fail(label + ': channel required'); return null; }
      if (!isCh(e.channel)) fail(label + ': channel must be "A".."H"');
      return e.channel;
    }
    var logic = e.logic === 'any' ? 'any' : 'all';
    if (e.logic != null && e.logic !== 'any' && e.logic !== 'all') fail(label + ': logic must be all|any');
    switch (e.type) {
      case 'crate':
        n.w = Math.max(1, fnum(e.w, 1)); n.h = Math.max(1, fnum(e.h, 1));
        n.need = Math.max(1, fnum(e.need, 1)); n.weight = fnum(e.weight, 1); break;
      case 'button':
        n.w = Math.max(1, fnum(e.w, 1)); n.channel = chan(true); n.need = Math.max(1, fnum(e.need, 1));
        n.mode = e.mode == null ? 'hold' : e.mode;
        if (n.mode !== 'hold' && n.mode !== 'latch' && n.mode !== 'timer') fail(label + ': mode must be hold|latch|timer');
        n.time = Math.max(1, fnum(e.time, C.TIMER_DEFAULT)); break;
      case 'lever':
        n.channel = chan(true); n.on = !!e.on; break;
      case 'gate':
        n.w = Math.max(1, fnum(e.w, 1)); n.h = Math.max(1, fnum(e.h, 1)); n.channel = chan(true);
        n.logic = logic; n.invert = !!e.invert; break;
      case 'platform':
        n.w = Math.max(1, fnum(e.w, 1)); n.path = normPath(e, n, fail, label);
        n.speed = Math.max(0, fnum(e.speed, C.PLATFORM_SPEED)); n.mode = e.mode === 'loop' ? 'loop' : 'pingpong';
        n.channel = chan(false); n.logic = logic; n.invert = !!e.invert; n.need = Math.max(0, fnum(e.need, 0)); break;
      case 'saw':
        n.path = normPath(e, n, fail, label); n.speed = Math.max(0, fnum(e.speed, C.SAW_SPEED));
        n.mode = e.mode === 'loop' ? 'loop' : 'pingpong'; break;
      case 'laser':
        n.dir = e.dir == null ? 'r' : e.dir;
        if ('rlud'.indexOf(n.dir) < 0 || n.dir.length !== 1) fail(label + ': dir must be r|l|u|d');
        n.channel = chan(false); n.logic = logic; n.invert = !!e.invert;
        n.cyc = (!n.channel && isFinite(e.on) && isFinite(e.off)) ? [Math.max(0, +e.on), Math.max(0, +e.off), fnum(e.phase, 0)] : null;
        break;
      default: fail(label + ': unknown entity type');
    }
    return n;
  }

  // ------------------------------------------------------------------ geometry helpers
  function ovX(a, b) { return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS; }
  function ovY(a, b) { return Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS; }
  function ovXY(a, b) { return ovX(a, b) && ovY(a, b); }
  function rnd1(v) { return Math.round(v * 10) / 10; }
  function rnd2(v) { return Math.round(v * 100) / 100; }

  function solidAt(w, c, r, slot) {
    var L = w.level;
    if (c < 0 || c >= L.cols) return true;
    if (r < 0 || r >= L.rows) return false;
    var i = r * L.cols + c, k = L.cat[i];
    if (k === K_SOLID || k === K_CONVL || k === K_CONVR) return true;
    if (k === K_CRUMBLE) return !w._gone[i];
    if (k >= K_COLOR) { var o = k - K_COLOR; return !(slot === o && w._present[o]); }
    return false;
  }
  function catAt(w, c, r) {
    var L = w.level;
    if (c < 0 || c >= L.cols) return K_SOLID;
    if (r < 0 || r >= L.rows) return K_EMPTY;
    return L.cat[r * L.cols + c];
  }
  function tileAt(w, c, r) {
    var L = w.level;
    if (c < 0 || c >= L.cols) return '#';
    if (r < 0 || r >= L.rows) return '.';
    var i = r * L.cols + c, t = L.tiles[i];
    if (t === '=' && w._gone[i]) return '.';
    return t;
  }
  function isSolidFor(w, c, r, slot) { return solidAt(w, c, r, slot == null ? -1 : slot); }
  function slotOf(b) { return b.isP ? b.slot : -1; }
  var BODY_HIDDEN = ['sup', 'rest', 'def', 'path', 'inp'];
  function hide(o, names) {
    for (var i = 0; i < names.length; i++) {
      var n = names[i], d = Object.getOwnPropertyDescriptor(o, n);
      if (d && d.enumerable) Object.defineProperty(o, n, { value: d.value, writable: true, enumerable: false, configurable: true });
    }
    return o;
  }

  // ------------------------------------------------------------------ paths
  function buildPath(pts, loop) {
    var P = [], i, segs = [], L = 0;
    for (i = 0; i < pts.length; i++) P.push([pts[i][0] * T, pts[i][1] * T]);
    var n = P.length, m = loop ? n : n - 1;
    for (i = 0; i < m && n > 1; i++) {
      var a = P[i], b = P[(i + 1) % n], len = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
      segs.push({ a: a, b: b, s0: L, len: len }); L += len;
    }
    return { pts: P, segs: segs, len: L, loop: !!loop };
  }
  function pathAt(path, s, out) {
    var segs = path.segs;
    if (!segs.length || s <= 0) { out[0] = path.pts[0][0]; out[1] = path.pts[0][1]; return out; }
    for (var i = 0; i < segs.length; i++) {
      var g = segs[i];
      if (s <= g.s0 + g.len || i === segs.length - 1) {
        var f = g.len > 0 ? Math.min(1, Math.max(0, (s - g.s0) / g.len)) : 1;
        out[0] = g.a[0] + (g.b[0] - g.a[0]) * f; out[1] = g.a[1] + (g.b[1] - g.a[1]) * f; return out;
      }
    }
    return out;
  }
  var tmp2 = [0, 0];

  // ------------------------------------------------------------------ world construction
  function emit(w, t, x, y, slot) {
    var ev = { t: t, x: Math.round(x), y: Math.round(y), slot: slot == null ? -1 : slot };
    w.events.push(ev);
    w._evAcc.push(ev);
    if (w._evAcc.length > 32) w._evAcc.shift();
  }

  function createWorld(level, opts) {
    var L = level && level.cat ? level : parseLevel(level);
    var slots = (opts && Array.isArray(opts.slots) && opts.slots.length) ? opts.slots.slice() : [0, 1, 2, 3];
    slots = slots.filter(function (s, i) { return s >= 0 && s <= 3 && slots.indexOf(s) === i; }).sort();
    if (!slots.length) slots = [0];
    var w = {
      level: L, slots: slots, nbots: slots.length, tick: 0, time: 0, attempt: 0, deaths: 0,
      phase: 'play', phaseTimer: 0, deadSlot: -1,
      players: [], key: null, door: null, entities: [], crumble: {}, gears: [], gearsTaken: 0,
      channels: {}, chanAny: {}, ropes: [], events: [], _liftSeq: 0,
      _evAcc: [], _present: [false, false, false, false], _gone: new Uint8Array(L.rows * L.cols), _in: []
    };
    for (var i = 0; i < slots.length; i++) w._present[slots[i]] = true;
    for (i = 0; i < 4; i++) w._in.push({ j: false, u: false, d: false, jc: null, uc: null });
    buildState(w);
    return w;
  }

  function makePlayer(w, slot) {
    var L = w.level, sp = L.spawns[slot], off = 0;
    if (!sp) { for (var k = 0; k < 4; k++) if (L.spawns[k]) { sp = L.spawns[k]; off = (slot - k) * 26; break; } }
    if (!sp) sp = { c: 1, r: 1 };
    var pl = {
      slot: slot, x: sp.c * T + 4 + off, y: sp.r * T + 2, w: C.PW, h: C.PH, vx: 0, vy: 0, onGround: false,
      facing: 1, state: 'active', hasKey: false, walk: 0, landed: false,
      isP: true, coyote: 0, jbuf: 0, jumping: false, dropT: 0, sup: null, rest: [], restStatic: false,
      supOneWay: false, conv: 0, air: 0, _dx: 0, _dy: 0, _dir: 0, _lift: 0, _ls: 0, inp: NOIN
    };
    return hide(pl, BODY_HIDDEN);
  }

  function initEntity(w, d) {
    var e = { id: d.id, type: d.type, def: d, x: d.x * T, y: d.y * T, w: T, h: T };
    switch (d.type) {
      case 'crate':
        e.w = d.w * T; e.h = d.h * T; e.vx = 0; e.vy = 0; e.need = d.need; e.weight = d.weight; e.pushers = 0;
        e.gone = false; e.isC = true; e.onGround = false; e.sup = null; e.rest = []; e.restStatic = false;
        e.conv = 0; e._dx = 0; e._dy = 0; e.dropT = 0; e._lift = 0; e._ls = 0; break;
      case 'button':
        e.y = d.y * T + 26; e.w = d.w * T; e.h = 6; e.channel = d.channel; e.need = d.need; e.mode = d.mode;
        e.time = d.time; e.pressed = false; e.on = false; e.load = 0; e.timer = 0; break;
      case 'lever':
        e.channel = d.channel; e.on = d.on; break;
      case 'gate':
        e.w = d.w * T; e.h = d.h * T; e.channel = d.channel; e.logic = d.logic; e.invert = d.invert;
        e.open = false; e.openAmt = 0; e.isGate = true; break;
      case 'platform':
        e.w = d.w * T; e.h = C.PLAT_H; e.path = buildPath(d.path, d.mode === 'loop'); e.s = 0; e.dir = 1;
        e.speed = d.speed; e.mode = d.mode; e.channel = d.channel; e.logic = d.logic; e.need = d.need;
        e.riders = 0; e.isPlat = true; e._dx = 0; e._dy = 0; break;
      case 'saw':
        e.path = buildPath(d.path, d.mode === 'loop'); e.r = C.SAW_R; e.angle = 0; e.w = e.h = 2 * C.SAW_R;
        e.s = 0; e.dir = 1; e.speed = d.speed; e.mode = d.mode;
        e.cx = d.x * T + 16; e.cy = d.y * T + 16; break;
      case 'laser':
        e.dir = d.dir; e.channel = d.channel; e.logic = d.logic; e.invert = d.invert; e.beamOn = true;
        e.len = 0; e.x1 = 0; e.y1 = 0; e.x2 = 0; e.y2 = 0; break;
    }
    return hide(e, BODY_HIDDEN);
  }

  function buildState(w) {
    var L = w.level, i;
    w.players = [];
    for (i = 0; i < w.slots.length; i++) w.players.push(makePlayer(w, w.slots[i]));
    w._bySlot = [null, null, null, null];
    for (i = 0; i < w.players.length; i++) w._bySlot[w.players[i].slot] = w.players[i];
    w.key = L.key ? { x: L.key.c * T + 16, y: L.key.r * T + 16, holder: -1, used: false } : null;
    w.door = { x: L.door.c * T, y: (L.door.r - 1) * T, w: T, h: 2 * T, open: !L.key };
    w.entities = []; w._crates = []; w._gates = []; w._plats = []; w._buttons = []; w._levers = []; w._saws = []; w._lasers = [];
    var lists = { crate: w._crates, gate: w._gates, platform: w._plats, button: w._buttons, lever: w._levers, saw: w._saws, laser: w._lasers };
    for (i = 0; i < L.entities.length; i++) {
      var e = initEntity(w, L.entities[i]);
      w.entities.push(e); lists[e.type].push(e);
    }
    w.crumble = {}; w._gone = new Uint8Array(L.rows * L.cols);
    w.gears = L.gears.map(function (g) { return { x: g.c * T + 16, y: g.r * T + 16, taken: false }; });
    w.gearsTaken = 0;
    w.ropes = [];
    if (L.tether) for (i = 0; i + 1 < w.slots.length; i++) w.ropes.push([w.slots[i], w.slots[i + 1]]);
    w.phase = 'play'; w.phaseTimer = 0; w.deadSlot = -1; w.time = 0;
    computeChannels(w);
    for (i = 0; i < w._gates.length; i++) { var g = w._gates[i]; g.open = gateWant(w, g); g.openAmt = g.open ? 1 : 0; }
    updateSaws(w); updateLaserStates(w); computeBeams(w);
  }

  function reset(w) {
    buildState(w);
    w.attempt++;
    return w;
  }

  // ------------------------------------------------------------------ channels
  function computeChannels(w) {
    var all = {}, any = {}, seen = {}, i, s, srcs = w._buttons.concat(w._levers);
    for (i = 0; i < srcs.length; i++) {
      s = srcs[i]; var ch = s.channel;
      if (!seen[ch]) { seen[ch] = true; all[ch] = true; any[ch] = false; }
      if (s.on) any[ch] = true; else all[ch] = false;
    }
    w.channels = all; w.chanAny = any;
  }
  function reading(w, ch, logic) {
    if (!ch) return false;
    return logic === 'any' ? !!w.chanAny[ch] : !!w.channels[ch];
  }
  function gateWant(w, g) { return reading(w, g.channel, g.logic) !== g.invert; }

  // ------------------------------------------------------------------ collision
  var EPS2 = 0.05;
  var hitBody = null;                       // set by sweepX
  var HL = [], HT = [], H_static = false, H_oneway = false, H_hit = false;  // set by sweepDown
  var CANDS = [];


  function sweepX(w, b, dx) {
    hitBody = null;
    if (dx === 0) return 0;
    var slot = slotOf(b), lim = dx, c, r, i, o;
    var r0 = Math.floor((b.y + EPS) / T), r1 = Math.floor((b.y + b.h - EPS) / T);
    var P = w.players, Cr = w._crates, G = w._gates;
    if (dx > 0) {
      var edge = b.x + b.w;
      var c0 = Math.ceil((edge - EPS) / T), c1 = Math.floor((edge + dx - TINY) / T);
      outer1: for (c = c0; c <= c1; c++) for (r = r0; r <= r1; r++) if (solidAt(w, c, r, slot)) { lim = c * T - edge; break outer1; }
      for (i = 0; i < P.length; i++) { o = P[i]; if (o !== b && o.state === 'active' && ovY(b, o) && o.x >= edge - EPS && o.x - edge < lim) { lim = o.x - edge; hitBody = o; } }
      for (i = 0; i < Cr.length; i++) { o = Cr[i]; if (o !== b && !o.gone && ovY(b, o) && o.x >= edge - EPS && o.x - edge < lim) { lim = o.x - edge; hitBody = o; } }
      for (i = 0; i < G.length; i++) { o = G[i]; if (!o.open && ovY(b, o) && o.x >= edge - EPS && o.x - edge < lim) { lim = o.x - edge; hitBody = null; } }
      return lim > 0 ? lim : 0;
    } else {
      var left = b.x;
      var d0 = Math.floor((left + EPS) / T) - 1, d1 = Math.floor((left + dx + TINY) / T);
      outer2: for (c = d0; c >= d1; c--) for (r = r0; r <= r1; r++) if (solidAt(w, c, r, slot)) { lim = (c + 1) * T - left; break outer2; }
      for (i = 0; i < P.length; i++) { o = P[i]; if (o !== b && o.state === 'active' && ovY(b, o) && o.x + o.w <= left + EPS && o.x + o.w - left > lim) { lim = o.x + o.w - left; hitBody = o; } }
      for (i = 0; i < Cr.length; i++) { o = Cr[i]; if (o !== b && !o.gone && ovY(b, o) && o.x + o.w <= left + EPS && o.x + o.w - left > lim) { lim = o.x + o.w - left; hitBody = o; } }
      for (i = 0; i < G.length; i++) { o = G[i]; if (!o.open && ovY(b, o) && o.x + o.w <= left + EPS && o.x + o.w - left > lim) { lim = o.x + o.w - left; hitBody = null; } }
      return lim < 0 ? lim : 0;
    }
  }

  // downward sweep; fills HL/HT/H_static/H_oneway/H_hit; returns allowed dy (may be slightly < 0 when snapping onto a rising platform)
  function sweepDown(w, b, dy) {
    var L = w.level, slot = slotOf(b), edge = b.y + b.h, best = dy, drop = b.dropT > 0, c, r, i, o, d, k;
    var c0 = Math.floor((b.x + EPS) / T), c1 = Math.floor((b.x + b.w - EPS) / T);
    var r0 = Math.ceil((edge - EPS) / T), r1 = Math.floor((edge + dy - TINY) / T);
    var tileRow = -1, rowOneWay = true, sprRow = -1;
    if (r0 < 0) r0 = 0;
    for (r = r0; r <= r1 && r < L.rows && tileRow < 0; r++) {
      for (c = c0; c <= c1; c++) {
        if (solidAt(w, c, r, slot)) { tileRow = r; rowOneWay = false; }
        else if (!drop && catAt(w, c, r) === K_ONEWAY) tileRow = r;
      }
    }
    if (tileRow >= 0) best = tileRow * T - edge;
    var s0 = Math.ceil((edge - EPS - 20) / T), s1 = Math.floor((edge + Math.min(best, dy) - 20 + EPS) / T);
    if (s0 < 0) s0 = 0;
    for (r = s0; r <= s1 && r < L.rows && sprRow < 0; r++) for (c = c0; c <= c1; c++) {
      if (catAt(w, c, r) === K_SPRING) { d = r * T + 20 - edge; if (d >= -EPS && d < best + EPS) { sprRow = r; if (d < best) best = d; } }
    }
    CANDS.length = 0;
    var P = w.players, Cr = w._crates, G = w._gates, Pl = w._plats;
    for (i = 0; i < P.length; i++) { o = P[i]; if (o === b || o.state !== 'active' || !ovX(b, o)) continue; d = o.y - edge; if (d >= -EPS && d <= best + EPS) { CANDS.push(o); if (d < best) best = d; } }
    for (i = 0; i < Cr.length; i++) { o = Cr[i]; if (o === b || o.gone || !ovX(b, o)) continue; d = o.y - edge; if (d >= -EPS && d <= best + EPS) { CANDS.push(o); if (d < best) best = d; } }
    for (i = 0; i < G.length; i++) { o = G[i]; if (o.open || !ovX(b, o)) continue; d = o.y - edge; if (d >= -EPS && d <= best + EPS) { CANDS.push(o); if (d < best) best = d; } }
    if (!drop) for (i = 0; i < Pl.length; i++) {
      o = Pl[i]; if (!ovX(b, o)) continue; d = o.y - edge;
      var tol = EPS + (o._dy < 0 ? -o._dy : 0);
      if (d >= -tol && d <= best + EPS) { CANDS.push(o); if (d < best) best = d; }
    }
    HL.length = 0; HT.length = 0; H_static = false; H_oneway = true; H_hit = false;
    if (tileRow >= 0 && tileRow * T - edge <= best + EPS2) {
      H_hit = true; H_static = true; if (!rowOneWay) H_oneway = false;
      for (c = c0; c <= c1; c++) if (c >= 0 && c < L.cols) { k = L.cat[tileRow * L.cols + c]; if ((k !== K_EMPTY && solidAt(w, c, tileRow, slot)) || (k === K_ONEWAY && !drop)) HT.push(tileRow * L.cols + c); }
    }
    if (sprRow >= 0 && sprRow * T + 20 - edge <= best + EPS2) {
      H_hit = true; H_static = true; H_oneway = false;
      for (c = c0; c <= c1; c++) if (catAt(w, c, sprRow) === K_SPRING) HT.push(sprRow * L.cols + c);
    }
    for (i = 0; i < CANDS.length; i++) {
      o = CANDS[i]; d = o.y - edge;
      if (d <= best + EPS2) {
        H_hit = true;
        if (o.isGate) { H_static = true; H_oneway = false; }
        else { HL.push(o); if (!o.isPlat) H_oneway = false; }
      }
    }
    if (!H_hit) H_oneway = false;
    return best;
  }
  function springUnder(w) {
    for (var i = 0; i < HT.length; i++) if (w.level.cat[HT[i]] === K_SPRING) return true;
    return false;
  }

  function sweepUp(w, b, dy, excl) {
    var L = w.level, slot = slotOf(b), edge = b.y, lim = dy, c, r, i, o, bot;
    var c0 = Math.floor((b.x + EPS) / T), c1 = Math.floor((b.x + b.w - EPS) / T);
    var rs = Math.floor((edge + EPS) / T) - 1, re = Math.floor((edge + dy + TINY) / T);
    if (rs >= L.rows) rs = L.rows - 1;
    outer: for (r = rs; r >= re && r >= 0; r--) for (c = c0; c <= c1; c++) if (solidAt(w, c, r, slot)) { lim = (r + 1) * T - edge; break outer; }
    var P = w.players, Cr = w._crates, G = w._gates;
    for (i = 0; i < P.length; i++) { o = P[i]; if (o === b || o.state !== 'active' || excl.indexOf(o) >= 0 || !ovX(b, o)) continue; bot = o.y + o.h; if (bot <= edge + EPS && bot - edge > lim) lim = bot - edge; }
    for (i = 0; i < Cr.length; i++) { o = Cr[i]; if (o === b || o.gone || excl.indexOf(o) >= 0 || !ovX(b, o)) continue; bot = o.y + o.h; if (bot <= edge + EPS && bot - edge > lim) lim = bot - edge; }
    for (i = 0; i < G.length; i++) { o = G[i]; if (o.open || !ovX(b, o)) continue; bot = o.y + o.h; if (bot <= edge + EPS && bot - edge > lim) lim = bot - edge; }
    return lim < 0 ? lim : 0;
  }

  // bodies resting directly on b (players; plus crates when b is not a player)
  function ridersOf(w, b) {
    var out = [], i, o, top = b.y, P = w.players, Cr = w._crates;
    for (i = 0; i < P.length; i++) { o = P[i]; if (o !== b && o.state === 'active' && ovX(o, b) && Math.abs(o.y + o.h - top) <= EPS2) out.push(o); }
    if (!b.isP) for (i = 0; i < Cr.length; i++) { o = Cr[i]; if (o !== b && !o.gone && ovX(o, b) && Math.abs(o.y + o.h - top) <= EPS2) out.push(o); }
    return out;
  }

  // how far b (with everything stacked on it) can move up, want < 0
  function maxUp(w, b, want, depth) {
    var rs = ridersOf(w, b), lim = b.isPlat ? want : sweepUp(w, b, want, rs);
    if ((depth | 0) < 12) for (var i = 0; i < rs.length && lim < 0; i++) {
      var rl = maxUp(w, rs[i], lim, (depth | 0) + 1);
      if (rl > lim) lim = rl;
    }
    return lim;
  }

  // move b up by (at most) dy < 0 together with everything resting on it (dedup'd); riders are flagged _lift=tick
  // so their own step does not apply the support's dy a second time
  var LIFT = [];
  function liftY(w, b, dy) {
    if (dy >= 0) return 0;
    var act = maxUp(w, b, dy);
    if (act >= 0) return 0;
    var seq = ++w._liftSeq, i, j;
    LIFT.length = 0; LIFT.push(b); b._ls = seq;
    for (i = 0; i < LIFT.length && i < 64; i++) {
      var rs = ridersOf(w, LIFT[i]);
      for (j = 0; j < rs.length; j++) if (rs[j]._ls !== seq) { rs[j]._ls = seq; LIFT.push(rs[j]); }
    }
    for (i = 0; i < LIFT.length; i++) { LIFT[i].y += act; if (i) LIFT[i]._lift = w.tick; }
    return act;
  }

  // ------------------------------------------------------------------ landing bookkeeping
  function land(w, b) {
    // uses the H_* results of the last sweepDown
    b.rest = HL.slice(); b.restStatic = H_static; b.supOneWay = H_oneway;
    var best = null, bo = -1, i;
    if (!H_static) for (i = 0; i < HL.length; i++) {
      var o = HL[i], ov = Math.min(b.x + b.w, o.x + o.w) - Math.max(b.x, o.x);
      if (ov > bo) { bo = ov; best = o; }
    }
    b.sup = best;
    b.conv = 0;
    if (HT.length) {
      var L = w.level, cx = Math.floor((b.x + b.w / 2) / T), centerConv = 0, anyConv = 0;
      for (i = 0; i < HT.length; i++) {
        var idx = HT[i], k = L.cat[idx];
        if (k === K_CRUMBLE) touchCrumble(w, idx);
        if (k === K_CONVL || k === K_CONVR) {
          var v = k === K_CONVL ? -1 : 1;
          if (!anyConv) anyConv = v;
          if (idx % L.cols === cx) centerConv = v;
        }
      }
      b.conv = centerConv || anyConv;
    }
  }

  function touchCrumble(w, idx) {
    var L = w.level, key = (idx % L.cols) + ',' + Math.floor(idx / L.cols);
    if (!w.crumble[key]) w.crumble[key] = { t: C.CRUMBLE_DELAY, gone: false };
  }

  function supportDx(b) {
    if (!b.onGround) return 0;
    if (b.sup) return (b.sup.isPlat || (b.sup.isP && b.sup.state !== 'active')) ? 0 : (b.sup._dx || 0);
    return b.conv * C.CONVEYOR;
  }
  function supportDy(b) {
    // most upward (min) dy among supports that still overlap horizontally
    if (!b.onGround) return 0;
    var dy = b.restStatic ? 0 : Infinity, any = b.restStatic;
    for (var i = 0; i < b.rest.length; i++) {
      var o = b.rest[i];
      if (o.gone || (o.isP && o.state !== 'active') || !ovX(b, o)) continue;
      if ((b.isC && o.isP) || o.isPlat) { if (0 < dy) dy = 0; any = true; continue; }
      any = true; if (o._dy < dy) dy = o._dy;
    }
    return any && dy !== Infinity ? dy : 0;
  }

  // move b vertically by carry dy (no landing bookkeeping); returns actual
  function carryY(w, b, dy) {
    if (dy < 0) { var lim = maxUp(w, b, dy); b.y += lim; return lim; }
    if (dy > 0) { var d = sweepDown(w, b, dy); if (d > dy) d = dy; b.y += d; return d; }
    return 0;
  }

  function leashLimit(w, p, dx) {
    var P = w.players, mn = Infinity, mx = -Infinity, n = 0;
    for (var i = 0; i < P.length; i++) {
      var o = P[i]; if (o === p || o.state !== 'active') continue;
      var cx = o.x + o.w / 2; if (cx < mn) mn = cx; if (cx > mx) mx = cx; n++;
    }
    if (!n) return dx;
    var pc = p.x + p.w / 2;
    if (dx > 0) { var a = mn + C.LEASH_X - pc; if (a < 0) a = 0; return dx < a ? dx : a; }
    if (dx < 0) { var b2 = mx - C.LEASH_X - pc; if (b2 > 0) b2 = 0; return dx > b2 ? dx : b2; }
    return dx;
  }

  function movePX(w, p, dx) {
    if (!dx) return 0;
    var a = sweepX(w, p, dx);
    a = leashLimit(w, p, a);
    p.x += a;
    return a;
  }

  // ------------------------------------------------------------------ step: inputs & interaction
  function readInputs(w, inputs) {
    var P = w.players;
    for (var i = 0; i < P.length; i++) {
      var p = P[i], inp = (inputs && inputs[p.slot]) || NOIN, st = w._in[p.slot];
      var j = !!inp.jump, u = !!inp.up, d = !!inp.down;
      var jc = typeof inp.jc === 'number' ? inp.jc : null, uc = typeof inp.uc === 'number' ? inp.uc : null;
      p._jp = (j && !st.j) || (jc !== null && st.jc !== null && jc > st.jc);
      p._up = (u && !st.u) || (uc !== null && st.uc !== null && uc > st.uc);
      p._dp = d && !st.d;
      st.j = j; st.u = u; st.d = d;
      if (jc !== null) st.jc = jc;
      if (uc !== null) st.uc = uc;
      p._L = !!inp.left; p._R = !!inp.right; p._D = d; p._J = j || u;
    }
  }

  function tryUnlock(w, p) {
    var k = w.key;
    if (!k || k.used || w.door.open || !p.hasKey || !ovXY(p, w.door)) return;
    w.door.open = true; k.used = true; k.holder = -1; p.hasKey = false;
    k.x = w.door.x + 16; k.y = w.door.y + 24;
    emit(w, 'unlock', w.door.x + 16, w.door.y + 32, p.slot);
  }

  function bodyFree(w, x, y, ww, hh, slot) {
    var c0 = Math.floor(x / T), c1 = Math.floor((x + ww - EPS) / T), r0 = Math.floor(y / T), r1 = Math.floor((y + hh - EPS) / T);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (solidAt(w, c, r, slot)) return false;
    var box = { x: x, y: y, w: ww, h: hh }, i, o;
    for (i = 0; i < w.players.length; i++) { o = w.players[i]; if (o.state === 'active' && ovXY(o, box)) return false; }
    for (i = 0; i < w._crates.length; i++) { o = w._crates[i]; if (!o.gone && ovXY(o, box)) return false; }
    for (i = 0; i < w._gates.length; i++) { o = w._gates[i]; if (!o.open && ovXY(o, box)) return false; }
    return true;
  }

  function interact(w) {
    var P = w.players, i, j, p;
    for (i = 0; i < P.length; i++) {
      p = P[i];
      if (p.state === 'entered') {
        if (p._dp) {
          var d = w.door, offs = [0, -26, 26, -52, 52];
          for (j = 0; j < offs.length; j++) {
            var nx = d.x + 4 + offs[j], ny = d.y + d.h - C.PH;
            if (bodyFree(w, nx, ny, C.PW, C.PH, p.slot)) {
              p.state = 'active'; p.x = nx; p.y = ny; p.vx = 0; p.vy = 0; p.onGround = false; p.sup = null; p.rest = [];
              p.coyote = 0; p.jbuf = 0; p.jumping = false;
              emit(w, 'exit', nx + 12, ny + 15, p.slot); break;
            }
          }
        }
        continue;
      }
      if (!p._up) continue;
      tryUnlock(w, p);
      if (w.door.open && ovXY(p, w.door)) {
        p.state = 'entered'; p.vx = 0; p.vy = 0; p.onGround = false; p.sup = null; p.rest = []; p._jp = false;
        emit(w, 'enter', w.door.x + 16, w.door.y + 32, p.slot);
        continue;
      }
      var lv = null;
      for (j = 0; j < w._levers.length; j++) if (ovXY(p, w._levers[j])) { lv = w._levers[j]; break; }
      if (lv) { lv.on = !lv.on; emit(w, 'lever', lv.x + 16, lv.y + 16, p.slot); continue; }
      p._jp = true;
    }
  }

  // ------------------------------------------------------------------ gates, platforms, saws
  function occupied(w, box) {
    var i, o;
    for (i = 0; i < w.players.length; i++) { o = w.players[i]; if (o.state === 'active' && ovXY(o, box)) return true; }
    for (i = 0; i < w._crates.length; i++) { o = w._crates[i]; if (!o.gone && ovXY(o, box)) return true; }
    return false;
  }

  function updateGates(w) {
    for (var i = 0; i < w._gates.length; i++) {
      var g = w._gates[i], want = gateWant(w, g);
      if (want && !g.open) { g.open = true; emit(w, 'gate', g.x + g.w / 2, g.y + g.h / 2, -1); }
      else if (!want && g.open && !occupied(w, g)) { g.open = false; emit(w, 'gate', g.x + g.w / 2, g.y + g.h / 2, -1); }
      var tgt = g.open ? 1 : 0;
      if (g.openAmt < tgt) g.openAmt = Math.min(tgt, g.openAmt + C.GATE_ANIM);
      else if (g.openAmt > tgt) g.openAmt = Math.max(tgt, g.openAmt - C.GATE_ANIM);
    }
  }

  function countRiders(w, b, seen) {
    var rs = ridersOf(w, b), n = 0;
    for (var i = 0; i < rs.length; i++) {
      if (seen.indexOf(rs[i]) >= 0) continue;
      seen.push(rs[i]); n += 1 + countRiders(w, rs[i], seen);
    }
    return n;
  }

  function advance(e, len) {
    // continuous movement along path: returns new s, updates e.dir
    var s = e.s;
    if (len <= 0) return 0;
    if (e.mode === 'loop' && e.path.loop) { s += e.speed; while (s >= len) s -= len; return s; }
    s += e.dir * e.speed;
    if (s >= len) { s = len; e.dir = -1; } else if (s <= 0) { s = 0; e.dir = 1; }
    return s;
  }

  function updatePlatforms(w) {
    for (var i = 0; i < w._plats.length; i++) {
      var e = w._plats[i], len = e.path.len, ns;
      e.riders = countRiders(w, e, []);
      if (e.need > 0) ns = e.riders >= Math.min(e.need, w.nbots) ? Math.min(len, e.s + e.speed) : Math.max(0, e.s - e.speed);
      else if (e.channel) ns = (reading(w, e.channel, e.logic) !== e.def.invert) ? Math.min(len, e.s + e.speed) : Math.max(0, e.s - e.speed);
      else { var od = e.dir; ns = advance(e, len); e._ndir = e.dir; e.dir = od; }
      pathAt(e.path, ns, tmp2);
      var dx = tmp2[0] - e.x, dy = tmp2[1] - e.y, ok = true;
      if (dy < -TINY) {
        var rs = ridersOf(w, e);
        for (var j = 0; j < rs.length && ok; j++) if (maxUp(w, rs[j], dy) > dy + EPS) ok = false;
      }
      if (ok) {
        var carried = (dx || dy) ? ridersOf(w, e) : null;
        e.x = tmp2[0]; e.y = tmp2[1]; e.s = ns; e._dx = dx; e._dy = dy;
        if (!e.need && !e.channel) e.dir = e._ndir;
        if (carried) for (var k = 0; k < carried.length; k++) {
          var rb = carried[k];
          if (rb.dropT > 0 || (rb.isP && rb.vy < 0)) continue;
          carryStack(w, rb, dx, dy, 0);
        }
      } else { e._dx = 0; e._dy = 0; }
    }
  }

  // move a body and everything stacked on it (platform carry); riders follow by the body's actual motion
  function carryStack(w, b, dx, dy, depth) {
    var rs = ridersOf(w, b), ax = 0, ay = 0, i;
    if (dx) { ax = sweepX(w, b, dx); if (b.isP) ax = leashLimit(w, b, ax); b.x += ax; }
    if (dy < 0) { ay = maxUp(w, b, dy); b.y += ay; }
    else if (dy > 0) { ay = sweepDown(w, b, dy); if (ay > dy) ay = dy; if (ay < 0) ay = 0; b.y += ay; }
    if ((ax || ay) && depth < 12) for (i = 0; i < rs.length; i++) if (!(rs[i].isP && rs[i].vy < 0)) carryStack(w, rs[i], ax, ay, depth + 1);
  }

  function updateSaws(w) {
    for (var i = 0; i < w._saws.length; i++) {
      var e = w._saws[i];
      if (w.time > 0) { e.s = advance(e, e.path.len); e.angle = (e.angle + 0.2) % 6.283185307179586; }
      pathAt(e.path, e.s, tmp2);
      e.cx = tmp2[0] + 16; e.cy = tmp2[1] + 16; e.x = e.cx - e.r; e.y = e.cy - e.r;
    }
  }

  // ------------------------------------------------------------------ crates
  function holding(p, dir) { return dir > 0 ? (p._R && !p._L) : (p._L && !p._R); }
  function touching(a, b, dir) { return dir > 0 ? Math.abs(a.x + a.w - b.x) <= 0.5 : Math.abs(b.x + b.w - a.x) <= 0.5; }
  var PUSH = [];
  function countPushers(w, e, dir) {
    var P = w.players, i, p, n = 0, changed = true;
    PUSH.length = 0;
    for (i = 0; i < P.length; i++) {
      p = P[i];
      if (p.state === 'active' && p.onGround && holding(p, dir) && ovY(p, e) && touching(p, e, dir)) PUSH.push(p);
    }
    while (changed && PUSH.length) {
      changed = false;
      for (i = 0; i < P.length; i++) {
        p = P[i];
        if (PUSH.indexOf(p) >= 0 || p.state !== 'active' || !p.onGround || !holding(p, dir)) continue;
        for (var j = 0; j < PUSH.length; j++) if (ovY(p, PUSH[j]) && touching(p, PUSH[j], dir)) { PUSH.push(p); changed = true; break; }
      }
    }
    n = PUSH.length;
    return n;
  }
  function byBottomDesc(a, b) { return (b.y + b.h) - (a.y + a.h) || a._ord - b._ord; }

  function updateCrates(w) {
    var list = [], i, e;
    for (i = 0; i < w._crates.length; i++) { e = w._crates[i]; e._ord = i; if (!e.gone) list.push(e); }
    list.sort(byBottomDesc);
    var pitY = w.level.rows * T + 64;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      var needEff = Math.min(e.need, w.nbots), R = countPushers(w, e, 1), Lc = countPushers(w, e, -1);
      e.pushers = R > Lc ? R : Lc;
      e.vx = 0;
      if (R >= needEff && Lc < needEff) e.vx = C.CRATE_SPEED;
      else if (Lc >= needEff && R < needEff) e.vx = -C.CRATE_SPEED;
      var carry = supportDx(e), want = e.vx + carry;
      if (e.onGround && e.sup && e.sup.isP) want = e.vx;
      var a = want ? sweepX(w, e, want) : 0;
      e.x += a; e._dx = a;
      if (e.vx && Math.abs(a - want) > EPS) e.vx = 0;
      // vertical
      var y0 = e.y, wasG = e.onGround;
      if (wasG) { if (e._lift !== w.tick) carryY(w, e, supportDy(e)); e.vy = 0; }
      var dy = e.vy + C.GRAVITY * 0.5; e.vy += C.GRAVITY;
      if (e.vy > C.MAX_FALL) e.vy = C.MAX_FALL; if (dy > C.MAX_FALL) dy = C.MAX_FALL;
      if (dy < 0) {
        var lim = liftY(w, e, dy); if (lim > dy + EPS) e.vy = 0; e.onGround = false; e.sup = null; e.rest = [];
      } else {
        var d = sweepDown(w, e, dy);
        if (H_hit && d <= dy + EPS) { e.y += d; land(w, e); e.onGround = true; e.vy = 0; if (springUnder(w)) { e.vy = C.SPRING_V; e.onGround = false; e.sup = null; e.rest = []; emit(w, 'spring', e.x + e.w / 2, e.y + e.h, -1); } }
        else { e.y += dy; e.onGround = false; e.sup = null; e.rest = []; }
      }
      e._dy = e.y - y0;
      if (e.y > pitY) { e.gone = true; e.vx = e.vy = 0; }
    }
  }

  // ------------------------------------------------------------------ players
  function approach(v, t, a) { return v < t ? Math.min(t, v + a) : Math.max(t, v - a); }
  var PL = [];
  function playerOrder(a, b) {
    var ba = a.y + a.h, bb = b.y + b.h;
    if (Math.abs(ba - bb) > 1) return bb - ba;              // lower (supports) first
    var ka = -a._dir * a.x, kb = -b._dir * b.x;             // front-most in move direction first
    return ka - kb || a.slot - b.slot;
  }

  function moveStackY(w, b, dy, depth) {
    if (!dy) return 0;
    var rs = ridersOf(w, b), act;
    if (dy < 0) act = maxUp(w, b, dy);
    else { act = sweepDown(w, b, dy); if (act > dy) act = dy; if (act < 0) act = 0; }
    b.y += act;
    if (act && (depth | 0) < 12) for (var i = 0; i < rs.length; i++) moveStackY(w, rs[i], act, (depth | 0) + 1);
    return act;
  }

  function updatePlayers(w) {
    var P = w.players, i, p;
    PL.length = 0;
    for (i = 0; i < P.length; i++) {
      p = P[i];
      if (p.state !== 'active') continue;
      p._dir = (p._R ? 1 : 0) - (p._L ? 1 : 0);
      PL.push(p);
    }
    PL.sort(playerOrder);
    for (i = 0; i < PL.length; i++) updatePlayer(w, PL[i]);
  }

  function chainGrounded(b, depth) {
    if (!b.onGround) return false;
    if (b.restStatic) return true;
    for (var i = 0; i < b.rest.length; i++) {
      var o = b.rest[i];
      if (o.isPlat) return true;
      if (o.gone || (o.isP && o.state !== 'active') || !ovX(b, o)) continue;
      if (depth < 8 && chainGrounded(o, depth + 1)) return true;
    }
    return false;
  }

  function updatePlayer(w, p) {
    var wasG = p.onGround, dir = p._dir, vyBefore = p.vy;
    if (dir) p.facing = dir;
    if (p.dropT > 0) p.dropT--;
    // horizontal velocity (own only; carry is added separately)
    if (wasG) p.vx = dir ? approach(p.vx, dir * C.RUN, C.ACC_GROUND) : approach(p.vx, 0, C.DEC_GROUND);
    else p.vx = approach(p.vx, dir * C.RUN, C.ACC_AIR);
    // jump / drop-through
    // a bot may only jump from a support chain that ends on something grounded (no jumping off an airborne bot,
    // and no coyote time when the support itself leaves the ground) -> keeps "2 + bots below" climbing rule exact
    var solidG = wasG && chainGrounded(p, 0);
    if (solidG) p.air = 0; else if (wasG) p.air = 99; else if (p.air < 99) p.air++;
    if (p._jp) p.jbuf = C.JUMP_BUFFER;
    var jumped = false, dropped = false;
    if (p.jbuf > 0) {
      if (wasG && p._D && p.supOneWay) {
        p.dropT = C.DROP_TICKS; p.jbuf = 0; dropped = true;
      } else if (solidG || (p.air <= C.COYOTE && !p.jumping)) {
        p.vy = C.JUMP_V; p.jumping = true; p.air = 99; p.jbuf = 0; jumped = true;
        emit(w, 'jump', p.x + p.w / 2, p.y + p.h, p.slot);
      } else p.jbuf--;
    }
    if (p.jumping && !jumped && !p._J && p.vy < C.JUMP_CUT) p.vy = C.JUMP_CUT;
    // X: own velocity + support's real dx
    var carry = wasG ? supportDx(p) : 0, want = p.vx + carry, a = 0;
    if (want) {
      a = movePX(w, p, want);
      if (Math.abs(a - want) > EPS) {
        var own = a - carry;
        if (p.vx > 0) p.vx = Math.max(0, Math.min(p.vx, own));
        else if (p.vx < 0) p.vx = Math.min(0, Math.max(p.vx, own));
      }
    }
    p._dx = a;
    if (wasG && dir) p.walk += Math.abs(p.vx);
    // Y
    var lifted = p._lift === w.tick;
    var y0 = p.y, cdy = (wasG && !jumped && !lifted) ? supportDy(p) : 0;
    var ody = p.vy + C.GRAVITY * 0.5;
    p.vy += C.GRAVITY;
    if (p.vy > C.MAX_FALL) p.vy = C.MAX_FALL;
    if (ody > C.MAX_FALL) ody = C.MAX_FALL;
    if (jumped) {
      var sdy = (wasG && !lifted) ? supportDy(p) : 0;
      if (sdy > 0) { carryY(w, p, sdy); sdy = 0; }   // support just moved down (landed): follow it first
      var jd = Math.min(ody, sdy);
      var lim = liftY(w, p, jd);
      if (lim > jd + EPS) p.vy = 0;
      p.onGround = false; p.sup = null; p.rest = [];
    } else {
      if (cdy < 0) liftY(w, p, cdy); else if (cdy > 0) carryY(w, p, cdy);
      if (ody < 0) {
        var l2 = liftY(w, p, ody);
        if (l2 > ody + EPS) { p.vy = 0; }
        p.onGround = false; p.sup = null; p.rest = [];
      } else {
        var d = sweepDown(w, p, ody);
        if (H_hit && d <= ody + EPS) {
          p.y += d; land(w, p); p.onGround = true; p.vy = 0; p.jumping = false;
        } else {
          p.y += ody; p.onGround = false; p.sup = null; p.rest = [];
        }
      }
    }
    if (p.vy >= 0 && !p.onGround) p.jumping = p.jumping && p.vy < 0;
    p._dy = p.y - y0;
    p.landed = !wasG && p.onGround;
    if (p.landed && vyBefore >= 1) emit(w, 'land', p.x + p.w / 2, p.y + p.h, p.slot);
  }

  // ------------------------------------------------------------------ tether
  function pullBody(w, b, mx, my) {
    if (mx) b.x += sweepX(w, b, mx);
    if (my) moveStackY(w, b, my);
  }
  // dangler m hangs from anchor an: keep m's x where possible (it hangs straight down a wall), fix y; else pull x in
  function pullToward(w, m, an, L) {
    var ax = an.x + an.w / 2, ay = an.y + an.h / 2, mx = m.x + m.w / 2, my = m.y + m.h / 2;
    var dx = mx - ax, dy = my - ay, d = Math.sqrt(dx * dx + dy * dy);
    if (d <= L) return;
    if (Math.abs(dx) >= L - 1) {
      var tx = ax + (dx >= 0 ? 1 : -1) * (L - 1);
      m.x += sweepX(w, m, tx - mx);
      if (m.vx * dx > 0) m.vx = 0;
      dx = m.x + m.w / 2 - ax;
    }
    if (Math.abs(dx) < L) {
      var ty = ay + (dy >= 0 ? 1 : -1) * Math.sqrt(L * L - dx * dx), ddy = ty - my;
      if ((dy > 0 && ddy < 0) || (dy < 0 && ddy > 0)) {
        moveStackY(w, m, ddy);
        if (dy > 0 && m.vy > 0) m.vy = 0;
        if (dy < 0 && m.vy < 0) m.vy = 0;
      }
    }
  }
  function ropeDist(a, b) {
    var dx = (b.x + b.w / 2) - (a.x + a.w / 2), dy = (b.y + b.h / 2) - (a.y + a.h / 2);
    return Math.sqrt(dx * dx + dy * dy);
  }
  function dampOutward(m, an) {
    var nx = (an.x + an.w / 2) - (m.x + m.w / 2), ny = (an.y + an.h / 2) - (m.y + m.h / 2), n = Math.sqrt(nx * nx + ny * ny);
    if (n < TINY) return;
    nx /= n; ny /= n;
    var v = m.vx * nx + m.vy * ny;
    if (v < 0) { m.vx -= v * nx; m.vy -= v * ny; }
  }
  function updateTether(w) {
    if (!w.ropes.length) return;
    var L = w.level.tetherLength * T;
    for (var it = 0; it < 2; it++) for (var i = 0; i < w.ropes.length; i++) {
      var a = w._bySlot[w.ropes[i][0]], b = w._bySlot[w.ropes[i][1]];
      if (!a || !b || a.state !== 'active' || b.state !== 'active') continue;
      var d = ropeDist(a, b);
      if (d <= L + EPS) continue;
      if (a.onGround === b.onGround) {
        var ex = (d - L) / 2, nx = ((b.x + b.w / 2) - (a.x + a.w / 2)) / d, ny = ((b.y + b.h / 2) - (a.y + a.h / 2)) / d;
        pullBody(w, a, nx * ex, ny * ex);
        pullBody(w, b, -nx * ex, -ny * ex);
        if (!a.onGround) { dampOutward(a, b); dampOutward(b, a); }
      } else {
        var m = a.onGround ? b : a, an = a.onGround ? a : b;
        pullToward(w, m, an, L);
        if (ropeDist(a, b) > L + 2) pullToward(w, an, m, L);
      }
    }
  }

  // ------------------------------------------------------------------ tiles: springs, crumble
  function springs(w) {
    var L = w.level, P = w.players;
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      if (p.state !== 'active' || p.vy < 0) continue;
      var f = p.y + p.h, r = Math.floor((f - EPS) / T);
      if (r < 0 || r >= L.rows || f < r * T + 20 - EPS) continue;
      var c0 = Math.floor((p.x + 2) / T), c1 = Math.floor((p.x + p.w - 2) / T);
      for (var c = c0; c <= c1; c++) {
        if (catAt(w, c, r) !== K_SPRING) continue;
        if (maxUp(w, p, -1) > -0.5) break;               // pinned under something: no launch
        p.vy = C.SPRING_V; p.onGround = false; p.jumping = false; p.air = 99; p.jbuf = 0; p.sup = null; p.rest = [];
        emit(w, 'spring', c * T + 16, r * T + 20, p.slot);
        break;
      }
    }
  }
  function updateCrumble(w) {
    var L = w.level;
    for (var key in w.crumble) {
      var cr = w.crumble[key], cm = key.indexOf(','), c = +key.slice(0, cm), r = +key.slice(cm + 1), idx = r * L.cols + c;
      cr.t--;
      if (!cr.gone) {
        if (cr.t <= 0) { cr.gone = true; cr.t = C.CRUMBLE_RESPAWN; w._gone[idx] = 1; emit(w, 'crumble', c * T + 16, r * T + 16, -1); }
      } else if (cr.t <= 0) {
        cr.t = 0;
        if (!occupied(w, { x: c * T, y: r * T, w: T, h: T })) { delete w.crumble[key]; w._gone[idx] = 0; }
      }
    }
  }

  // ------------------------------------------------------------------ pickups, lasers, hazards, buttons
  function pickups(w) {
    var P = w.players, k = w.key, i, j, p;
    for (i = 0; i < P.length; i++) {
      p = P[i]; if (p.state !== 'active') continue;
      if (k && !k.used && k.holder < 0 && p.x < k.x + 10 && p.x + p.w > k.x - 10 && p.y < k.y + 10 && p.y + p.h > k.y - 10) {
        k.holder = p.slot; p.hasKey = true; emit(w, 'key', k.x, k.y, p.slot);
      }
      if (p.hasKey) tryUnlock(w, p);
      for (j = 0; j < w.gears.length; j++) {
        var g = w.gears[j];
        if (!g.taken && p.x < g.x + 10 && p.x + p.w > g.x - 10 && p.y < g.y + 10 && p.y + p.h > g.y - 10) {
          g.taken = true; w.gearsTaken++; emit(w, 'gear', g.x, g.y, p.slot);
        }
      }
    }
    if (k && !k.used && k.holder >= 0) {
      var h = w._bySlot[k.holder];
      if (h) { k.x = h.x + h.w / 2 - h.facing * 14; k.y = h.y + 6; }
    }
  }

  function updateLaserStates(w) {
    for (var i = 0; i < w._lasers.length; i++) {
      var e = w._lasers[i], d = e.def;
      if (e.channel) e.beamOn = !reading(w, e.channel, e.logic) !== e.invert;
      else if (d.cyc) {
        var per = d.cyc[0] + d.cyc[1];
        e.beamOn = per <= 0 ? d.cyc[0] > 0 : ((((w.time + d.cyc[2]) % per) + per) % per) < d.cyc[0];
      } else e.beamOn = true;
    }
  }

  function computeBeams(w) {
    var L = w.level, hw = C.BEAM_W / 2;
    for (var i = 0; i < w._lasers.length; i++) {
      var e = w._lasers[i], tx = e.def.x, ty = e.def.y, c, r, j, o, x1, y1, x2, y2;
      if (e.dir === 'r' || e.dir === 'l') {
        y1 = y2 = ty * T + 16;
        if (e.dir === 'r') {
          x1 = tx * T + T; for (c = tx + 1; c < L.cols && !solidAt(w, c, ty, -1); c++); x2 = c * T;
        } else {
          x1 = tx * T; for (c = tx - 1; c >= 0 && !solidAt(w, c, ty, -1); c--); x2 = (c + 1) * T;
        }
      } else {
        x1 = x2 = tx * T + 16;
        if (e.dir === 'd') {
          y1 = ty * T + T; for (r = ty + 1; r < L.rows && !solidAt(w, tx, r, -1); r++); y2 = r * T;
        } else {
          y1 = ty * T; for (r = ty - 1; r >= 0 && !solidAt(w, tx, r, -1); r--); y2 = (r + 1) * T;
        }
      }
      var blockers = w._crates.concat(w._gates);
      for (j = 0; j < blockers.length; j++) {
        o = blockers[j];
        if (o.gone || o.open) continue;
        if (e.dir === 'r') { if (o.y < y1 + hw && o.y + o.h > y1 - hw && o.x + o.w > x1 && o.x < x2) x2 = Math.max(x1, o.x); }
        else if (e.dir === 'l') { if (o.y < y1 + hw && o.y + o.h > y1 - hw && o.x < x1 && o.x + o.w > x2) x2 = Math.min(x1, o.x + o.w); }
        else if (e.dir === 'd') { if (o.x < x1 + hw && o.x + o.w > x1 - hw && o.y + o.h > y1 && o.y < y2) y2 = Math.max(y1, o.y); }
        else { if (o.x < x1 + hw && o.x + o.w > x1 - hw && o.y < y1 && o.y + o.h > y2) y2 = Math.min(y1, o.y + o.h); }
      }
      e.x1 = x1; e.y1 = y1; e.x2 = x2; e.y2 = y2; e.len = Math.abs(x2 - x1) + Math.abs(y2 - y1);
    }
  }

  function die(w, p) {
    if (w.phase !== 'play') return;
    w.phase = 'dead'; w.phaseTimer = C.DEAD_TICKS; w.deadSlot = p.slot; w.deaths++;
    p.vx = 0; p.vy = 0;
    emit(w, 'die', p.x + p.w / 2, p.y + p.h / 2, p.slot);
  }

  function hazards(w) {
    var L = w.level, P = w.players, pit = L.rows * T + 64, hw = C.BEAM_W / 2;
    for (var i = 0; i < P.length && w.phase === 'play'; i++) {
      var p = P[i]; if (p.state !== 'active') continue;
      if (p.y > pit) { die(w, p); break; }
      var c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w - EPS) / T), r0 = Math.floor(p.y / T), r1 = Math.floor((p.y + p.h - EPS) / T), c, r, j, hit = false;
      for (r = r0; r <= r1 && !hit; r++) for (c = c0; c <= c1 && !hit; c++) {
        if (catAt(w, c, r) === K_SPIKE && p.x < c * T + 28 - EPS && p.x + p.w > c * T + 4 + EPS && p.y < r * T + 32 - EPS && p.y + p.h > r * T + 16 + EPS) hit = true;
      }
      for (j = 0; j < w._saws.length && !hit; j++) {
        var s = w._saws[j], qx = Math.max(p.x, Math.min(s.cx, p.x + p.w)), qy = Math.max(p.y, Math.min(s.cy, p.y + p.h));
        var ddx = s.cx - qx, ddy = s.cy - qy, rr = s.r - 2;
        if (ddx * ddx + ddy * ddy < rr * rr) hit = true;
      }
      for (j = 0; j < w._lasers.length && !hit; j++) {
        var e = w._lasers[j]; if (!e.beamOn || e.len <= 0) continue;
        var bx0 = Math.min(e.x1, e.x2) - (e.x1 === e.x2 ? hw : 0), bx1 = Math.max(e.x1, e.x2) + (e.x1 === e.x2 ? hw : 0);
        var by0 = Math.min(e.y1, e.y2) - (e.y1 === e.y2 ? hw : 0), by1 = Math.max(e.y1, e.y2) + (e.y1 === e.y2 ? hw : 0);
        if (p.x < bx1 - EPS && p.x + p.w > bx0 + EPS && p.y < by1 - EPS && p.y + p.h > by0 + EPS) hit = true;
      }
      if (hit) die(w, p);
    }
  }

  function updateButtons(w) {
    for (var i = 0; i < w._buttons.length; i++) {
      var e = w._buttons[i], bottom = e.y + e.h, load = 0, j, o;
      for (j = 0; j < w.players.length; j++) {
        o = w.players[j];
        if (o.state === 'active' && Math.abs(o.y + o.h - bottom) <= C.BUTTON_TOL && o.x < e.x + e.w && o.x + o.w > e.x) load += 1;
      }
      for (j = 0; j < w._crates.length; j++) {
        o = w._crates[j];
        if (!o.gone && Math.abs(o.y + o.h - bottom) <= C.BUTTON_TOL && o.x < e.x + e.w && o.x + o.w > e.x) load += o.weight;
      }
      var was = e.pressed;
      e.load = load; e.pressed = load >= Math.min(e.need, w.nbots);
      if (e.pressed && !was) emit(w, 'press', e.x + e.w / 2, bottom, -1);
      else if (!e.pressed && was) emit(w, 'release', e.x + e.w / 2, bottom, -1);
      if (e.mode === 'hold') e.on = e.pressed;
      else if (e.mode === 'latch') { if (e.pressed) e.on = true; }
      else {
        if (e.pressed) { e.on = true; e.timer = e.time; }
        else if (e.timer > 0) { e.timer--; e.on = e.timer > 0; }
        else e.on = false;
      }
    }
  }

  // ------------------------------------------------------------------ step
  function step(w, inputs) {
    w.events = [];
    w.tick++;
    readInputs(w, inputs);
    var P = w.players, i;
    if (w.phase === 'dead') {
      if (--w.phaseTimer <= 0) { buildState(w); w.attempt++; }
      return w;
    }
    if (w.phase === 'clear') { if (w.phaseTimer > 0) w.phaseTimer--; return w; }
    w.time++;
    for (i = 0; i < P.length; i++) P[i].landed = false;
    interact(w);
    computeChannels(w);
    updateGates(w);
    updatePlatforms(w);
    updateSaws(w);
    updateCrates(w);
    updatePlayers(w);
    updateTether(w);
    springs(w);
    updateCrumble(w);
    pickups(w);
    updateLaserStates(w);
    computeBeams(w);
    hazards(w);
    updateButtons(w);
    computeChannels(w);           // so the renderer sees channels matching this tick's sources
    if (w.phase === 'play') {
      var all = P.length > 0;
      for (i = 0; i < P.length; i++) if (P[i].state !== 'entered') { all = false; break; }
      if (all) { w.phase = 'clear'; w.phaseTimer = C.CLEAR_TICKS; emit(w, 'clear', w.door.x + 16, w.door.y + 32, -1); }
    }
    return w;
  }

  // ------------------------------------------------------------------ snapshots
  function pflags(p) {
    return (p.onGround ? 1 : 0) | (p.state === 'entered' ? 2 : 0) | (p.hasKey ? 4 : 0) | (p.landed ? 8 : 0) | (p.facing < 0 ? 16 : 0) | (p.jumping ? 32 : 0);
  }
  function snapshot(w) {
    var s = { k: w.tick, t: w.time, f: PHASES.indexOf(w.phase), pt: w.phaseTimer, ds: w.deadSlot, n: w.attempt, dd: w.deaths, p: [], e: [] }, i, e;
    for (i = 0; i < w.players.length; i++) {
      var p = w.players[i];
      s.p.push([p.slot, rnd1(p.x), rnd1(p.y), rnd2(p.vx), rnd2(p.vy), pflags(p), rnd1(p.walk % 4096)]);
    }
    if (w.key) s.y = [rnd1(w.key.x), rnd1(w.key.y), w.key.holder, w.key.used ? 1 : 0];
    s.o = w.door.open ? 1 : 0;
    for (i = 0; i < w.entities.length; i++) {
      e = w.entities[i];
      switch (e.type) {
        case 'crate': s.e.push(e.gone ? [0] : [rnd1(e.x), rnd1(e.y), rnd2(e.vx), rnd2(e.vy), e.pushers]); break;
        case 'button': s.e.push([(e.pressed ? 1 : 0) | (e.on ? 2 : 0), e.load, e.timer]); break;
        case 'lever': s.e.push(e.on ? 1 : 0); break;
        case 'gate': s.e.push([e.open ? 1 : 0, rnd2(e.openAmt)]); break;
        case 'platform': s.e.push([rnd1(e.x), rnd1(e.y), e.riders, rnd2(e.s), e.dir]); break;
        case 'saw': s.e.push([rnd2(e.s), e.dir, rnd2(e.angle)]); break;
        case 'laser': s.e.push(e.beamOn ? 1 : 0); break;
        default: s.e.push(0);
      }
    }
    var cr = [];
    for (var key in w.crumble) { var c = w.crumble[key], cm = key.indexOf(','); cr.push([+key.slice(0, cm), +key.slice(cm + 1), c.t, c.gone ? 1 : 0]); }
    if (cr.length) s.c = cr;
    if (w.gears.length) { var g = ''; for (i = 0; i < w.gears.length; i++) g += w.gears[i].taken ? '1' : '0'; s.g = g; }
    if (w._evAcc.length) {
      s.v = w._evAcc.map(function (ev) { return [EVENTS.indexOf(ev.t), ev.x, ev.y, ev.slot]; });
      w._evAcc = [];
    }
    return s;
  }

  function applySnapshot(w, s) {
    if (!s || typeof s !== 'object') return w;
    var i, e, a;
    w.tick = s.k | 0; w.time = s.t | 0; w.phase = PHASES[s.f] || 'play'; w.phaseTimer = s.pt | 0;
    w.deadSlot = s.ds == null ? -1 : s.ds; if (s.n != null) w.attempt = s.n; if (s.dd != null) w.deaths = s.dd;
    var ps = s.p || [], np = [], slots = [];
    for (i = 0; i < ps.length; i++) {
      a = ps[i];
      var p = w._bySlot[a[0]] || makePlayer(w, a[0]);
      hide(p, BODY_HIDDEN);
      p.x = a[1]; p.y = a[2]; p.vx = a[3]; p.vy = a[4];
      p.onGround = !!(a[5] & 1); p.state = (a[5] & 2) ? 'entered' : 'active'; p.hasKey = !!(a[5] & 4);
      p.landed = !!(a[5] & 8); p.facing = (a[5] & 16) ? -1 : 1; p.jumping = !!(a[5] & 32); p.walk = a[6] || 0;
      p.sup = null; p.rest = [];
      np.push(p); slots.push(p.slot);
    }
    if (np.length) {
      w.players = np; w.slots = slots; w.nbots = slots.length;
      w._bySlot = [null, null, null, null]; w._present = [false, false, false, false];
      for (i = 0; i < np.length; i++) { w._bySlot[np[i].slot] = np[i]; w._present[np[i].slot] = true; }
    }
    if (w.key && s.y) { w.key.x = s.y[0]; w.key.y = s.y[1]; w.key.holder = s.y[2]; w.key.used = !!s.y[3]; }
    w.door.open = !!s.o;
    var es = s.e || [];
    for (i = 0; i < w.entities.length && i < es.length; i++) {
      e = w.entities[i]; a = es[i];
      switch (e.type) {
        case 'crate':
          if (a.length < 2) { e.gone = true; e.vx = e.vy = 0; e.pushers = 0; }
          else { e.gone = false; e.x = a[0]; e.y = a[1]; e.vx = a[2]; e.vy = a[3]; e.pushers = a[4]; }
          break;
        case 'button': e.pressed = !!(a[0] & 1); e.on = !!(a[0] & 2); e.load = a[1]; e.timer = a[2]; break;
        case 'lever': e.on = !!a; break;
        case 'gate': e.open = !!a[0]; e.openAmt = a[1]; break;
        case 'platform': e.x = a[0]; e.y = a[1]; e.riders = a[2]; e.s = a[3]; e.dir = a[4]; break;
        case 'saw': e.s = a[0]; e.dir = a[1]; e.angle = a[2]; break;
        case 'laser': e.beamOn = !!a; break;
      }
    }
    for (i = 0; i < w._saws.length; i++) {
      e = w._saws[i]; pathAt(e.path, e.s, tmp2); e.cx = tmp2[0] + 16; e.cy = tmp2[1] + 16; e.x = e.cx - e.r; e.y = e.cy - e.r;
    }
    w.crumble = {}; w._gone = new Uint8Array(w.level.rows * w.level.cols);
    if (s.c) for (i = 0; i < s.c.length; i++) {
      a = s.c[i]; w.crumble[a[0] + ',' + a[1]] = { t: a[2], gone: !!a[3] };
      if (a[3]) w._gone[a[1] * w.level.cols + a[0]] = 1;
    }
    w.gearsTaken = 0;
    for (i = 0; i < w.gears.length; i++) { w.gears[i].taken = !!(s.g && s.g[i] === '1'); if (w.gears[i].taken) w.gearsTaken++; }
    computeChannels(w);
    computeBeams(w);
    w.events = (s.v || []).map(function (v) { return { t: EVENTS[v[0]] || '?', x: v[1], y: v[2], slot: v[3] }; });
    w._evAcc = [];
    return w;
  }

  return {
    C: C, parseLevel: parseLevel, createWorld: createWorld, reset: reset, step: step,
    snapshot: snapshot, applySnapshot: applySnapshot, tileAt: tileAt, isSolidFor: isSolidFor,
    EVENTS: EVENTS, version: 1
  };
});
