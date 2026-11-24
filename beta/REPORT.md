# STACKBOTS — Beta test report (build 5bcc044887)

Headless Chromium 960×540 unless noted; real page input (keyboard P1/P2, fake gamepads P3/P4). Online via emulated relay (PeerJS blocked, one broker down, two fake brokers). Scripts + 57 shots in `beta/`. **No console errors in any run. No blockers.**

Verified working: 1-1 cleared keyboard-only (8.4 s) → clear screen → Next → level-select progress (✓, time, gears); 2-bot stack jump & piggyback; 2-pusher crate (1 can't, chain can); hold button opens gate; need-4 lift with 4 bots; spike death banner + ~0.9 s restart; Esc / R / M; 4-page online session; friendly wrong-code and host-left dialogs.

## MAJOR
1. **Guest input lag & smoothness** (client/net): guest's own bot reacts 64–84 ms after a key on a perfect relay (host ~30 ms), ~276 ms with 60–120 ms one-way delay. Guest frame-to-frame speed σ 80–90 px/s vs host 45–55 (mean 153), with stalls and 2.5× catch-ups. Want: own-bot prediction + adaptive interpolation buffer.
2. **Phone playfield tiny** (client render/CSS): portrait 400×800 — bots 8–16 px, spread bots off-screen, ~60% empty sky, HUD title overlaps 4 player chips. Landscape 844×390 — 150 px reserved for touch buttons; 10-10 saws cut off. Want: rotate prompt in portrait, translucent overlaid touch buttons, zoom from real available height, HUD wraps at 400 px.
3. **Goal not visible / no overview** (client camera): camera frames only bots at zoom 1.0. Hatch half off-screen in 1-1; second gate off-screen in 3-5; 10-10 start shows ~¼ of level (hatch, lift, saws unseen); 7-10 / 9-10 hatch unseen from most spots. Want: 2–3 s intro pan (cell → hatch → bots), hold-to-peek overview, edge pointers for cell & hatch.

## MINOR
1. Level needing 4 bots starts silently with 2 (1-7) — warn "needs 4 bots, you have 2" with add/play-anyway.
2. Spring reads as a flat red pad like a button (colour close to channel A / Coral) — visible coil/up-arrow, distinct colour.
3. Background props look like game objects: switchyard traffic lights (read as gate state), ropeway coral/teal gondolas (look like bots), skyway islands (ground colour at lift height), bouncy balloons (pickups), hazard searchlights (beams). Mute/darken and keep out of play band.
4. Hint bubble covers bottom ~70 px for 8 s (covers 7-2 well bottom) and can't be recalled — show in pause menu; camera bottom padding while visible.
5. "X joined" toasts cover the lobby room code.
6. Default names repeat in a room (two "Gizmo") — host makes names unique ("Gizmo 2").
7. Timer plates show no countdown (9-10 relies on 540 ticks) — draining ring on plate and on the controlled target.

## POLISH
- Title logo top clipped at 960×540.
- Wrong room code takes 12.4 s to report; host-left without unload 6.3 s.
- Button channel letters 8 px; 6-3 spikes pale grey on pale ground.
- No key reminder in 1-1 (hint says "press Up").
- Phone Local Play lobby talks about WASD/Arrows/Tab and defaults to 2 bots, but touch drives only P1.

## Feel
Most fun: stack jumps; team crate push with lighting dots; "All Aboard" 4-2 lift; fast retry; lively bots and world-7 ropes.
Least fun: guest lag on timing levels; not seeing hatch/cell on big levels; stuck on 4+ level with 2 bots; look-alikes (spring/button, props); phone play.
