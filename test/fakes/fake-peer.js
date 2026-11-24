/* Minimal fake of the PeerJS `Peer` API, for tests only (inject with page.add_init_script).
 * Pages of one browser talk over BroadcastChannel('fake-peerjs'). Supports:
 *   new Peer(id?, opts) -> events: open(id), connection(conn), error({type}), disconnected, close
 *   peer.connect(id, opts) -> DataConnection: events open, data, close, error; send(), close(), .open, .peer
 *   peer.destroy(), peer.reconnect()
 * Errors: 'unavailable-id' when the id is taken, 'peer-unavailable' when connecting to an unknown id. */
(function () {
  'use strict';
  var bc = new BroadcastChannel('fake-peerjs');
  var local = {};   // id -> Peer on this page
  var conns = {};   // cid -> DataConnection on this page
  var stats = window.__fakePeer = { created: 0, connects: 0, sent: 0 };
  function rid(p) { return (p || '') + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8); }
  function Emitter() { this._h = {}; }
  Emitter.prototype.on = function (ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return this; };
  Emitter.prototype.off = function (ev, fn) { var a = this._h[ev] || []; var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); return this; };
  Emitter.prototype._emit = function (ev, arg) { var self = this; (this._h[ev] || []).slice().forEach(function (f) { try { f.call(self, arg); } catch (e) { setTimeout(function () { throw e; }); } }); };
  function post(m) { try { bc.postMessage(m); } catch (e) {} }

  function DataConnection(peer, remote, cid, opts) {
    Emitter.call(this);
    this.peer = remote; this.connectionId = cid; this.open = false; this.metadata = opts && opts.metadata;
    this.serialization = (opts && opts.serialization) || 'binary'; this.reliable = !!(opts && opts.reliable);
    this._local = peer; conns[cid] = this;
  }
  DataConnection.prototype = Object.create(Emitter.prototype);
  DataConnection.prototype.send = function (data) {
    if (!this.open) return;
    stats.sent++;
    post({ k: 'data', cid: this.connectionId, to: this.peer, from: this._local.id, data: JSON.parse(JSON.stringify(data)) });
  };
  DataConnection.prototype.close = function () {
    if (!conns[this.connectionId]) return;
    post({ k: 'close', cid: this.connectionId, to: this.peer });
    this._closed();
  };
  DataConnection.prototype._closed = function () {
    if (!conns[this.connectionId]) return;
    delete conns[this.connectionId]; this.open = false; this._emit('close');
  };

  function Peer(id, opts) {
    if (!(this instanceof Peer)) return new Peer(id, opts);
    Emitter.call(this);
    if (id && typeof id === 'object') { opts = id; id = null; }
    var self = this;
    this.id = id || rid('peer-'); this.open = false; this.destroyed = false; this.disconnected = false; this._claimTaken = false;
    stats.created++;
    post({ k: 'claim', id: this.id });
    this._claimTimer = setTimeout(function () {
      if (self.destroyed) return;
      if (self._claimTaken) { self._emit('error', { type: 'unavailable-id', message: 'ID "' + self.id + '" is taken' }); return; }
      local[self.id] = self; self.open = true; self._emit('open', self.id);
    }, 120);
  }
  Peer.prototype = Object.create(Emitter.prototype);
  Peer.prototype.connect = function (remote, opts) {
    var cid = rid('dc_'), c = new DataConnection(this, remote, cid, opts), self = this;
    stats.connects++;
    post({ k: 'conn', cid: cid, to: remote, from: this.id, opts: { serialization: c.serialization, reliable: c.reliable } });
    c._timer = setTimeout(function () {
      if (c.open) return;
      delete conns[cid];
      self._emit('error', { type: 'peer-unavailable', message: 'Could not connect to peer ' + remote });
    }, 1500);
    return c;
  };
  Peer.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true; this.open = false;
    var self = this;
    Object.keys(conns).forEach(function (cid) { var c = conns[cid]; if (c._local === self) c.close(); });
    delete local[this.id];
    this._emit('close');
  };
  Peer.prototype.disconnect = function () { this.disconnected = true; this._emit('disconnected', this.id); };
  Peer.prototype.reconnect = function () { this.disconnected = false; };

  bc.onmessage = function (e) {
    var m = e.data; if (!m) return;
    if (m.k === 'claim') { if (local[m.id]) post({ k: 'taken', id: m.id }); return; }
    if (m.k === 'taken') {
      // a pending Peer on this page with that id loses the claim
      return Object.keys(pendingClaims()).forEach(function () {});
    }
    if (m.k === 'conn') {
      var host = local[m.to]; if (!host || host.destroyed) return;
      var c = new DataConnection(host, m.from, m.cid, m.opts);
      c.open = true;
      post({ k: 'conn-ok', cid: m.cid, to: m.from });
      host._emit('connection', c);
      setTimeout(function () { c._emit('open'); }, 0);
      return;
    }
    if (m.k === 'conn-ok') { var c2 = conns[m.cid]; if (c2 && !c2.open) { clearTimeout(c2._timer); c2.open = true; c2._emit('open'); } return; }
    if (m.k === 'data') { var c3 = conns[m.cid]; if (c3 && c3.open) c3._emit('data', m.data); return; }
    if (m.k === 'close') { var c4 = conns[m.cid]; if (c4) c4._closed(); return; }
  };
  // claim conflicts: track Peers waiting for their claim on this page
  var origOn = bc.onmessage;
  var waiting = [];
  function pendingClaims() { return {}; }
  bc.onmessage = function (e) {
    var m = e.data;
    if (m && m.k === 'taken') { waiting.forEach(function (p) { if (p.id === m.id) p._claimTaken = true; }); return; }
    origOn(e);
  };
  var RealPeer = Peer;
  function TrackedPeer(id, opts) { var p = new RealPeer(id, opts); waiting.push(p); setTimeout(function () { var i = waiting.indexOf(p); if (i >= 0) waiting.splice(i, 1); }, 400); return p; }
  TrackedPeer.prototype = RealPeer.prototype;
  window.addEventListener('pagehide', function () { Object.keys(local).forEach(function (id) { local[id].destroy(); }); });
  window.Peer = TrackedPeer;
})();
