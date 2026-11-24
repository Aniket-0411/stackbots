/* STACKBOTS netcode transports (SPEC §10.2-§10.3).
 * One interface, three implementations: 'room' (claude.ai artifact presence), 'peer' (PeerJS/WebRTC), 'tabs' (BroadcastChannel).
 *   t.hostStart(code, name) -> Promise<code>     (code may change on collision)
 *   t.joinStart(code, name) -> Promise<void>     (rejects with Error(user-facing message))
 *   t.onMsg(msg)            host receives {t:'hello'|'in'|'bye', id,...}; guest receives {t:'welcome'|'full'|'st'|'hostgone'}
 *   t.toGuest(id, msg) / t.broadcast(msg)   host only
 *   t.toHost(msg)                           guest only
 *   t.onStatus(ok)          optional connectivity indicator
 *   t.close()
 * The game session logic (slots, snapshots, restarts) lives in main.js. */
(function () {
  'use strict';
  var SB = globalThis.SB = globalThis.SB || {};
  var ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var PEER_URLS = ['https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'];
  var PRESENCE_MAX = 4000; // bytes; platform limit is 4 KiB for the merged object

  function genCode() { var s = ''; for (var i = 0; i < 5; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
  function cleanCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0').split('').filter(function (ch) { return ALPHA.indexOf(ch) >= 0; }).join('').slice(0, 5); }
  function rid() { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6); }
  function bytes(o) { var s = JSON.stringify(o); try { return new TextEncoder().encode(s).length; } catch (e) { return s.length * 2; } }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function noop() {}
  function base(kind) { return { kind: kind, onMsg: noop, onStatus: noop, isHost: false, myId: null, code: null }; }
  function isArtifact() { try { return !!(window.claude && typeof window.claude.use === 'function'); } catch (e) { return false; } }

  // =====================================================================================
  // 1) BroadcastChannel tabs (same browser) — local testing
  // =====================================================================================
  function TabsTransport() {
    var t = base('tabs'), bc = null, alive = true, hostSeen = 0, watch = null, guests = {};
    function open(code) {
      if (typeof BroadcastChannel === 'undefined') throw new Error('This browser has no BroadcastChannel, so tab play is unavailable.');
      bc = new BroadcastChannel('stackbots-' + code);
    }
    function post(o) { try { if (bc && alive) bc.postMessage(o); } catch (e) {} }
    t.hostStart = function (code, name) {
      t.isHost = true;
      return (async function () {
        for (var tries = 0; tries < 6; tries++) {
          open(code);
          var taken = false;
          bc.onmessage = function (e) { var m = e.data; if (m && m.t === 'st') taken = true; if (m && m.t === 'probe-ack') taken = true; };
          post({ t: 'probe' });
          await delay(350);
          if (!taken) break;
          try { bc.close(); } catch (e) {}
          code = genCode();
        }
        t.code = code;
        bc.onmessage = function (e) {
          var m = e.data; if (!m || !alive) return;
          if (m.t === 'probe') { post({ t: 'probe-ack' }); return; }
          if (m.t === 'hello' || m.t === 'in' || m.t === 'bye') {
            if (m.t === 'hello') guests[m.id] = Date.now();
            else if (guests[m.id]) guests[m.id] = Date.now();
            if (m.t === 'bye') delete guests[m.id];
            t.onMsg(m);
          }
        };
        watch = setInterval(function () { // guests send `in` at least every 250 ms; 4 s silence = gone
          var now = Date.now();
          for (var id in guests) if (now - guests[id] > 4000) { delete guests[id]; t.onMsg({ t: 'bye', id: id, timeout: true }); }
        }, 500);
        window.addEventListener('pagehide', bye);
        return code;
      })();
    };
    function bye() { if (t.isHost) post({ t: 'hostbye' }); else if (t.myId) post({ t: 'bye', id: t.myId }); }
    t.joinStart = function (code, name) {
      t.myId = 'g' + rid();
      return new Promise(function (resolve, reject) {
        try { open(code); } catch (e) { reject(e); return; }
        t.code = code;
        var ok = false;
        bc.onmessage = function (e) {
          var m = e.data; if (!m || !alive) return;
          if (m.t === 'st') { hostSeen = Date.now(); if (ok) t.onMsg(m); return; }
          if (m.t === 'hostbye') { t.onMsg({ t: 'hostgone' }); return; }
          if ((m.t === 'welcome' || m.t === 'full') && m.id === t.myId) {
            if (!ok) { ok = true; hostSeen = Date.now(); resolve(); }
            t.onMsg(m);
          }
        };
        post({ t: 'hello', id: t.myId, name: name, v: 1 });
        var again = setInterval(function () { if (ok || !alive) { clearInterval(again); return; } post({ t: 'hello', id: t.myId, name: name, v: 1 }); }, 700);
        setTimeout(function () { if (!ok) { clearInterval(again); reject(new Error('No game found with code ' + code + ' in this browser.')); } }, 3500);
        watch = setInterval(function () { if (ok && alive && Date.now() - hostSeen > 5000) { clearInterval(watch); t.onMsg({ t: 'hostgone' }); } }, 500);
        window.addEventListener('pagehide', bye);
      });
    };
    t.toGuest = function (id, m) { m.id = id; post(m); };
    t.broadcast = function (m) { post(m); };
    t.toHost = function (m) { post(m); };
    t.close = function () { if (!alive) return; bye(); alive = false; clearInterval(watch); window.removeEventListener('pagehide', bye); try { bc && bc.close(); } catch (e) {} };
    return t;
  }

  // =====================================================================================
  // 2) PeerJS (WebRTC) — standalone build
  // =====================================================================================
  var peerLoad = null;
  function PeerCtor() { return window.Peer || (window.peerjs && window.peerjs.Peer) || null; }
  function loadPeer() {
    if (PeerCtor()) return Promise.resolve(PeerCtor());
    if (peerLoad) return peerLoad;
    peerLoad = (async function () {
      for (var i = 0; i < PEER_URLS.length; i++) {
        try {
          await new Promise(function (res, rej) {
            var s = document.createElement('script'); s.src = PEER_URLS[i]; s.async = true; s.crossOrigin = 'anonymous';
            var to = setTimeout(function () { rej(new Error('timeout')); }, 9000);
            s.onload = function () { clearTimeout(to); res(); }; s.onerror = function () { clearTimeout(to); rej(new Error('load')); };
            document.head.appendChild(s);
          });
          if (PeerCtor()) return PeerCtor();
        } catch (e) {}
      }
      peerLoad = null;
      throw new Error('Could not load the online-play library (PeerJS). Check your internet connection, or try Local Play.');
    })();
    return peerLoad;
  }
  function PeerTransport() {
    var t = base('peer'), peer = null, conns = {}, alive = true, hostConn = null, hostSeen = 0, watch = null;
    function peerErrMsg(err) {
      var ty = err && err.type;
      if (ty === 'peer-unavailable') return 'No game found with that code. Check the code and make sure the host is still in the lobby.';
      if (ty === 'browser-incompatible') return 'This browser does not support WebRTC, so online play is unavailable here.';
      if (ty === 'network' || ty === 'server-error' || ty === 'socket-error' || ty === 'socket-closed') return 'Could not reach the online-play server. Check your connection and try again.';
      return 'Online connection failed' + (ty ? ' (' + ty + ')' : '') + '.';
    }
    t.hostStart = function (code, name) {
      t.isHost = true;
      return (async function () {
        var P = await loadPeer();
        for (var tries = 0; tries < 6; tries++) {
          var res = await new Promise(function (resolve) {
            var p;
            try { p = new P('stackbots-v1-' + code, { debug: 0 }); } catch (e) { resolve({ err: { type: 'init', message: e.message } }); return; }
            var to = setTimeout(function () { resolve({ err: { type: 'network' }, p: p }); }, 15000);
            p.on('open', function () { clearTimeout(to); resolve({ p: p }); });
            p.on('error', function (err) { clearTimeout(to); resolve({ err: err, p: p }); });
          });
          if (!res.err) { peer = res.p; break; }
          try { res.p && res.p.destroy(); } catch (e) {}
          if (res.err.type === 'unavailable-id') { code = genCode(); continue; }
          throw new Error(peerErrMsg(res.err));
        }
        if (!peer) throw new Error('Could not reserve a room code. Please try again.');
        t.code = code;
        peer.on('connection', function (c) {
          c.on('data', function (m) {
            if (!m || typeof m !== 'object' || !alive) return;
            if (m.t === 'hello') { c._sbId = m.id; conns[m.id] = c; c._seen = Date.now(); t.onMsg(m); }
            else if (m.t === 'in' || m.t === 'bye') { c._seen = Date.now(); if (c._sbId) t.onMsg(m); }
          });
          c.on('close', function () { if (c._sbId && conns[c._sbId] === c) { delete conns[c._sbId]; t.onMsg({ t: 'bye', id: c._sbId }); } });
          c.on('error', function () {});
        });
        peer.on('disconnected', function () { t.onStatus(false); try { peer.reconnect(); } catch (e) {} });
        peer.on('open', function () { t.onStatus(true); });
        peer.on('error', function () {});
        watch = setInterval(function () {
          var now = Date.now();
          for (var id in conns) if (now - (conns[id]._seen || now) > 5000) { var c = conns[id]; delete conns[id]; try { c.close(); } catch (e) {} t.onMsg({ t: 'bye', id: id, timeout: true }); }
        }, 1000);
        return code;
      })();
    };
    t.joinStart = function (code, name) {
      t.myId = t.myId || ('g' + rid());
      return (async function () {
        var P = await loadPeer();
        await new Promise(function (resolve, reject) {
          var done = false;
          function fail(msg) { if (done) return; done = true; reject(new Error(msg)); }
          try { peer = new P({ debug: 0 }); } catch (e) { fail('Online play is unavailable in this browser.'); return; }
          var to = setTimeout(function () { fail('Timed out connecting to the host. Check the code and try again.'); }, 20000);
          peer.on('error', function (err) { if (!done) { clearTimeout(to); fail(peerErrMsg(err)); } else if (err && err.type === 'peer-unavailable') t.onMsg({ t: 'hostgone' }); });
          peer.on('open', function () {
            var c = peer.connect('stackbots-v1-' + code, { serialization: 'json', reliable: true });
            hostConn = c;
            c.on('open', function () { c.send({ t: 'hello', id: t.myId, name: name, v: 1 }); });
            c.on('data', function (m) {
              if (!m || typeof m !== 'object' || !alive) return;
              hostSeen = Date.now();
              if ((m.t === 'welcome' || m.t === 'full') && m.id === t.myId) { if (!done) { done = true; clearTimeout(to); resolve(); } t.onMsg(m); }
              else if (m.t === 'st' && done) t.onMsg(m);
            });
            c.on('close', function () { if (alive && done) t.onMsg({ t: 'hostgone' }); });
            c.on('error', function () {});
          });
        });
        t.code = code;
        watch = setInterval(function () { if (alive && Date.now() - hostSeen > 6000) { clearInterval(watch); t.onMsg({ t: 'hostgone' }); } }, 1000);
      })();
    };
    function send(c, m) { try { if (c && c.open) c.send(m); } catch (e) {} }
    t.toGuest = function (id, m) { m.id = id; send(conns[id], m); };
    t.broadcast = function (m) { for (var id in conns) send(conns[id], m); };
    t.toHost = function (m) { send(hostConn, m); };
    t.close = function () {
      if (!alive) return;
      if (!t.isHost && hostConn) send(hostConn, { t: 'bye', id: t.myId });
      alive = false; clearInterval(watch);
      setTimeout(function () { try { for (var id in conns) conns[id].close(); } catch (e) {} try { peer && peer.destroy(); } catch (e) {} }, 60);
    };
    return t;
  }

  // =====================================================================================
  // 3) claude.ai room (artifact) — presence only
  // =====================================================================================
  var roomNs = null;
  function getRoom() {
    if (!roomNs) roomNs = (async function () {
      if (!isArtifact()) return null;
      try { return await window.claude.use('room'); } catch (e) { return null; }
    })();
    return roomNs;
  }
  var ROOM_UNAVAILABLE = 'Online play is not available in this view. Open the artifact signed in on claude.ai, or try Local Play.';
  function RoomTransport() {
    var t = base('room'), r = null, alive = true, unsubs = [], name = '';
    var sl = {}, fu = {}, known = {}, lastPres = {}, hostLabel = null, welcomed = null, lastQ = -1, seenHost = false;
    function errText(e) {
      var c = e && e.code;
      if (c === 'not_permitted') return 'Your account cannot use online rooms in this artifact.';
      if (c === 'limit_reached') return 'Too many rooms are open right now. Close another game tab and retry.';
      if (c === 'not_granted' || c === 'revoked' || c === 'capability_disabled' || c === 'capability_removed') return ROOM_UNAVAILABLE;
      return 'Could not connect to the room. Please try again.';
    }
    async function enter(code) {
      var ns = await getRoom();
      if (!ns) throw new Error(ROOM_UNAVAILABLE);
      try { r = await ns.join('sb-' + code.toLowerCase()); } catch (e) { throw new Error(errText(e)); }
      t.code = code;
      unsubs.push(r.onConnection(function (ok) { if (alive) t.onStatus(!!ok); }, function (e) { if (alive) t.onMsg(t.isHost ? { t: 'fatal', msg: errText(e) } : { t: 'hostgone', msg: errText(e) }); }));
    }
    function me() { var ps = r.peers(); for (var i = 0; i < ps.length; i++) if (ps[i].sameTab) return ps[i].peer; return null; }
    function pres(patch) {
      try { var p = r.presence(patch); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
    // ---------- host ----------
    function hostScan(change) {
      if (!alive) return;
      var ps = r.peers(), present = {};
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i]; if (p.sameTab || p.kind === 'agent') continue;
        var pr = p.presence || {};
        if (pr.sb !== 1 || pr.role !== 'guest') continue;
        var id = p.peer; present[id] = 1;
        if (!known[id]) { known[id] = 1; t.onMsg({ t: 'hello', id: id, name: String(pr.n || 'Bot').slice(0, 14), v: 1 }); }
        if (lastPres[id] !== pr) {
          lastPres[id] = pr;
          var a = Array.isArray(pr.in) ? pr.in : [0, 0, 0, 0];
          t.onMsg({ t: 'in', id: id, b: a[0] | 0, jc: a[1] | 0, uc: a[2] | 0, rc: a[3] | 0, ts: a[4] == null ? undefined : a[4] | 0 });
        }
      }
      for (var k in known) if (!present[k]) { delete known[k]; delete lastPres[k]; delete sl[k]; delete fu[k]; t.onMsg({ t: 'bye', id: k }); }
    }
    t.hostStart = function (code, nm) {
      t.isHost = true; name = nm;
      return (async function () {
        for (var tries = 0; tries < 5; tries++) {
          await enter(code);
          await delay(900); // let the room answer, then check nobody else hosts this code
          var clash = r.peers().some(function (p) { return !p.sameTab && p.presence && p.presence.sb === 1 && p.presence.role === 'host'; });
          if (!clash) break;
          try { await r.leave(); } catch (e) {}
          unsubs.forEach(function (u) { try { u(); } catch (e) {} }); unsubs = [];
          code = genCode();
        }
        pres({ sb: 1, role: 'host', n: name, st: null });
        unsubs.push(r.onPeers(hostScan, function (e) { if (alive) t.onMsg({ t: 'fatal', msg: errText(e) }); }));
        t.poll = hostScan;
        return code;
      })();
    };
    t.toGuest = function (id, m) { if (m.t === 'welcome') { sl[id] = m.slot; delete fu[id]; } else if (m.t === 'full') fu[id] = 1; };
    t.broadcast = function (m) {
      if (!r || !alive || m.t !== 'st') return;
      var meta = Object.assign({}, m.m, { sl: sl });
      var f = Object.keys(fu); if (f.length) meta.fu = f;
      var st = { m: meta, s: m.s, q: m.q };
      var obj = { sb: 1, role: 'host', n: name, st: st };
      if (bytes(obj) > PRESENCE_MAX) { // trim: drop message text, then snapshot event lists, then the snapshot itself
        delete meta.msg;
        if (st.s && typeof st.s === 'object') {
          var s2 = Object.assign({}, st.s); ['v', 'ev', 'events'].forEach(function (k) { delete s2[k]; }); st.s = s2;
        }
        if (bytes(obj) > PRESENCE_MAX) st.s = null;
        t.trimmed = (t.trimmed || 0) + 1;
      }
      pres({ st: st });
    };
    // ---------- guest ----------
    function guestScan(change) {
      if (!alive) return;
      var myLabel = me(); if (myLabel) t.myId = myLabel;
      var ps = r.peers(), host = null;
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i]; if (p.sameTab || p.kind === 'agent') continue;
        if (p.presence && p.presence.sb === 1 && p.presence.role === 'host') { if (!host || p.peer === hostLabel) host = p; }
      }
      if (!host) {
        if (seenHost && change && change.left && change.left.some(function (p) { return p.peer === hostLabel; })) { seenHost = false; t.onMsg({ t: 'hostgone' }); }
        return;
      }
      hostLabel = host.peer; seenHost = true;
      var st = host.presence.st; if (!st || !st.m) return;
      if (st.q === lastQ) return;
      lastQ = st.q;
      if (t.myId && st.m.fu && st.m.fu.indexOf(t.myId) >= 0) { t.onMsg({ t: 'full', id: t.myId }); return; }
      var slot = st.m.sl && t.myId ? st.m.sl[t.myId] : undefined;
      if (slot != null && welcomed !== slot) { welcomed = slot; t.onMsg({ t: 'welcome', id: t.myId, slot: slot }); }
      if (welcomed != null) t.onMsg({ t: 'st', m: st.m, s: st.s, q: st.q });
    }
    t.joinStart = function (code, nm) {
      name = nm;
      return (async function () {
        await enter(code);
        pres({ sb: 1, role: 'guest', n: name, in: [0, 0, 0, 0] });
        var res = await new Promise(function (resolve) {
          var settled = false;
          var origMsg = t.onMsg;
          t.onMsg = function (m) { if (!settled && (m.t === 'welcome' || m.t === 'full')) { settled = true; resolve('ok'); } origMsg(m); };
          unsubs.push(r.onPeers(guestScan, function (e) { if (alive) t.onMsg({ t: 'hostgone', msg: errText(e) }); }));
          t.poll = guestScan;
          setTimeout(function () { if (!settled) { settled = true; resolve(seenHost ? 'nowelcome' : 'nohost'); } }, 9000);
        });
        if (res !== 'ok') { t.close(); throw new Error(res === 'nohost' ? 'No game found with code ' + code + '. Ask the host for the code shown in their lobby.' : 'The host did not answer. Try again.'); }
      })();
    };
    t.toHost = function (m) {
      if (!r || !alive) return;
      if (m.t === 'in') { var a = [m.b | 0, m.jc | 0, m.uc | 0, m.rc | 0], k = a.join(','); if (k !== t.lastIn || (m.ts | 0) - (t.lastTs | 0) > 30) { t.lastIn = k; t.lastTs = m.ts | 0; a.push(m.ts | 0); pres({ in: a }); } }
    };
    t.close = function () {
      if (!alive) return; alive = false;
      unsubs.forEach(function (u) { try { u(); } catch (e) {} }); unsubs = [];
      if (r) { try { var p = r.leave(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    };
    // wrap onMsg setter so joinStart's interception keeps working when main.js assigns after construction
    return t;
  }

  // =====================================================================================
  // 4) Relay — MQTT 3.1.1 over secure WebSocket through several free public brokers.
  //    No accounts, no WebRTC; works wherever the page can open a wss:// connection.
  //    Host listens on stackbots/v1/<CODE>/h on every broker it can reach; each guest says hello on
  //    every broker it reaches and the host answers on whichever hello arrived first.
  // =====================================================================================
  var RELAYS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  function relayUrls() { try { if (Array.isArray(window.__SB_RELAYS)) return window.__SB_RELAYS.slice(); } catch (e) {} return RELAYS.slice(); }
  var NET_FAIL = 'Could not reach any online-play server. If you opened the game inside a preview window, save the file to your computer and open it in your browser (or put it on a website) instead. School and office networks sometimes block online games; home Wi-Fi or a phone hotspot usually works.';
  var enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  var dec = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
  function mqStr(str) { var b = enc.encode(str), o = new Uint8Array(2 + b.length); o[0] = (b.length >> 8) & 255; o[1] = b.length & 255; o.set(b, 2); return o; }
  function mqPacket(head, parts) {
    var len = 0, i; for (i = 0; i < parts.length; i++) len += parts[i].length;
    var lb = [], x = len; do { var d = x % 128; x = Math.floor(x / 128); if (x > 0) d |= 128; lb.push(d); } while (x > 0);
    var out = new Uint8Array(1 + lb.length + len), o = 1 + lb.length; out[0] = head; out.set(lb, 1);
    for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }
  function firstOf(ps) {
    return new Promise(function (res, rej) {
      var left = ps.length; if (!left) { rej(new Error('none')); return; }
      ps.forEach(function (p) { p.then(res, function () { if (--left === 0) rej(new Error('all failed')); }); });
    });
  }
  /** One broker connection with automatic reconnect (once it has worked). opts: {subs, onMsg(topic, text, link), onChange()} */
  function MqttLink(url, opts) {
    var L = { url: url, up: false, closed: false, everUp: false }, ws = null, pid = 1, ping = null, backoff = 1000, first = null;
    L.ready = new Promise(function (res, rej) { first = { res: res, rej: rej }; });
    L.ready.catch(noop);
    function connect() {
      if (L.closed) return;
      var me, buf = new Uint8Array(0), gone = false;
      try { me = ws = new WebSocket(url, ['mqtt']); } catch (e) { down(); return; }
      me.binaryType = 'arraybuffer';
      var to = setTimeout(function () { if (!L.up) { try { me.close(); } catch (e) {} down(); } }, 8000);
      me.onopen = function () {
        var cid = 'sb' + rid().slice(0, 18);
        try { me.send(mqPacket(0x10, [mqStr('MQTT'), new Uint8Array([4, 2, 0, 45]), mqStr(cid)])); } catch (e) {}
      };
      me.onmessage = function (e) {
        if (typeof e.data === 'string') return;
        var d = new Uint8Array(e.data), nb = new Uint8Array(buf.length + d.length); nb.set(buf); nb.set(d, buf.length); buf = nb;
        while (buf.length >= 2) {
          var mul = 1, len = 0, i = 1, b;
          do { if (i >= buf.length) return; b = buf[i++]; len += (b & 127) * mul; mul *= 128; } while (b & 128);
          if (buf.length < i + len) return;
          var type = buf[0] >> 4, flags = buf[0] & 15, body = buf.subarray(i, i + len);
          buf = buf.slice(i + len);
          if (type === 2) { // CONNACK
            if (body[1] !== 0) { try { me.close(); } catch (e2) {} return; }
            clearTimeout(to);
            (opts.subs || []).forEach(function (tp) { var id = pid; pid = pid % 65535 + 1; try { me.send(mqPacket(0x82, [new Uint8Array([id >> 8, id & 255]), mqStr(tp), new Uint8Array([0])])); } catch (e3) {} });
            L.up = true; L.everUp = true; backoff = 1000;
            clearInterval(ping); ping = setInterval(function () { try { me.send(new Uint8Array([0xC0, 0])); } catch (e4) {} }, 20000);
            if (first) { first.res(L); first = null; }
            if (opts.onChange) opts.onChange(L);
          } else if (type === 3) { // PUBLISH
            var tl = (body[0] << 8) | body[1], off = 2 + tl;
            if ((flags >> 1) & 3) off += 2;
            var tp2 = dec.decode(body.subarray(2, 2 + tl)), text = dec.decode(body.subarray(off));
            try { opts.onMsg(tp2, text, L); } catch (e5) {}
          }
        }
      };
      me.onclose = me.onerror = function () { clearTimeout(to); down(); };
      function down() {
        if (gone) return; gone = true;
        if (ws === me) { var was = L.up; L.up = false; clearInterval(ping); if (was && opts.onChange) opts.onChange(L); }
        if (first) { first.rej(new Error('unreachable')); first = null; }
        if (!L.closed && L.everUp) { setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 8000); }
      }
    }
    L.pub = function (topic, text, droppable) {
      if (!L.up || !ws) return false;
      if (droppable && ws.bufferedAmount > 200000) return false;
      try { ws.send(mqPacket(0x30, [mqStr(topic), enc.encode(text)])); return true; } catch (e) { return false; }
    };
    L.close = function () {
      if (L.closed) return; L.closed = true; clearInterval(ping);
      var w = ws; L.up = false;
      if (first) { first.rej(new Error('closed')); first = null; }
      try { if (w && w.readyState === 1) w.send(new Uint8Array([0xE0, 0])); } catch (e) {}
      setTimeout(function () { try { w && w.close(); } catch (e) {} }, 30);
    };
    connect();
    return L;
  }
  function RelayTransport() {
    var t = base('relay'), alive = true, links = [], owner = {}, seen = {}, hostLink = null, hostSeen = 0, watch = null, lastQ = -1, welcomed = false, helloTimer = null, myName = '';
    function tpc(k) { return 'stackbots/v1/' + t.code + '/' + k; }
    function parse(text) { try { var m = JSON.parse(text); return m && typeof m === 'object' ? m : null; } catch (e) { return null; } }
    function status() { t.onStatus(links.some(function (L) { return L.up; })); }
    function openAll(sub, onMsg) {
      links = relayUrls().map(function (u) { return MqttLink(u, { subs: [tpc(sub)], onMsg: onMsg, onChange: function (L) { status(); if (L.up && t.onLinkUp) t.onLinkUp(L); } }); });
      return firstOf(links.map(function (L) { return L.ready; }));
    }
    function closeLinks(list) { (list || links).forEach(function (L) { try { L.close(); } catch (e) {} }); }
    // ---------- host ----------
    function hostIn(tp, text, L) {
      if (!alive) return;
      var m = parse(text); if (!m || typeof m.id !== 'string' || m.id.length > 40) return;
      if (m.t === 'hello') {
        if (owner[m.id] && owner[m.id] !== L) return;
        owner[m.id] = L; seen[m.id] = Date.now();
        t.onMsg({ t: 'hello', id: m.id, name: String(m.name || 'Bot').slice(0, 14), v: m.v });
      } else if ((m.t === 'in' || m.t === 'bye') && owner[m.id] === L) {
        seen[m.id] = Date.now();
        if (m.t === 'bye') { delete owner[m.id]; delete seen[m.id]; }
        t.onMsg(m);
      }
    }
    t.hostStart = function (code, name) {
      t.isHost = true; t.code = code;
      return (async function () {
        try { await openAll('h', hostIn); } catch (e) { closeLinks(); throw new Error(NET_FAIL); }
        watch = setInterval(function () {
          var now = Date.now();
          for (var id in owner) if (now - seen[id] > 5000) { delete owner[id]; delete seen[id]; t.onMsg({ t: 'bye', id: id, timeout: true }); }
        }, 1000);
        return code;
      })();
    };
    t.toGuest = function (id, m) { m.id = id; var L = owner[id]; if (L) L.pub(tpc('g'), JSON.stringify(m)); };
    t.broadcast = function (m) {
      var used = {}, s = null;
      for (var id in owner) { var L = owner[id]; if (used[L.url]) continue; used[L.url] = 1; s = s || JSON.stringify(m); L.pub(tpc('g'), s, m.t === 'st'); }
    };
    // ---------- guest ----------
    t.hold = false;
    function hello() {
      if (!alive || welcomed || t.hold) return;
      var s = JSON.stringify({ t: 'hello', id: t.myId, name: myName, v: 1 });
      links.forEach(function (L) { L.pub(tpc('h'), s); });
    }
    t.releaseHello = function () { if (t.hold) { t.hold = false; hello(); } };
    t.joinStart = function (code, name) {
      t.myId = t.myId || ('g' + rid()); t.code = code; myName = name;
      return new Promise(function (resolve, reject) {
        var done = false, nf = null;
        function finish(err) {
          if (done) return; done = true; clearInterval(helloTimer); clearTimeout(nf);
          if (err) { closeLinks(); reject(err); } else resolve();
        }
        function guestIn(tp, text, L) {
          if (!alive) return;
          var m = parse(text); if (!m) return;
          if ((m.t === 'welcome' || m.t === 'full') && m.id === t.myId) {
            if (!hostLink) { hostLink = L; closeLinks(links.filter(function (o) { return o !== L; })); links = [L]; }
            if (L !== hostLink) return;
            welcomed = true; hostSeen = Date.now(); finish(null); t.onMsg(m); return;
          }
          if (L !== hostLink) return;
          if (m.t === 'st') { hostSeen = Date.now(); if (typeof m.q === 'number') { if (m.q <= lastQ) return; lastQ = m.q; } t.onMsg(m); }
          else if (m.t === 'hostbye') t.onMsg({ t: 'hostgone' });
        }
        t.onLinkUp = function () { hello(); };
        var nfMsg = 'No game found with code ' + code + '. Ask the host for the code shown in their lobby.';
        openAll('g', guestIn).then(function () { hello(); clearTimeout(nf); if (!done) nf = setTimeout(function () { finish(new Error(nfMsg)); }, 8000); }, function () { finish(new Error(NET_FAIL)); });
        helloTimer = setInterval(hello, 1000);
        nf = setTimeout(function () { finish(new Error(nfMsg)); }, 15000);
        watch = setInterval(function () { if (alive && welcomed && Date.now() - hostSeen > 6000) { clearInterval(watch); t.onMsg({ t: 'hostgone' }); } }, 1000);
      });
    };
    t.toHost = function (m) { if (hostLink) hostLink.pub(tpc('h'), JSON.stringify(m)); };
    t.close = function () {
      if (!alive) return; alive = false; clearInterval(watch); clearInterval(helloTimer);
      if (t.isHost) { var s = JSON.stringify({ t: 'hostbye' }); links.forEach(function (L) { L.pub(tpc('g'), s); }); }
      else if (hostLink && welcomed) hostLink.pub(tpc('h'), JSON.stringify({ t: 'bye', id: t.myId }));
      var list = links.slice(); setTimeout(function () { closeLinks(list); }, 80);
    };
    return t;
  }

  // =====================================================================================
  // 5) Online (auto) — standalone default. Runs PeerJS (direct WebRTC) and the relay side by side.
  //    Host is reachable through both; a guest prefers a direct link and falls back to the relay.
  //    Each guest id belongs to whichever route its first hello arrived on.
  // =====================================================================================
  function isNotFound(e) { return !!(e && /No game found/.test(e.message || '')); }
  function OnlineTransport() {
    var t = base('online'), alive = true, subs = [], owner = {}, winner = null;
    function status() { t.onStatus(true); }
    t.hostStart = function (code, name) {
      t.isHost = true;
      var cands = [RelayTransport(), PeerTransport()];
      return new Promise(function (resolve, reject) {
        var left = cands.length, done = false, errs = [];
        cands.forEach(function (s) {
          s.onStatus = status;
          s.onMsg = function (m) {
            if (!alive || !m || typeof m.id !== 'string') return;
            if (m.t === 'hello') { if (owner[m.id] && owner[m.id] !== s) return; owner[m.id] = s; }
            else if (owner[m.id] !== s) return;
            if (m.t === 'bye') delete owner[m.id];
            t.onMsg(m);
          };
          s.hostStart(code, name).then(function (c) {
            if (!alive || (done && c !== t.code)) { s.close(); return; }
            subs.push(s);
            if (!done) { done = true; t.code = c; resolve(c); }
          }, function (e) {
            errs.push(e); try { s.close(); } catch (e2) {}
            if (--left === 0 && !done) reject(new Error(NET_FAIL));
          });
        });
      });
    };
    t.toGuest = function (id, m) { var s = owner[id]; if (s) s.toGuest(id, m); };
    t.broadcast = function (m) { subs.forEach(function (s) { s.broadcast(m); }); };
    t.joinStart = function (code, name) {
      t.myId = 'g' + rid(); t.code = code;
      var relay = RelayTransport(), peer = PeerTransport(), cands = [peer, relay];
      relay.hold = true; // give the direct route a head start; the relay says hello after 3.5 s or as soon as PeerJS fails
      var holdTimer = setTimeout(function () { relay.releaseHello(); }, 3500);
      return new Promise(function (resolve, reject) {
        var left = cands.length, done = false, errs = [];
        function win(s) {
          if (done) return; done = true; winner = s; subs = [s]; clearTimeout(holdTimer);
          cands.forEach(function (o) { if (o !== s) { try { o.close(); } catch (e) {} } });
          resolve();
        }
        cands.forEach(function (s) {
          s.myId = t.myId; s.onStatus = status;
          s.onMsg = function (m) {
            if (!alive) return;
            if (!done && (m.t === 'welcome' || m.t === 'full') && m.id === t.myId) win(s);
            if (winner === s) t.onMsg(m);
          };
          s.joinStart(code, name).then(function () { win(s); }, function (e) {
            if (s === winner) return;
            errs.push(e); try { s.close(); } catch (e2) {}
            if (s === peer) relay.releaseHello();
            if (--left === 0 && !done) {
              var relayErr = errs.filter(function (x) { return x && x.message === NET_FAIL; }).length;
              reject(errs.some(isNotFound) && !relayErr ? errs.filter(isNotFound)[0] : new Error(NET_FAIL));
            }
          });
        });
      });
    };
    t.toHost = function (m) { if (winner) winner.toHost(m); };
    t.close = function () {
      if (!alive) return; alive = false;
      (winner ? [winner] : subs).forEach(function (s) { try { s.close(); } catch (e) {} });
    };
    return t;
  }

  SB.Net = {
    ALPHA: ALPHA,
    genCode: genCode,
    cleanCode: cleanCode,
    isArtifact: isArtifact,
    getRoom: getRoom,
    loadPeer: loadPeer,
    RELAYS: RELAYS,
    create: function (kind) {
      return kind === 'room' ? RoomTransport() : kind === 'online' ? OnlineTransport() : kind === 'peer' ? PeerTransport() : kind === 'relay' ? RelayTransport() : TabsTransport();
    },
    /** kinds offered in this context, in preference order */
    kinds: function () { return isArtifact() ? ['room', 'tabs'] : ['online', 'peer', 'relay', 'tabs']; },
    label: function (k) {
      return k === 'room' ? 'claude.ai room' : k === 'online' ? 'Internet (auto)' : k === 'peer' ? 'Internet (direct only)' : k === 'relay' ? 'Internet (relay only)' : 'Browser tabs';
    },
    bytes: bytes
  };
})();
