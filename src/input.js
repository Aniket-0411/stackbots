/* STACKBOTS input — keyboard, gamepads, touch. Produces per-device held state + press counters. */
(function () {
  'use strict';
  var SB = globalThis.SB = globalThis.SB || {};
  var KEYS = ['left', 'right', 'up', 'down', 'jump'];
  var BIT = { left: 1, right: 2, up: 4, down: 8, jump: 16 };

  // keyboard maps (e.code). W/Up are "up" (engine: up press = jump unless interacting; holding up = holding jump).
  var MAP_ALL = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down', Space: 'jump', KeyZ: 'jump', KeyK: 'jump', KeyJ: 'jump' };
  var MAP_KB1 = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Space: 'jump', KeyF: 'jump', KeyG: 'jump' };
  var MAP_KB2 = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'jump', NumpadEnter: 'jump',
    Slash: 'jump', ShiftRight: 'jump', Numpad0: 'jump', Period: 'jump' };

  function mkDev(id, label) { return { id: id, label: label, held: { left: false, right: false, up: false, down: false, jump: false }, jc: 0, uc: 0, connected: true, lastUse: 0 }; }
  var dev = { all: mkDev('all', 'Keyboard'), kb1: mkDev('kb1', 'WASD'), kb2: mkDev('kb2', 'Arrows'), touch: mkDev('touch', 'Touch') };
  var pads = []; // index -> device
  for (var i = 0; i < 4; i++) { pads.push(mkDev('pad' + i, 'Pad ' + (i + 1))); pads[i].connected = false; pads[i].btnPrev = {}; }
  var downCodes = {};
  var actionCb = null;
  var PEEK = { KeyQ: 1, ShiftLeft: 1 }, touchPeek = false, padPeek = false, lastPress = 0;
  var capture = function () { return true; };
  var enabled = true;

  function anyHeld(map, key) { for (var c in map) if (map[c] === key && downCodes[c]) return true; return false; }
  function refreshKb(d, map) { for (var i = 0; i < KEYS.length; i++) d.held[KEYS[i]] = anyHeld(map, KEYS[i]); }
  function press(d, key) { if (key === 'jump') d.jc++; else if (key === 'up') d.uc++; d.lastUse = performance.now(); }

  function isTyping(e) {
    var t = e.target; if (!t || !t.tagName) return false;
    return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
  }

  function onKeyDown(e) {
    if (isTyping(e)) { if (e.key === 'Escape') { try { e.target.blur(); } catch (er) {} } else return; }
    var code = e.code || e.key, k = (e.key || '').toLowerCase();
    if (!e.repeat) lastPress = performance.now();
    if (PEEK[code]) { downCodes[code] = true; if (capture()) e.preventDefault(); return; }
    var gameKey = MAP_ALL[code] || MAP_KB1[code] || MAP_KB2[code];
    var cap = capture();
    if (cap && (gameKey || code === 'Tab' || code === 'Space')) e.preventDefault();
    if (!e.repeat) {
      if (code === 'Escape') emit('pause', e);
      else if (code === 'KeyR' || k === 'r') emit('restart', e);
      else if (code === 'KeyM' || k === 'm') emit('mute', e);
      else if (code === 'Tab') emit('tab', e);
      else if (code === 'Enter' || code === 'NumpadEnter') emit('confirm', e);
    }
    if (!gameKey || !enabled) return;
    var was = !!downCodes[code];
    downCodes[code] = true;
    if (!was) {
      if (MAP_ALL[code]) press(dev.all, MAP_ALL[code]);
      if (MAP_KB1[code]) press(dev.kb1, MAP_KB1[code]);
      if (MAP_KB2[code]) press(dev.kb2, MAP_KB2[code]);
    }
    refreshAll();
  }
  function onKeyUp(e) { var code = e.code || e.key; if (downCodes[code]) { delete downCodes[code]; refreshAll(); } }
  function refreshAll() { refreshKb(dev.all, MAP_ALL); refreshKb(dev.kb1, MAP_KB1); refreshKb(dev.kb2, MAP_KB2); }
  function clearAll() {
    downCodes = {}; refreshAll();
    for (var i = 0; i < KEYS.length; i++) dev.touch.held[KEYS[i]] = false;
    touchPtrs = {}; paintTouch();
  }
  function emit(a, e) { if (actionCb) actionCb(a, e); }

  // ---- touch buttons ----
  var touchPtrs = {}, touchEls = [];
  function paintTouch() {
    for (var i = 0; i < touchEls.length; i++) touchEls[i].classList.toggle('on', !!dev.touch.held[touchEls[i].getAttribute('data-k')]);
  }
  function touchRecalc() {
    var h = { left: false, right: false, up: false, down: false, jump: false };
    for (var id in touchPtrs) if (touchPtrs[id]) h[touchPtrs[id]] = true;
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      if (h[k] && !dev.touch.held[k]) press(dev.touch, k);
      dev.touch.held[k] = h[k];
    }
    paintTouch();
  }
  function bindTouch(root) {
    touchEls = Array.prototype.slice.call(root.querySelectorAll('[data-k]'));
    function keyAt(x, y) {
      var el = document.elementFromPoint(x, y);
      while (el && el !== root && !(el.getAttribute && el.getAttribute('data-k'))) el = el.parentNode;
      return el && el.getAttribute && el.getAttribute('data-k');
    }
    touchEls.forEach(function (el) {
      el.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        try { el.setPointerCapture && el.releasePointerCapture && el.releasePointerCapture(e.pointerId); } catch (er) {}
        touchPtrs[e.pointerId] = el.getAttribute('data-k'); touchRecalc(); lastPress = performance.now();
        if (SB.Audio) SB.Audio.init();
      });
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
    // sliding a finger between buttons switches key
    root.addEventListener('pointermove', function (e) {
      if (!(e.pointerId in touchPtrs)) return;
      var k = keyAt(e.clientX, e.clientY);
      if (k && k !== touchPtrs[e.pointerId]) { touchPtrs[e.pointerId] = k; touchRecalc(); }
    });
    function up(e) { if (e.pointerId in touchPtrs) { delete touchPtrs[e.pointerId]; touchRecalc(); } }
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }

  // ---- gamepads ----
  var padsSeen = 0;
  function pollPads() {
    var list = [], anyPadPeek = false;
    try { list = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { list = []; }
    var n = 0;
    for (var i = 0; i < 4; i++) {
      var gp = list && list[i], d = pads[i];
      if (!gp || !gp.connected) { d.connected = false; for (var q = 0; q < KEYS.length; q++) d.held[KEYS[q]] = false; continue; }
      d.connected = true; n++;
      d.label = 'Pad ' + (i + 1);
      var b = function (ix) { var x = gp.buttons[ix]; return !!(x && (x.pressed || x.value > 0.5)); };
      var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      var h = { left: b(14) || ax < -0.4, right: b(15) || ax > 0.4, up: b(12) || b(3), down: b(13) || ay > 0.65, jump: b(0) || b(2) };
      for (var k = 0; k < KEYS.length; k++) {
        var key = KEYS[k];
        if (h[key] && !d.held[key]) press(d, key);
        d.held[key] = h[key];
      }
      if (h.left || h.right || h.jump) d.lastUse = performance.now();
      for (var bb = 0; bb < gp.buttons.length && bb < 16; bb++) { var pr = b(bb); if (pr && !d.btnPrev['b' + bb]) lastPress = performance.now(); d.btnPrev['b' + bb] = pr; }
      if (Math.abs(ax) > 0.5 && !d.axPrev) lastPress = performance.now(); d.axPrev = Math.abs(ax) > 0.5;
      if (b(4) || b(5)) anyPadPeek = true;
      var sys = { 9: 'pause', 8: 'restart', 1: 'back' };
      for (var bi in sys) { var on = b(+bi); if (on && !d.btnPrev[bi]) emit(sys[bi], { pad: i }); d.btnPrev[bi] = on; }
      var a = b(0); if (a && !d.btnPrev.a) emit('padA', { pad: i }); d.btnPrev.a = a;
    }
    padsSeen = n; padPeek = anyPadPeek;
  }

  function merge(list) {
    var o = { left: false, right: false, up: false, down: false, jump: false, jc: 0, uc: 0 };
    for (var i = 0; i < list.length; i++) {
      var d = list[i]; if (!d) continue;
      for (var k = 0; k < KEYS.length; k++) if (d.held[KEYS[k]]) o[KEYS[k]] = true;
      o.jc += d.jc; o.uc += d.uc;
    }
    return o;
  }
  var NONE = { left: false, right: false, up: false, down: false, jump: false, jc: 0, uc: 0 };

  SB.Input = {
    KEYS: KEYS, BIT: BIT,
    init: function (touchRoot) {
      window.addEventListener('keydown', onKeyDown, { passive: false });
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', clearAll);
      document.addEventListener('visibilitychange', function () { if (document.hidden) clearAll(); });
      if (touchRoot) bindTouch(touchRoot);
      window.addEventListener('gamepadconnected', function (e) { pollPads(); emit('pad', e); });
      window.addEventListener('gamepaddisconnected', function (e) { pollPads(); emit('pad', e); });
    },
    onAction: function (cb) { actionCb = cb; },
    setCapture: function (fn) { capture = fn; },
    poll: pollPads,
    clear: clearAll,
    setEnabled: function (v) { enabled = !!v; if (!v) clearAll(); },
    /** combined input for "one bot per machine" (online / solo) */
    online: function () { return merge([dev.all, dev.touch].concat(pads)); },
    /** state of one local device id: kb1, kb2, touch, pad0..3, all */
    device: function (id) {
      if (id === 'kb1') return merge([dev.kb1, dev.touch]);
      if (id && id.indexOf('pad') === 0) { var p = pads[+id.slice(3)]; return p && p.connected ? merge([p]) : NONE; }
      return dev[id] ? merge([dev[id]]) : NONE;
    },
    deviceLabel: function (id) {
      if (id === 'kb1') return 'WASD'; if (id === 'kb2') return 'Arrows'; if (id === 'none') return 'Idle';
      if (id && id.indexOf('pad') === 0) return 'Pad ' + (+id.slice(3) + 1) + (pads[+id.slice(3)].connected ? '' : ' (off)');
      return id;
    },
    /** hold-to-peek overview: Q / Left Shift / gamepad LB-RB / touch MAP button */
    peekHeld: function () { return !!(downCodes.KeyQ || downCodes.ShiftLeft || touchPeek || padPeek); },
    setTouchPeek: function (v) { touchPeek = !!v; },
    lastPress: function () { return lastPress; },
    padConnected: function (i) { return !!(pads[i] && pads[i].connected); },
    padCount: function () { return padsSeen; },
    bits: function (i) { var b = 0; for (var k = 0; k < KEYS.length; k++) if (i[KEYS[k]]) b |= BIT[KEYS[k]]; return b; },
    fromBits: function (b, jc, uc) { return { left: !!(b & 1), right: !!(b & 2), up: !!(b & 4), down: !!(b & 8), jump: !!(b & 16), jc: jc | 0, uc: uc | 0 }; },
    none: function () { return { left: false, right: false, up: false, down: false, jump: false, jc: 0, uc: 0 }; },
    _dev: dev, _pads: pads
  };
})();
