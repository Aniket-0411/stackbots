/* STACKBOTS main — screens, fixed 60 Hz host simulation, local play, online session (host-authoritative). */
(function () {
  'use strict';
  var SB = globalThis.SB = globalThis.SB || {};
  var E = SB.Engine, UI = SB.UI, R = SB.Render, A = SB.Audio, I = SB.Input, N = SB.Net;
  var $ = UI.$;
  var DT = 1 / 60, CLEAR_TICKS = (E && E.C && E.C.CLEAR_TICKS) || 120;
  var SLOT_NAME = ['Coral', 'Teal', 'Marigold', 'Lilac'];
  var NAMES = ['Sprocket', 'Widget', 'Bolt', 'Pixel', 'Gizmo', 'Rivet', 'Dynamo', 'Noodle', 'Ziggy', 'Tinker', 'Pebble', 'Beep'];

  // ---------- storage (always try/catch) ----------
  function sget(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function sset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function jget(k, d) { try { var v = JSON.parse(sget(k, 'null')); return v == null ? d : v; } catch (e) { return d; } }
  var settings = Object.assign({ shake: true, touch: 'auto', net: 'auto' }, jget('sb.settings', {}));
  function saveSettings() { sset('sb.settings', JSON.stringify(settings)); }
  var progress = jget('sb.progress.v1', {});
  function saveProgress() { sset('sb.progress.v1', JSON.stringify(progress)); }

  // ---------- levels ----------
  var LV = [], WORLDS = [];
  var extra = []; try { if (Array.isArray(window.__SB_EXTRA_LEVELS)) extra = window.__SB_EXTRA_LEVELS; } catch (e) {} // test hook
  (SB.LEVEL_DATA || []).concat(extra).forEach(function (w, wi) {
    var W = { num: w.world, name: w.name, theme: w.theme, levels: [] };
    (w.levels || []).forEach(function (l, li) {
      var info = { index: LV.length, raw: l, world: w.world, worldName: w.name, theme: w.theme, tab: wi, id: l.id || (w.world + '-' + (li + 1)), name: l.name || 'Level', parsed: null,
        gearsTotal: (l.map || []).join('').split('o').length - 1, minPlayers: l.minPlayers || 1 };
      LV.push(info); W.levels.push(info);
    });
    WORLDS.push(W);
  });
  function parsed(i) {
    var L = LV[i];
    if (!L.parsed) L.parsed = E.parseLevel(L.raw, { world: L.world, theme: L.theme, worldName: L.worldName, index: L.index });
    return L.parsed;
  }

  // ---------- game state ----------
  var G = {
    mode: 'none',            // 'local' | 'host' | 'guest'
    screen: 'title',         // title lobby select play clear done (+ settings help wait)
    net: null, code: null, mySlot: 0, name: '',
    roster: {},              // slot -> {slot,name,id,dev,pending}
    idToSlot: {}, guestIn: {}, lastRc: {},
    lv: -1, level: null, world: null, worldKey: '',
    acc: 0, runTicks: 0, clearTicks: 0, hintT: 0, tagT: 0, attemptNo: 0,
    paused: false, notice: null, clearInfo: null,
    q: 0, netTick: 0, netOk: true, netBadT: 0,
    rc: 0, lastInKey: '', lastInT: 0,
    virt: {}, ip: { prev: null, cur: null, interval: 1 / 30, host: true },
    frameEvents: [], selTab: 0, padN: 0, introT0: 0, hostMeta: null, leaving: false,
    ack: {},                 // host: slot -> [guest input ts, host tick when received]
    buf: [], clock: { off: null, lat: [], D: 0.06, target: 0.06, gap: 2 / 60, rt: null }, // guest snapshot buffer + render clock
    pred: { w: null, pt: 0, acc: 0, hist: {}, prev: null, cur: null, corr: { x: 0, y: 0 }, valid: false, on: false, blend: 0, hold: 0, b: null },
    introLv: -1, hudPadT: 60, hudPadB: 0, padT: 0, legendT: 0, rotateOff: false
  };
  G.name = (sget('sb.name', '') || NAMES[Math.floor(Math.random() * NAMES.length)]).slice(0, 14);

  function cleanName(s) { s = String(s || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').trim().slice(0, 14); return s || 'Bot'; }
  function rosterList() { return Object.keys(G.roster).map(Number).sort().map(function (s) { return G.roster[s]; }); }
  function worldSlots() { var s = rosterList().filter(function (p) { return !p.pending; }).map(function (p) { return p.slot; }); return s.length ? s : [0]; }
  function worldSlotList(w) { return (w && w.players || []).map(function (p) { return p.slot; }); }
  function uniqueName(n, exceptSlot) {
    function taken(x) { for (var s in G.roster) if (+s !== exceptSlot && G.roster[s].name.toLowerCase() === x.toLowerCase()) return true; return false; }
    if (!taken(n)) return n;
    for (var k = 2; k < 99; k++) { var c = n.slice(0, 11).trim() + ' ' + k; if (!taken(c)) return c; }
    return n;
  }
  function nameOf(slot) { var p = G.roster[slot]; return p ? p.name : SLOT_NAME[slot]; }
  function isAuthority() { return G.mode === 'local' || G.mode === 'host'; }

  // ---------- screens ----------
  var SCREEN_PANEL = { title: 'title', lobby: 'lobby', select: 'select', clear: 'clear', done: 'credits', settings: 'settings', help: 'help', wait: 'wait', play: null };
  function setScreen(s) {
    var prev = G.screen;
    G.screen = s;
    UI.show(SCREEN_PANEL[s]);
    $('app').setAttribute('data-scr', s);
    if (s !== 'play') setPause(false, true);
    $('hud').classList.toggle('hidden', !(s === 'play' || s === 'clear'));
    updateTouch();
    if (s === 'lobby') refreshLobby();
    if (s === 'select') refreshSelect();
    if (s === 'clear') refreshClear();
    if (s === 'done') refreshCredits();
    if (s === 'title') { $('in-name').value = G.name; refreshNetNote(); }
    if (s === 'title' || s === 'lobby' || s === 'select' || s === 'done') A.music('menu');
    I.setEnabled(true);
    if (G.mode === 'host' && prev !== s) hostBroadcast(true);
    if (s === 'title' || s === 'lobby' || s === 'select') { try { if (document.activeElement && document.activeElement.blur && s !== 'title') document.activeElement.blur(); } catch (e) {} }
  }
  function touchOn() {
    if (settings.touch === 'on') return true;
    if (settings.touch === 'off') return false;
    try { return window.matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && 'ontouchstart' in window); } catch (e) { return false; }
  }
  function updateTouch() { var on = G.screen === 'play' && touchOn() && !G.paused; $('touch').classList.toggle('hidden', !on); $('app').classList.toggle('touch-on', touchOn()); }
  function showWait(title, text) { $('wait-title').textContent = title; $('wait-text').innerHTML = '<span class="spinner"></span>' + UI.esc(text); setScreen('wait'); }

  // ---------- level lifecycle (authority) ----------
  function buildWorld(slots) {
    G.world = E.createWorld(G.level, { slots: slots });
    var info = LV[G.lv];
    R.setLevel(G.world, { raw: info.raw, theme: info.theme });
    G.virt = {}; G.ip = { prev: null, cur: null, interval: G.mode === 'guest' ? 1 / 30 : DT, host: G.mode !== 'guest' };
    G.tagT = 4; G.ack = {};
    G.buf = []; G.clock.rt = null; G.clock.off = null; G.clock.lat = [];
    var P = G.pred; P.hist = {}; P.prev = P.cur = null; P.corr = { x: 0, y: 0 }; P.valid = false; P.on = false; P.blend = 0; P.acc = 0; P.w = null;
    if (G.mode === 'guest') { try { P.w = E.createWorld(G.level, { slots: slots }); } catch (e) { P.w = null; } }
  }
  function maybeIntro() {
    if (G.introLv === G.lv || !G.world) return;
    G.introLv = G.lv; R.intro(G.world); G.introT0 = performance.now();
  }
  function startLevel(i) {
    var info = LV[i]; if (!info) return;
    try { G.level = parsed(i); } catch (e) { UI.toast('Level ' + info.id + ' could not load: ' + e.message, 'bad', 5000); return; }
    for (var s in G.roster) G.roster[s].pending = false;
    G.lv = i;
    try { buildWorld(worldSlots()); } catch (e) { UI.toast('Level ' + info.id + ' failed to start: ' + e.message, 'bad', 5000); G.world = null; return; }
    G.runTicks = 0; G.clearTicks = 0; G.hintT = info.raw.hint ? 8 : 0; G.clearInfo = null; G.notice = null; G.acc = 0; G.attemptNo++;
    G.selTab = info.tab;
    G.introLv = -1; maybeIntro();
    if (info.id === '1-1' && sget('sb.legend', '') !== '1') { G.legendT = 14; sset('sb.legend', '1'); }
    UI.resetHud();
    A.music(info.theme); A.play('start');
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
    setScreen('play');
  }
  function restart() {
    if (!G.world || !isAuthority()) return;
    G.notice = null;
    for (var s in G.roster) G.roster[s].pending = false;
    var want = worldSlots();
    if (want.join(',') !== worldSlotList(G.world).join(',')) buildWorld(want);
    else { E.reset(G.world); R.resetAttempt(); G.virt = {}; G.tagT = 2.5; }
    G.runTicks = 0; G.clearTicks = 0; G.attemptNo++;
    if (G.screen !== 'play') setScreen('play');
    A.play('restart');
    if (G.mode === 'host') hostBroadcast(true);
  }
  function onAutoReset() { // engine reset itself after the dead phase
    G.runTicks = 0; G.attemptNo++;
    var pend = rosterList().some(function (p) { return p.pending; });
    if (pend) restart(); else { R.resetAttempt(); G.tagT = 2; }
  }
  function onCleared() {
    var info = LV[G.lv], w = G.world;
    var t = G.runTicks, gears = w.gearsTaken || 0, gt = (w.gears || []).length;
    var rec = progress[info.id] || {}, nb = !rec.c || t < rec.t;
    var gb = Math.max(rec.g || 0, gears);
    progress[info.id] = { c: 1, t: rec.c ? Math.min(rec.t, t) : t, g: gb };
    saveProgress();
    G.clearInfo = { t: t, g: gears, gt: gt, best: progress[info.id].t, nb: nb && !!rec.c };
    setScreen('clear');
  }

  // ---------- inputs ----------
  var NONE = I.none();
  function virt(slot, dev, raw, blocked) {
    var v = G.virt[slot];
    if (!v || v.dev !== dev) v = G.virt[slot] = { dev: dev, jc: raw.jc, uc: raw.uc, vj: v ? v.vj : 0, vu: v ? v.vu : 0 };
    if (!blocked) { if (raw.jc > v.jc) v.vj += raw.jc - v.jc; if (raw.uc > v.uc) v.vu += raw.uc - v.uc; }
    v.jc = raw.jc; v.uc = raw.uc;
    if (blocked) return { left: false, right: false, up: false, down: false, jump: false, jc: v.vj, uc: v.vu };
    return { left: raw.left, right: raw.right, up: raw.up, down: raw.down, jump: raw.jump, jc: v.vj, uc: v.vu };
  }
  function blockedNow() { return G.paused || UI.dialogOpen() || G.screen !== 'play'; }
  function gatherInputs() {
    var inputs = {}, pl = G.world.players, blocked = blockedNow();
    for (var i = 0; i < pl.length; i++) {
      var s = pl[i].slot, r = G.roster[s];
      if (G.mode === 'local') {
        var dev = r ? r.dev : 'none';
        inputs[s] = virt(s, dev, dev === 'none' ? NONE : I.device(dev), blocked || dev === 'none');
      } else if (s === G.mySlot) inputs[s] = virt(s, 'me', I.online(), blocked);
      else inputs[s] = G.guestIn[s] || NONE;
    }
    return inputs;
  }

  // ---------- fixed-step simulation ----------
  function recordPrev() {
    var w = G.world, p = {}, e = [];
    for (var i = 0; i < w.players.length; i++) p[w.players[i].slot] = { x: w.players[i].x, y: w.players[i].y };
    for (var k = 0; k < w.entities.length; k++) e.push({ x: w.entities[k].x, y: w.entities[k].y });
    return { p: p, e: e, k: w.key ? { x: w.key.x, y: w.key.y } : null };
  }
  function simTick() {
    var w = G.world;
    G.ip.prev = recordPrev();
    var before = w.phase;
    E.step(w, gatherInputs());
    if (w.events && w.events.length) for (var i = 0; i < w.events.length; i++) G.frameEvents.push(w.events[i]);
    if (w.phase === 'play') G.runTicks++;
    if (before === 'dead' && w.phase === 'play') onAutoReset();
    if (w.phase === 'clear') { G.clearTicks++; if (G.clearTicks >= CLEAR_TICKS && G.screen === 'play') onCleared(); }
    else G.clearTicks = 0;
    if (G.notice && --G.notice.ticks <= 0) restart();
  }
  function hostTick() {
    if (G.world && (G.screen === 'play') && !(G.mode === 'local' && G.paused)) simTick();
    else if (G.world) G.ip.prev = null;
    if (G.mode === 'host') {
      if (G.net && G.net.poll) { try { G.net.poll(); } catch (e) {} }
      G.netTick++;
      var every = (G.screen === 'play' || G.screen === 'clear') ? 2 : 12;
      if (G.netTick % every === 0) hostBroadcast(false);
    }
  }
  function hostMeta() {
    var scr = G.screen;
    if (scr !== 'lobby' && scr !== 'select' && scr !== 'play' && scr !== 'clear' && scr !== 'done') scr = 'lobby';
    var m = { scr: scr, lv: G.lv, pl: rosterList().map(function (p) { return [p.slot, p.name, p.pending ? 0 : 1]; }), at: G.attemptNo, tm: G.runTicks };
    if (G.notice) m.msg = G.notice.text;
    var ak = []; for (var as in G.ack) if (G.roster[as]) ak.push([+as, G.ack[as][0], G.ack[as][1]]);
    if (ak.length && (scr === 'play' || scr === 'clear')) m.ak = ak;
    if (scr === 'clear' && G.clearInfo) m.cl = [G.clearInfo.t, G.clearInfo.g, G.clearInfo.gt, G.clearInfo.best, G.clearInfo.nb ? 1 : 0];
    return m;
  }
  function hostBroadcast(force) {
    if (G.mode !== 'host' || !G.net) return;
    var m = hostMeta(), s = null;
    if (G.world && (m.scr === 'play' || m.scr === 'clear')) { try { s = E.snapshot(G.world); } catch (e) { s = null; } }
    G.net.broadcast({ t: 'st', m: m, s: s, q: ++G.q });
  }

  // ---------- host networking ----------
  function onHostMsg(m) {
    if (G.mode !== 'host' || !m) return;
    var t = G.net, slot;
    if (m.t === 'hello') {
      if (G.idToSlot[m.id] != null) { t.toGuest(m.id, { t: 'welcome', slot: G.idToSlot[m.id] }); return; }
      slot = -1; for (var s = 1; s < 4; s++) if (!G.roster[s]) { slot = s; break; }
      if (slot < 0) { t.toGuest(m.id, { t: 'full' }); return; }
      var pending = !!(G.world && (G.screen === 'play' || G.screen === 'clear'));
      G.roster[slot] = { slot: slot, name: uniqueName(cleanName(m.name), slot), id: m.id, pending: pending };
      G.idToSlot[m.id] = slot; G.guestIn[slot] = NONE;
      t.toGuest(m.id, { t: 'welcome', slot: slot });
      A.play('join');
      UI.toast(G.roster[slot].name + (pending ? ' will join next attempt' : ' joined'), pending ? 'warn' : '');
      if (G.screen === 'lobby') refreshLobby();
      hostBroadcast(true);
    } else if (m.t === 'in') {
      slot = G.idToSlot[m.id]; if (slot == null) return;
      G.guestIn[slot] = I.fromBits(m.b | 0, m.jc | 0, m.uc | 0);
      if (typeof m.ts === 'number' && G.world) G.ack[slot] = [m.ts | 0, G.world.tick | 0];
      var rc = m.rc | 0;
      if (G.lastRc[m.id] == null) G.lastRc[m.id] = rc;
      else if (rc > G.lastRc[m.id]) { G.lastRc[m.id] = rc; if (G.screen === 'play' && !G.notice) { UI.toast(nameOf(slot) + ' restarted'); restart(); } }
    } else if (m.t === 'bye') {
      slot = G.idToSlot[m.id]; if (slot == null) return;
      var nm = nameOf(slot);
      delete G.idToSlot[m.id]; delete G.roster[slot]; delete G.lastRc[m.id]; G.guestIn[slot] = NONE;
      A.play('leave');
      if (G.world && G.screen === 'play' && worldSlotList(G.world).indexOf(slot) >= 0) {
        G.notice = { ticks: 120, text: nm + ' left — restarting…' };
      } else UI.toast(nm + ' left', 'warn');
      if (G.screen === 'lobby') refreshLobby();
      hostBroadcast(true);
    } else if (m.t === 'fatal') {
      leaveSession();
      UI.dialog({ title: 'Connection lost', text: m.msg || 'The room connection ended.' });
    }
  }

  // ---------- guest networking ----------
  function onGuestMsg(m) {
    if (G.mode !== 'guest' || !m) return;
    if (m.t === 'welcome') {
      G.mySlot = m.slot;
      if (G.screen === 'wait') { A.play('join'); setScreen('lobby'); }
    } else if (m.t === 'full') {
      leaveSession();
      UI.dialog({ title: 'Room is full', text: 'That room already has 4 bots. Ask the host to make space, or start your own room.' });
    } else if (m.t === 'st') {
      onGuestState(m);
    } else if (m.t === 'hostgone') {
      if (G.leaving) return;
      leaveSession();
      UI.dialog({ title: 'Host left the room', text: m.msg || 'The host closed the room, so the session ended. You are back at the title screen.' });
    }
  }
  function onGuestState(m) {
    var meta = m.m; if (!meta || !Array.isArray(meta.pl)) return;
    G.hostMeta = meta;
    var roster = {};
    meta.pl.forEach(function (p) { roster[p[0]] = { slot: p[0], name: cleanName(p[1]), pending: !p[2] }; });
    var rk = JSON.stringify(meta.pl);
    if (rk !== G.rosterKey) { G.rosterKey = rk; G.roster = roster; if (G.screen === 'lobby') refreshLobby(); }
    G.runTicks = meta.tm | 0;
    if (meta.cl) G.clearInfo = { t: meta.cl[0], g: meta.cl[1], gt: meta.cl[2], best: meta.cl[3], nb: !!meta.cl[4] };
    G.notice = meta.msg ? { text: meta.msg, ticks: 1 } : null;
    if ((meta.scr === 'play' || meta.scr === 'clear') && LV[meta.lv]) {
      var slots = meta.pl.filter(function (p) { return p[2]; }).map(function (p) { return p[0]; }).sort();
      var key = meta.lv + '|' + slots.join(',');
      if (key !== G.worldKey || !G.world) {
        try {
          G.lv = meta.lv; G.level = parsed(meta.lv);
          var newLevel = G.worldKey.split('|')[0] !== String(meta.lv);
          buildWorld(slots.length ? slots : [0]);
          if (newLevel) { G.introLv = -1; maybeIntro(); if (LV[meta.lv].id === '1-1' && sget('sb.legend', '') !== '1') { G.legendT = 14; sset('sb.legend', '1'); } }
          G.worldKey = key; G.hintT = LV[meta.lv].raw.hint ? 8 : 0; UI.resetHud(); A.music(LV[meta.lv].theme);
        } catch (e) { G.world = null; G.worldKey = ''; }
      }
      if (G.world && m.s) {
        try {
          E.applySnapshot(G.world, m.s);
          var tick = typeof m.s.k === 'number' ? m.s.k : (typeof m.s.t === 'number' ? m.s.t : null);
          bufferSnapshot(tick, performance.now() / 1000);
          reconcile(m.s, tick, meta.ak);
          var predOn = G.pred.on && G.pred.blend > 0.5;
          if (G.world.events && G.world.events.length) for (var i = 0; i < G.world.events.length; i++) {
            var ev = G.world.events[i];
            if (predOn && ev.slot === G.mySlot && (ev.t === 'jump' || ev.t === 'land')) continue; // already played from the prediction
            G.frameEvents.push(ev);
          }
          if (meta.at !== G.lastAt) { if (G.lastAt != null) R.resetAttempt(); G.lastAt = meta.at; G.tagT = 2; }
        } catch (e) {}
      }
    }
    var scr = meta.scr;
    if (scr !== G.screen && !(G.screen === 'wait')) {
      if (scr === 'select') G.selTab = LV[meta.lv] ? LV[meta.lv].tab : G.selTab;
      setScreen(scr);
    } else if (G.screen === 'wait' && G.mySlot != null) setScreen(scr);
    if (G.screen === 'clear') refreshClear();
  }
  function guestInputNow() { return virt(G.mySlot, 'me', I.online(), blockedNow()); }
  function guestSendInput(force, v) {
    if (G.mode !== 'guest' || !G.net || !G.net.myId) return;
    v = v || guestInputNow();
    var b = I.bits(v), key = b + ',' + v.jc + ',' + v.uc + ',' + G.rc, now = performance.now();
    if (!force && key === G.lastInKey && now - G.lastInT < 250) return;
    G.lastInKey = key; G.lastInT = now;
    G.net.toHost({ t: 'in', id: G.net.myId, b: b, jc: v.jc, uc: v.uc, rc: G.rc, ts: G.pred.pt });
  }

  // ---------- guest: adaptive snapshot buffer ----------
  // Snapshots are stamped with the host tick. We estimate host time (offset = max recent tick/60 - arrival), track
  // how late snapshots arrive (jitter) and render remote things D seconds behind host time, D = gap + p95 lateness.
  function bufferSnapshot(tick, nowS) {
    if (tick == null) return;
    var c = G.clock, B = G.buf, last = B[B.length - 1];
    if (last && tick <= last.k) { if (tick < last.k - 20) { B.length = 0; c.off = null; c.rt = null; c.lat = []; } else return; }
    var rec = recordPrev(); rec.key = rec.k; rec.k = tick; B.push(rec); if (B.length > 48) B.shift();
    var sample = tick / 60 - nowS;
    if (c.off == null) c.off = sample;
    else if (sample > c.off) c.off += (sample - c.off) * 0.3;
    else c.off -= 0.00005;
    c.lat.push(Math.max(0, c.off - sample)); if (c.lat.length > 90) c.lat.shift();
    if (last) c.gap = c.gap * 0.9 + Math.min(0.25, (tick - last.k) / 60) * 0.1;
    var srt = c.lat.slice().sort(function (a, b) { return a - b; }), p95 = srt[Math.min(srt.length - 1, Math.floor(srt.length * 0.95))] || 0;
    c.target = Math.max(0.03, Math.min(0.45, c.gap + p95 + 0.006));
  }
  // elastic playout clock: runs at 0.8x-1.2x real time to track host time - D, never more than 4 ticks past the
  // newest snapshot (so a transport stall slows/holds the picture instead of running ahead and lurching later)
  function renderTick(nowS, dt) {
    var c = G.clock, B = G.buf; if (c.off == null || !B.length) return null;
    c.D += (c.target - c.D) * (c.target > c.D ? 0.08 : 0.01);
    var tgt = (nowS + c.off - c.D) * 60, newest = B[B.length - 1].k;
    if (c.rt == null || Math.abs(tgt - c.rt) > 40) c.rt = Math.min(tgt, newest);
    else {
      var sp = 1 + Math.max(-0.2, Math.min(0.2, (tgt - c.rt) * 0.04));
      var lead = newest - c.rt; if (lead < 2) sp = Math.min(sp, 0.75 + Math.max(0, lead) * 0.1); // buffer running dry: slow down early
      c.rt += dt * 60 * sp;
    }
    if (c.rt > newest + 3) c.rt = newest + 3;
    return c.rt;
  }
  function sampleBuffer(rt) {
    var B = G.buf, n = B.length; if (!n || rt == null) return null;
    if (n === 1 || rt <= B[0].k) return { a: B[0], b: B[0], f: 0 };
    for (var i = n - 1; i > 0; i--) if (B[i - 1].k <= rt) break;
    var a = B[i - 1], b = B[i];
    if (rt >= B[n - 1].k) { a = B[n - 2]; b = B[n - 1]; var over = Math.min(3, rt - b.k); return { a: a, b: b, f: 1 + over / Math.max(1, b.k - a.k) }; }
    return { a: a, b: b, f: (rt - a.k) / Math.max(1e-6, b.k - a.k) };
  }

  // ---------- guest: own-bot prediction (rollback + replay with the shared deterministic engine) ----------
  function myBody(w) { if (!w) return null; if (w._bySlot) return w._bySlot[G.mySlot]; for (var i = 0; i < w.players.length; i++) if (w.players[i].slot === G.mySlot) return w.players[i]; return null; }
  function predStep(inp) {
    var P = G.pred, pw = P.w; P.pt++;
    if (!pw) return;
    var ins = {}; ins[G.mySlot] = inp;
    try { E.step(pw, ins); } catch (e) { P.valid = false; return; }
    var b = myBody(pw); if (!b) return;
    P.hist[P.pt] = { inp: inp, x: b.x, y: b.y, c: b.coyote, j: b.jbuf, dr: b.dropT, jp: b.jumping };
    delete P.hist[P.pt - 200];
    P.prev = P.cur; P.cur = { x: b.x, y: b.y }; P.v = { x: b.vx || 0, y: b.onGround ? 0 : (b.vy || 0) };
    if (P.on && pw.events) for (var i = 0; i < pw.events.length; i++) {
      var ev = pw.events[i]; if (ev.slot === G.mySlot && (ev.t === 'jump' || ev.t === 'land')) G.frameEvents.push(ev);
    }
  }
  function predDisplay() {
    var P = G.pred; if (!P.cur) return null;
    var a = Math.max(0, Math.min(1, P.acc / DT)), v = P.v || { x: 0, y: 0 };
    return { x: P.cur.x + Math.max(-3, Math.min(3, v.x)) * a + P.corr.x, y: P.cur.y + Math.max(-12, Math.min(12, v.y)) * a + P.corr.y };
  }
  function reconcile(snap, tick, ak) {
    var P = G.pred, pw = P.w, me = G.mySlot; if (!pw || !snap || tick == null) return;
    var a = null; if (Array.isArray(ak)) for (var i = 0; i < ak.length; i++) if (ak[i][0] === me) a = ak[i];
    var old = P.cur ? { x: P.cur.x + P.corr.x, y: P.cur.y + P.corr.y } : null; // stepped position (no in-tick extrapolation)
    try { E.applySnapshot(pw, snap); } catch (e) { P.valid = false; return; }
    pw.events = [];
    var b = myBody(pw); if (!b) { P.valid = false; return; }
    var eq = a ? a[1] + (tick - a[2]) : -1;
    if (eq > P.pt) eq = P.pt;
    var h = a && P.hist[eq];
    if (!h) { P.valid = false; P.prev = P.cur = { x: b.x, y: b.y }; P.corr = { x: 0, y: 0 }; return; }
    // snapshots don't carry these engine timers / press-edge state: restore them from our own history at that tick
    if ('coyote' in b) b.coyote = h.c; if ('jbuf' in b) b.jbuf = h.j; if ('dropT' in b) b.dropT = h.dr;
    if (pw._in && pw._in[me]) { var st = pw._in[me], hi = h.inp; st.j = !!hi.jump; st.u = !!hi.up; st.d = !!hi.down; st.jc = hi.jc; st.uc = hi.uc; }
    var ins = {};
    for (var t = eq + 1; t <= P.pt; t++) {
      var hh = P.hist[t]; if (!hh) break;
      ins[me] = hh.inp;
      try { E.step(pw, ins); } catch (e) { P.valid = false; return; }
      hh.x = b.x; hh.y = b.y; hh.c = b.coyote; hh.j = b.jbuf; hh.dr = b.dropT;
    }
    pw.events = [];
    P.valid = true;
    P.cur = { x: b.x, y: b.y }; P.prev = P.cur; P.v = { x: b.vx || 0, y: b.onGround ? 0 : (b.vy || 0) };
    if (old) {
      var dx = old.x - b.x, dy = old.y - b.y;
      P.corr = dx * dx + dy * dy > 34 * 34 ? { x: 0, y: 0 } : { x: dx, y: dy }; // snap beyond ~1 tile, else glide
      P.nrec = (P.nrec || 0) + 1; P.lastErr = Math.round(dx * 10) / 10;
    }
  }
  /** contact with things whose (delayed) motion we can't predict well: other bots/crates/platforms under, on, or pushed by us */
  function inContact(w, b) {
    if (!w || !b) return false;
    var x0 = b.x, x1 = b.x + b.w, y0 = b.y, y1 = b.y + b.h, i, o;
    function hov(o) { return Math.min(x1, o.x + o.w) - Math.max(x0, o.x) > 0.5; }
    function vov(o) { return Math.min(y1, o.y + o.h) - Math.max(y0, o.y) > 0.5; }
    for (i = 0; i < w.players.length; i++) {
      o = w.players[i]; if (o.slot === G.mySlot || o.state !== 'active') continue;
      if (hov(o) && (Math.abs(o.y - y1) < 2 || Math.abs(o.y + o.h - y0) < 2)) return true;
    }
    for (i = 0; i < w.entities.length; i++) {
      o = w.entities[i];
      if (o.type === 'crate' && !o.gone) { if ((hov(o) && (Math.abs(o.y - y1) < 2 || Math.abs(o.y + o.h - y0) < 2)) || (vov(o) && (Math.abs(o.x - x1) < 2 || Math.abs(o.x + o.w - x0) < 2))) return true; }
      else if (o.type === 'platform') { if (hov(o) && Math.abs(o.y - y1) < 3) return true; }
    }
    return false;
  }
  function updatePrediction(dt, inp) {
    var P = G.pred;
    P.acc += dt; var n = 0;
    while (P.acc >= DT && n < 8) { predStep(inp); P.acc -= DT; n++; }
    if (n === 8) P.acc = 0;
    var w = G.world, ab = myBody(w), pb = myBody(P.w);
    var ok = P.valid && G.screen === 'play' && w.phase === 'play' && P.w && P.w.phase === 'play' && ab && ab.state === 'active' && pb && pb.state === 'active' &&
      !(G.level && G.level.tether) && !(w.ropes && w.ropes.length);
    if (ok && (inContact(w, ab) || inContact(P.w, pb))) P.hold = 0.3;
    if (P.hold > 0) { P.hold -= dt; ok = false; }
    P.on = !!ok;
    P.blend += ((P.on ? 1 : 0) - P.blend) * (1 - Math.exp(-dt * 12));
    if (P.blend < 0.01 && !P.on) P.blend = 0;
    var k = Math.exp(-dt / 0.09); P.corr.x *= k; P.corr.y *= k;
    P.b = pb;
  }

  // ---------- session start / leave ----------
  function netKind() {
    var kinds = N.kinds();
    if (/^#tabs\b/.test(location.hash || '')) return 'tabs';
    if (settings.net !== 'auto' && kinds.indexOf(settings.net) >= 0) return settings.net;
    return kinds[0];
  }
  function takeName() { G.name = cleanName($('in-name').value || G.name); $('in-name').value = G.name; sset('sb.name', G.name); }
  async function hostOnline() {
    takeName();
    var kind = netKind();
    if (kind === 'room' && !(await N.getRoom())) { UI.dialog({ title: 'Online play unavailable', text: 'Online rooms are not available in this view of the artifact (you may need to be signed in on claude.ai). Local Play still works!' }); return; }
    var t = N.create(kind);
    G.mode = 'host'; G.net = t; G.roster = { 0: { slot: 0, name: G.name, id: 'host' } }; G.mySlot = 0; G.idToSlot = {}; G.guestIn = {}; G.lastRc = {}; G.world = null; G.lv = -1;
    t.onMsg = onHostMsg; t.onStatus = function (ok) { G.netOk = ok; };
    showWait('Opening a room', kind === 'room' || kind === 'tabs' ? 'Setting up your room…' : 'Connecting to the online-play servers…');
    try {
      var code = await t.hostStart(N.genCode(), G.name);
      if (G.net !== t) { t.close(); return; }
      G.code = code; setScreen('lobby');
    } catch (e) {
      if (G.net !== t) return;
      t.close(); G.net = null; G.mode = 'none'; setScreen('title');
      UI.dialog({ title: 'Could not open a room', text: (e && e.message) || 'Something went wrong.' });
    }
  }
  async function joinOnline() {
    takeName();
    var code = N.cleanCode($('in-code').value);
    $('in-code').value = code;
    if (code.length !== 5) { UI.toast('Enter the 5-character room code', 'warn'); try { $('in-code').focus(); } catch (e) {} return; }
    var kind = netKind();
    if (kind === 'room' && !(await N.getRoom())) { UI.dialog({ title: 'Online play unavailable', text: 'Online rooms are not available in this view of the artifact (you may need to be signed in on claude.ai). Local Play still works!' }); return; }
    var t = N.create(kind);
    G.mode = 'guest'; G.net = t; G.code = code; G.roster = {}; G.mySlot = null; G.world = null; G.worldKey = ''; G.rosterKey = ''; G.rc = 0; G.lastAt = null; G.lv = -1;
    t.onMsg = onGuestMsg; t.onStatus = function (ok) { G.netOk = ok; };
    showWait('Joining ' + code, kind === 'room' || kind === 'tabs' ? 'Looking for the room…' : 'Connecting to the host over the internet…');
    try {
      await t.joinStart(code, G.name);
      if (G.net !== t) { t.close(); return; }
      guestSendInput(true);
    } catch (e) {
      if (G.net !== t) return;
      t.close(); G.net = null; G.mode = 'none'; setScreen('title');
      UI.dialog({ title: 'Could not join', text: (e && e.message) || 'Something went wrong.' });
    }
  }
  function localPlay() {
    G.mode = 'local'; G.net = null; G.code = null; G.mySlot = 0; G.world = null; G.lv = -1;
    G.roster = { 0: { slot: 0, name: 'P1', dev: 'kb1' }, 1: { slot: 1, name: 'P2', dev: 'kb2' } };
    I.poll();
    var s = 2; for (var p = 0; p < 4 && s < 4; p++) if (I.padConnected(p)) { G.roster[s] = { slot: s, name: 'P' + (s + 1), dev: 'pad' + p }; s++; }
    setScreen('lobby');
  }
  function leaveSession() {
    G.leaving = true;
    if (G.net) { try { G.net.close(); } catch (e) {} }
    G.net = null; G.mode = 'none'; G.world = null; G.roster = {}; G.code = null; G.notice = null; G.paused = false; G.lv = -1;
    G.leaving = false;
    setScreen('title');
  }

  // ---------- local lobby ----------
  var DEVS = ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3', 'none'];
  function devUsed(dev, exceptSlot) { for (var s in G.roster) if (+s !== exceptSlot && G.roster[s].dev === dev && dev !== 'none') return true; return false; }
  function devAvail(dev, slot) { return dev === 'none' || (!devUsed(dev, slot) && (dev.indexOf('pad') !== 0 || I.padConnected(+dev.slice(3)))); }
  function localSlotClick(slot) {
    if (G.mode !== 'local') return;
    A.play('click');
    var r = G.roster[slot];
    if (!r) {
      var dev = 'none';
      for (var i = 0; i < DEVS.length; i++) if (DEVS[i] !== 'none' && devAvail(DEVS[i], slot)) { dev = DEVS[i]; break; }
      G.roster[slot] = { slot: slot, name: 'P' + (slot + 1), dev: dev };
    } else {
      var k = DEVS.indexOf(r.dev), n = Object.keys(G.roster).length;
      for (var j = 1; j <= DEVS.length + 1; j++) {
        var idx = (k + j) % (DEVS.length + 1);
        if (idx === DEVS.length) { if (n > 1) { delete G.roster[slot]; break; } continue; }
        if (devAvail(DEVS[idx], slot)) { r.dev = DEVS[idx]; break; }
      }
    }
    refreshLobby();
  }
  function devLabel(d) { return d === 'none' ? (touchOn() ? 'Idle' : 'Idle (Tab)') : (d === 'kb1' && touchOn() ? 'Touch' : I.deviceLabel(d)); }
  function padJoin(pad) {
    if (G.mode !== 'local') return;
    var dev = 'pad' + pad;
    if (devUsed(dev, -1)) return;
    var target = -1, s;
    if (G.screen === 'lobby') for (s = 0; s < 4; s++) if (!G.roster[s]) { target = s; break; }
    if (target < 0) for (s = 0; s < 4; s++) if (G.roster[s] && G.roster[s].dev === 'none') { target = s; break; }
    if (target < 0) return;
    if (!G.roster[target]) G.roster[target] = { slot: target, name: 'P' + (target + 1), dev: dev }; else G.roster[target].dev = dev;
    UI.toast('Pad ' + (pad + 1) + ' drives ' + SLOT_NAME[target]);
    A.play('join');
    if (G.screen === 'lobby') refreshLobby();
  }
  function tabSwap() {
    if (G.mode !== 'local' || G.screen !== 'play') return;
    var slots = worldSlotList(G.world), cur = -1, i;
    for (i = 0; i < slots.length; i++) if (G.roster[slots[i]] && G.roster[slots[i]].dev === 'kb1') cur = i;
    var idle = slots.filter(function (s) { return G.roster[s] && G.roster[s].dev === 'none'; });
    if (!idle.length) { UI.toast('No idle bots to switch to'); return; }
    var next = -1;
    for (i = 1; i <= slots.length; i++) { var s = slots[((cur < 0 ? -1 : cur) + i + slots.length) % slots.length]; if (G.roster[s] && G.roster[s].dev === 'none') { next = s; break; } }
    if (next < 0) return;
    if (cur >= 0) G.roster[slots[cur]].dev = 'none';
    G.roster[next].dev = 'kb1';
    UI.toast('WASD now drives ' + SLOT_NAME[next]);
    A.play('click');
  }

  // ---------- screen renderers ----------
  function refreshLobby() {
    var players = rosterList().map(function (p) {
      return { slot: p.slot, name: p.name, me: G.mode !== 'local' && p.slot === G.mySlot, pending: p.pending, devLabel: devLabel(p.dev || 'none') };
    });
    var n = players.length, status;
    var kindLbl = G.net ? N.label(G.net.kind) : '';
    if (G.mode === 'local') status = n + ' bot' + (n === 1 ? '' : 's') + ' ready. Most levels want 2 or more.';
    else if (G.mode === 'host') status = (n < 2 ? 'Waiting for friends to join… (you can also start alone)' : n + ' bots in the room.') + (kindLbl ? '<br>Connected via <b>' + UI.esc(kindLbl) + '</b>' : '');
    else status = 'Waiting for the host to pick a level…';
    UI.renderLobby({ touch: touchOn(), mode: G.mode === 'local' ? 'local' : G.mode, code: G.code, players: players, canStart: n >= 1, status: status, onSlot: localSlotClick });
  }
  function refreshSelect() {
    var total = 0, cleared = 0;
    var worlds = WORLDS.map(function (W) {
      return { num: W.num, name: W.name, theme: W.theme, levels: W.levels.map(function (l) {
        var p = progress[l.id] || {}; total++; if (p.c) cleared++;
        return { index: l.index, id: l.id, name: l.name, cleared: !!p.c, best: p.t, gearsBest: p.g || 0, gearsTotal: l.gearsTotal, minPlayers: l.minPlayers };
      }) };
    });
    if (G.selTab >= worlds.length) G.selTab = 0;
    UI.renderSelect({ worlds: worlds, tab: G.selTab, guest: G.mode === 'guest', totalCleared: cleared, total: total,
      onTab: function (i) { G.selTab = i; refreshSelect(); },
      onPick: function (i) { if (G.mode === 'guest') return; A.play('click'); tryStartLevel(i); } });
  }
  function tryStartLevel(i) {
    var info = LV[i]; if (!info) return;
    var have = rosterList().length, need = info.minPlayers || 1;
    if (have >= need) { startLevel(i); return; }
    UI.dialog({ title: 'Needs ' + need + ' bots', text: info.id + ' \u201C' + info.name + '\u201D needs ' + need + ' bots \u2014 you have ' + have + '. ' +
      (G.mode === 'local' ? 'Add bots in the lobby (gamepads or a second keyboard player), or give it a try anyway.' : 'Invite more friends with your room code, or give it a try anyway.'),
      buttons: [{ label: 'Back', cls: 'ghost' }, { label: 'Play anyway', cls: 'primary', fn: function () { startLevel(i); } }] });
  }
  function refreshClear() {
    var info = LV[G.lv], c = G.clearInfo || { t: G.runTicks, g: 0, gt: 0 };
    $('clear-name').textContent = info ? info.id + ' · ' + info.name : '';
    $('clear-time').textContent = UI.fmtTime(c.t);
    $('clear-gears').textContent = (c.g || 0) + '/' + (c.gt || 0);
    $('clear-gears').parentNode.classList.toggle('hidden', !c.gt);
    $('clear-best').textContent = c.best != null ? UI.fmtTime(c.best) : '-';
    $('clear-newbest').classList.toggle('hidden', !c.nb);
    var guest = G.mode === 'guest';
    $('clear-host').classList.toggle('hidden', guest); $('clear-guest').classList.toggle('hidden', !guest);
    $('b-next').innerHTML = G.lv >= LV.length - 1 ? 'Credits &#9654;' : 'Next &#9654;';
  }
  function refreshCredits() {
    $('credits-body').innerHTML = '<p>Every level is cleared. The bots salute you!</p>' +
      '<p><span class="role">Game design &amp; integration</span><br>The Stackbots lead</p>' +
      '<p><span class="role">Engine</span><br>dev-engine</p><p><span class="role">Client, art &amp; sound</span><br>client developer</p>' +
      '<p><span class="role">Levels</span><br>Five level designers</p><p><span class="role">Testing</span><br>QA &amp; our beta tester</p>' +
      '<p>All bots, art, sounds and music are original and drawn in code.</p><p><b>Thanks for playing!</b></p>';
    $('b-credits-ok').textContent = G.mode === 'guest' ? 'Leave' : (G.mode === 'none' ? 'Back' : 'Level Select');
  }
  function refreshNetNote() {
    var kind = netKind(), el = $('net-note');
    if (kind === 'room') {
      el.innerHTML = '<span class="spinner"></span>Checking online rooms…';
      N.getRoom().then(function (r) { el.innerHTML = r ? 'Online play runs through this claude.ai artifact’s room.' : 'Online play is not available in this view. <b>Local Play</b> works!'; });
    } else if (kind === 'tabs') el.innerHTML = '<b>Tab mode:</b> open this page in other tabs of this browser to join.';
    else el.innerHTML = 'Friends join with your 5-letter code over the internet.';
  }
  function refreshSettings() {
    $('t-sound').textContent = A.sfxOn() && !A.isMuted() ? 'On' : 'Off';
    $('t-music').textContent = A.musicOn() ? 'On' : 'Off';
    $('t-shake').textContent = settings.shake ? 'On' : 'Off';
    $('t-touch').textContent = { auto: 'Auto', on: 'On', off: 'Off' }[settings.touch] || 'Auto';
    var kinds = N.kinds();
    $('t-net').textContent = settings.net === 'auto' ? 'Auto' : N.label(settings.net);
    $('net-desc').innerHTML = 'Auto uses <b>' + UI.esc(N.label(kinds[0])) + '</b>. <b>Browser tabs</b> plays between tabs of this browser (great for testing; also <code>#tabs</code> in the URL).';
  }

  // ---------- pause ----------
  function setPause(on, silent) {
    if (on && G.screen !== 'play') return;
    G.paused = !!on;
    UI.overlay('pause', G.paused);
    if (G.paused) {
      var guest = G.mode === 'guest';
      $('b-restart').innerHTML = guest ? 'Ask for restart' : 'Restart <span class="kbd">R</span>';
      $('b-pselect').classList.toggle('hidden', guest);
      $('b-pmute').textContent = 'Sound: ' + (A.isMuted() ? 'off' : 'on');
      var hint = LV[G.lv] && LV[G.lv].raw.hint; $('pause-hint').textContent = hint || ''; $('pause-hint').classList.toggle('hidden', !hint);
      $('pause-note').textContent = G.mode === 'host' ? 'The game keeps running for your friends.' : (guest ? 'The game keeps running while you are paused.' : '');
      I.clear();
    }
    updateTouch();
    if (!silent) A.play(on ? 'click' : 'back');
  }
  function requestRestart() {
    if (G.screen !== 'play' && !(G.screen === 'clear' && false)) return;
    if (G.mode === 'guest') { G.rc++; guestSendInput(true); UI.toast('Restart requested'); return; }
    if (isAuthority()) restart();
  }

  // ---------- main loop ----------
  var last = 0, titleT = 0;
  function pump(now, render) {
    var dt = last ? (now - last) / 1000 : DT; last = now;
    if (dt > 0.25) dt = 0.25; if (dt < 0) dt = 0;
    I.poll();
    if (isAuthority()) {
      G.acc += dt; var n = 0;
      while (G.acc >= DT && n < 8) { hostTick(); G.acc -= DT; n++; }
      if (n === 8) G.acc = 0;
    } else if (G.mode === 'guest') {
      var gin = G.mySlot != null ? guestInputNow() : null;
      if (gin) guestSendInput(false, gin);
      if (gin && G.world && G.pred.w && (G.screen === 'play' || G.screen === 'clear')) updatePrediction(dt, gin);
    }
    if (G.frameEvents.length) {
      A.events(G.frameEvents);
      if (render !== false) R.events(G.frameEvents, G.world);
      G.frameEvents = [];
    }
    if (render === false) return;
    var inGame = (G.screen === 'play' || G.screen === 'clear') && G.world;
    if (inGame) {
      if (G.hintT > 0 && G.screen === 'play' && !G.paused) G.hintT -= dt;
      if (G.tagT > 0) G.tagT -= dt;
      if (R.introActive() && (I.lastPress() > G.introT0 || G.screen !== 'play')) R.skipIntro();
      var interp = interpolate(now / 1000, dt);
      var names = {}; for (var s in G.roster) names[s] = G.roster[s].name;
      if (++G.padN % 15 === 1) measurePads();
      R.frame(G.world, { dt: dt, pp: interp.pp, ep: interp.ep, kp: interp.kp, names: names, me: G.mode === 'local' ? -1 : G.mySlot, tagAlpha: Math.max(0, Math.min(1, G.tagT)),
        shake: settings.shake, padTop: G.hudPadT, padBottom: G.hudPadB, peek: G.screen === 'play' && !G.paused && !UI.dialogOpen() && I.peekHeld() });
      updateHud(dt);
    } else {
      R.title(dt);
      if (G.screen === 'lobby') { titleT += dt; UI.animateLobby(rosterList(), titleT); }
    }
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function interpolate(nowS, dt) {
    var w = G.world, out = { pp: null, ep: null, kp: null };
    if (!w) return out;
    var i, pp = {}, ep = [];
    if (G.mode === 'guest') {
      var sm = sampleBuffer(renderTick(nowS, dt));
      if (sm) {
        var A0 = sm.a, B0 = sm.b, f = sm.f;
        for (i = 0; i < w.players.length; i++) {
          var sl = w.players[i].slot, q0 = A0.p[sl], q1 = B0.p[sl];
          if (!q0 || !q1) continue;
          if (Math.abs(q1.x - q0.x) > 48 || Math.abs(q1.y - q0.y) > 48) pp[sl] = { x: q1.x, y: q1.y };
          else pp[sl] = { x: lerp(q0.x, q1.x, f), y: lerp(q0.y, q1.y, f) };
        }
        for (i = 0; i < w.entities.length; i++) {
          var e0 = A0.e[i], e1 = B0.e[i];
          if (!e0 || !e1 || Math.abs(e1.x - e0.x) > 48 || Math.abs(e1.y - e0.y) > 48) { ep.push(null); continue; }
          ep.push({ x: lerp(e0.x, e1.x, Math.min(f, 1)), y: lerp(e0.y, e1.y, Math.min(f, 1)) });
        }
        if (A0.key && B0.key && w.key && !(w.key.holder >= 0)) out.kp = { x: lerp(A0.key.x, B0.key.x, Math.min(f, 1)), y: lerp(A0.key.y, B0.key.y, Math.min(f, 1)) };
        out.ep = ep;
      }
      // own bot: blend the local prediction over the interpolated authority
      var P = G.pred, me = G.mySlot, pd = P.blend > 0 ? predDisplay() : null;
      if (pd && P.b) {
        var base = pp[me] || (myBody(w) ? { x: myBody(w).x, y: myBody(w).y } : pd), k = P.blend;
        pp[me] = { x: lerp(base.x, pd.x, k), y: lerp(base.y, pd.y, k) };
        if (k > 0.5) { pp[me].slot = me; pp[me].facing = P.b.facing; pp[me].onGround = P.b.onGround; pp[me].vx = P.b.vx; pp[me].vy = P.b.vy; }
      }
      out.pp = pp;
      return out;
    }
    var ip = G.ip; if (!ip.prev) return out;
    var a = Math.max(0, Math.min(1, G.acc / DT)), prev = ip.prev;
    for (i = 0; i < w.players.length; i++) {
      var p = w.players[i], r0 = prev.p[p.slot];
      if (!r0 || Math.abs(p.x - r0.x) > 48 || Math.abs(p.y - r0.y) > 48) continue;
      pp[p.slot] = { x: lerp(r0.x, p.x, a), y: lerp(r0.y, p.y, a) };
    }
    for (i = 0; i < w.entities.length; i++) {
      var x0 = prev.e[i], x1 = w.entities[i];
      if (!x0 || Math.abs(x1.x - x0.x) > 48 || Math.abs(x1.y - x0.y) > 48) { ep.push(null); continue; }
      ep.push({ x: lerp(x0.x, x1.x, a), y: lerp(x0.y, x1.y, a) });
    }
    out.pp = pp; out.ep = ep;
    return out;
  }
  /** free band for the camera: below the HUD bar, above the hint bubble (touch buttons overlay and reserve nothing) */
  function measurePads() {
    var ih = window.innerHeight || 540, top = 0, bot = 0;
    try {
      var hb = $('hud-top').getBoundingClientRect(); top = Math.max(0, hb.bottom + 4);
      var hint = $('hud-hint');
      if (!hint.classList.contains('off') && hint.textContent) {
        var r = hint.getBoundingClientRect();
        if (r.top > ih / 2) bot = ih - r.top + 6; else top = Math.max(top, r.bottom + 6);
      }
    } catch (e) {}
    G.hudPadT = Math.min(ih * 0.3, top); G.hudPadB = Math.min(ih * 0.3, bot);
  }
  function updateHud(dt) {
    var w = G.world, info = LV[G.lv] || {};
    var chips = rosterList().map(function (r) {
      var p = null; for (var i = 0; i < w.players.length; i++) if (w.players[i].slot === r.slot) p = w.players[i];
      return { slot: r.slot, name: r.name, me: G.mode !== 'local' && r.slot === G.mySlot, inHatch: !!(p && p.state === 'entered'),
        cell: !!(p && (p.hasKey || (w.key && w.key.holder === r.slot && !w.key.used))), pending: !p };
    });
    var banner = '';
    if (R.introActive() && w.phase === 'play') banner = UI.esc(info.id || '') + ' \u00B7 ' + UI.esc(info.name || '') + '<small>' + (touchOn() ? 'Tap' : 'Press any key') + ' to skip</small>';
    else if (w.phase === 'dead') banner = 'Oops! ' + UI.esc(nameOf(w.deadSlot)) + ' got scrapped<small>Restarting…</small>';
    else if (G.notice) banner = UI.esc(G.notice.text);
    else if (w.phase === 'clear') banner = 'Everybody in!';
    else if (G.mode === 'guest' && G.roster[G.mySlot] && G.roster[G.mySlot].pending) banner = '<small>You’ll hop in on the next attempt</small>';
    if (G.mode === 'guest' && G.net && !G.netOk) { G.netBadT += dt; } else G.netBadT = 0;
    UI.hud({ lid: info.id || '', lname: info.name || '', time: G.runTicks, gears: w.gearsTaken || 0, gearsTotal: (w.gears || []).length,
      chips: chips, hint: G.hintT > 0 && G.screen === 'play' ? (info.raw && info.raw.hint) : '', banner: G.screen === 'play' ? banner : '', net: G.netBadT > 2 });
    if (G.legendT > 0 && G.screen === 'play' && !G.paused) G.legendT -= dt;
    var lg = $('legend'), showLg = G.legendT > 0 && G.screen === 'play' && !R.introActive();
    if (showLg !== !lg.classList.contains('hidden')) { if (showLg) lg.innerHTML = legendHtml(); lg.classList.toggle('hidden', !showLg); }
    var rot = G.screen === 'play' && touchOn() && !G.rotateOff && window.innerHeight > window.innerWidth * 1.1;
    if (rot !== !$('rotate').classList.contains('hidden')) $('rotate').classList.toggle('hidden', !rot);
  }
  function legendHtml() {
    var k = function (t) { return '<span class="kbd">' + t + '</span>'; };
    if (touchOn()) return '<b>Controls</b><span>' + k('\u25C0') + k('\u25B6') + ' move</span><span>' + k('JUMP') + ' jump</span><span>' + k('UP') + ' enter hatch / flip lever</span><span>' + k('DN') + '+' + k('JUMP') + ' drop through</span><span>hold ' + k('MAP') + ' to see the whole level</span>';
    if (G.mode === 'local') return '<b>Controls</b><span>P1 ' + k('A') + k('D') + ' move ' + k('Space') + ' jump ' + k('W') + ' enter</span><span>P2 ' + k('\u2190') + k('\u2192') + ' move ' + k('Enter') + ' jump ' + k('\u2191') + ' enter</span><span>hold ' + k('Q') + ' see whole level \u00B7 ' + k('R') + ' restart \u00B7 ' + k('Esc') + ' pause</span>';
    return '<b>Controls</b><span>' + k('\u2190') + k('\u2192') + ' / ' + k('A') + k('D') + ' move</span><span>' + k('Space') + ' / ' + k('W') + ' jump</span><span>' + k('W') + ' / ' + k('\u2191') + ' enter the hatch, flip levers</span><span>hold ' + k('Q') + ' see whole level \u00B7 ' + k('R') + ' restart \u00B7 ' + k('Esc') + ' pause</span>';
  }
  function rafLoop(now) { requestAnimationFrame(rafLoop); try { pump(now, true); } catch (e) { if (!rafLoop.err) { rafLoop.err = 1; console.warn('frame error', e); } } }

  // ---------- actions (keys / gamepad system buttons) ----------
  function onAction(a, e) {
    if (UI.dialogOpen()) { if (a === 'pause') { var b = $('dlg-btns').lastChild; if (b) b.click(); } return; }
    if (a === 'mute') { var m = A.toggleMute(); UI.toast(m ? 'Sound off' : 'Sound on'); if (G.paused) $('b-pmute').textContent = 'Sound: ' + (m ? 'off' : 'on'); return; }
    if (a === 'pause') {
      if (G.screen === 'play') setPause(!G.paused);
      else if (G.screen === 'settings' || G.screen === 'help') setScreen(G.mode === 'none' ? 'title' : 'lobby');
      else if (G.screen === 'select' && G.mode !== 'guest') setScreen('lobby');
      return;
    }
    if (a === 'back' && G.paused) { setPause(false); return; }
    if (a === 'restart') { if (G.screen === 'play' && !G.paused) requestRestart(); return; }
    if (a === 'tab') { if (G.mode === 'local' && G.screen === 'play' && e && e.preventDefault) e.preventDefault(); tabSwap(); return; }
    if (a === 'padA' && e) { padJoin(e.pad); return; }
    if (a === 'confirm') {
      if (G.screen === 'clear' && G.mode !== 'guest') $('b-next').click();
    }
  }

  // ---------- wiring ----------
  function on(id, fn) { var el = $(id); if (el) el.addEventListener('click', function (e) { A.init(); fn(e); }); }
  function init() {
    R.init($('game'));
    I.init($('touch'));
    I.onAction(onAction);
    I.setCapture(function () { return G.screen === 'play' && !G.paused && !UI.dialogOpen(); });
    $('in-name').value = G.name;
    $('in-name').addEventListener('change', takeName);
    $('in-code').addEventListener('input', function () { var c = N.cleanCode(this.value); if (c !== this.value) this.value = c; });
    $('in-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); A.init(); joinOnline(); } });
    $('in-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); takeName(); this.blur(); } });
    on('b-host', function () { A.play('click'); hostOnline(); });
    on('b-join', function () { A.play('click'); joinOnline(); });
    on('b-local', function () { A.play('click'); takeName(); localPlay(); });
    on('b-settings', function () { A.play('click'); refreshSettings(); setScreen('settings'); });
    on('b-help', function () { A.play('click'); setScreen('help'); });
    on('b-help-ok', function () { A.play('back'); setScreen('title'); });
    on('b-credits', function () { A.play('click'); setScreen('done'); });
    on('b-credits-ok', function () {
      A.play('back');
      if (G.mode === 'guest') leaveSession(); else if (G.mode === 'none') setScreen('title'); else setScreen('select');
    });
    on('b-settings-ok', function () { A.play('back'); setScreen('title'); });
    on('b-wait-cancel', function () { A.play('back'); leaveSession(); });
    on('b-copy', function () {
      var code = G.code || '', ok = false;
      try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(code).then(function () { UI.toast('Code copied!'); }, selectCode); ok = true; } } catch (e) { ok = false; }
      if (!ok) selectCode();
    });
    function selectCode() {
      try { var r = document.createRange(); r.selectNodeContents($('lobby-code')); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
      UI.toast('Code selected — copy it with Ctrl/Cmd+C');
    }
    on('b-lobby-leave', function () { A.play('back'); leaveSession(); });
    on('b-lobby-start', function () { A.play('click'); if (G.mode !== 'guest') setScreen('select'); });
    on('b-sel-back', function () { A.play('back'); if (G.mode === 'guest') return; setScreen('lobby'); });
    on('hud-pause', function () { setPause(!G.paused); });
    var pk = $('hud-peek');
    pk.addEventListener('pointerdown', function (e) { e.preventDefault(); I.setTouchPeek(true); pk.classList.add('on'); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { pk.addEventListener(ev, function () { I.setTouchPeek(false); pk.classList.remove('on'); }); });
    window.addEventListener('pointerup', function () { I.setTouchPeek(false); pk.classList.remove('on'); });
    pk.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    on('b-rotate-ok', function () { G.rotateOff = true; $('rotate').classList.add('hidden'); });
    $('legend').addEventListener('click', function () { G.legendT = 0; });
    $('game').addEventListener('pointerdown', function () { if (R.introActive()) R.skipIntro(); });
    on('b-resume', function () { setPause(false); });
    on('b-restart', function () { setPause(false, true); requestRestart(); });
    on('b-pselect', function () { setPause(false, true); setScreen('select'); });
    on('b-pmute', function () { var m = A.toggleMute(); $('b-pmute').textContent = 'Sound: ' + (m ? 'off' : 'on'); });
    on('b-leave', function () {
      UI.dialog({ title: 'Leave the game?', text: G.mode === 'host' ? 'Everyone in your room will be sent back to the title screen.' : 'You will go back to the title screen.',
        buttons: [{ label: 'Stay', cls: 'ghost' }, { label: 'Leave', cls: 'coral', fn: leaveSession }] });
    });
    on('b-next', function () {
      A.play('click');
      if (G.lv >= LV.length - 1) setScreen('done'); else tryStartLevel(G.lv + 1);
    });
    on('b-clear-select', function () { A.play('click'); setScreen('select'); });
    on('t-sound', function () { if (A.isMuted()) { A.setMuted(false); A.setSfx(true); } else A.setSfx(!A.sfxOn()); refreshSettings(); A.play('click'); });
    on('t-music', function () { A.setMusic(!A.musicOn()); refreshSettings(); });
    on('t-shake', function () { settings.shake = !settings.shake; saveSettings(); refreshSettings(); });
    on('t-touch', function () { settings.touch = { auto: 'on', on: 'off', off: 'auto' }[settings.touch] || 'auto'; saveSettings(); refreshSettings(); });
    on('t-net', function () { var opts = ['auto'].concat(N.kinds()); settings.net = opts[(opts.indexOf(settings.net) + 1) % opts.length]; saveSettings(); refreshSettings(); });
    on('t-reset', function () {
      UI.dialog({ title: 'Reset progress?', text: 'This forgets every cleared level, best time and gear on this device.',
        buttons: [{ label: 'Keep', cls: 'ghost' }, { label: 'Reset', cls: 'coral', fn: function () { progress = {}; saveProgress(); UI.toast('Progress reset'); } }] });
    });
    var unlockAudio = function () { A.init(); };
    window.addEventListener('pointerdown', unlockAudio, true);
    window.addEventListener('keydown', unlockAudio, true);
    window.addEventListener('pagehide', function () { if (G.net) { try { G.net.close(); } catch (e) {} } });
    $('ver').textContent = 'v1 · ' + ((SB.BUILD && SB.BUILD.hash) || 'dev') + (SB.BUILD && SB.BUILD.stub ? ' · ENGINE STUB' : '');
    setScreen('title');
    if (/^#tabs\b/.test(location.hash || '')) refreshNetNote();
    requestAnimationFrame(rafLoop);
    // keep the host simulation alive (at reduced rate) while its tab is hidden
    setInterval(function () { if (document.hidden && (G.mode === 'host')) { try { pump(performance.now(), false); } catch (e) {} } }, 50);
  }

  // test/debug hook (read-only view of the session)
  SB.Game = {
    state: function () {
      var w = G.world;
      return { screen: G.screen, mode: G.mode, slot: G.mySlot, code: G.code, lv: G.lv, levelId: LV[G.lv] ? LV[G.lv].id : null, paused: G.paused,
        roster: rosterList().map(function (p) { return { slot: p.slot, name: p.name, pending: !!p.pending, dev: p.dev }; }),
        phase: w ? w.phase : null, net: G.net ? G.net.kind : null,
        players: w ? w.players.map(function (p) { return { slot: p.slot, x: p.x, y: p.y, state: p.state, onGround: p.onGround }; }) : [] };
    },
    levels: function () { return LV.map(function (l) { return { index: l.index, id: l.id, name: l.name, theme: l.theme }; }); },
    progress: function () { return progress; },
    /* test hooks */
    localStart: function (idx, n) {
      G.mode = 'local'; G.net = null; G.roster = {}; n = n || 4;
      for (var s = 0; s < n; s++) G.roster[s] = { slot: s, name: 'P' + (s + 1), dev: s === 0 ? 'kb1' : s === 1 ? 'kb2' : 'none' };
      startLevel(idx);
    },
    world: function () { return G.world; },
    netDebug: function () { var c = G.clock, B = G.buf; return { padT: G.hudPadT, padB: G.hudPadB, rt: c.rt, off: c.off, D: c.D, target: c.target, gap: c.gap, newest: B.length ? B[B.length - 1].k : null, n: B.length, pred: { on: G.pred.on, blend: G.pred.blend, valid: G.pred.valid, pt: G.pred.pt, cx: G.pred.corr.x, cur: G.pred.cur && G.pred.cur.x, rc: G.pred.nrec || 0, lastErr: G.pred.lastErr } }; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
