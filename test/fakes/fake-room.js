/* In-page emulation of the claude.ai artifact `room` capability (docs/room.d.ts), for tests only.
 * Inject with page.add_init_script(path=...). Relays between pages of one browser via BroadcastChannel.
 * Implements: claude.use('room') -> {join, presence, peers, onPeers, connected, onConnection, emit, on}
 *   NamedRoom: presence (merge, top-level null deletes, 4 KiB merged limit -> reject invalid_argument, coalesced ~30 Hz),
 *   peers() frozen snapshot (identity stable until change), onPeers (first delivery async; joined/left/updated per frame),
 *   connected()/onConnection, leave(). Leaves are detected via 'bye' (leave/pagehide) or 3 s keepalive timeout.
 * Test hooks: window.__fakeRoom = {stats:{maxBytes, rejects, sends}, opts:{nullNamespace, neverConnect}} */
(function () {
  'use strict';
  var LIMIT = 4096;
  var me = 'p' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  var stats = { maxBytes: 0, rejects: 0, sends: 0, lastBytes: 0 };
  var hook = window.__fakeRoom = { stats: stats, peer: me, opts: window.__fakeRoomOpts || {} };
  function bytes(o) { return new TextEncoder().encode(JSON.stringify(o)).length; }
  function err(code, message) { var e = new Error(message || code); e.code = code; return e; }
  function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (var k in o) deepFreeze(o[k]); } return o; }

  function makeRoom(name) {
    var bc = new BroadcastChannel('fake-room-' + name);
    var mine = {}, others = {};        // peer -> {presence, updatedAt, seen}
    var snapshot = Object.freeze([]), dirty = true, alive = true, connected = false;
    var peerListeners = [], connListeners = [], pendingChange = { joined: {}, left: {}, updated: {} }, deliverScheduled = false;
    var sendTimer = null, lastSend = 0, keep = null, firstDelivered = false;
    var myPresence = Object.freeze({}), myUpdated = Date.now();

    function peerObj(id, pres, upd, isMe) {
      return Object.freeze({ peer: id, by: null, isMe: !!isMe, sameTab: !!isMe, kind: 'viewer', guest: false, presence: pres, updatedAt: upd });
    }
    var myObj = peerObj(me, myPresence, myUpdated, true);
    var objs = {};
    function rebuild() {
      if (!dirty) return snapshot;
      var list = [myObj];
      Object.keys(others).sort().forEach(function (id) { list.push(objs[id]); });
      snapshot = Object.freeze(list); dirty = false;
      return snapshot;
    }
    function schedule() {
      if (deliverScheduled || !alive) return;
      deliverScheduled = true;
      setTimeout(function () {
        deliverScheduled = false;
        if (!alive) return;
        var peers = rebuild();
        var ch = {
          peers: peers,
          joined: Object.freeze(Object.keys(pendingChange.joined).map(function (id) { return id === me ? myObj : objs[id]; }).filter(Boolean)),
          left: Object.freeze(Object.keys(pendingChange.left).map(function (id) { return pendingChange.left[id]; })),
          updated: Object.freeze(Object.keys(pendingChange.updated).map(function (id) { return id === me ? myObj : objs[id]; }).filter(Boolean))
        };
        pendingChange = { joined: {}, left: {}, updated: {} };
        peerListeners.slice().forEach(function (l) { try { l(ch); } catch (e) { setTimeout(function () { throw e; }); } });
      }, 16);
    }
    function upsert(id, pres) {
      var now = Date.now(), o = others[id], fresh = !o;
      if (!o) o = others[id] = { presence: Object.freeze({}), updatedAt: now, seen: now };
      o.seen = now;
      var changed = JSON.stringify(o.presence) !== JSON.stringify(pres || {});
      if (fresh || changed) {
        if (changed) { o.presence = deepFreeze(JSON.parse(JSON.stringify(pres || {}))); o.updatedAt = now; }
        objs[id] = peerObj(id, o.presence, o.updatedAt, false);
        dirty = true;
        if (fresh) pendingChange.joined[id] = 1; else if (!pendingChange.joined[id]) pendingChange.updated[id] = 1;
        schedule();
      }
    }
    function drop(id) {
      if (!others[id]) return;
      var gone = objs[id];
      delete others[id]; delete objs[id]; dirty = true;
      if (pendingChange.joined[id]) delete pendingChange.joined[id]; else pendingChange.left[id] = gone;
      delete pendingChange.updated[id];
      schedule();
    }
    function post(m) { if (alive) try { bc.postMessage(m); } catch (e) {} }
    function sendNow() { sendTimer = null; lastSend = Date.now(); stats.sends++; post({ k: 'pres', from: me, pres: myPresence }); }
    function queueSend() {
      if (sendTimer) return;
      var wait = Math.max(0, 33 - (Date.now() - lastSend));
      sendTimer = setTimeout(sendNow, wait);
    }
    bc.onmessage = function (e) {
      var m = e.data; if (!m || m.from === me || !alive) return;
      if (m.k === 'hello') { upsert(m.from, m.pres); post({ k: 'pres', from: me, pres: myPresence }); }
      else if (m.k === 'pres' || m.k === 'keep') { if (m.k === 'keep' && others[m.from]) others[m.from].seen = Date.now(); else upsert(m.from, m.pres); }
      else if (m.k === 'bye') drop(m.from);
    };
    function bye() { post({ k: 'bye', from: me }); }
    window.addEventListener('pagehide', bye);
    keep = setInterval(function () {
      post({ k: 'keep', from: me });
      var now = Date.now();
      Object.keys(others).forEach(function (id) { if (now - others[id].seen > 3000) drop(id); });
    }, 700);
    setTimeout(function () {
      if (hook.opts.neverConnect) return;
      connected = true; post({ k: 'hello', from: me, pres: myPresence });
      connListeners.forEach(function (l) { try { l(true); } catch (e) {} });
    }, 60);
    pendingChange.joined[me] = 1;

    var api = {
      name: name,
      presence: function (patch) {
        if (!alive) return Promise.reject(err('invalid_argument', 'left'));
        if (!patch || typeof patch !== 'object') return Promise.reject(err('invalid_argument', 'patch must be an object'));
        var next = Object.assign({}, myPresence);
        for (var k in patch) { if (patch[k] === null) delete next[k]; else next[k] = patch[k]; }
        var n;
        try { n = bytes(next); } catch (e) { return Promise.reject(err('invalid_argument', 'not JSON')); }
        if (n > LIMIT) { stats.rejects++; return Promise.reject(err('invalid_argument', 'presence would be ' + n + ' bytes; the limit is 4096')); }
        stats.lastBytes = n; if (n > stats.maxBytes) stats.maxBytes = n;
        myPresence = deepFreeze(JSON.parse(JSON.stringify(next))); myUpdated = Date.now();
        myObj = peerObj(me, myPresence, myUpdated, true); dirty = true;
        pendingChange.updated[me] = 1; schedule();
        if (connected) queueSend();
        return Promise.resolve();
      },
      peers: function () { return rebuild(); },
      onPeers: function (h, onErr) {
        if (typeof h !== 'function') throw new TypeError('handler');
        peerListeners.push(h);
        if (!firstDelivered) { firstDelivered = true; }
        // first delivery for this listener: everyone so far as joined
        setTimeout(function () {
          if (!alive || peerListeners.indexOf(h) < 0) return;
          var p = rebuild();
          try { h({ peers: p, joined: p, left: Object.freeze([]), updated: Object.freeze([]) }); } catch (e) { setTimeout(function () { throw e; }); }
        }, 0);
        return function () { var i = peerListeners.indexOf(h); if (i >= 0) peerListeners.splice(i, 1); };
      },
      connected: function () { return connected && alive; },
      onConnection: function (h) { connListeners.push(h); setTimeout(function () { if (alive) h(connected); }, 0); return function () { var i = connListeners.indexOf(h); if (i >= 0) connListeners.splice(i, 1); }; },
      emit: function () { return Promise.reject(err('not_permitted', 'event topics are admin-only')); },
      on: function () { return function () {}; },
      leave: function () {
        if (!alive) return Promise.resolve();
        bye(); alive = false; clearInterval(keep); clearTimeout(sendTimer); window.removeEventListener('pagehide', bye);
        peerListeners = []; connListeners = [];
        try { bc.close(); } catch (e) {}
        delete rooms[name];
        return Promise.resolve();
      }
    };
    return Object.freeze(api);
  }

  var rooms = {};
  var ns = Object.freeze({
    join: function (name) {
      if (!/^[a-z0-9][a-z0-9_.-]{0,47}$/.test(name)) return Promise.reject(err('invalid_argument', 'bad room name'));
      if (!rooms[name]) rooms[name] = makeRoom(name);
      var r = rooms[name];
      return new Promise(function (res) { setTimeout(function () { res(r); }, 30); });
    },
    presence: function () { return Promise.resolve(); },
    peers: function () { return Object.freeze([]); },
    onPeers: function () { return function () {}; },
    connected: function () { return true; },
    onConnection: function (h) { setTimeout(function () { h(true); }, 0); return function () {}; },
    emit: function () { return Promise.reject(err('not_permitted')); },
    on: function () { return function () {}; }
  });
  var claude = Object.freeze({
    use: function (name) {
      if (name !== 'room' || hook.opts.nullNamespace) return Promise.resolve(null);
      return new Promise(function (res) { setTimeout(function () { res(ns); }, 20); });
    }
  });
  Object.defineProperty(window, 'claude', { value: claude, configurable: false, writable: false });
})();
