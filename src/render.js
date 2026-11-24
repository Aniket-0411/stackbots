/* STACKBOTS renderer — everything drawn in code on one canvas. Original art. */
(function () {
  'use strict';
  var SB = globalThis.SB = globalThis.SB || {};
  var T = 32;
  var SLOT = ['#FF6F59', '#2EC4B6', '#FFB627', '#9D7BFF'];
  var SLOT_NAME = ['Coral', 'Teal', 'Marigold', 'Lilac'];
  var EMBLEM = ['circle', 'triangle', 'square', 'diamond'];
  var CHC = { A: '#FF4FA3', B: '#3D9BFF', C: '#8CE83A', D: '#FF8A1F', E: '#C46BFF', F: '#22D3EE', G: '#F5E50A', H: '#F0F0FA' };
  var OUT = '#1A1230', VISOR = '#17112C', CELL = '#B6FF5C', CREAM = '#FFF6E8';
  var TAU = Math.PI * 2;

  // ---------- color + shape helpers ----------
  var rgbC = {}, mixC = {};
  function rgb(h) { var c = rgbC[h]; if (c) return c; var n = parseInt(h.slice(1), 16); c = [n >> 16 & 255, n >> 8 & 255, n & 255]; rgbC[h] = c; return c; }
  function hex(r, g, b) { return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1); }
  function mix(a, b, t) {
    var k = a + b + t, c = mixC[k]; if (c) return c;
    var A = rgb(a), B = rgb(b);
    c = hex(Math.round(A[0] + (B[0] - A[0]) * t), Math.round(A[1] + (B[1] - A[1]) * t), Math.round(A[2] + (B[2] - A[2]) * t));
    mixC[k] = c; return c;
  }
  function shade(h, t) { return t < 0 ? mix(h, '#000000', -t) : mix(h, '#FFFFFF', t); }
  function rgba(h, a) { var A = rgb(h); return 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + a + ')'; }
  function hsh(a, b) { var h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function glow(g, x, y, r, col, a) {
    if (a <= 0.01) return;
    var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  function emblemPath(g, kind, cx, cy, r) {
    g.beginPath();
    if (kind === 'circle') g.arc(cx, cy, r, 0, TAU);
    else if (kind === 'triangle') { g.moveTo(cx, cy - r * 1.05); g.lineTo(cx + r * 1.1, cy + r * 0.8); g.lineTo(cx - r * 1.1, cy + r * 0.8); g.closePath(); }
    else if (kind === 'square') g.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
    else { g.moveTo(cx, cy - r * 1.15); g.lineTo(cx + r * 1.0, cy); g.lineTo(cx, cy + r * 1.15); g.lineTo(cx - r * 1.0, cy); g.closePath(); }
  }
  function gearPath(g, cx, cy, r, teeth, ang, depth) {
    g.beginPath();
    var n = teeth * 2;
    for (var i = 0; i <= n * 2; i++) {
      var a = ang + i / (n * 2) * TAU, k = i % 4, rad = (k === 0 || k === 1) ? r : r - depth;
      if (i === 0) g.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); else g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    g.closePath();
  }
  function chColor(ch) { return CHC[ch] || '#E8E8F0'; }

  // ---------- themes ----------
  var THEMES = {
    meadow: { sky: ['#62C4FF', '#DDF6FF'], body: '#9A6440', dark: '#5C3A24', lip: '#5BC94F', lipHi: '#9BEB7E', lipDk: '#3E9A3A', speck: '#7E4F31', seam: '#87573A', plank: '#C08A55', tex: 'pebbles', deco: 'grass', far: '#A6DE9C', mid: '#79C76E', crate: '#C98544' },
    workshop: { sky: ['#5B4A6E', '#8C7187'], body: '#6E7C99', dark: '#3E4760', lip: '#AFC0DC', lipHi: '#DCE6F6', lipDk: '#8191AE', speck: '#5E6B87', seam: '#5F6C88', plank: '#B98B5E', tex: 'plates', deco: 'rivets', far: '#7A6378', mid: '#5F4B62', crate: '#C98544' },
    switchyard: { sky: ['#22375C', '#C67E6E'], body: '#7F8799', dark: '#454B5C', lip: '#B9C0CF', lipHi: '#E2E6EE', lipDk: '#8D95A8', speck: '#6C7486', seam: '#6E7689', plank: '#8B6B4A', tex: 'cracks', deco: 'stripe', far: '#394869', mid: '#29344F', crate: '#B5793F' },
    skyway: { sky: ['#3FA9F5', '#CFF1FF'], body: '#7E8BC0', dark: '#4E5A8E', lip: '#F4F9FF', lipHi: '#FFFFFF', lipDk: '#C7D5F0', speck: '#6F7CB2', seam: '#7180B6', plank: '#E0B77A', tex: 'puffs', deco: 'cloud', far: '#EAF7FF', mid: '#FFFFFF', crate: '#D29A55' },
    prism: { sky: ['#1A1038', '#5A3290'], body: '#4B3B80', dark: '#2A2050', lip: '#C9A8FF', lipHi: '#F0E6FF', lipDk: '#9C7AE0', speck: '#5E4C9A', seam: '#3F3170', plank: '#7FE3E8', tex: 'facets', deco: 'gems', far: '#33255F', mid: '#4C3590', crate: '#B07A4A' },
    bouncy: { sky: ['#FF94C8', '#FFE9F4'], body: '#4C7BE0', dark: '#2C4E9E', lip: '#FFE07A', lipHi: '#FFF4C2', lipDk: '#E5B94A', speck: '#5C8BEE', seam: '#4470D0', plank: '#FF8FB8', tex: 'dots', deco: 'candy', far: '#FFC4E1', mid: '#FFADD4', crate: '#E59A4E' },
    ropeway: { sky: ['#7FCBBE', '#F9E6BE'], body: '#C4834F', dark: '#7E4E2C', lip: '#E9B985', lipHi: '#F8DDB6', lipDk: '#C9935F', speck: '#B07444', seam: '#A86E40', plank: '#9A7048', tex: 'strata', deco: 'none', far: '#DDB07F', mid: '#B98257', crate: '#9C6A3C' },
    foundry: { sky: ['#1A0C0A', '#7A2B12'], body: '#4E4A55', dark: '#2B2830', lip: '#8F8A99', lipHi: '#C2BDCB', lipDk: '#6E6978', speck: '#423F48', seam: '#3A3740', plank: '#7A6A5A', tex: 'rivets', deco: 'hot', far: '#2E1712', mid: '#1E0F0C', crate: '#8B5A30' },
    hazard: { sky: ['#15151B', '#3A3624'], body: '#5B606C', dark: '#33363E', lip: '#F2C84B', lipHi: '#FFE38A', lipDk: '#C29A2A', speck: '#4E525D', seam: '#4A4E58', plank: '#6B6F7A', tex: 'grate', deco: 'stripes', far: '#2A2A26', mid: '#1C1C1A', crate: '#9A6A36' },
    summit: { sky: ['#0A1230', '#3E4F91'], body: '#6E7EA8', dark: '#3E4A70', lip: '#F4F8FF', lipHi: '#FFFFFF', lipDk: '#C9D6EE', speck: '#5F6E96', seam: '#5A6890', plank: '#9A7B5A', tex: 'rock', deco: 'snow', far: '#33467E', mid: '#22305A', crate: '#A0703F' }
  };
  var THEME_ORDER = ['meadow', 'workshop', 'switchyard', 'skyway', 'prism', 'bouncy', 'ropeway', 'foundry', 'hazard', 'summit'];

  // ---------- state ----------
  var cv, g, W = 1, H = 1, dpr = 1, s0 = 1;
  var cam = { x: 480, y: 270, z: 1, init: false };
  var L = null;          // current level render info
  var parts = [];        // particles
  var shakeAmt = 0, flash = 0, flashCol = '#FF4D5E';
  var botFx = {};        // per-slot animation state
  var springFx = {};     // "c,r" -> time
  var cellPos = null;
  var gateAmt = {};
  var bg = { theme: null, layers: null, scale: 0 };
  var time = 0;

  function resize() {
    if (!cv) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round((cv.clientWidth || window.innerWidth) * dpr)), h = Math.max(1, Math.round((cv.clientHeight || window.innerHeight) * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    W = w; H = h;
    var lw = W >= H ? 960 : 480;
    s0 = Math.min(W / lw, H / 540);
    bg.theme = null;
    if (L && L.cacheScale && Math.abs(cacheRes() - L.cacheScale) > 0.3) buildCache();
  }

  // ---------- backgrounds (pre-rendered repeating strips per theme) ----------
  var LW = 1024, LH = 540;
  function hills(c, y0, waves, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, LH);
    for (var x = 0; x <= LW; x += 8) {
      var y = y0; for (var i = 0; i < waves.length; i++) y += waves[i][0] * Math.sin(TAU * waves[i][1] * x / LW + waves[i][2]);
      c.lineTo(x, y);
    }
    c.lineTo(LW, LH); c.closePath(); c.fill();
  }
  function hillY(x, y0, waves) { var y = y0; for (var i = 0; i < waves.length; i++) y += waves[i][0] * Math.sin(TAU * waves[i][1] * x / LW + waves[i][2]); return y; }
  function puff(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); c.moveTo(x + r * 1.65, y + r * 0.2); c.arc(x + r * 0.9, y + r * 0.2, r * 0.75, 0, TAU); c.moveTo(x - r * 0.2, y + r * 0.25); c.arc(x - r * 0.9, y + r * 0.25, r * 0.7, 0, TAU); var bx = x - r * 1.55, bw = r * 3.1, by = y + r * 0.1, bh = r * 0.85, br = bh / 2; c.moveTo(bx + br, by); c.arcTo(bx + bw, by, bx + bw, by + bh, br); c.arcTo(bx + bw, by + bh, bx, by + bh, br); c.arcTo(bx, by + bh, bx, by, br); c.arcTo(bx, by, bx + bw, by, br); c.closePath(); c.fill('nonzero'); }
  function wrapDraw(c, fn) { fn(0); fn(-LW); fn(LW); }
  function peaks(c, base, pts, col, snow) {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, LH);
    for (var i = 0; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.lineTo(LW, LH); c.closePath(); c.fill();
    if (snow) {
      c.fillStyle = snow;
      for (var j = 1; j < pts.length - 1; j++) {
        var p = pts[j], a = pts[j - 1], b = pts[j + 1];
        if (p[1] < a[1] && p[1] < b[1]) {
          var d = 34;
          var la = d / Math.max(1, (a[1] - p[1])), lb = d / Math.max(1, (b[1] - p[1]));
          c.beginPath(); c.moveTo(p[0], p[1]);
          c.lineTo(p[0] + (b[0] - p[0]) * lb, p[1] + d);
          c.lineTo(p[0] + (b[0] - p[0]) * lb * 0.5, p[1] + d * 0.75);
          c.lineTo(p[0], p[1] + d * 0.95);
          c.lineTo(p[0] + (a[0] - p[0]) * la * 0.5, p[1] + d * 0.7);
          c.lineTo(p[0] + (a[0] - p[0]) * la, p[1] + d);
          c.closePath(); c.fill();
        }
      }
    }
  }
  function ridge(seed, n, ymin, ymax) {
    var pts = [[0, ymax]], step = LW / n;
    for (var i = 0; i <= n; i++) pts.push([i * step, i === 0 || i === n ? (ymin + ymax) / 2 : ymin + hsh(seed, i) * (ymax - ymin) * (i % 2 ? 0.5 : 1) + (i % 2 ? 0 : (ymax - ymin) * 0.35)]);
    pts[1][1] = pts[pts.length - 1][1];
    pts.push([LW, ymax]);
    return pts;
  }

  var BG = {
    meadow: [
      { f: 0.1, base: '#A6DE9C', draw: function (c) { hills(c, 360, [[26, 2, 0], [14, 5, 1.3]], '#B9E8AE'); } },
      { f: 0.26, base: '#79C76E', draw: function (c) {
        var w = [[26, 3, 2], [10, 7, 0.5]];
        for (var i = 0; i < 6; i++) {
          var x = i * 171 + 50, y = hillY(x, 432, w);
          c.fillStyle = '#6E5236'; c.fillRect(x - 3, y - 30, 6, 34);
          c.fillStyle = i % 2 ? '#5DB357' : '#4FA64C'; c.beginPath(); c.arc(x, y - 40, 20 + (i % 3) * 4, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.arc(x - 6, y - 47, 8, 0, TAU); c.fill();
        }
        hills(c, 432, w, '#7AC96F');
        for (var j = 0; j < 40; j++) { var fx = hsh(j, 3) * LW, fy = hillY(fx, 432, w) + 10 + hsh(j, 4) * 60; c.fillStyle = ['#FFF6E8', '#FFD86B', '#FF9EC4'][j % 3]; c.beginPath(); c.arc(fx, fy, 2.2, 0, TAU); c.fill(); }
      } }
    ],
    workshop: [
      { f: 0.06, base: '#7A6378', draw: function (c) {
        c.fillStyle = '#7A6378'; c.fillRect(0, 0, LW, LH);
        c.fillStyle = '#6A5468';
        for (var y = 14; y < LH; y += 26) for (var x = 13; x < LW; x += 26) { c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill(); }
        c.fillStyle = '#5E4A5E'; c.strokeStyle = '#5E4A5E'; c.lineWidth = 8; c.lineCap = 'round';
        for (var i = 0; i < 8; i++) {
          var tx = 60 + i * 128, ty = 120 + (i % 3) * 70, k = i % 4;
          c.fillRect(tx - 2, ty - 26, 4, 10);
          if (k === 0) { c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx, ty + 70); c.stroke(); c.beginPath(); c.arc(tx, ty, 12, 0, TAU); c.fill(); }
          else if (k === 1) { c.fillRect(tx - 18, ty - 6, 36, 14); c.beginPath(); c.moveTo(tx, ty + 6); c.lineTo(tx, ty + 70); c.stroke(); }
          else if (k === 2) { c.beginPath(); c.moveTo(tx - 14, ty); c.lineTo(tx + 14, ty); c.lineTo(tx + 6, ty + 64); c.lineTo(tx - 6, ty + 64); c.closePath(); c.fill(); }
          else { gearPath(c, tx, ty + 20, 22, 8, 0, 6); c.fill(); }
        }
        c.fillStyle = '#5A4659'; c.fillRect(0, 300, LW, 10); c.fillRect(0, 410, LW, 8);
      } },
      { f: 0.2, base: '#4D3C50', draw: function (c) {
        c.fillStyle = '#5F4B62';
        gearPath(c, 180, 520, 120, 12, 0.2, 20); c.fill();
        gearPath(c, 640, 560, 150, 14, 0.1, 22); c.fill();
        gearPath(c, 930, 500, 80, 10, 0.4, 16); c.fill();
        c.fillStyle = '#4D3C50'; c.fillRect(300, 430, 260, 18); c.fillRect(320, 448, 14, 92); c.fillRect(526, 448, 14, 92);
        c.fillRect(0, 500, LW, 40);
      } }
    ],
    switchyard: [
      { f: 0.08, base: '#394869', draw: function (c) {
        c.fillStyle = '#394869';
        for (var i = 0; i < 9; i++) { var x = i * 118, h = 90 + hsh(i, 7) * 110, w = 70 + hsh(i, 8) * 50; c.fillRect(x, 470 - h, w, h + 80); c.fillRect(x + 10, 470 - h - 18, 16, 20); }
        c.fillStyle = '#FFD27A';
        for (var j = 0; j < 40; j++) { var wx = hsh(j, 11) * LW, wy = 300 + hsh(j, 12) * 150; c.globalAlpha = 0.35; c.fillRect(wx, wy, 6, 8); }
        c.globalAlpha = 1;
        c.strokeStyle = '#2F3C59'; c.lineWidth = 3;
        for (var k = 0; k < 4; k++) { var px = k * 256 + 40; c.fillStyle = '#2F3C59'; c.fillRect(px, 250, 8, 300); c.fillRect(px - 26, 250, 60, 6); }
        c.beginPath(); for (var m = 0; m < 4; m++) { var ax = m * 256 + 44; c.moveTo(ax - 20, 256); c.quadraticCurveTo(ax + 108, 290, ax + 236, 256); } c.stroke();
      } },
      { f: 0.24, base: '#29344F', draw: function (c) {
        c.fillStyle = '#29344F'; c.fillRect(0, 480, LW, 60);
        c.fillStyle = '#1F283E'; for (var x = 0; x < LW; x += 22) c.fillRect(x, 488, 12, 8);
        c.fillStyle = '#5B6782'; c.fillRect(0, 484, LW, 3); c.fillRect(0, 494, LW, 3);
        for (var i = 0; i < 4; i++) {
          var sx = 90 + i * 256;
          c.fillStyle = '#29344F'; c.fillRect(sx - 4, 330, 8, 160); rr(c, sx - 14, 300, 28, 56, 8); c.fill();
          var lit = i % 3; // dim, desaturated lamps: scenery, not gameplay signals
          ['#7A4A55', '#7A6E4E', '#4E6E5C'].forEach(function (col, q) {
            c.fillStyle = q === lit ? col : '#1F283E'; c.beginPath(); c.arc(sx, 312 + q * 16, 5, 0, TAU); c.fill();
          });
        }
        c.fillStyle = '#323F5E';
        rr(c, 380, 420, 150, 56, 6); c.fill(); rr(c, 540, 420, 150, 56, 6); c.fill();
        c.fillStyle = '#29344F'; [400, 510, 560, 670].forEach(function (x) { c.beginPath(); c.arc(x, 478, 9, 0, TAU); c.fill(); });
      } }
    ],
    skyway: [
      { f: 0.05, base: '#EAF7FF', draw: function (c) {
        for (var i = 0; i < 14; i++) puff(c, i * 78 + 20, 440 + hsh(i, 2) * 30, 34 + hsh(i, 3) * 20, '#EAF7FF');
        c.fillStyle = '#EAF7FF'; c.fillRect(0, 470, LW, 70);
      } },
      { f: 0.18, base: '#FFFFFF', draw: function (c) {
        for (var i = 0; i < 4; i++) {
          var x = 80 + i * 260, y = 190 + hsh(i, 9) * 60; // hazy islands, kept high above the play band
          c.globalAlpha = 0.55;
          c.fillStyle = '#B9CCEC'; c.beginPath(); c.moveTo(x - 60, y); c.lineTo(x + 60, y); c.lineTo(x + 20, y + 50); c.lineTo(x - 10, y + 70); c.lineTo(x - 40, y + 30); c.closePath(); c.fill();
          c.fillStyle = '#DCE7F8'; rr(c, x - 64, y - 8, 128, 14, 7); c.fill();
          c.fillStyle = '#C6D5EE'; c.fillRect(x - 20, y - 58, 14, 50); c.fillRect(x + 8, y - 40, 22, 32); c.beginPath(); c.moveTo(x - 24, y - 58); c.lineTo(x - 13, y - 76); c.lineTo(x - 2, y - 58); c.fill();
          c.globalAlpha = 1;
        }
        for (var j = 0; j < 9; j++) puff(c, j * 118 + 40, 500 + hsh(j, 5) * 24, 30 + hsh(j, 6) * 14, '#FFFFFF');
        c.fillStyle = '#FFFFFF'; c.fillRect(0, 520, LW, 20);
      } }
    ],
    prism: [
      { f: 0.07, base: '#33255F', draw: function (c) {
        for (var i = 0; i < 12; i++) {
          var x = i * 88 + hsh(i, 1) * 40, h = 160 + hsh(i, 2) * 220, w = 30 + hsh(i, 3) * 30, lean = (hsh(i, 4) - 0.5) * 40;
          c.fillStyle = '#33255F'; c.beginPath(); c.moveTo(x - w, LH); c.lineTo(x - w * 0.6 + lean, LH - h + 30); c.lineTo(x + lean, LH - h); c.lineTo(x + w * 0.6 + lean, LH - h + 30); c.lineTo(x + w, LH); c.fill();
          c.fillStyle = '#3F2F72'; c.beginPath(); c.moveTo(x + lean, LH - h); c.lineTo(x + w * 0.6 + lean, LH - h + 30); c.lineTo(x + w, LH); c.lineTo(x + 4, LH); c.fill();
        }
      } },
      { f: 0.2, base: '#4C3590', draw: function (c) {
        for (var i = 0; i < 9; i++) {
          var x = i * 118 + 30, h = 70 + hsh(i, 7) * 110, w = 20 + hsh(i, 8) * 16, cyan = i % 3 === 0;
          c.fillStyle = cyan ? '#3B7FA8' : '#5A3FA6'; c.beginPath(); c.moveTo(x - w, LH); c.lineTo(x - w * 0.5, LH - h + 18); c.lineTo(x, LH - h); c.lineTo(x + w * 0.5, LH - h + 18); c.lineTo(x + w, LH); c.fill();
          c.fillStyle = cyan ? '#5CC8E6' : '#8A6BD8'; c.beginPath(); c.moveTo(x, LH - h); c.lineTo(x + w * 0.5, LH - h + 18); c.lineTo(x + w * 0.3, LH); c.lineTo(x, LH); c.fill();
        }
        c.fillStyle = '#4C3590'; c.fillRect(0, 512, LW, 28);
      } }
    ],
    bouncy: [
      { f: 0.08, base: '#FFC4E1', draw: function (c) {
        hills(c, 400, [[30, 2, 1], [12, 6, 0]], '#FFC4E1');
        c.fillStyle = 'rgba(255,255,255,.35)';
        for (var i = 0; i < 50; i++) { var x = hsh(i, 1) * LW; var y = hillY(x, 400, [[30, 2, 1], [12, 6, 0]]) + 20 + hsh(i, 2) * 100; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); }
      } },
      { f: 0.22, base: '#FFADD4', draw: function (c) {
        for (var i = 0; i < 2; i++) {
          var x = 180 + i * 520, y = 360;
          c.fillStyle = i ? '#FF9DC9' : '#FFA7CF'; rr(c, x - 110, y, 220, 180, 26); c.fill();
          c.fillStyle = 'rgba(255,255,255,.35)'; for (var s = 0; s < 5; s++) c.fillRect(x - 100 + s * 44, y + 12, 18, 168);
          c.fillStyle = i ? '#FF9DC9' : '#FFA7CF';
          for (var t = 0; t < 4; t++) { c.beginPath(); c.arc(x - 90 + t * 60, y, 26, Math.PI, 0); c.fill(); }
          c.fillStyle = '#FFE07A'; c.beginPath(); c.moveTo(x, y - 90); c.lineTo(x + 30, y - 78); c.lineTo(x, y - 66); c.fill();
          c.fillStyle = '#E58AB6'; c.fillRect(x - 2, y - 92, 4, 70);
        }
        hills(c, 470, [[16, 3, 2], [8, 8, 1]], '#FFADD4');
      } }
    ],
    ropeway: [
      { f: 0.07, base: '#DDB07F', draw: function (c) {
        c.fillStyle = '#E8C095';
        var m = [[0, 330], [90, 330], [110, 300], [260, 300], [280, 340], [380, 340], [400, 260], [520, 260], [545, 320], [700, 320], [720, 280], [860, 280], [880, 330], [1024, 330]];
        c.beginPath(); c.moveTo(0, LH); m.forEach(function (p) { c.lineTo(p[0], p[1]); }); c.lineTo(LW, LH); c.fill();
        c.fillStyle = '#DDB07F'; c.fillRect(0, 420, LW, 120);
        c.fillStyle = 'rgba(160,100,60,.18)'; for (var y = 300; y < LH; y += 22) c.fillRect(0, y, LW, 6);
      } },
      { f: 0.22, base: '#B98257', draw: function (c) {
        var towers = [60, 316, 572, 828];
        c.strokeStyle = '#6E4B30'; c.lineWidth = 2.5;
        towers.forEach(function (x, i) {
          var nx = x + 256;
          c.beginPath(); c.moveTo(x, 262); c.quadraticCurveTo(x + 128, 300, nx, 262); c.stroke();
          c.beginPath(); c.moveTo(x, 276); c.quadraticCurveTo(x + 128, 314, nx, 276); c.stroke();
          var gx = x + 128 + (i % 2 ? 40 : -30), gy = 290 + (i % 2 ? -3 : -1);
          c.fillStyle = '#6E4B30'; c.fillRect(gx - 1, gy - 6, 2, 16);
          c.fillStyle = i % 2 ? '#8E6A4E' : '#7A7F6E'; rr(c, gx - 11, gy + 8, 22, 15, 4); c.fill();
          c.fillStyle = '#C9B597'; c.fillRect(gx - 7, gy + 11, 5, 5); c.fillRect(gx + 2, gy + 11, 5, 5);
        });
        towers.forEach(function (x) {
          c.fillStyle = '#8E6440'; c.fillRect(x - 6, 262, 12, 280); c.fillRect(x - 22, 258, 44, 8);
          c.strokeStyle = '#5E3F26'; c.lineWidth = 3;
          [x - 14, x + 14].forEach(function (wx) { c.fillStyle = '#A97A50'; c.beginPath(); c.arc(wx, 262, 9, 0, TAU); c.fill(); c.stroke();
            c.beginPath(); c.moveTo(wx - 7, 262); c.lineTo(wx + 7, 262); c.moveTo(wx, 255); c.lineTo(wx, 269); c.stroke(); });
        });
        hills(c, 490, [[10, 3, 1], [5, 9, 2]], '#B98257');
      } }
    ],
    foundry: [
      { f: 0.07, base: '#2E1712', draw: function (c) {
        c.fillStyle = '#2E1712';
        var b = [[0, 330, 180], [190, 280, 160], [360, 350, 140], [510, 300, 200], [720, 340, 140], [870, 290, 154]];
        b.forEach(function (q, i) {
          c.fillStyle = '#2E1712'; c.fillRect(q[0], q[1], q[2], LH - q[1]);
          for (var k = 0; k < 3; k++) { var tx = q[0] + 20 + k * 40; if (tx > q[0] + q[2] - 20) break; c.beginPath(); c.moveTo(tx, q[1]); c.lineTo(tx + 20, q[1] - 22); c.lineTo(tx + 40, q[1]); c.fill(); }
          if (i % 2 === 0) { c.fillRect(q[0] + q[2] - 50, q[1] - 140, 24, 140); c.fillRect(q[0] + q[2] - 54, q[1] - 146, 32, 10); }
          c.fillStyle = 'rgba(255,138,61,.5)'; for (var w = 0; w < 4; w++) c.fillRect(q[0] + 16 + w * 34, q[1] + 40, 14, 18);
        });
      } },
      { f: 0.2, base: '#1E0F0C', draw: function (c) {
        c.fillStyle = '#1E0F0C'; c.fillRect(0, 470, LW, 70);
        c.strokeStyle = '#26130F'; c.lineWidth = 18;
        c.beginPath(); c.moveTo(0, 400); c.lineTo(300, 400); c.lineTo(300, 470); c.moveTo(420, 470); c.lineTo(420, 360); c.lineTo(760, 360); c.lineTo(760, 470); c.moveTo(860, 430); c.lineTo(1024, 430); c.stroke();
        c.fillStyle = '#331A14'; [[300, 400], [420, 360], [760, 360]].forEach(function (p) { c.fillRect(p[0] - 14, p[1] - 14, 28, 28); });
      } }
    ],
    hazard: [
      { f: 0.05, base: '#2A2A26', draw: function (c) {
        c.fillStyle = '#24241F'; c.fillRect(0, 0, LW, LH);
        c.save(); c.beginPath(); c.rect(0, 180, LW, 70); c.clip();
        c.fillStyle = '#3A3624'; c.fillRect(0, 180, LW, 70);
        c.fillStyle = '#2A2A26'; for (var x = -80; x < LW + 80; x += 64) { c.beginPath(); c.moveTo(x, 250); c.lineTo(x + 32, 250); c.lineTo(x + 102, 180); c.lineTo(x + 70, 180); c.fill(); }
        c.restore();
        c.fillStyle = '#1E1E1A'; for (var p = 0; p < LW; p += 128) c.fillRect(p, 0, 6, LH);
        c.fillStyle = '#2A2A26'; c.fillRect(0, 380, LW, 160);
      } },
      { f: 0.2, base: '#1C1C1A', draw: function (c) {
        c.fillStyle = '#1C1C1A'; c.fillRect(0, 480, LW, 60);
        for (var i = 0; i < 7; i++) { var x = 40 + i * 150 + hsh(i, 3) * 40; rr(c, x, 420, 40, 60, 6); c.fill(); c.fillStyle = '#33321E'; c.fillRect(x, 436, 40, 6); c.fillRect(x, 458, 40, 6); c.fillStyle = '#1C1C1A'; }
        for (var j = 0; j < 3; j++) { var sx = 150 + j * 340; c.fillRect(sx - 3, 330, 6, 150); c.beginPath(); c.moveTo(sx, 290); c.lineTo(sx + 30, 340); c.lineTo(sx - 30, 340); c.fill(); c.fillStyle = '#4A4426'; c.fillRect(sx - 2, 305, 4, 18); c.fillRect(sx - 2, 327, 4, 4); c.fillStyle = '#1C1C1A'; }
      } }
    ],
    summit: [
      { f: 0.04, base: '#33467E', draw: function (c) { peaks(c, 0, ridge(5, 8, 200, 360), '#33467E', '#8FA3D9'); c.fillStyle = '#33467E'; c.fillRect(0, 440, LW, 100); } },
      { f: 0.16, base: '#22305A', draw: function (c) { peaks(c, 0, ridge(9, 6, 300, 450), '#22305A', '#C9D6EE'); c.fillStyle = '#22305A'; c.fillRect(0, 500, LW, 40); } }
    ]
  };

  function ensureBg(theme) {
    var bs = Math.min(s0, 1.5);
    if (bg.theme === theme && bg.layers && Math.abs(bg.scale - bs) < 0.01) return;
    bg.theme = theme; bg.scale = bs;
    var defs = BG[theme] || BG.meadow;
    bg.layers = defs.map(function (d) {
      var c = document.createElement('canvas');
      c.width = Math.ceil(LW * bs); c.height = Math.ceil(LH * bs);
      var x = c.getContext('2d'); x.scale(bs, bs);
      try { d.draw(x); } catch (e) {}
      return { c: c, f: d.f, base: d.base };
    });
  }

  function drawSky(theme, camX, camY, levelBottomY, t) {
    var P = THEMES[theme] || THEMES.meadow;
    var gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, P.sky[0]); gr.addColorStop(1, P.sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    ensureBg(theme);
    skyExtras(theme, camX, t);
    var lw = LW * s0, lh = LH * s0;
    for (var i = 0; i < bg.layers.length; i++) {
      var Ly = bg.layers[i];
      var ox = ((camX * Ly.f * s0) % lw + lw) % lw;
      var bottom = H + (levelBottomY - H) * Math.min(1, Ly.f * 1.6);
      bottom = Math.max(H * 0.62, bottom);
      var top = bottom - lh;
      for (var x = -ox; x < W; x += lw) g.drawImage(Ly.c, x, top, lw + 1, lh);
      if (bottom < H) { g.fillStyle = Ly.base; g.fillRect(0, bottom - 1, W, H - bottom + 1); }
      if (i === 0) midExtras(theme, camX, t, top);
    }
    g.fillStyle = rgba(P.sky[1], 0.22); g.fillRect(0, 0, W, H);
  }
  // animated screen-space extras
  function skyExtras(theme, camX, t) {
    var s = s0, i, x, y;
    if (theme === 'summit' || theme === 'prism' || theme === 'foundry' || theme === 'hazard') {
      var n = theme === 'summit' ? 70 : 30;
      for (i = 0; i < n; i++) {
        x = ((hsh(i, 1) * 1.3 * W - camX * 0.02 * s) % W + W) % W; y = hsh(i, 2) * H * 0.55;
        var tw = 0.5 + 0.5 * Math.sin(t * (1 + hsh(i, 3) * 2) + i);
        g.fillStyle = theme === 'foundry' ? rgba('#FF9A4D', 0.25 * tw) : rgba('#FFFFFF', (theme === 'summit' ? 0.85 : 0.35) * tw);
        var r = (hsh(i, 4) < 0.15 ? 2.2 : 1.2) * s;
        g.fillRect(x - r / 2, y - r / 2, r, r);
      }
      if (theme === 'summit') {
        var mx = W * 0.78 - camX * 0.01 * s, my = H * 0.17;
        glow(g, mx, my, 70 * s, '#DDE6FF', 0.25);
        g.fillStyle = '#F2F5FF'; g.beginPath(); g.arc(mx, my, 24 * s, 0, TAU); g.fill();
        g.fillStyle = '#C9D3F0'; g.beginPath(); g.arc(mx - 7 * s, my - 4 * s, 5 * s, 0, TAU); g.arc(mx + 8 * s, my + 7 * s, 3.5 * s, 0, TAU); g.fill();
      }
    }
    if (theme === 'meadow' || theme === 'skyway' || theme === 'bouncy' || theme === 'ropeway') {
      var span = W + 400 * s;
      for (i = 0; i < 6; i++) {
        x = ((hsh(i, 9) * span + t * (6 + i * 2) * s - camX * 0.04 * s) % span + span) % span - 200 * s;
        y = (40 + hsh(i, 8) * 170) * s;
        g.save(); g.globalAlpha = theme === 'skyway' ? 0.9 : 0.75; g.translate(x, y); g.scale(s, s);
        puff(g, 0, 0, 22 + hsh(i, 7) * 18, '#FFFFFF'); g.restore();
      }
    }
    if (theme === 'meadow') { var sx = W * 0.15 - camX * 0.01 * s, sy = H * 0.14; glow(g, sx, sy, 90 * s, '#FFF2B0', 0.5); g.fillStyle = '#FFF4C4'; g.beginPath(); g.arc(sx, sy, 26 * s, 0, TAU); g.fill(); }
  }
  function midExtras(theme, camX, t, layerTop) {
    var s = s0, i, x, y;
    if (theme === 'bouncy') {
      var cols = ['#FF6F91', '#FFD15C', '#6FD6FF', '#B98CFF', '#7CF0A9'];
      for (i = 0; i < 9; i++) {
        var span = W + 200 * s;
        x = ((hsh(i, 3) * span - camX * 0.12 * s) % span + span) % span - 100 * s + Math.sin(t * 0.8 + i) * 8 * s;
        var cyc = (t * (10 + hsh(i, 4) * 8) + hsh(i, 5) * 700) % 700;
        y = H + 60 * s - cyc * s;
        g.strokeStyle = 'rgba(120,60,90,.35)'; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x, y + 18 * s); g.quadraticCurveTo(x - 6 * s, y + 34 * s, x + 2 * s, y + 52 * s); g.stroke();
        g.fillStyle = rgba(mix(cols[i % 5], '#FFC4E1', 0.55), 0.3); g.beginPath(); g.ellipse(x, y, 10 * s, 12.5 * s, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(x - 4 * s, y - 6 * s, 3 * s, 5 * s, -0.4, 0, TAU); g.fill();
      }
    } else if (theme === 'foundry') {
      var stacks = [[160, 330 - 146], [530, 300 - 146], [990, 290 - 146]];
      var lw = LW * s, ox = ((camX * 0.07 * s) % lw + lw) % lw;
      for (var k = -1; k < Math.ceil(W / lw) + 1; k++) for (i = 0; i < stacks.length; i++) for (var q = 0; q < 5; q++) {
        var ph = (t * 0.25 + q / 5 + i * 0.13) % 1;
        x = k * lw - ox + (stacks[i][0] - 18 + ph * 30) * s; y = layerTop + (stacks[i][1] - ph * 120) * s;
        g.fillStyle = rgba('#5A4038', 0.45 * (1 - ph)); g.beginPath(); g.arc(x, y, (10 + ph * 26) * s, 0, TAU); g.fill();
      }
      for (i = 0; i < 18; i++) { var e = (t * (0.15 + hsh(i, 2) * 0.2) + hsh(i, 1)) % 1; x = ((hsh(i, 3) * W - camX * 0.1 * s) % W + W) % W + Math.sin(t * 2 + i) * 10 * s; y = H - e * H * 0.8;
        g.fillStyle = rgba('#FF9A4D', 0.7 * (1 - e)); g.fillRect(x, y, 2.2 * s, 2.2 * s); }
    } else if (theme === 'hazard') {
      for (i = 0; i < 3; i++) {
        var lw2 = LW * s, bx = ((150 + i * 340) * s - ((camX * 0.2 * s) % lw2 + lw2) % lw2);
        for (var kk = 0; kk < 3; kk++) {
          x = bx + kk * lw2; y = layerTop + 286 * s;
          var a = t * 3 + i;
          g.save(); g.translate(x, y); g.rotate(a);
          var gr = g.createRadialGradient(0, 0, 0, 0, 0, 120 * s); gr.addColorStop(0, 'rgba(200,160,90,.12)'); gr.addColorStop(1, 'rgba(200,160,90,0)');
          g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 120 * s, -0.35, 0.35); g.closePath(); g.fill(); g.restore();
          g.fillStyle = '#6E6040'; g.beginPath(); g.arc(x, y, 4 * s, 0, TAU); g.fill();
        }
      }
    } else if (theme === 'workshop') {
      for (i = 0; i < 2; i++) {
        x = ((i ? 0.72 : 0.22) * W) - camX * 0.03 * s; y = H * (i ? 0.2 : 0.3);
        g.save(); g.translate(x, y); g.rotate(t * (i ? -0.2 : 0.25)); g.fillStyle = 'rgba(70,52,72,.55)';
        gearPath(g, 0, 0, 44 * s, 9, 0, 9 * s); g.fill(); g.fillStyle = 'rgba(122,99,120,1)'; g.beginPath(); g.arc(0, 0, 14 * s, 0, TAU); g.fill(); g.restore();
      }
    } else if (theme === 'prism') {
      for (i = 0; i < 14; i++) {
        x = ((hsh(i, 7) * W - camX * 0.08 * s) % W + W) % W; y = layerTop + (200 + hsh(i, 8) * 300) * s;
        var tw = Math.max(0, Math.sin(t * 1.7 + i * 1.3)); if (tw < 0.2) continue;
        star(g, x, y, (3 + tw * 4) * s, rgba(i % 2 ? '#9FF6FF' : '#F2D6FF', tw * 0.8));
      }
    }
  }
  function star(c, x, y, r, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill();
  }

  // ---------- tiles ----------
  function isSolidCh(ch) { return ch === '#' || ch === '=' || ch === '<' || ch === '>'; }
  function cacheRes() { return Math.max(1, Math.min(2, Math.round(s0 * 0.9 * 4) / 4)); }

  function buildLevel(world, info) {
    var raw = info.raw, map = raw.map, rows = map.length, cols = map[0].length;
    L = { raw: raw, map: map, rows: rows, cols: cols, theme: THEMES[info.theme] ? info.theme : 'meadow', slots: (world.players || []).map(function (p) { return p.slot; }),
      springs: [], conv: [], crumbles: [], colorWalls: [] };
    L.P = THEMES[L.theme];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var ch = map[r][c];
      if (ch === '*') L.springs.push([c, r]);
      else if (ch === '<' || ch === '>') L.conv.push([c, r, ch === '>' ? 1 : -1]);
      else if (ch === '=') L.crumbles.push([c, r]);
    }
    buildCache();
  }
  function chAt(c, r) { if (!L) return '.'; if (c < 0 || c >= L.cols) return '#'; if (r < 0 || r >= L.rows) return '.'; return L.map[r][c]; }

  function buildCache() {
    var res = cacheRes(), wpx = L.cols * T, hpx = L.rows * T;
    while (res > 0.5 && wpx * hpx * res * res > 14e6) res -= 0.25;
    var c = document.createElement('canvas');
    c.width = Math.ceil(wpx * res); c.height = Math.ceil(hpx * res);
    var x = c.getContext('2d'); x.scale(res, res);
    for (var r = 0; r < L.rows; r++) for (var col = 0; col < L.cols; col++) {
      var ch = L.map[r][col];
      try {
        if (ch === '#' || ch === '<' || ch === '>') solidTile(x, col, r, L.P, ch);
        else if (ch === '-') oneWay(x, col, r, L.P);
        else if (ch === '^') spikes(x, col, r);
        else if (ch >= 'a' && ch <= 'd') colorWall(x, col, r, ch.charCodeAt(0) - 97);
      } catch (e) {}
    }
    L.cache = c; L.cacheScale = res;
  }

  function solidTile(g, c, r, P, ch, ox, oy, nbOverride) {
    var x = ox != null ? ox : c * T, y = oy != null ? oy : r * T;
    var nb = nbOverride || { u: isSolidCh(chAt(c, r - 1)), d: isSolidCh(chAt(c, r + 1)), l: isSolidCh(chAt(c - 1, r)), r: isSolidCh(chAt(c + 1, r)) };
    var h1 = hsh(c, r), h2 = hsh(c + 99, r * 7);
    g.save();
    // rounded outer corners
    var rad = 7;
    g.beginPath();
    var tl = !nb.u && !nb.l ? rad : 0, tr = !nb.u && !nb.r ? rad : 0, br = !nb.d && !nb.r ? 4 : 0, bl = !nb.d && !nb.l ? 4 : 0;
    g.moveTo(x + tl, y); g.lineTo(x + T - tr, y); if (tr) g.quadraticCurveTo(x + T, y, x + T, y + tr);
    g.lineTo(x + T, y + T - br); if (br) g.quadraticCurveTo(x + T, y + T, x + T - br, y + T);
    g.lineTo(x + bl, y + T); if (bl) g.quadraticCurveTo(x, y + T, x, y + T - bl);
    g.lineTo(x, y + tl); if (tl) g.quadraticCurveTo(x, y, x + tl, y);
    g.closePath(); g.clip();
    g.fillStyle = P.body; g.fillRect(x, y, T, T);
    // texture
    texture(g, P, x, y, c, r, h1, h2);
    // brick seams (chunky blocks)
    g.fillStyle = P.seam;
    if (nb.r) g.fillRect(x + T - 1, y + 2, 1, T - 4);
    if (nb.d) g.fillRect(x + 2, y + T - 1, T - 4, 1);
    // edges
    if (!nb.l) { g.fillStyle = shade(P.body, 0.12); g.fillRect(x, y, 3, T); }
    if (!nb.r) { g.fillStyle = P.dark; g.fillRect(x + T - 4, y, 4, T); }
    if (!nb.d) { g.fillStyle = P.dark; g.fillRect(x, y + T - 6, T, 6); g.fillStyle = shade(P.dark, -0.2); g.fillRect(x, y + T - 2, T, 2); }
    if (!nb.u) {
      g.fillStyle = P.lipDk; g.fillRect(x, y + 6, T, 4);
      g.fillStyle = P.lip; g.fillRect(x, y, T, 8);
      g.fillStyle = P.lipHi; g.fillRect(x + (nb.l ? 0 : 3), y + 1, T - (nb.l ? 0 : 3) - (nb.r ? 0 : 3), 2);
    }
    if (ch === '<' || ch === '>') {
      g.fillStyle = '#2A2638'; g.fillRect(x, y, T, 10);
      g.fillStyle = '#4A4560'; g.fillRect(x, y + 10, T, 2);
      g.fillStyle = '#8A86A0'; [6, 26].forEach(function (k) { g.beginPath(); g.arc(x + k, y + 18, 3, 0, TAU); g.fill(); });
    }
    g.restore();
    // decorations that overhang
    if (!nb.u && ch === '#') deco(g, P, x, y, c, r, nb, h1);
  }
  function texture(g, P, x, y, c, r, h1, h2) {
    var k, px, py;
    switch (P.tex) {
      case 'pebbles':
        g.fillStyle = P.speck;
        for (k = 0; k < 4; k++) { px = x + 4 + hsh(c * 3 + k, r) * 24; py = y + 10 + hsh(c, r * 5 + k) * 18; g.beginPath(); g.ellipse(px, py, 2.6, 1.8, 0, 0, TAU); g.fill(); }
        g.fillStyle = shade(P.body, 0.1); g.beginPath(); g.ellipse(x + 8 + h1 * 16, y + 16 + h2 * 10, 1.6, 1.2, 0, 0, TAU); g.fill();
        break;
      case 'plates':
        g.fillStyle = shade(P.body, 0.07); g.fillRect(x + 3, y + 3, T - 6, T - 6);
        g.fillStyle = P.speck; [[6, 6], [26, 6], [6, 26], [26, 26]].forEach(function (q) { g.beginPath(); g.arc(x + q[0], y + q[1], 1.6, 0, TAU); g.fill(); });
        break;
      case 'cracks':
        g.strokeStyle = P.speck; g.lineWidth = 1.2;
        if (h1 < 0.5) { g.beginPath(); g.moveTo(x + 6 + h2 * 10, y + 12); g.lineTo(x + 14 + h1 * 6, y + 20); g.lineTo(x + 12 + h2 * 8, y + 28); g.stroke(); }
        g.fillStyle = P.speck; g.fillRect(x + 4 + h2 * 22, y + 14 + h1 * 12, 2, 2);
        break;
      case 'puffs':
        g.fillStyle = shade(P.body, 0.1); g.beginPath(); g.arc(x + 10 + h1 * 12, y + 18 + h2 * 6, 5, 0, TAU); g.fill();
        g.fillStyle = P.speck; g.beginPath(); g.arc(x + 22 - h2 * 10, y + 26, 3, 0, TAU); g.fill();
        break;
      case 'facets':
        g.fillStyle = shade(P.body, 0.08); g.beginPath(); g.moveTo(x, y + 32); g.lineTo(x + 16 + h1 * 10, y + 8); g.lineTo(x + 32, y + 22); g.lineTo(x + 32, y + 32); g.fill();
        g.fillStyle = P.speck; g.beginPath(); g.moveTo(x + 4, y + 30); g.lineTo(x + 10, y + 18 + h2 * 6); g.lineTo(x + 14, y + 30); g.fill();
        break;
      case 'dots':
        g.fillStyle = P.speck;
        for (k = 0; k < 2; k++) for (var j = 0; j < 2; j++) { g.beginPath(); g.arc(x + 9 + k * 14 + (j ? 7 : 0) * 0, y + 14 + j * 10, 2.4, 0, TAU); g.fill(); }
        break;
      case 'strata':
        g.fillStyle = P.speck; g.fillRect(x, y + 14 + ((r * 3) % 4), T, 3); g.fillRect(x, y + 24 + ((c + r) % 3), T, 2);
        g.fillStyle = shade(P.body, 0.1); g.fillRect(x + h1 * 20, y + 19, 8, 2);
        break;
      case 'rivets':
        g.fillStyle = P.speck; g.fillRect(x + 2, y + 2, T - 4, T - 4);
        g.fillStyle = P.body; g.fillRect(x + 4, y + 4, T - 8, T - 8);
        g.fillStyle = shade(P.body, 0.2); [[7, 7], [25, 7], [7, 25], [25, 25]].forEach(function (q) { g.beginPath(); g.arc(x + q[0], y + q[1], 1.8, 0, TAU); g.fill(); });
        break;
      case 'grate':
        g.fillStyle = P.speck; for (k = 0; k < 4; k++) g.fillRect(x + 4 + k * 7, y + 12, 3, 16);
        break;
      case 'rock':
        g.fillStyle = P.speck; g.beginPath(); g.moveTo(x + 2 + h1 * 8, y + 30); g.lineTo(x + 10 + h1 * 8, y + 16 + h2 * 6); g.lineTo(x + 20, y + 30); g.fill();
        g.fillStyle = shade(P.body, 0.1); g.beginPath(); g.arc(x + 22 + h2 * 4, y + 16, 3, 0, TAU); g.fill();
        break;
    }
  }
  function deco(g, P, x, y, c, r, nb, h1) {
    if (P.deco === 'grass') {
      g.fillStyle = P.lipHi;
      for (var k = 0; k < 3; k++) { var bx = x + 4 + k * 10 + h1 * 4; g.beginPath(); g.moveTo(bx, y + 1); g.lineTo(bx + 2, y - 4 - hsh(c, k) * 3); g.lineTo(bx + 4, y + 1); g.fill(); }
      if (hsh(c, r + 3) < 0.12) { g.fillStyle = '#FF8FB0'; g.beginPath(); g.arc(x + 16, y - 3, 2.5, 0, TAU); g.fill(); g.fillStyle = '#FFE36B'; g.beginPath(); g.arc(x + 16, y - 3, 1, 0, TAU); g.fill(); }
      g.fillStyle = P.lip; if (!nb.l) { g.beginPath(); g.arc(x + 4, y + 8, 3, 0, TAU); g.fill(); } if (!nb.r) { g.beginPath(); g.arc(x + 28, y + 9, 3, 0, TAU); g.fill(); }
    } else if (P.deco === 'snow') {
      g.fillStyle = '#FFFFFF';
      g.beginPath(); g.moveTo(x, y - 1); g.quadraticCurveTo(x + 8, y - 5, x + 16, y - 2); g.quadraticCurveTo(x + 24, y - 5, x + 32, y - 1); g.lineTo(x + 32, y + 4); g.lineTo(x, y + 4); g.fill();
      if (!nb.l) { g.beginPath(); g.ellipse(x + 3, y + 10, 3, 5, 0, 0, TAU); g.fill(); }
      if (!nb.r && hsh(c, r) < 0.6) { g.beginPath(); g.ellipse(x + 29, y + 11, 2.5, 6, 0, 0, TAU); g.fill(); }
    } else if (P.deco === 'stripes') {
      g.save(); g.beginPath(); g.rect(x, y, T, 8); g.clip();
      g.fillStyle = '#1C1C1A'; for (var s = -8; s < 32; s += 12) { g.beginPath(); g.moveTo(x + s, y + 8); g.lineTo(x + s + 6, y + 8); g.lineTo(x + s + 14, y); g.lineTo(x + s + 8, y); g.fill(); }
      g.restore();
    } else if (P.deco === 'hot') {
      g.fillStyle = 'rgba(255,120,40,.55)'; g.fillRect(x, y + 8, T, 2);
    } else if (P.deco === 'gems' && hsh(c, r) < 0.18) {
      g.fillStyle = '#7FE3E8'; g.beginPath(); g.moveTo(x + 14, y + 2); g.lineTo(x + 18, y - 6); g.lineTo(x + 22, y + 2); g.fill();
      g.fillStyle = '#E8FDFF'; g.fillRect(x + 17, y - 3, 1.5, 3);
    } else if (P.deco === 'candy') {
      g.fillStyle = '#FF8FB8'; for (var q = 0; q < 2; q++) { g.beginPath(); g.arc(x + 8 + q * 16, y + 8, 3.2, 0, Math.PI); g.fill(); }
    } else if (P.deco === 'cloud') {
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x + 8, y + 2, 5, Math.PI, 0); g.arc(x + 20, y + 1, 7, Math.PI, 0); g.arc(x + 30, y + 3, 4, Math.PI, 0); g.fill();
    } else if (P.deco === 'rivets') {
      g.fillStyle = P.lipDk; g.beginPath(); g.arc(x + 8, y + 4, 1.5, 0, TAU); g.arc(x + 24, y + 4, 1.5, 0, TAU); g.fill();
    } else if (P.deco === 'stripe') {
      g.fillStyle = '#E8B33A'; if ((c & 1) === 0) g.fillRect(x + 4, y + 2, 10, 3);
    }
  }
  function oneWay(g, c, r, P) {
    var x = c * T, y = r * T, lft = chAt(c - 1, r) !== '-', rgt = chAt(c + 1, r) !== '-';
    g.fillStyle = shade(P.plank, -0.45);
    if (lft) { g.beginPath(); g.moveTo(x + 3, y + 9); g.lineTo(x + 11, y + 9); g.lineTo(x + 3, y + 18); g.fill(); }
    if (rgt) { g.beginPath(); g.moveTo(x + 29, y + 9); g.lineTo(x + 21, y + 9); g.lineTo(x + 29, y + 18); g.fill(); }
    rr(g, x + (lft ? 1 : 0), y, T - (lft ? 1 : 0) - (rgt ? 1 : 0), 9, lft || rgt ? 3 : 0);
    g.fillStyle = P.plank; g.fill();
    g.fillStyle = shade(P.plank, 0.3); g.fillRect(x + (lft ? 3 : 0), y + 1, T - (lft ? 3 : 0) - (rgt ? 3 : 0), 2);
    g.fillStyle = shade(P.plank, -0.3); g.fillRect(x, y + 7, T, 2);
    g.fillStyle = shade(P.plank, -0.2); g.fillRect(x + 15, y + 2, 2, 5);
  }
  function spikes(g, c, r) {
    var x = c * T, y = r * T;
    for (var k = 0; k < 3; k++) {
      var bx = x + 3 + k * 9;
      g.fillStyle = OUT; g.beginPath(); g.moveTo(bx - 1.4, y + 32.5); g.lineTo(bx + 4.5, y + 12.6); g.lineTo(bx + 10.4, y + 32.5); g.fill();
      g.fillStyle = '#B9BED0'; g.beginPath(); g.moveTo(bx, y + 32); g.lineTo(bx + 4.5, y + 15); g.lineTo(bx + 9, y + 32); g.fill();
      g.fillStyle = '#6A7086'; g.beginPath(); g.moveTo(bx + 4.5, y + 15); g.lineTo(bx + 9, y + 32); g.lineTo(bx + 4.5, y + 32); g.fill();
      g.fillStyle = '#F4F6FF'; g.fillRect(bx + 3.6, y + 17, 1.2, 3);
    }
    g.fillStyle = OUT; g.fillRect(x, y + 29, T, 3);
  }
  function colorWall(g, c, r, slot) {
    var x = c * T, y = r * T, col = SLOT[slot], present = L.slots.indexOf(slot) >= 0, ch = String.fromCharCode(97 + slot);
    g.save();
    g.fillStyle = present ? rgba(col, 0.32) : rgba(shade(col, -0.55), 0.92); g.fillRect(x, y, T, T);
    // sheen
    g.fillStyle = rgba('#FFFFFF', present ? 0.12 : 0.05);
    g.beginPath(); g.moveTo(x + ((c + r) % 2) * 10, y + 32); g.lineTo(x + 10 + ((c + r) % 2) * 10, y + 32); g.lineTo(x + 26 + ((c + r) % 2) * 6, y); g.lineTo(x + 16 + ((c + r) % 2) * 6, y); g.fill();
    // emblem pattern
    g.fillStyle = rgba(present ? shade(col, 0.4) : col, present ? 0.75 : 0.45);
    emblemPath(g, EMBLEM[slot], x + 16, y + 16, 5); g.fill();
    g.fillStyle = rgba(present ? shade(col, 0.4) : col, present ? 0.35 : 0.25);
    emblemPath(g, EMBLEM[slot], x + 4, y + 4, 2.2); g.fill();
    // borders where the wall meets non-wall
    g.fillStyle = present ? col : shade(col, -0.2);
    if (chAt(c, r - 1) !== ch) g.fillRect(x, y, T, 3);
    if (chAt(c, r + 1) !== ch) g.fillRect(x, y + T - 3, T, 3);
    if (chAt(c - 1, r) !== ch) g.fillRect(x, y, 3, T);
    if (chAt(c + 1, r) !== ch) g.fillRect(x + T - 3, y, 3, T);
    g.restore();
  }

  // dynamic tiles
  function dynTiles(world, t) {
    var P = L.P, i, c, r, x, y;
    // conveyors: animated chevrons on the belt
    for (i = 0; i < L.conv.length; i++) {
      c = L.conv[i][0]; r = L.conv[i][1]; var d = L.conv[i][2]; x = c * T; y = r * T;
      g.save(); g.beginPath(); g.rect(x, y + 1, T, 8); g.clip();
      var off = ((t * 1.4 * 60 * d) % 12 + 12) % 12;
      g.fillStyle = '#FFB627';
      for (var k = -12; k < T + 12; k += 12) {
        var bx = x + k + off;
        g.beginPath();
        if (d > 0) { g.moveTo(bx, y + 1); g.lineTo(bx + 4, y + 1); g.lineTo(bx + 8, y + 5); g.lineTo(bx + 4, y + 9); g.lineTo(bx, y + 9); g.lineTo(bx + 4, y + 5); }
        else { g.moveTo(bx + 8, y + 1); g.lineTo(bx + 4, y + 1); g.lineTo(bx, y + 5); g.lineTo(bx + 4, y + 9); g.lineTo(bx + 8, y + 9); g.lineTo(bx + 4, y + 5); }
        g.fill();
      }
      g.restore();
      var rot = t * 6 * d;
      g.strokeStyle = '#2A2638'; g.lineWidth = 1.5;
      [6, 26].forEach(function (k2) { g.beginPath(); g.moveTo(x + k2 + Math.cos(rot) * 3, y + 18 + Math.sin(rot) * 3); g.lineTo(x + k2 - Math.cos(rot) * 3, y + 18 - Math.sin(rot) * 3); g.stroke(); });
    }
    // springs: steel coil, slate pad with white up-chevrons and a bobbing arrow (distinct from channel/bot colours)
    for (i = 0; i < L.springs.length; i++) {
      c = L.springs[i][0]; r = L.springs[i][1]; x = c * T; y = r * T;
      var st = springFx[c + ',' + r], age = st != null ? time - st : 9, comp = 0;
      if (age < 0.5) comp = Math.sin(age * 28) * Math.exp(-age * 7) * 7;
      var top = y + 13 - comp;
      g.fillStyle = OUT; rr(g, x + 3, y + 27, 26, 5, 2); g.fill();
      g.fillStyle = '#4A5068'; rr(g, x + 4.5, y + 28, 23, 3, 1.5); g.fill();
      var n = 6, hh = (y + 28) - (top + 6);
      g.lineCap = 'round';
      [[OUT, 4.6], ['#E3E7F2', 2.4]].forEach(function (sty) {
        g.strokeStyle = sty[0]; g.lineWidth = sty[1]; g.beginPath(); g.moveTo(x + 8, y + 28);
        for (var q = 0; q <= n; q++) g.lineTo(x + (q % 2 ? 24 : 8), y + 28 - q * hh / n);
        g.stroke();
      });
      g.lineCap = 'butt';
      g.fillStyle = OUT; rr(g, x + 1, top - 1, 30, 8, 3.5); g.fill();
      g.fillStyle = '#5E6E92'; rr(g, x + 2.5, top + 0.5, 27, 5, 2.5); g.fill();
      g.fillStyle = '#FFFFFF';
      [10, 16, 22].forEach(function (cx2) { g.beginPath(); g.moveTo(cx2 - 2.6, top + 4.6); g.lineTo(cx2, top + 1.6); g.lineTo(cx2 + 2.6, top + 4.6); g.lineTo(cx2 + 1.4, top + 4.6); g.lineTo(cx2, top + 3.2); g.lineTo(cx2 - 1.4, top + 4.6); g.fill(); });
      var bob = (time * 1.6 + c * 0.37) % 1, ay = top - 5 - bob * 9;
      g.globalAlpha = 0.65 * (1 - bob);
      g.fillStyle = OUT; g.beginPath(); g.moveTo(x + 16, ay - 5.5); g.lineTo(x + 22.5, ay + 1); g.lineTo(x + 9.5, ay + 1); g.fill();
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(x + 16, ay - 3.5); g.lineTo(x + 20.5, ay); g.lineTo(x + 11.5, ay); g.fill();
      g.globalAlpha = 1;
    }
    // crumble blocks
    for (i = 0; i < L.crumbles.length; i++) {
      c = L.crumbles[i][0]; r = L.crumbles[i][1]; x = c * T; y = r * T;
      var cs = world.crumble && world.crumble[c + ',' + r], gone = cs && cs.gone;
      if (!gone && SB.Engine && SB.Engine.tileAt) { try { gone = SB.Engine.tileAt(world, c, r) === '.'; } catch (e) {} }
      if (gone) {
        g.strokeStyle = rgba(P.lip, 0.35); g.lineWidth = 1.5; g.setLineDash([4, 4]); g.strokeRect(x + 2, y + 2, T - 4, T - 4); g.setLineDash([]);
        continue;
      }
      var sh = cs && !cs.gone ? Math.max(0.35, Math.min(1, 1 - (cs.t || 0) / 30)) : 0, jx = sh ? Math.sin(time * 70 + c) * 1.6 * sh : 0, jy = sh ? Math.cos(time * 55 + r) * 1 * sh : 0;
      g.save(); g.translate(jx, jy);
      g.fillStyle = shade(P.body, 0.12); rr(g, x + 1, y + 1, T - 2, T - 2, 5); g.fill();
      g.fillStyle = P.lip; rr(g, x + 1, y + 1, T - 2, 7, 4); g.fill();
      g.strokeStyle = shade(P.body, -0.35); g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x + 9, y + 9); g.lineTo(x + 14, y + 17); g.lineTo(x + 10, y + 26); g.moveTo(x + 14, y + 17); g.lineTo(x + 23, y + 20); g.lineTo(x + 26, y + 12); g.stroke();
      g.strokeStyle = OUT; g.lineWidth = 1.5; rr(g, x + 1, y + 1, T - 2, T - 2, 5); g.stroke();
      if (sh) { g.fillStyle = rgba('#FFFFFF', 0.25 * sh); rr(g, x + 1, y + 1, T - 2, T - 2, 5); g.fill(); }
      g.restore();
    }
  }

  // ---------- entities ----------
  function dots(g, cx, cy, need, lit, col) {
    need = Math.max(1, need | 0);
    if (need > 4) {
      g.fillStyle = OUT; rr(g, cx - 11, cy - 7, 22, 14, 6); g.fill();
      g.fillStyle = '#FFF6E8'; g.font = '900 11px ' + FONT_B; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(Math.min(lit, need) + '/' + need, cx, cy + 0.5);
      return;
    }
    var gap = 7, x0 = cx - (need - 1) * gap / 2;
    for (var i = 0; i < need; i++) {
      g.fillStyle = OUT; g.beginPath(); g.arc(x0 + i * gap, cy, 3.4, 0, TAU); g.fill();
      g.fillStyle = i < lit ? (col || '#FFF6E8') : '#4A4560'; g.beginPath(); g.arc(x0 + i * gap, cy, 2.2, 0, TAU); g.fill();
    }
  }
  var FONT_B = "'Nunito','Trebuchet MS',Arial,sans-serif";
  function nBots(world) { return (world.players || []).length || 1; }

  function drawCrate(e, x, y, world) {
    var w = e.w || T, h = e.h || T, P = L.P, base = P.crate || '#C98544';
    g.fillStyle = OUT; rr(g, x - 1, y - 1, w + 2, h + 2, 5); g.fill();
    g.fillStyle = base; rr(g, x + 1, y + 1, w - 2, h - 2, 4); g.fill();
    g.fillStyle = shade(base, -0.18);
    for (var py = y + 9; py < y + h - 4; py += 9) g.fillRect(x + 3, py, w - 6, 1.5);
    g.strokeStyle = shade(base, -0.35); g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(x + 6, y + h - 6); g.lineTo(x + w - 6, y + 6); g.stroke();
    g.fillStyle = shade(base, -0.3);
    g.fillRect(x + 1, y + 1, w - 2, 4); g.fillRect(x + 1, y + h - 5, w - 2, 4); g.fillRect(x + 1, y + 1, 4, h - 2); g.fillRect(x + w - 5, y + 1, 4, h - 2);
    g.fillStyle = shade(base, 0.3); g.fillRect(x + 3, y + 2, w - 6, 1.5);
    g.fillStyle = '#E8D9B8'; [[4, 4], [w - 4, 4], [4, h - 4], [w - 4, h - 4]].forEach(function (q) { g.beginPath(); g.arc(x + q[0], y + q[1], 1.3, 0, TAU); g.fill(); });
    var need = Math.min(e.need || 1, nBots(world));
    var cy = y + h / 2;
    g.fillStyle = 'rgba(26,18,48,.55)'; rr(g, x + w / 2 - Math.max(9, need * 3.5 + 3), cy - 6, Math.max(18, need * 7 + 6), 12, 6); g.fill();
    dots(g, x + w / 2, cy, need, e.pushers || 0, '#B6FF5C');
    if ((e.weight || 1) > 1) { g.fillStyle = '#FFF6E8'; g.font = '900 9px ' + FONT_B; g.textAlign = 'right'; g.textBaseline = 'top'; g.fillText('x' + e.weight, x + w - 6, y + 6); }
  }
  function drawButton(e, x, y, world) {
    y = Math.floor((y + 0.5) / T) * T;
    var w = e.w || T, col = chColor(e.channel), on = !!e.on, pr = !!e.pressed;
    var ph = pr ? 3 : 6, py = y + T - 4 - ph;
    if (on) glow(g, x + w / 2, y + T - 6, w / 2 + 14, col, 0.35);
    g.fillStyle = OUT; rr(g, x + 1, y + T - 6, w - 2, 6, 2); g.fill();
    g.fillStyle = '#3B3550'; rr(g, x + 2, y + T - 5, w - 4, 4, 1.5); g.fill();
    g.fillStyle = OUT; rr(g, x + 3, py - 1, w - 6, ph + 2, 3); g.fill();
    g.fillStyle = on ? shade(col, 0.25) : shade(col, -0.3); rr(g, x + 4, py, w - 8, ph, 2.5); g.fill();
    g.fillStyle = rgba('#FFFFFF', on ? 0.6 : 0.25); g.fillRect(x + 6, py + 1, w - 12, 1.3);
    var need = Math.min(e.need || 1, nBots(world));
    var cx = x + w / 2, ty = need > 1 ? y + T - 30 : y + T - 19;
    if (need > 1) { dots(g, cx, y + T - 17, need, Math.min(need, e.load || 0), col); }
    var tf = timerFrac(e);
    if (tf > 0) { timerRing(cx, ty, 11, tf, col); chanTimer[e.channel] = Math.max(chanTimer[e.channel] || 0, tf); }
    if (e.mode === 'latch' || e.mode === 'timer') {
      g.save(); g.translate(cx + 15, ty);
      g.fillStyle = OUT; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill();
      g.strokeStyle = col; g.lineWidth = 1.5;
      if (e.mode === 'timer') { g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -2.4); g.moveTo(0, 0); g.lineTo(1.8, 0); g.stroke(); }
      else { g.fillStyle = col; g.fillRect(-2.2, -0.5, 4.4, 3.2); g.beginPath(); g.arc(0, -0.8, 1.8, Math.PI, 0); g.stroke(); }
      g.restore();
    }
    chanTag(e.channel, cx, ty, col);
  }
  /** timer plates: fraction of the countdown left after release (0 when not counting) */
  function timerFrac(e) {
    if (e.mode !== 'timer' || e.pressed || !e.on || !(e.timer > 0)) return 0;
    var tot = e.time || (e.def && e.def.time) || 180;
    return Math.max(0, Math.min(1, e.timer / tot));
  }
  function timerRing(x, y, r, f, col) {
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(26,18,48,.75)'; g.lineWidth = 4.5; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    g.strokeStyle = f < 0.25 && ((time * 6) | 0) % 2 ? '#FFFFFF' : col; g.lineWidth = 2.6;
    g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * f); g.stroke();
    g.lineCap = 'butt';
  }
  var chanTimer = {};
  function chanTag(ch, x, y, col) {
    if (!ch) return;
    g.fillStyle = OUT; g.beginPath(); g.arc(x, y, 7.5, 0, TAU); g.fill();
    g.fillStyle = col; g.font = '900 11.5px ' + FONT_B; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, x, y + 1);
  }
  function drawLever(e, x, y) {
    var col = chColor(e.channel), on = !!e.on, cx = x + 16, by = y + T;
    var ang = on ? 0.6 : -0.6;
    var tx = cx + Math.sin(ang) * 18, ty = by - 7 - Math.cos(ang) * 18;
    g.strokeStyle = OUT; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, by - 7); g.lineTo(tx, ty); g.stroke();
    g.strokeStyle = '#C7CCDA'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(cx, by - 7); g.lineTo(tx, ty); g.stroke(); g.lineCap = 'butt';
    if (on) glow(g, tx, ty, 14, col, 0.45);
    g.fillStyle = OUT; g.beginPath(); g.arc(tx, ty, 5.5, 0, TAU); g.fill();
    g.fillStyle = on ? shade(col, 0.2) : shade(col, -0.15); g.beginPath(); g.arc(tx, ty, 4, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(tx - 1.3, ty - 1.3, 1.3, 0, TAU); g.fill();
    g.fillStyle = OUT; rr(g, x + 5, by - 10, 22, 10, 4); g.fill();
    g.fillStyle = '#4A4560'; rr(g, x + 6.5, by - 8.5, 19, 7, 3); g.fill();
    g.fillStyle = on ? col : '#2A2638'; g.beginPath(); g.arc(x + 10, by - 5, 1.8, 0, TAU); g.fill();
    g.fillStyle = on ? '#2A2638' : '#FF4D5E'; g.beginPath(); g.arc(x + 22, by - 5, 1.8, 0, TAU); g.fill();
  }
  function drawGate(e, idx, x, y, dt) {
    var w = e.w || T, h = e.h || T, col = chColor(e.channel);
    var amt = typeof e.openAmt === 'number' ? e.openAmt : null;
    var key = e.id || idx;
    if (amt == null) { var cur = gateAmt[key] == null ? (e.open ? 1 : 0) : gateAmt[key]; cur += ((e.open ? 1 : 0) - cur) * Math.min(1, dt * 8); gateAmt[key] = cur; amt = cur; }
    var horiz = w > h;
    var vis = horiz ? w * (1 - amt) : h * (1 - amt);
    // frame/ghost outline
    g.strokeStyle = rgba(col, 0.35); g.lineWidth = 1.5; g.setLineDash([3, 4]); g.strokeRect(x + 2, y + 2, w - 4, h - 4); g.setLineDash([]);
    if (vis > 0.5) {
      g.save(); g.beginPath();
      if (horiz) g.rect(x, y + 3, vis, h - 6); else g.rect(x + 3, y, w - 6, vis);
      g.clip();
      g.fillStyle = shade(col, -0.45); g.fillRect(x, y, w, h);
      g.fillStyle = col;
      var off = horiz ? -(w - vis) : -(h - vis);
      for (var s = -h - w; s < w + h; s += 16) {
        g.beginPath();
        if (horiz) { g.moveTo(x + s + off, y + h); g.lineTo(x + s + 8 + off, y + h); g.lineTo(x + s + 8 + h + off, y); g.lineTo(x + s + h + off, y); }
        else { g.moveTo(x, y + s + off); g.lineTo(x + w, y + s + w + off); g.lineTo(x + w, y + s + w + 8 + off); g.lineTo(x, y + s + 8 + off); }
        g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,.18)'; if (horiz) g.fillRect(x, y + 3, vis, 2); else g.fillRect(x + 3, y, 3, vis);
      g.restore();
      g.strokeStyle = OUT; g.lineWidth = 2;
      if (horiz) g.strokeRect(x + 1, y + 3, Math.max(1, vis - 2), h - 6); else g.strokeRect(x + 3, y + 1, w - 6, Math.max(1, vis - 2));
      g.fillStyle = shade(col, 0.4);
      if (horiz) g.fillRect(x + vis - 3, y + 3, 3, h - 6); else g.fillRect(x + 3, y + vis - 3, w - 6, 3);
    }
    // housing cap
    g.fillStyle = OUT;
    if (horiz) { rr(g, x - 3, y, 7, h, 2); g.fill(); g.fillStyle = '#4A4560'; g.fillRect(x - 1.5, y + 1.5, 4, h - 3); }
    else { rr(g, x, y - 3, w, 7, 2); g.fill(); g.fillStyle = '#4A4560'; g.fillRect(x + 1.5, y - 1.5, w - 3, 4); }
    var lx = horiz ? x + 0.5 : x + w / 2, ly = horiz ? y + h / 2 : y + 0.5;
    g.fillStyle = e.open ? '#5CFF8A' : col; g.beginPath(); g.arc(lx, ly, 2, 0, TAU); g.fill();
  }
  function drawPlatform(e, x, y, world) {
    var w = e.w || T * 3, col = e.channel ? chColor(e.channel) : (e.need > 0 ? '#FFB627' : '#C7CCDA');
    g.fillStyle = rgba(col, 0.35); g.beginPath(); g.ellipse(x + w / 2, y + 16, w * 0.3, 3, 0, 0, TAU); g.fill();
    var fl = 0.6 + 0.4 * Math.sin(time * 20 + x);
    glow(g, x + 10, y + 14, 8, '#7FE3FF', 0.5 * fl); glow(g, x + w - 10, y + 14, 8, '#7FE3FF', 0.5 * fl);
    g.fillStyle = OUT; rr(g, x - 1, y - 1, w + 2, 14, 5); g.fill();
    g.fillStyle = '#8D93AE'; rr(g, x + 1, y + 1, w - 2, 10, 4); g.fill();
    g.fillStyle = '#C9CEE2'; g.fillRect(x + 4, y + 2, w - 8, 2);
    g.fillStyle = col; g.fillRect(x + 3, y + 7, w - 6, 3);
    g.fillStyle = '#5A5F78'; for (var k = x + 14; k < x + w - 8; k += 16) g.fillRect(k, y + 4, 2, 3);
    if (e.need > 0) { var need = Math.min(e.need, nBots(world)); g.fillStyle = OUT; rr(g, x + w / 2 - need * 3.5 - 4, y + 12, need * 7 + 8, 10, 4); g.fill(); dots(g, x + w / 2, y + 17, need, Math.min(need, e.riders || 0), '#FFB627'); }
    if (e.channel) chanTag(e.channel, x + 8, y + 17, col);
  }
  function drawPaths(world) {
    var ents = L.raw.entities || [];
    g.save(); g.setLineDash([2, 6]); g.lineCap = 'round';
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (!e.path || e.path.length < 2 || (e.type !== 'platform' && e.type !== 'saw')) continue;
      var ox = e.type === 'saw' ? 16 : (e.w || 1) * 16, oy = e.type === 'saw' ? 16 : 6;
      g.strokeStyle = e.type === 'saw' ? 'rgba(30,20,50,.45)' : 'rgba(255,255,255,.28)'; g.lineWidth = e.type === 'saw' ? 4 : 2;
      g.beginPath();
      for (var k = 0; k < e.path.length; k++) { var px = e.path[k][0] * T + ox, py = e.path[k][1] * T + oy; if (k) g.lineTo(px, py); else g.moveTo(px, py); }
      if (e.mode === 'loop') g.closePath();
      g.stroke();
    }
    g.restore();
  }
  function sawCenter(e, x, y) {
    var w = e.w || 0, h = e.h || 0;
    if (w && h) return [x + w / 2, y + h / 2];
    if (e.cx != null) return [e.cx, e.cy];
    return [x, y];
  }
  function drawSaw(e, x, y) {
    var c = sawCenter(e, x, y), r = e.r || 14, a = typeof e.angle === 'number' ? e.angle : time * 12;
    g.save(); g.translate(c[0], c[1]);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(0, 0, r + 3, 0, TAU); g.fill();
    g.rotate(a);
    g.fillStyle = OUT; gearPath(g, 0, 0, r + 1.5, 10, 0, 5); g.fill();
    g.fillStyle = '#D8DCE8'; gearPath(g, 0, 0, r, 10, 0, 4.5); g.fill();
    g.fillStyle = '#A3A9BD'; g.beginPath(); g.arc(0, 0, r - 5, 0, TAU); g.fill();
    g.strokeStyle = '#EEF1F8'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, r - 7, 0.3, 1.6); g.stroke();
    g.fillStyle = '#FF4D5E'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
    g.fillStyle = OUT; g.beginPath(); g.arc(0, 0, 1.6, 0, TAU); g.fill();
    g.restore();
  }
  var DIRV = { r: [1, 0], l: [-1, 0], u: [0, -1], d: [0, 1] };
  function laserColor(e) { return e.channel ? chColor(e.channel) : '#FF3355'; }
  function drawLaserEmitter(e, x, y) {
    var d = DIRV[e.dir] || DIRV.r, col = laserColor(e), cx = x + 16, cy = y + 16;
    g.save(); g.translate(cx, cy); g.rotate(Math.atan2(d[1], d[0]));
    g.fillStyle = OUT; rr(g, -14, -12, 24, 24, 5); g.fill();
    g.fillStyle = '#4A4560'; rr(g, -12.5, -10.5, 21, 21, 4); g.fill();
    g.fillStyle = '#2A2638'; g.fillRect(-10, -6, 4, 12);
    g.fillStyle = OUT; rr(g, 6, -7, 9, 14, 3); g.fill();
    g.fillStyle = e.beamOn ? shade(col, 0.3) : shade(col, -0.5); rr(g, 8, -5, 6, 10, 2); g.fill();
    g.restore();
    if (e.channel) chanTag(e.channel, x + 7, y + 7, col);
  }
  function drawBeam(e, x, y) {
    var d = DIRV[e.dir] || DIRV.r, col = laserColor(e);
    var sx = x + 16 + d[0] * 15, sy = y + 16 + d[1] * 15;
    if (e.x1 || e.y1) { sx = e.x1; sy = e.y1; }
    var ex = e.x2, ey = e.y2;
    if (!ex && !ey && e.len == null) return;
    if (ex == null) { var len = e.len || 0; ex = sx + d[0] * len; ey = sy + d[1] * len; }
    if (!e.beamOn) {
      g.strokeStyle = rgba(col, 0.18); g.lineWidth = 1; g.setLineDash([3, 6]); g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
      return;
    }
    var fl = 0.85 + 0.15 * Math.sin(time * 40 + x);
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    g.strokeStyle = rgba(col, 0.18); g.lineWidth = 12 * fl; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = rgba(col, 0.55); g.lineWidth = 5 * fl; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = rgba('#FFFFFF', 0.9); g.lineWidth = 1.6; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    g.restore();
    glow(g, ex, ey, 12, col, 0.6);
    if (Math.random() < 0.3) spawn({ x: ex, y: ey, vx: (Math.random() - 0.5) * 2 - d[0], vy: (Math.random() - 0.5) * 2 - d[1] - 0.5, life: 0.25, size: 1.6, col: shade(col, 0.4), kind: 'spark', grav: 0.05 });
  }
  function drawGear(gr, i) {
    var bob = Math.sin(time * 3 + i) * 2, x = gr.x, y = gr.y + bob;
    if (gr.x != null && gr.x % 32 === 0 && gr.c == null) { /* gears given at tile corner? assume center */ }
    glow(g, x, y, 18, '#FFD86B', 0.35);
    g.save(); g.translate(x, y); g.rotate(time * 1.5 + i);
    g.fillStyle = OUT; gearPath(g, 0, 0, 10, 7, 0, 3.5); g.fill();
    g.fillStyle = '#FFC94D'; gearPath(g, 0, 0, 8.6, 7, 0, 3); g.fill();
    g.fillStyle = '#FFE9A8'; g.beginPath(); g.arc(-1.5, -1.5, 3, Math.PI, 1.5 * Math.PI); g.lineTo(0, 0); g.fill();
    g.fillStyle = OUT; g.beginPath(); g.arc(0, 0, 2.4, 0, TAU); g.fill();
    g.restore();
    if (Math.random() < 0.02) spawn({ x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 16, vx: 0, vy: -0.2, life: 0.6, size: 3, col: '#FFF2B0', kind: 'star' });
  }

  // ---------- Power Cell + hatch ----------
  function drawCell(cx, cy, sc, a) {
    g.save(); g.translate(cx, cy); g.scale(sc, sc); if (a != null) g.globalAlpha = a;
    glow(g, 0, 0, 28, CELL, 0.28 + 0.12 * Math.sin(time * 4));
    drawCellBody();
    g.restore();
  }
  function drawCellBody() {
    g.fillStyle = OUT; rr(g, -5, -15.5, 10, 6, 2); g.fill();
    g.fillStyle = '#D9E3EA'; rr(g, -3.5, -14, 7, 4, 1.5); g.fill();
    g.fillStyle = OUT; rr(g, -9.5, -12.5, 19, 26, 8); g.fill();
    var gr = g.createLinearGradient(-8, 0, 8, 0); gr.addColorStop(0, '#7CF08A'); gr.addColorStop(0.45, CELL); gr.addColorStop(1, '#4ACB6A');
    g.fillStyle = gr; rr(g, -8, -11, 16, 23, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; rr(g, -5.5, -9, 3, 12, 1.5); g.fill();
    g.fillStyle = '#1F5E2E'; g.beginPath(); g.moveTo(1.8, -8); g.lineTo(-4, 1.5); g.lineTo(-0.4, 1.5); g.lineTo(-2.2, 9); g.lineTo(4.2, -1); g.lineTo(0.6, -1); g.lineTo(2.8, -8); g.closePath(); g.fill();
  }
  function drawDoor(world) {
    var d = world.door; if (!d) return;
    var x = d.x, y = d.y, w = d.w || T, h = d.h || T * 2, open = !!d.open, cx = x + w / 2;
    var fx = x - 7, fw = w + 14, fy = y - 8, fh = h + 8, R = fw / 2;
    if (open) glow(g, cx, y + h * 0.55, 60, '#5CFFC8', 0.28 + 0.08 * Math.sin(time * 3));
    // frame
    g.fillStyle = OUT; g.beginPath(); g.moveTo(fx - 1.5, fy + fh); g.lineTo(fx - 1.5, fy + R); g.arc(cx, fy + R, R + 1.5, Math.PI, 0); g.lineTo(fx + fw + 1.5, fy + fh); g.closePath(); g.fill();
    var fg = g.createLinearGradient(fx, 0, fx + fw, 0); fg.addColorStop(0, '#B5BBD3'); fg.addColorStop(0.5, '#8C92AE'); fg.addColorStop(1, '#6A6F8C');
    g.fillStyle = fg; g.beginPath(); g.moveTo(fx, fy + fh); g.lineTo(fx, fy + R); g.arc(cx, fy + R, R, Math.PI, 0); g.lineTo(fx + fw, fy + fh); g.closePath(); g.fill();
    // inner opening
    var ix = x + 1, iw = w - 2, iy = y + 2, ir = iw / 2;
    g.save(); g.beginPath(); g.moveTo(ix, y + h); g.lineTo(ix, iy + ir); g.arc(cx, iy + ir, ir, Math.PI, 0); g.lineTo(ix + iw, y + h); g.closePath(); g.clip();
    if (open) {
      var ig = g.createRadialGradient(cx, y + h * 0.6, 2, cx, y + h * 0.6, h * 0.6); ig.addColorStop(0, '#E9FFF6'); ig.addColorStop(0.35, '#5CFFC8'); ig.addColorStop(1, '#14806A');
      g.fillStyle = ig; g.fillRect(ix, iy, iw, h);
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5;
      for (var k = 0; k < 3; k++) { var ph = (time * 0.7 + k / 3) % 1; g.globalAlpha = 1 - ph; g.beginPath(); g.ellipse(cx, y + h * 0.6, ph * iw * 0.6, ph * h * 0.45, 0, 0, TAU); g.stroke(); }
      g.globalAlpha = 1;
    } else {
      g.fillStyle = '#120D24'; g.fillRect(ix, iy, iw, h);
      g.fillStyle = '#2A2340'; for (var s = iy + 8; s < y + h; s += 7) g.fillRect(ix, s, iw, 3);
      g.globalAlpha = 0.4 + 0.25 * Math.sin(time * 3);
      drawCellOutline(cx, y + h * 0.55);
      g.globalAlpha = 1;
    }
    g.restore();
    // rivets
    g.fillStyle = '#5A5F78'; [fy + R + 6, fy + fh - 8].forEach(function (ry) { g.beginPath(); g.arc(fx + 3.5, ry, 1.5, 0, TAU); g.arc(fx + fw - 3.5, ry, 1.5, 0, TAU); g.fill(); });
    // status light
    var lc = open ? '#5CFF8A' : '#FF4D5E';
    glow(g, cx, fy + 1, 14, lc, 0.6);
    g.fillStyle = OUT; g.beginPath(); g.arc(cx, fy + 1, 5.5, 0, TAU); g.fill();
    g.fillStyle = lc; g.beginPath(); g.arc(cx, fy + 1, 4, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(cx - 1.2, fy - 0.2, 1.3, 0, TAU); g.fill();
    // entered dots
    var pl = world.players || [];
    for (var i = 0; i < pl.length; i++) {
      var p = pl[i], side = i % 2 ? 1 : -1, row = i >> 1;
      var dx = side < 0 ? fx + 3.5 : fx + fw - 3.5, dy = fy + R + 16 + row * 12;
      var inn = p.state === 'entered';
      g.fillStyle = OUT; g.beginPath(); g.arc(dx, dy, 3.3, 0, TAU); g.fill();
      g.fillStyle = inn ? SLOT[p.slot] : '#3B3550'; g.beginPath(); g.arc(dx, dy, 2.2, 0, TAU); g.fill();
      if (inn) glow(g, dx, dy, 8, SLOT[p.slot], 0.6);
    }
  }
  function drawCellOutline(cx, cy) {
    g.strokeStyle = CELL; g.lineWidth = 1.5; rr(g, cx - 5, cy - 7, 10, 15, 4.5); g.stroke(); g.fillStyle = CELL; g.fillRect(cx - 2, cy - 9.5, 4, 2);
  }

  // ---------- bots ----------
  function eyeColor(slot) { return mix(SLOT[slot], '#FFFFFF', 0.72); }
  /** draw a bot with feet at (fx, fy) center-bottom. o: {facing,vx,vy,onGround,moving,phase,landAge,dead,happy,alpha,t} */
  function bot(gx, slot, fx, fy, o) {
    var col = SLOT[slot] || '#CCCCCC', dark = shade(col, -0.3), light = shade(col, 0.38), t = o.t != null ? o.t : time;
    var sx = 1, sy = 1, rot = 0;
    if (o.dead) { var k0 = Math.min(1, (o.deadAge || 0) * 3); sx = 1 + 0.15 * k0; sy = 1 - 0.25 * k0; rot = 0.25 * k0 * (o.facing || 1); }
    else if (o.landAge != null && o.landAge < 0.2) { var k = 1 - o.landAge / 0.2; k *= k; sx = 1 + 0.24 * k; sy = 1 - 0.2 * k; }
    else if (!o.onGround) { if (o.vy < -2) { sx = 0.86; sy = 1.14; } else if (o.vy > 4) { sx = 0.94; sy = 1.06; } }
    gx.save(); gx.translate(fx, fy); gx.rotate(rot); gx.scale(sx, sy);
    if (o.alpha != null && o.alpha < 1) gx.globalAlpha = o.alpha;
    var face = o.facing || 1;
    // antenna
    var sway = Math.max(-4, Math.min(4, -(o.vx || 0) * 1.2)) + Math.sin(t * 2.2 + slot) * 0.6 + (o.onGround ? 0 : (o.vy || 0) * 0.15);
    var tipX = sway, tipY = -36 + (o.onGround ? 0 : Math.min(2, (o.vy || 0) * 0.2));
    gx.strokeStyle = OUT; gx.lineWidth = 2.4; gx.beginPath(); gx.moveTo(0, -27); gx.quadraticCurveTo(sway * 0.2, -32, tipX, tipY); gx.stroke();
    var pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + slot * 1.7);
    if (!o.dead) { var gg = gx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 9); gg.addColorStop(0, rgba(light, 0.55 * pulse + 0.15)); gg.addColorStop(1, rgba(light, 0)); gx.fillStyle = gg; gx.fillRect(tipX - 9, tipY - 9, 18, 18); }
    gx.fillStyle = OUT; gx.beginPath(); gx.arc(tipX, tipY, 3.6, 0, TAU); gx.fill();
    gx.fillStyle = o.dead ? '#55506A' : mix(light, '#FFFFFF', 0.3 * pulse); gx.beginPath(); gx.arc(tipX, tipY, 2.5, 0, TAU); gx.fill();
    // feet
    var l1 = 0, l2 = 0, f1 = 0, f2 = 0;
    if (o.onGround && o.moving && !o.dead) { var s = Math.sin(o.phase || 0); l1 = Math.max(0, s) * 3; l2 = Math.max(0, -s) * 3; f1 = Math.cos(o.phase || 0) * 1.5; f2 = -f1; }
    else if (!o.onGround && !o.dead) { l1 = l2 = 1.5; }
    foot(gx, -6.5 + f1, -l1, dark); foot(gx, 6.5 + f2, -l2, dark);
    // body
    gx.fillStyle = OUT; rr(gx, -13.2, -29.2, 26.4, 26.6, 7.2); gx.fill();
    gx.fillStyle = col; rr(gx, -12, -28, 24, 24.2, 6.2); gx.fill();
    gx.save(); rr(gx, -12, -28, 24, 24.2, 6.2); gx.clip();
    gx.fillStyle = dark; gx.fillRect(-12, -9.5, 24, 6);
    gx.fillStyle = rgba('#FFFFFF', 0.28); gx.fillRect(-10, -27, 15, 1.8);
    gx.fillStyle = rgba('#000000', 0.12); gx.fillRect(9.5, -27, 2.5, 22);
    gx.restore();
    // visor
    var vx0 = -10.2 + face * 0.6;
    gx.fillStyle = VISOR; rr(gx, vx0, -25.2, 20.4, 10.4, 4.5); gx.fill();
    gx.save(); rr(gx, vx0, -25.2, 20.4, 10.4, 4.5); gx.clip();
    var ex = face * 1.8, ec = eyeColor(slot);
    if (!o.dead) { var eg = gx.createRadialGradient(ex, -20, 0, ex, -20, 11); eg.addColorStop(0, rgba(col, 0.45)); eg.addColorStop(1, rgba(col, 0)); gx.fillStyle = eg; gx.fillRect(-11, -26, 22, 12); }
    gx.fillStyle = 'rgba(255,255,255,.13)'; gx.beginPath(); gx.moveTo(vx0 + 2, -24.4); gx.lineTo(vx0 + 8, -24.4); gx.lineTo(vx0 + 4, -16); gx.lineTo(vx0 + 1, -16); gx.fill();
    gx.restore();
    var blink = !o.dead && ((t * 1000 + slot * 1777) % 3700) < 130;
    var squint = !o.dead && !o.onGround && (o.vy || 0) < -1.5;
    gx.fillStyle = ec; gx.strokeStyle = ec; gx.lineCap = 'round';
    if (o.dead) {
      gx.strokeStyle = '#FF8A8A'; gx.lineWidth = 1.7;
      [-4.5, 4.5].forEach(function (e) { gx.beginPath(); gx.moveTo(e - 2.2, -22.2); gx.lineTo(e + 2.2, -17.8); gx.moveTo(e + 2.2, -22.2); gx.lineTo(e - 2.2, -17.8); gx.stroke(); });
    } else if (o.happy || squint) {
      gx.lineWidth = 1.9;
      [-4.5, 4.5].forEach(function (e) { gx.beginPath(); gx.moveTo(ex + e - 2.4, -18.8); gx.lineTo(ex + e, -21.4); gx.lineTo(ex + e + 2.4, -18.8); gx.stroke(); });
    } else if (blink) {
      gx.fillRect(ex - 6.5, -20.4, 4, 1.4); gx.fillRect(ex + 2.5, -20.4, 4, 1.4);
    } else {
      rr(gx, ex - 6.5, -22.6, 4, 5.4, 1.6); gx.fill(); rr(gx, ex + 2.5, -22.6, 4, 5.4, 1.6); gx.fill();
      gx.fillStyle = '#FFFFFF'; gx.fillRect(ex - 5.7, -21.8, 1.3, 1.3); gx.fillRect(ex + 3.3, -21.8, 1.3, 1.3);
    }
    gx.lineCap = 'butt';
    // chest emblem
    gx.fillStyle = OUT; emblemPath(gx, EMBLEM[slot], 0, -10.8, 3.9); gx.fill();
    gx.fillStyle = CREAM; emblemPath(gx, EMBLEM[slot], 0, -10.8, 2.7); gx.fill();
    gx.restore();
  }
  function foot(gx, cx, dy, dark) {
    gx.fillStyle = OUT; rr(gx, cx - 5.2, -6.2 + dy, 10.4, 6.6, 3); gx.fill();
    gx.fillStyle = dark; rr(gx, cx - 4, -5 + dy, 8, 4.4, 2); gx.fill();
  }

  function botState(p, rx, ry, dt, world, q) {
    if (q && q.facing != null) p = q; // predicted own bot: animate from the local prediction
    var s = botFx[p.slot];
    if (!s) s = botFx[p.slot] = { x: rx, y: ry, phase: 0, landT: -9, ground: true, vy: 0 };
    var dx = rx - s.x, dy = ry - s.y;
    if (Math.abs(dx) > 80 || Math.abs(dy) > 80) { dx = 0; dy = 0; }
    var vy = typeof p.vy === 'number' ? p.vy : dy / Math.max(dt * 60, 0.01);
    var ground = !!p.onGround;
    if (ground && !s.ground && s.airTime > 0.08) s.landT = time;
    s.airTime = ground ? 0 : (s.airTime || 0) + dt;
    s.ground = ground;
    var moving = Math.abs(dx) > 0.05 * Math.max(1, dt * 60);
    if (ground && moving) s.phase += Math.abs(dx) * 0.42;
    s.x = rx; s.y = ry; s.vy = vy;
    return { facing: p.facing || 1, vx: typeof p.vx === 'number' ? p.vx : dx, vy: vy, onGround: ground, moving: moving, phase: s.phase, landAge: time - s.landT };
  }

  // ---------- particles ----------
  function spawn(p) { if (parts.length > 600) parts.shift(); p.age = 0; parts.push(p); }
  function burst(x, y, n, o) {
    for (var i = 0; i < n; i++) {
      var a = (o.a0 != null ? o.a0 : 0) + (o.spread != null ? (Math.random() - 0.5) * o.spread : Math.random() * TAU);
      var sp = (o.sp || 2) * (0.4 + Math.random() * 0.8);
      spawn({ x: x + (Math.random() - 0.5) * (o.jx || 0), y: y + (Math.random() - 0.5) * (o.jy || 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (o.life || 0.5) * (0.6 + Math.random() * 0.6),
        size: (o.size || 3) * (0.6 + Math.random() * 0.7), col: Array.isArray(o.col) ? o.col[(Math.random() * o.col.length) | 0] : o.col, kind: o.kind || 'dust', grav: o.grav || 0, drag: o.drag || 0.94, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.4 });
    }
  }
  function stepParts(dt) {
    var k = dt * 60;
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.age += dt;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      p.vx *= Math.pow(p.drag || 0.94, k); p.vy = p.vy * Math.pow(p.drag || 0.94, k) + (p.grav || 0) * k;
      p.x += p.vx * k; p.y += p.vy * k; if (p.vr) p.rot += p.vr * k;
    }
  }
  function drawParts() {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], a = 1 - p.age / p.life;
      if (p.kind === 'dust') { g.fillStyle = rgba(p.col, 0.7 * a); g.beginPath(); g.arc(p.x, p.y, p.size * (0.6 + 0.6 * (1 - a)), 0, TAU); g.fill(); }
      else if (p.kind === 'spark') { g.strokeStyle = rgba(p.col, a); g.lineWidth = p.size * 0.8; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); g.stroke(); }
      else if (p.kind === 'star') { star(g, p.x, p.y, p.size * (0.5 + a * 0.7), rgba(p.col, a)); }
      else if (p.kind === 'bit' || p.kind === 'confetti') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); if (p.kind === 'confetti') g.scale(1, Math.cos(p.age * 9 + p.rot));
        g.fillStyle = rgba(p.col, Math.min(1, a * 1.6)); g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (p.kind === 'confetti' ? 0.6 : 1)); g.restore();
      }
      else if (p.kind === 'ring') { g.strokeStyle = rgba(p.col, a * 0.8); g.lineWidth = 2.5 * a + 0.5; g.beginPath(); g.arc(p.x, p.y, p.size + (1 - a) * p.grow, 0, TAU); g.stroke(); }
    }
  }
  function onEvents(evs, world) {
    if (!evs || !evs.length || !L) return;
    var P = L.P;
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i], x = e.x, y = e.y, slot = e.slot;
      if ((x == null || y == null) && slot != null && world && world.players) {
        var pp = world.players.filter(function (q) { return q.slot === slot; })[0];
        if (pp) { x = pp.x + 12; y = pp.y + 30; }
      }
      if (x == null) continue;
      var col = SLOT[slot] || '#FFFFFF';
      switch (e.t) {
        case 'jump': burst(x, y, 5, { sp: 1.2, a0: -Math.PI / 2, spread: 2.4, col: '#FFFFFF', size: 3, life: 0.35, jx: 14 }); break;
        case 'land': burst(x, y - 1, 7, { sp: 1.4, a0: Math.PI, spread: 0.6, col: '#FFFFFF', size: 3.2, life: 0.4, jx: 6 }); burst(x, y - 1, 7, { sp: 1.4, a0: 0, spread: 0.6, col: '#FFFFFF', size: 3.2, life: 0.4, jx: 6 }); break;
        case 'key': burst(x, y, 16, { sp: 2.2, col: [CELL, '#FFFFFF'], kind: 'star', size: 5, life: 0.7, drag: 0.9 }); spawn({ x: x, y: y, vx: 0, vy: 0, life: 0.5, size: 6, grow: 34, col: CELL, kind: 'ring' }); break;
        case 'unlock': burst(x, y, 26, { sp: 3, col: ['#5CFF8A', '#FFFFFF', CELL], kind: 'star', size: 6, life: 0.9, drag: 0.9 }); spawn({ x: x, y: y, vx: 0, vy: 0, life: 0.7, size: 10, grow: 70, col: '#5CFF8A', kind: 'ring' }); shakeAmt = Math.max(shakeAmt, 3); break;
        case 'enter': spawn({ x: x, y: y, vx: 0, vy: 0, life: 0.45, size: 6, grow: 30, col: col, kind: 'ring' }); burst(x, y, 10, { sp: 1.8, col: [col, '#FFFFFF'], kind: 'star', size: 4, life: 0.6 }); break;
        case 'exit': burst(x, y, 6, { sp: 1.2, col: '#FFFFFF', size: 3, life: 0.35 }); break;
        case 'die':
          burst(x, y, 26, { sp: 4.5, col: ['#FFE36B', '#FFFFFF', '#FF9A4D'], kind: 'spark', size: 2.4, life: 0.5, grav: 0.12, drag: 0.95 });
          burst(x, y, 12, { sp: 3.5, col: [col, shade(col, -0.3), '#4A4560'], kind: 'bit', size: 4.5, life: 1.0, grav: 0.25, drag: 0.97, a0: -Math.PI / 2, spread: 2.6 });
          shakeAmt = Math.max(shakeAmt, 9); flash = 1; flashCol = '#FF4D5E';
          break;
        case 'clear':
          burst(x, y, 70, { sp: 5, col: SLOT.concat([CELL, '#FFFFFF']), kind: 'confetti', size: 6, life: 2.2, grav: 0.08, drag: 0.96, a0: -Math.PI / 2, spread: 2.2 });
          spawn({ x: x, y: y, vx: 0, vy: 0, life: 0.9, size: 10, grow: 110, col: '#5CFFC8', kind: 'ring' }); flash = 0.6; flashCol = '#FFFFFF';
          break;
        case 'press': case 'release': burst(x, y, 4, { sp: 1.2, a0: -Math.PI / 2, spread: 2, col: '#FFFFFF', kind: 'spark', size: 1.6, life: 0.25 }); break;
        case 'lever': burst(x, y, 6, { sp: 1.6, col: '#FFE36B', kind: 'spark', size: 1.6, life: 0.3 }); break;
        case 'spring': springFx[Math.floor(x / T) + ',' + Math.floor((y - 1) / T)] = time; springFx[Math.floor(x / T) + ',' + Math.floor(y / T)] = time;
          burst(x, y, 8, { sp: 1.6, a0: -Math.PI / 2, spread: 2.8, col: '#FFFFFF', size: 3, life: 0.4 }); break;
        case 'gear': burst(x, y, 12, { sp: 2, col: ['#FFC94D', '#FFF2B0'], kind: 'star', size: 5, life: 0.6 }); spawn({ x: x, y: y, vx: 0, vy: 0, life: 0.35, size: 4, grow: 20, col: '#FFD86B', kind: 'ring' }); break;
        case 'crumble': burst(x, y, 10, { sp: 2, col: [P.body, P.lip, P.dark], kind: 'bit', size: 4, life: 0.8, grav: 0.25, jx: 24, jy: 10 }); break;
        case 'gate': burst(x, y, 5, { sp: 1, col: '#FFFFFF', size: 2.5, life: 0.4, jx: 16 }); break;
      }
    }
  }

  // ---------- camera ----------
  function camTarget(world, pp) {
    var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, n = 0;
    var pl = world.players || [];
    for (var i = 0; i < pl.length; i++) {
      var p = pl[i]; if (p.state === 'entered') continue;
      var q = pp && pp[p.slot] || p;
      minx = Math.min(minx, q.x); maxx = Math.max(maxx, q.x + 24); miny = Math.min(miny, q.y - 10); maxy = Math.max(maxy, q.y + 30); n++;
    }
    if (!n && world.door) { var d = world.door; minx = d.x; maxx = d.x + 32; miny = d.y; maxy = d.y + 64; }
    return { x: (minx + maxx) / 2, y: (miny + maxy) / 2, w: maxx - minx, h: maxy - miny };
  }
  // intro pan: cell -> hatch -> bots (camera only; the simulation keeps running)
  var intro = null;
  function ease(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function startIntro(world) {
    if (!world || !world.door || !L) { intro = null; return; }
    var d = world.door, pts = [];
    if (world.key && !world.key.used && !(world.key.holder >= 0)) pts.push({ x: world.key.x, y: world.key.y, hold: 0.55 });
    pts.push({ x: d.x + (d.w || T) / 2, y: d.y + (d.h || 2 * T) / 2, hold: pts.length ? 0.55 : 0.8 });
    intro = { t: 0, pts: pts, move: pts.length > 1 ? 0.6 : 0.8, last: 0.7 };
    intro.total = pts.reduce(function (a, p) { return a + p.hold; }, 0) + intro.move * (pts.length - 1) + intro.last;
    cam.init = false;
  }
  /** camera position for the intro at time t; returns null when finished */
  function introPose(tg) {
    var t = intro.t, P = intro.pts, i, a, b;
    for (i = 0; i < P.length; i++) {
      if (t < P[i].hold) return { x: P[i].x, y: P[i].y, final: false };
      t -= P[i].hold;
      if (i < P.length - 1) {
        if (t < intro.move) { a = P[i]; b = P[i + 1]; var k = ease(t / intro.move); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, final: false }; }
        t -= intro.move;
      }
    }
    if (t < intro.last) { a = P[P.length - 1]; var k2 = ease(t / intro.last); return { x: a.x + (tg.x - a.x) * k2, y: a.y + (tg.y - a.y) * k2, final: true, k: k2 }; }
    return null;
  }
  var peekAmt = 0;
  function updateCam(world, pp, dt, o) {
    var tg = camTarget(world, pp);
    var vw1 = W / s0, vh1 = H / s0;
    var ptL = Math.min(vh1 * 0.3, (o.padTop || 0) * dpr / s0), pbL = Math.min(vh1 * 0.3, (o.padBottom || 0) * dpr / s0);
    var avail = Math.max(120, vh1 - ptL - pbL);
    var lw = L.cols * T, lh = L.rows * T;
    var zt = Math.min(vw1 / (tg.w + 320), avail / (tg.h + 240));
    zt = Math.max(0.62, Math.min(1, zt));
    // hold-to-peek: zoom out to the whole level (or as much as fits)
    peekAmt += ((o.peek ? 1 : 0) - peekAmt) * (1 - Math.exp(-dt * 9));
    if (peekAmt > 0.001) {
      var fit = Math.max(0.22, Math.min(1, vw1 / (lw + 64), avail / (lh + 64)));
      zt = zt + (Math.min(zt, fit) - zt) * peekAmt;
      tg = { x: tg.x + (lw / 2 - tg.x) * peekAmt, y: tg.y + (lh / 2 - tg.y) * peekAmt };
    }
    if (intro) {
      intro.t += dt;
      var pose = introPose(tg);
      if (!pose) intro = null;
      else {
        cam.x = pose.x; cam.y = pose.y; cam.z = pose.final ? 0.9 + (zt - 0.9) * pose.k : 0.9; cam.init = true;
        tg = null;
      }
    }
    if (tg) {
      if (o.snapCam || !cam.init) { cam.z = zt; cam.x = tg.x; cam.y = tg.y; cam.init = true; }
      else {
        var kz = 1 - Math.exp(-dt * (peekAmt > 0.02 ? 7 : 2.5)), kp = 1 - Math.exp(-dt * (peekAmt > 0.02 ? 9 : 5));
        cam.z += (zt - cam.z) * kz; cam.x += (tg.x - cam.x) * kp; cam.y += (tg.y - cam.y) * kp;
      }
    }
    // cam.x/y is the centre of the free band between the HUD (top) and hint bubble (bottom)
    var vw = vw1 / cam.z, vh = vh1 / cam.z, ptz = ptL / cam.z, pbz = pbL / cam.z, d = (ptz - pbz) / 2;
    var cx = cam.x, cy = cam.y - d;
    if (lw <= vw) cx = lw / 2; else cx = Math.max(vw / 2, Math.min(lw - vw / 2, cx));
    if (lh + 68 <= vh - ptz - pbz) cy = lh + 20 + pbz - vh / 2;
    else cy = Math.max(vh / 2 - ptz - 48, Math.min(lh + 20 + pbz - vh / 2, cy));
    cam.x = cx; cam.y = cy + d;
    return { cx: cx, cy: cy, sc: s0 * cam.z, vw: vw, vh: vh };
  }

  // goal pointers (cell / hatch) at the screen edge when off-screen
  function edgeBadge(sxp, syp, mTop, mBot, col, icon) {
    var m = 26 * dpr;
    if (sxp > m * 0.4 && sxp < W - m * 0.4 && syp > mTop && syp < H - mBot) return;
    var cxp = Math.max(m, Math.min(W - m, sxp)), cyp = Math.max(mTop + m * 0.6, Math.min(H - mBot - m * 0.6, syp));
    var ang = Math.atan2(syp - cyp, sxp - cxp), r = 15 * dpr;
    g.save(); g.translate(cxp, cyp);
    g.save(); g.rotate(ang);
    g.fillStyle = OUT; g.beginPath(); g.moveTo(r + 9 * dpr, 0); g.lineTo(r - 2 * dpr, -8 * dpr); g.lineTo(r - 2 * dpr, 8 * dpr); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(r + 6 * dpr, 0); g.lineTo(r - 1 * dpr, -5 * dpr); g.lineTo(r - 1 * dpr, 5 * dpr); g.fill();
    g.restore();
    g.fillStyle = OUT; g.beginPath(); g.arc(0, 0, r + 2 * dpr, 0, TAU); g.fill();
    g.fillStyle = 'rgba(37,29,66,.95)'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.strokeStyle = col; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(0, 0, r - 1 * dpr, 0, TAU); g.stroke();
    g.scale(dpr, dpr); icon();
    g.restore();
  }
  function iconCell() { g.save(); g.scale(0.62, 0.62); g.translate(0, 1); drawCellBody(); g.restore(); }
  function iconHatch(open) {
    return function () {
      g.fillStyle = OUT; g.beginPath(); g.moveTo(-7.5, 8); g.lineTo(-7.5, -2); g.arc(0, -2, 7.5, Math.PI, 0); g.lineTo(7.5, 8); g.fill();
      g.fillStyle = open ? '#5CFFC8' : '#8C92AE'; g.beginPath(); g.moveTo(-5.5, 7); g.lineTo(-5.5, -2); g.arc(0, -2, 5.5, Math.PI, 0); g.lineTo(5.5, 7); g.fill();
      g.fillStyle = open ? '#5CFF8A' : '#FF4D5E'; g.beginPath(); g.arc(0, -8.5, 2.2, 0, TAU); g.fill();
    };
  }

  // ---------- main frame ----------
  function drawFrame(world, o) {
    if (!g || !L || !world) return;
    o = o || {};
    var dt = Math.min(0.1, o.dt || 1 / 60);
    time += dt;
    stepParts(dt);
    var pp = o.pp || null, ep = o.ep || null;
    chanTimer = {};
    var v = updateCam(world, pp, dt, o);
    var sx = 0, sy = 0;
    if (shakeAmt > 0.05 && o.shake !== false) { sx = (Math.random() - 0.5) * shakeAmt * s0; sy = (Math.random() - 0.5) * shakeAmt * s0; }
    shakeAmt *= Math.exp(-dt * 9);
    g.setTransform(1, 0, 0, 1, 0, 0);
    var levelBottomScreen = (L.rows * T - v.cy) * v.sc + H / 2;
    drawSky(L.theme, v.cx, v.cy, levelBottomScreen, time);
    var ox = W / 2 - v.cx * v.sc + sx, oy = H / 2 - v.cy * v.sc + sy;
    g.setTransform(v.sc, 0, 0, v.sc, ox, oy);
    g.imageSmoothingEnabled = true;
    var lw = L.cols * T, lh = L.rows * T, P = L.P;
    // out-of-bounds walls
    var vx0 = v.cx - v.vw / 2 - 40, vx1 = v.cx + v.vw / 2 + 40, vy0 = v.cy - v.vh / 2 - 40, vy1 = v.cy + v.vh / 2 + 40;
    g.fillStyle = P.dark;
    if (vx0 < 0) { g.fillRect(vx0, vy0, -vx0, vy1 - vy0); g.fillStyle = P.body; g.fillRect(-6, vy0, 6, vy1 - vy0); }
    g.fillStyle = P.dark;
    if (vx1 > lw) { g.fillRect(lw, vy0, vx1 - lw, vy1 - vy0); g.fillStyle = P.body; g.fillRect(lw, vy0, 6, vy1 - vy0); }
    // static tiles
    g.drawImage(L.cache, 0, 0, lw, lh);
    dynTiles(world, time);
    drawPaths(world);
    drawDoor(world);
    var ents = world.entities || [], i, e, ex, ey;
    var lasers = [], saws = [];
    for (i = 0; i < ents.length; i++) {
      e = ents[i]; ex = e.x; ey = e.y;
      if (ep && ep[i]) { ex = ep[i].x; ey = ep[i].y; }
      try {
        switch (e.type) {
          case 'button': drawButton(e, ex, ey, world); break;
          case 'lever': drawLever(e, ex, ey); break;
          case 'gate': drawGate(e, i, ex, ey, dt); break;
          case 'platform': drawPlatform(e, ex, ey, world); break;
          case 'crate': if (!e.gone) drawCrate(e, ex, ey, world); break;
          case 'laser': drawLaserEmitter(e, ex, ey); lasers.push([e, ex, ey]); break;
          case 'saw': saws.push([e, ex, ey]); break;
        }
      } catch (er) {}
    }
    var gears = world.gears || [];
    for (i = 0; i < gears.length; i++) if (!gears[i].taken) drawGear(gears[i], i);
    // power cell
    var key = world.key, pl = world.players || [];
    var holder = null;
    if (key && !key.used) {
      if (key.holder != null && key.holder >= 0) holder = pl.filter(function (q) { return q.slot === key.holder; })[0];
      if (holder) {
        var hp = pp && pp[holder.slot] || holder, f = holder.facing || 1;
        var tx = hp.x + 12 - f * 17, ty = hp.y + 2 + Math.sin(time * 4) * 2;
        if (!cellPos) cellPos = { x: tx, y: ty };
        var kk = 1 - Math.exp(-dt * 14); cellPos.x += (tx - cellPos.x) * kk; cellPos.y += (ty - cellPos.y) * kk;
        if (Math.abs(cellPos.x - tx) > 80 || Math.abs(cellPos.y - ty) > 80) { cellPos.x = tx; cellPos.y = ty; }
        drawCell(cellPos.x, cellPos.y, 0.72);
      } else {
        cellPos = null;
        var kx = key.x, ky = key.y;
        if (o.kp) { kx = o.kp.x; ky = o.kp.y; }
        drawCell(kx, ky + Math.sin(time * 2.5) * 3, 0.9);
        if (Math.random() < 0.05) spawn({ x: kx + (Math.random() - 0.5) * 20, y: ky + (Math.random() - 0.5) * 24, vx: 0, vy: -0.3, life: 0.7, size: 3.5, col: CELL, kind: 'star' });
      }
    } else cellPos = null;
    // ropes
    var ropes = world.ropes || [];
    for (i = 0; i < ropes.length; i++) drawRope(world, ropes[i], pp);
    // bots
    var dead = world.phase === 'dead';
    for (i = 0; i < pl.length; i++) {
      var p = pl[i];
      var q = pp && pp[p.slot] || p;
      var st = botState(p, q.x, q.y, dt, world, q !== p ? q : null);
      if (p.state === 'entered') continue;
      var isDead = dead && p.slot === world.deadSlot;
      if (isDead && botFx[p.slot].deadAt == null) botFx[p.slot].deadAt = time;
      if (!isDead) botFx[p.slot].deadAt = null;
      st.dead = isDead; st.deadAge = isDead ? time - botFx[p.slot].deadAt : 0;
      st.happy = world.phase === 'clear' || (holder && holder.slot === p.slot && st.onGround && !st.moving && ((time * 1000) % 2400) < 600);
      if (isDead && ((time * 12) | 0) % 2) st.alpha = 0.55;
      bot(g, p.slot, q.x + 12, q.y + 30, st);
    }
    // name tags
    if (o.names && o.tagAlpha > 0) {
      g.font = '800 10px ' + FONT_B; g.textAlign = 'center'; g.textBaseline = 'bottom';
      for (i = 0; i < pl.length; i++) {
        p = pl[i]; if (p.state === 'entered') continue;
        q = pp && pp[p.slot] || p;
        var nm = o.names[p.slot]; if (!nm) continue;
        var isMe = o.me === p.slot, tw = g.measureText(nm).width + 10, nx = q.x + 12, ny = q.y - 12;
        g.globalAlpha = o.tagAlpha;
        g.fillStyle = isMe ? SLOT[p.slot] : 'rgba(20,15,38,.8)'; rr(g, nx - tw / 2, ny - 13, tw, 13, 6); g.fill();
        g.fillStyle = isMe ? OUT : '#FFF6E8'; g.fillText(nm, nx, ny - 1.5);
        g.fillStyle = isMe ? SLOT[p.slot] : 'rgba(20,15,38,.8)'; g.beginPath(); g.moveTo(nx - 3, ny); g.lineTo(nx + 3, ny); g.lineTo(nx, ny + 3); g.fill();
        g.globalAlpha = 1;
      }
    }
    for (i = 0; i < saws.length; i++) try { drawSaw(saws[i][0], saws[i][1], saws[i][2]); } catch (er) {}
    for (i = 0; i < lasers.length; i++) try { drawBeam(lasers[i][0], lasers[i][1], lasers[i][2]); } catch (er) {}
    drawParts();
    // pit gradient below the level
    var pg = g.createLinearGradient(0, lh, 0, lh + 160);
    pg.addColorStop(0, 'rgba(15,10,30,0)'); pg.addColorStop(1, 'rgba(15,10,30,.85)');
    g.fillStyle = pg; g.fillRect(Math.min(0, vx0), lh, Math.max(lw, vx1) - Math.min(0, vx0), 400);
    // channel targets driven by a counting timer plate get the same draining ring
    g.setTransform(v.sc, 0, 0, v.sc, ox, oy);
    for (i = 0; i < ents.length; i++) {
      e = ents[i]; var tf2 = e.channel && chanTimer[e.channel];
      if (!tf2 || (e.type !== 'gate' && e.type !== 'platform' && e.type !== 'laser')) continue;
      ex = ep && ep[i] ? ep[i].x : e.x; ey = ep && ep[i] ? ep[i].y : e.y;
      var rx = e.type === 'gate' ? ex + (e.w || T) / 2 : e.type === 'platform' ? ex + (e.w || T) / 2 : ex + 16;
      var ry = e.type === 'gate' ? ey - 14 : e.type === 'platform' ? ey - 12 : ey - 10;
      timerRing(rx, ry, 8, tf2, chColor(e.channel));
    }
    // offscreen indicators: hatch + loose Power Cell, then bots
    g.setTransform(1, 0, 0, 1, 0, 0);
    var mTop = ((o.padTop || 0) + 8) * dpr, mBot = ((o.padBottom || 0) + 8) * dpr;
    if (world.door && !intro) {
      var dd = world.door;
      edgeBadge((dd.x + (dd.w || T) / 2) * v.sc + ox, (dd.y + (dd.h || 2 * T) / 2) * v.sc + oy, mTop, mBot, dd.open ? '#5CFF8A' : '#FF4D5E', iconHatch(dd.open));
    }
    if (key && !key.used && !holder && !intro) {
      var kpx = o.kp ? o.kp.x : key.x, kpy = o.kp ? o.kp.y : key.y;
      edgeBadge(kpx * v.sc + ox, kpy * v.sc + oy, mTop, mBot, CELL, iconCell);
    }
    for (i = 0; i < pl.length; i++) {
      p = pl[i]; if (p.state === 'entered') continue; q = pp && pp[p.slot] || p;
      var sxp = (q.x + 12) * v.sc + ox, syp = (q.y + 15) * v.sc + oy;
      if (sxp > 0 && sxp < W && syp > 0 && syp < H) continue;
      var cxp = Math.max(16 * dpr, Math.min(W - 16 * dpr, sxp)), cyp = Math.max(16 * dpr, Math.min(H - 16 * dpr, syp));
      g.save(); g.translate(cxp, cyp); g.rotate(Math.atan2(syp - cyp, sxp - cxp));
      g.fillStyle = OUT; g.beginPath(); g.moveTo(10 * dpr, 0); g.lineTo(-7 * dpr, -8 * dpr); g.lineTo(-7 * dpr, 8 * dpr); g.fill();
      g.fillStyle = SLOT[p.slot]; g.beginPath(); g.moveTo(7 * dpr, 0); g.lineTo(-5 * dpr, -5.5 * dpr); g.lineTo(-5 * dpr, 5.5 * dpr); g.fill();
      g.restore();
    }
    if (flash > 0.01) { g.fillStyle = rgba(flashCol, flash * 0.28); g.fillRect(0, 0, W, H); flash *= Math.exp(-dt * 6); }
    // soft vignette
    var vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(10,6,24,0)'); vg.addColorStop(1, 'rgba(10,6,24,.35)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  function drawRope(world, pair, pp) {
    var pl = world.players || [], a = null, b = null;
    for (var i = 0; i < pl.length; i++) { if (pl[i].slot === pair[0]) a = pl[i]; if (pl[i].slot === pair[1]) b = pl[i]; }
    if (!a || !b || a.state === 'entered' || b.state === 'entered') return;
    var A = pp && pp[a.slot] || a, B = pp && pp[b.slot] || b;
    var ax = A.x + 12, ay = A.y + 18, bx = B.x + 12, by = B.y + 18;
    var len = ((world.level && world.level.tetherLength) || (L.raw.tetherLength) || 5) * T;
    var d = Math.hypot(bx - ax, by - ay), slack = Math.max(0, len - d), sag = Math.min(46, slack * 0.45);
    var mx = (ax + bx) / 2, my = (ay + by) / 2 + sag;
    var taut = d >= len * 0.97;
    g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = 4.5; g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(mx, my, bx, by); g.stroke();
    var gr = g.createLinearGradient(ax, ay, bx, by); gr.addColorStop(0, SLOT[a.slot]); gr.addColorStop(1, SLOT[b.slot]);
    g.strokeStyle = gr; g.lineWidth = 2.4; g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(mx, my, bx, by); g.stroke();
    if (taut) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.setLineDash([2, 5]); g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(mx, my, bx, by); g.stroke(); g.setLineDash([]); }
    g.lineCap = 'butt';
  }

  // ---------- title scene ----------
  var titleTheme = 0, titleClock = 0;
  function drawTitle(dt) {
    if (!g) return;
    dt = Math.min(0.1, dt || 1 / 60);
    time += dt; titleClock += dt; stepParts(dt);
    var th = THEME_ORDER[Math.floor(titleClock / 14) % THEME_ORDER.length];
    var P = THEMES[th];
    g.setTransform(1, 0, 0, 1, 0, 0);
    var camX = titleClock * 22;
    var groundY = H - 64 * s0;
    drawSky(th, camX, 0, groundY + 6 * s0, time);
    var vw = W / s0;
    g.setTransform(s0, 0, 0, s0, 0, groundY);
    var off = (camX % T);
    for (var c = -1; c < vw / T + 2; c++) for (var r = 0; r < 3; r++) {
      var nb = { u: r > 0, d: true, l: true, r: true };
      solidTile(g, c + Math.floor(camX / T), r, P, '#', c * T - off, r * T, nb);
    }
    // bots marching + hopping across, one carrying the cell
    var span = vw + 240;
    for (var i = 0; i < 4; i++) {
      var speed = 36 + i * 3;
      var bxp = ((titleClock * speed + i * 46) % span) - 120;
      var hopT = (titleClock * 1.1 + i * 0.37) % 2.2;
      var hop = hopT < 0.55 ? Math.sin(hopT / 0.55 * Math.PI) : 0;
      var vy = hopT < 0.55 ? (hopT < 0.275 ? -5 : 5) : 0;
      var bfy = -hop * 46;
      var st = { facing: 1, vx: 2, vy: vy, onGround: hop === 0, moving: true, phase: titleClock * 10 + i, landAge: hopT >= 0.55 ? hopT - 0.55 : 9, t: time };
      bot(g, i, bxp, bfy, st);
      if (i === 0) drawCell(bxp - 18, bfy - 28 + Math.sin(time * 4) * 2, 0.7);
    }
    // a little stack tower posing at the right
    var tx = vw * 0.86, bob = Math.sin(time * 2) * 1.2;
    for (var k = 0; k < 4; k++) {
      var slot = 3 - k;
      bot(g, slot, tx + Math.sin(time * 2 + k) * 0.8, -k * 30 + bob * k * 0.3, { facing: -1, vx: 0, vy: 0, onGround: true, moving: false, phase: 0, landAge: 9, t: time + k * 0.37, happy: ((time * 1000 + k * 500) % 3000) < 400 });
    }
    drawParts();
    g.setTransform(1, 0, 0, 1, 0, 0);
    var vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(10,6,24,0)'); vg.addColorStop(1, 'rgba(10,6,24,.45)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  // ---------- portraits for lobby cards ----------
  function portrait(canvas, slot, o) {
    o = o || {};
    var d = Math.min(window.devicePixelRatio || 1, 2), cw = canvas.clientWidth || 64, ch = canvas.clientHeight || 64;
    var w = Math.round(cw * d), h = Math.round(ch * d);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    var c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    var sc = Math.min(w, h) / 46;
    c.setTransform(sc, 0, 0, sc, w / 2, h - 5 * sc);
    var t = o.t != null ? o.t : time;
    var hop = o.hop ? Math.max(0, Math.sin(t * 6)) * 6 : 0;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 1, 13 - hop * 0.6, 3, 0, 0, TAU); c.fill();
    bot(c, slot, 0, -hop, { facing: o.facing || 1, vx: 0, vy: o.hop ? (Math.cos(t * 6) > 0 ? -3 : 3) : 0, onGround: !hop, moving: false, phase: 0, landAge: 9, t: t + slot * 0.7, happy: o.happy });
  }

  SB.Render = {
    SLOT: SLOT, SLOT_NAME: SLOT_NAME, EMBLEM: EMBLEM, CH: CHC, THEMES: THEMES, THEME_ORDER: THEME_ORDER,
    init: function (canvas) {
      cv = canvas; g = cv.getContext('2d', { alpha: false }) || cv.getContext('2d');
      resize();
      window.addEventListener('resize', resize);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
    },
    resize: resize,
    setLevel: function (world, info) { intro = null; peekAmt = 0; parts = []; botFx = {}; springFx = {}; cellPos = null; gateAmt = {}; shakeAmt = 0; flash = 0; cam.init = false; buildLevel(world, info); },
    refreshSlots: function (world) { if (L) { L.slots = (world.players || []).map(function (p) { return p.slot; }); buildCache(); } },
    resetAttempt: function () { botFx = {}; cellPos = null; flash = 0; },
    frame: drawFrame,
    intro: startIntro,
    skipIntro: function () { if (intro) { intro = null; } },
    introActive: function () { return !!intro; },
    introInfo: function () { return intro ? { active: true, t: intro.t, total: intro.total, n: intro.pts.length } : { active: false }; },
    peekAmount: function () { return peekAmt; },
    events: onEvents,
    title: drawTitle,
    portrait: portrait,
    time: function () { return time; },
    shake: function (a) { shakeAmt = Math.max(shakeAmt, a); },
    _cam: cam
  };
})();
