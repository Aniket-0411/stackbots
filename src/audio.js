/* STACKBOTS audio — WebAudio-synthesized SFX + light procedural music. All original. */
(function () {
  'use strict';
  var SB = globalThis.SB = globalThis.SB || {};
  var ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
  var muted = false, musicOn = true, sfxOn = true;
  var lastPlay = {};
  var music = { theme: null, timer: null, step: 0, nextT: 0, bar: 0 };

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  muted = store('sb.muted') === '1';
  musicOn = store('sb.music') !== '0';
  sfxOn = store('sb.sfx') !== '0';

  function init() {
    if (ctx) { if (ctx.state === 'suspended') try { ctx.resume(); } catch (e) {} return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.55 : 0; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = musicOn ? 0.16 : 0; musBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0), seed = 1234567;
    for (var i = 0; i < d.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = seed / 0x3fffffff - 1; }
    if (music.theme) startMusic(music.theme, true);
  }

  // ---- primitives ----
  function tone(o) {
    // o: {type,f,f2,t0,dur,vol,att,bus,q,filt}
    if (!ctx) return;
    var t = ctx.currentTime + (o.at || 0), dur = o.dur || 0.12, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.slide || dur));
    if (o.det) osc.detune.value = o.det;
    var v = (o.vol || 0.3), att = o.att || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var node = osc;
    if (o.lp) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 1; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(o) {
    if (!ctx) return;
    var t = ctx.currentTime + (o.at || 0), dur = o.dur || 0.1, src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 1200, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    f.Q.value = o.q || 1;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + (o.att || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, (o.off || 0) % 0.4); src.stop(t + dur + 0.02);
  }
  function arp(notes, o) { notes.forEach(function (n, i) { tone({ type: o.type, f: n, at: (o.at || 0) + i * o.gap, dur: o.dur, vol: o.vol, lp: o.lp }); }); }
  function hz(semi) { return 440 * Math.pow(2, (semi - 9) / 12); } // semitone from C4-ish (0 = C4)

  // ---- SFX table (event name -> synth) ----
  var pitchBySlot = [0, 2, 4, 7];
  var SFX = {
    jump: function (o) { var p = Math.pow(2, (pitchBySlot[o.slot] || 0) / 24); tone({ type: 'square', f: 300 * p, f2: 620 * p, dur: 0.13, vol: 0.13, lp: 2400 }); },
    land: function () { noise({ f: 380, f2: 160, dur: 0.07, vol: 0.18, ft: 'lowpass' }); tone({ type: 'sine', f: 120, f2: 70, dur: 0.07, vol: 0.14 }); },
    key: function () { arp([hz(12), hz(16), hz(19), hz(24)], { type: 'triangle', gap: 0.055, dur: 0.18, vol: 0.2 }); noise({ f: 6000, dur: 0.25, vol: 0.05, q: 4, at: 0.05 }); },
    unlock: function () { tone({ type: 'square', f: 140, dur: 0.06, vol: 0.18, lp: 900 }); tone({ type: 'square', f: 210, dur: 0.07, vol: 0.18, lp: 900, at: 0.07 });
      arp([hz(7), hz(12), hz(16), hz(19), hz(24)], { type: 'triangle', gap: 0.06, dur: 0.3, vol: 0.18, at: 0.12 }); },
    enter: function (o) { var p = Math.pow(2, (pitchBySlot[o.slot] || 0) / 12); tone({ type: 'sine', f: 520 * p, f2: 1300 * p, dur: 0.22, vol: 0.2 }); tone({ type: 'triangle', f: 780 * p, dur: 0.18, vol: 0.08, at: 0.08 }); },
    exit: function () { tone({ type: 'sine', f: 1100, f2: 420, dur: 0.2, vol: 0.16 }); },
    clear: function () {
      var m = [hz(12), hz(16), hz(19), hz(24), hz(19), hz(24), hz(28)], tm = [0, .1, .2, .3, .45, .55, .7];
      m.forEach(function (f, i) { tone({ type: 'square', f: f, at: tm[i], dur: i === 6 ? 0.7 : 0.16, vol: 0.12, lp: 3000 }); tone({ type: 'triangle', f: f / 2, at: tm[i], dur: i === 6 ? 0.7 : 0.16, vol: 0.14 }); });
      noise({ f: 8000, dur: 0.6, vol: 0.05, q: 2, at: 0.7 });
    },
    die: function () { noise({ f: 2200, f2: 300, dur: 0.35, vol: 0.32, q: 0.8 }); tone({ type: 'sawtooth', f: 420, f2: 60, dur: 0.45, vol: 0.18, lp: 1600 });
      tone({ type: 'square', f: 880, dur: 0.04, vol: 0.1, at: 0.02 }); tone({ type: 'square', f: 660, dur: 0.04, vol: 0.1, at: 0.09 }); },
    press: function () { tone({ type: 'square', f: 260, f2: 180, dur: 0.06, vol: 0.14, lp: 1400 }); noise({ f: 900, dur: 0.04, vol: 0.12 }); },
    release: function () { tone({ type: 'square', f: 180, f2: 260, dur: 0.06, vol: 0.1, lp: 1400 }); },
    lever: function () { noise({ f: 2600, dur: 0.03, vol: 0.2, q: 3 }); tone({ type: 'square', f: 330, dur: 0.05, vol: 0.12, lp: 1800, at: 0.04 }); noise({ f: 1600, dur: 0.03, vol: 0.16, q: 3, at: 0.07 }); },
    spring: function () { tone({ type: 'sine', f: 180, f2: 900, dur: 0.25, vol: 0.24, slide: 0.18 }); tone({ type: 'triangle', f: 360, f2: 1400, dur: 0.18, vol: 0.08, at: 0.02 }); },
    gear: function () { tone({ type: 'triangle', f: hz(31), dur: 0.12, vol: 0.16 }); tone({ type: 'triangle', f: hz(36), dur: 0.22, vol: 0.16, at: 0.07 }); },
    crumble: function () { noise({ f: 500, f2: 200, dur: 0.3, vol: 0.2, ft: 'lowpass', q: 1 }); noise({ f: 1400, dur: 0.06, vol: 0.12, at: 0.12 }); },
    gate: function () { tone({ type: 'sawtooth', f: 90, f2: 140, dur: 0.28, vol: 0.09, lp: 700 }); noise({ f: 700, dur: 0.22, vol: 0.06 }); },
    // UI
    click: function () { tone({ type: 'square', f: 660, dur: 0.04, vol: 0.08, lp: 3000 }); },
    back: function () { tone({ type: 'square', f: 440, f2: 330, dur: 0.06, vol: 0.08, lp: 3000 }); },
    join: function () { arp([hz(12), hz(19)], { type: 'triangle', gap: 0.08, dur: 0.16, vol: 0.18 }); },
    leave: function () { arp([hz(19), hz(12)], { type: 'triangle', gap: 0.08, dur: 0.16, vol: 0.16 }); },
    start: function () { arp([hz(7), hz(12), hz(19)], { type: 'square', gap: 0.07, dur: 0.14, vol: 0.1, lp: 2600 }); },
    restart: function () { tone({ type: 'triangle', f: 500, f2: 260, dur: 0.18, vol: 0.14 }); }
  };
  var MINGAP = { land: 0.05, jump: 0.03, press: 0.05, release: 0.05, gear: 0.03, crumble: 0.08, gate: 0.12 };

  function play(name, o) {
    if (!ctx || muted || !sfxOn || !SFX[name]) return;
    var now = ctx.currentTime, gap = MINGAP[name] || 0.02;
    if (lastPlay[name] && now - lastPlay[name] < gap) return;
    lastPlay[name] = now;
    try { SFX[name](o || {}); } catch (e) {}
  }

  // ---- music: tiny per-theme procedural loop (bass + plucky arpeggio + soft hat) ----
  var THEMES = {
    meadow: { bpm: 104, root: 0, scale: [0, 2, 4, 7, 9], prog: [0, 5, 3, 4], lead: 'triangle' },
    workshop: { bpm: 96, root: -3, scale: [0, 3, 5, 7, 10], prog: [0, 0, 5, 3], lead: 'square' },
    switchyard: { bpm: 112, root: 2, scale: [0, 2, 4, 7, 9], prog: [0, 4, 5, 3], lead: 'square' },
    skyway: { bpm: 88, root: 5, scale: [0, 2, 4, 7, 11], prog: [0, 3, 0, 4], lead: 'sine' },
    prism: { bpm: 100, root: 1, scale: [0, 2, 4, 6, 9], prog: [0, 2, 5, 4], lead: 'triangle' },
    bouncy: { bpm: 120, root: 4, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 3], lead: 'square' },
    ropeway: { bpm: 92, root: -2, scale: [0, 2, 5, 7, 9], prog: [0, 5, 0, 4], lead: 'triangle' },
    foundry: { bpm: 98, root: -5, scale: [0, 3, 5, 6, 10], prog: [0, 0, 3, 5], lead: 'sawtooth' },
    hazard: { bpm: 126, root: -1, scale: [0, 1, 5, 7, 8], prog: [0, 1, 0, 5], lead: 'square' },
    summit: { bpm: 90, root: 3, scale: [0, 2, 4, 7, 9], prog: [0, 4, 5, 3], lead: 'triangle' },
    menu: { bpm: 100, root: 0, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 0], lead: 'triangle' }
  };
  var CHORD = { 0: [0, 4, 7], 1: [1, 5, 8], 2: [2, 5, 9], 3: [5, 9, 12], 4: [7, 11, 14], 5: [9, 12, 16] };
  function schedule() {
    if (!ctx || !music.theme) return;
    var th = THEMES[music.theme] || THEMES.meadow, spb = 60 / th.bpm / 2; // eighth notes
    while (music.nextT < ctx.currentTime + 0.25) {
      var t = music.nextT - ctx.currentTime, s = music.step % 32, bar = Math.floor(music.step / 8) % 4;
      var deg = th.prog[bar], ch = CHORD[deg] || CHORD[0];
      if (t >= 0 && musicOn && !muted) {
        if (s % 4 === 0) tone({ type: 'triangle', f: hz(th.root - 24 + ch[0]), at: t, dur: spb * 3.2, vol: 0.5, bus: musBus });
        if (s % 4 === 2) tone({ type: 'triangle', f: hz(th.root - 12 + ch[0]), at: t, dur: spb * 1.2, vol: 0.25, bus: musBus });
        // deterministic pseudo-random arpeggio pattern
        var hsh = ((music.step * 2654435761) >>> 0) % 7;
        if (hsh < 4 || s % 2 === 0) {
          var n = ch[(s + (hsh % 3)) % 3] + (s % 8 > 4 ? 12 : 0);
          tone({ type: th.lead, f: hz(th.root + n), at: t, dur: spb * 0.9, vol: th.lead === 'sine' ? 0.32 : 0.16, lp: 2200, bus: musBus });
        }
        if (s % 2 === 1) noise({ f: 7000, at: t, dur: 0.035, vol: 0.12, q: 2, bus: musBus });
        if (s % 8 === 4) noise({ f: 1800, at: t, dur: 0.08, vol: 0.14, q: 0.7, bus: musBus });
      }
      music.step++; music.nextT += spb;
    }
  }
  function startMusic(theme, force) {
    if (music.theme === theme && music.timer && !force) return;
    music.theme = theme;
    if (!ctx) return;
    if (music.timer) clearInterval(music.timer);
    music.step = 0; music.nextT = ctx.currentTime + 0.1;
    music.timer = setInterval(schedule, 90);
  }
  function stopMusic() { if (music.timer) clearInterval(music.timer); music.timer = null; music.theme = null; }

  function applyGains() {
    if (!ctx) return;
    var t = ctx.currentTime;
    master.gain.setTargetAtTime(muted ? 0 : 0.8, t, 0.02);
    sfxBus.gain.setTargetAtTime(sfxOn ? 0.55 : 0, t, 0.02);
    musBus.gain.setTargetAtTime(musicOn ? 0.16 : 0, t, 0.05);
  }

  SB.Audio = {
    init: init,
    play: play,
    events: function (evs) { if (!evs) return; for (var i = 0; i < evs.length; i++) play(evs[i].t, evs[i]); },
    music: startMusic,
    stopMusic: stopMusic,
    isMuted: function () { return muted; },
    setMuted: function (m) { muted = !!m; store('sb.muted', muted ? '1' : '0'); applyGains(); },
    toggleMute: function () { SB.Audio.setMuted(!muted); return muted; },
    musicOn: function () { return musicOn; },
    setMusic: function (v) { musicOn = !!v; store('sb.music', v ? '1' : '0'); applyGains(); },
    sfxOn: function () { return sfxOn; },
    setSfx: function (v) { sfxOn = !!v; store('sb.sfx', v ? '1' : '0'); applyGains(); },
    ready: function () { return !!ctx; }
  };
})();
