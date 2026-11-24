/* STACKBOTS UI helpers — thin HTML overlay (screens, dialog, toasts, HUD, lobby & level select). */
(function () {
  'use strict';
  var SB = globalThis.SB = globalThis.SB || {};
  var $ = function (id) { return document.getElementById(id); };
  var SLOT = ['#FF6F59', '#2EC4B6', '#FFB627', '#9D7BFF'];
  var SCREENS = ['title', 'lobby', 'select', 'pause', 'clear', 'credits', 'settings', 'help', 'wait'];
  var cur = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtTime(ticks, tenths) {
    if (ticks == null || !isFinite(ticks)) return '-';
    var s = ticks / 60, m = Math.floor(s / 60), r = s - m * 60;
    var ss = tenths === false ? String(Math.floor(r)).padStart(2, '0') : r.toFixed(1).padStart(4, '0');
    return m + ':' + ss;
  }
  function emblemSvg(slot, size, fill, stroke) {
    size = size || 12; fill = fill || '#FFF6E8'; stroke = stroke || '#1A1230';
    var p = ['<circle cx="6" cy="6" r="4.2"/>', '<path d="M6 1.4 L10.7 10 L1.3 10 Z"/>', '<rect x="2" y="2" width="8" height="8"/>', '<path d="M6 0.9 L11 6 L6 11.1 L1 6 Z"/>'][slot] || '';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 12 12" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.4" aria-hidden="true">' + p + '</svg>';
  }
  var CELL_SVG = '<svg width="10" height="15" viewBox="0 0 10 15" aria-hidden="true"><rect x="3" y="0" width="4" height="2.5" rx="1" fill="#D9E3EA" stroke="#1A1230" stroke-width="1"/><rect x="0.8" y="2" width="8.4" height="12.2" rx="3.4" fill="#B6FF5C" stroke="#1A1230" stroke-width="1.4"/><path d="M5.8 4.2 L2.9 8.6 L4.8 8.6 L3.9 12 L7.1 7.4 L5.2 7.4 Z" fill="#1F5E2E"/></svg>';
  var DOOR_SVG = '<svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path d="M1 13.5 V6 A5 5 0 0 1 11 6 V13.5 Z" fill="#5CFFC8" stroke="#1A1230" stroke-width="1.4"/></svg>';

  function show(name) {
    cur = name;
    for (var i = 0; i < SCREENS.length; i++) { var el = $('scr-' + SCREENS[i]); if (el) el.classList.toggle('on', SCREENS[i] === name); }
  }
  function overlayOn(name, on) { var el = $('scr-' + name); if (el) el.classList.toggle('on', !!on); }

  // ---------- toasts & dialog ----------
  function toast(msg, kind, ms) {
    var box = $('toasts'); if (!box) return;
    var el = document.createElement('div'); el.className = 'toast' + (kind ? ' ' + kind : ''); el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(function () { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320); }, ms || 2600);
  }
  var dlgStack = 0;
  function dialog(o) {
    var d = $('dialog'); $('dlg-title').textContent = o.title || ''; $('dlg-text').textContent = o.text || '';
    var btns = $('dlg-btns'); btns.innerHTML = '';
    function close() { d.classList.add('hidden'); dlgStack = 0; }
    (o.buttons || [{ label: 'OK', cls: 'primary' }]).forEach(function (b, i, arr) {
      var el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.textContent = b.label;
      el.onclick = function () { close(); if (SB.Audio) SB.Audio.play('click'); if (b.fn) b.fn(); };
      btns.appendChild(el);
      if (i === arr.length - 1) setTimeout(function () { try { el.focus(); } catch (e) {} }, 30);
    });
    d.classList.remove('hidden'); dlgStack = 1;
    return close;
  }
  function dialogOpen() { return !$('dialog').classList.contains('hidden'); }

  // ---------- lobby ----------
  var portraits = [];
  function renderLobby(st) {
    // st: {mode:'host'|'guest'|'local', code, kindLabel, players:[{slot,name,me,pending,dev,devLabel}], canStart, status, onSlot(slot)}
    var local = st.mode === 'local';
    $('lobby-title').textContent = local ? 'Local Play' : (st.mode === 'host' ? 'Your room' : 'Joined room');
    $('lobby-codewrap').classList.toggle('hidden', local);
    $('lobby-code').textContent = st.code || '-----';
    $('lobby-localhelp').innerHTML = !local ? '' : st.touch ?
      'The on-screen buttons drive <b>P1</b>. Other bots need a keyboard or gamepads (press <b>A</b> to join) \u2014 tap a card to add or change one. On a phone alone, <b>Host Online</b> and invite friends works best.' :
      'Tap a card to add a bot or change its controls. <b>P1</b> WASD + Space &middot; <b>P2</b> Arrows + Enter &middot; gamepads press <b>A</b> to join. Idle bots: press <span class="kbd">Tab</span> in-game to take control.';
    var box = $('lobby-slots');
    if (box.children.length !== 4) {
      box.innerHTML = ''; portraits = [];
      for (var i = 0; i < 4; i++) {
        var card = document.createElement('div'); card.className = 'slot';
        card.innerHTML = '<canvas></canvas><div class="nm"></div><div class="st"></div><button class="dev hidden"></button>';
        box.appendChild(card); portraits.push(card.querySelector('canvas'));
        (function (k, c) { c.querySelector('.dev').onclick = function (e) { e.stopPropagation(); if (box._onSlot) box._onSlot(k); }; c.onclick = function () { if (box._onSlot && box._local) box._onSlot(k); }; })(i, card);
      }
    }
    box._onSlot = st.onSlot; box._local = local;
    var bySlot = {};
    (st.players || []).forEach(function (p) { bySlot[p.slot] = p; });
    for (var s = 0; s < 4; s++) {
      var c2 = box.children[s], p = bySlot[s];
      c2.classList.toggle('empty', !p); c2.classList.toggle('me', !!(p && p.me));
      c2.style.borderColor = p ? SLOT[s] : '';
      c2.querySelector('.nm').textContent = p ? p.name : (local ? 'Add bot' : 'Waiting...');
      c2.querySelector('.st').innerHTML = p ? (emblemSvg(s, 10, SLOT[s]) + ' ' + esc(p.me ? 'You' : (p.pending ? 'Joins next try' : (local ? p.devLabel : (s === 0 ? 'Host' : 'Ready'))))) : (local ? '+' : 'open slot');
      var dev = c2.querySelector('.dev');
      dev.classList.toggle('hidden', !(local && p));
      if (local && p) dev.textContent = p.devLabel + ' ▾';
    }
    var startBtn = $('b-lobby-start');
    startBtn.classList.toggle('hidden', st.mode === 'guest');
    startBtn.disabled = !st.canStart;
    $('lobby-status').innerHTML = st.status || '';
    $('b-copy').classList.toggle('hidden', local);
  }
  function animateLobby(players, t) {
    var by = {}; (players || []).forEach(function (p) { by[p.slot] = p; });
    for (var i = 0; i < portraits.length; i++) if (SB.Render) SB.Render.portrait(portraits[i], i, { t: t, hop: !!by[i], happy: !!by[i] && ((t * 1000 + i * 700) % 2600) < 500, facing: i < 2 ? 1 : -1 });
  }

  // ---------- level select ----------
  function renderSelect(st) {
    // st: {worlds:[{name,theme,levels:[{index,id,name,cleared,best,gearsBest,gearsTotal,minPlayers}]}], tab, guest, onTab(i), onPick(index), totalCleared, total}
    var tabs = $('sel-tabs'); tabs.innerHTML = '';
    st.worlds.forEach(function (w, i) {
      var b = document.createElement('button'); b.className = 'tab' + (i === st.tab ? ' on' : '');
      var done = w.levels.filter(function (l) { return l.cleared; }).length;
      b.innerHTML = esc(w.num) + (done === w.levels.length && done ? '<span class="tk">✓</span>' : '');
      b.title = w.name; b.setAttribute('aria-label', 'World ' + w.num + ': ' + w.name);
      b.onclick = function () { if (SB.Audio) SB.Audio.play('click'); st.onTab(i); };
      tabs.appendChild(b);
    });
    var w = st.worlds[st.tab] || st.worlds[0];
    $('sel-wtitle').innerHTML = w ? '<b>' + esc(w.name) + '</b><span>World ' + esc(w.num) + ' &middot; ' + w.levels.filter(function (l) { return l.cleared; }).length + '/' + w.levels.length + ' cleared</span>' : '';
    $('sel-count').textContent = st.totalCleared + '/' + st.total;
    $('sel-guest').classList.toggle('hidden', !st.guest);
    var cards = $('sel-cards'); cards.innerHTML = '';
    var nextMarked = false;
    (w ? w.levels : []).forEach(function (l) {
      var b = document.createElement('button'); b.className = 'card';
      if (!l.cleared && !nextMarked) { b.classList.add('next'); nextMarked = true; }
      b.disabled = !!st.guest;
      b.innerHTML = '<span class="cid">' + esc(l.id) + '</span><span class="cnm">' + esc(l.name) + '</span>' +
        (l.cleared ? '<span class="tick">✓</span>' : '') +
        '<span class="cmeta"><span>' + (l.cleared ? '⏱ ' + fmtTime(l.best) : (l.minPlayers > 1 ? l.minPlayers + '+ bots' : '')) + '</span>' +
        (l.gearsTotal ? '<span>⚙ ' + (l.gearsBest || 0) + '/' + l.gearsTotal + '</span>' : '') + '</span>';
      b.onclick = function () { st.onPick(l.index); };
      cards.appendChild(b);
    });
  }

  // ---------- HUD ----------
  var hudCache = {};
  function setText(id, v) { if (hudCache[id] === v) return; hudCache[id] = v; var el = $(id); if (el) el.textContent = v; }
  function setHtml(id, v) { if (hudCache[id] === v) return; hudCache[id] = v; var el = $(id); if (el) el.innerHTML = v; }
  function hud(st) {
    // st: {lid, lname, time, gears, gearsTotal, chips:[{slot,name,inHatch,cell,me}], hint, banner, net}
    setText('hud-lid', st.lid); setText('hud-lname', st.lname);
    setText('hud-time', fmtTime(st.time));
    setHtml('hud-gears', '⚙ ' + st.gears + '/' + st.gearsTotal);
    $('hud-gears').classList.toggle('hidden', !st.gearsTotal);
    var ch = (st.chips || []).map(function (c) {
      return '<div class="chip' + (c.inHatch ? ' in' : '') + (c.pending ? ' gone' : '') + '" style="border-color:' + (c.me ? SLOT[c.slot] : '#120D24') + '">' +
        '<span class="em" style="background:' + SLOT[c.slot] + '">' + emblemSvg(c.slot, 10) + '</span><span class="cn">' + esc(c.name) + '</span>' +
        (c.cell ? '<span class="ic" title="Carrying the Power Cell">' + CELL_SVG + '</span>' : '') +
        (c.inHatch ? '<span class="ic" title="In the hatch">' + DOOR_SVG + '</span>' : '') + '</div>';
    }).join('');
    setHtml('hud-chips', ch);
    var hint = $('hud-hint');
    if (st.hint) { setText('hud-hint', st.hint); hint.classList.remove('off'); } else hint.classList.add('off');
    var bn = $('hud-banner');
    if (st.banner) { setHtml('hud-banner', st.banner); bn.classList.remove('off'); } else bn.classList.add('off');
    $('hud-net').classList.toggle('hidden', !st.net);
  }
  function resetHud() { hudCache = {}; }

  SB.UI = {
    $: $, esc: esc, fmtTime: fmtTime, emblemSvg: emblemSvg,
    show: show, overlay: overlayOn, current: function () { return cur; },
    toast: toast, dialog: dialog, dialogOpen: dialogOpen,
    renderLobby: renderLobby, animateLobby: animateLobby, renderSelect: renderSelect,
    hud: hud, resetHud: resetHud
  };
})();
