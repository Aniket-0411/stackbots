# NOTES — client developer

## Build
`node build.js` → `dist/stackbots.html` (standalone) and `dist/artifact.html` (same page without
doctype/html/head/body; starts with `<title>Stackbots</title>`, then the Google Fonts `<link>`, then `<style>`).
- Levels: every `levels/world01..10.json` that exists, flattened in world order (world name + theme kept);
  falls back to `levels/_examples.json` when none exist. Generated into `src/levels.js` as `SB.LEVEL_DATA`.
- If `src/engine.js` is missing or does not export the full §9 API, the build WARNS and uses the throwaway
  `test/fakes/engine-stub.js` (footer of the title screen shows "ENGINE STUB"). `node build.js --strict` fails instead.
- With the real engine, the build parses every level + creates a 4-bot world and warns on parse errors or
  initial snapshots > 3000 bytes.
- Script order: engine, levels, audio, input, render, net, ui, main. Markup: `src/template.html`, CSS: `src/style.css`.

## Architecture (all globals under `globalThis.SB`)
- `main.js` — session state `G`, screens, fixed 60 Hz accumulator loop (max 8 steps/frame) driven by rAF;
  a 50 ms interval keeps a hidden HOST tab simulating. Local / host / guest modes. Progress in
  `localStorage['sb.progress.v1']` = `{levelId: {c:1, t:bestTicks, g:bestGears}}` (all storage in try/catch).
  Name `sb.name`, settings `sb.settings`, audio `sb.muted / sb.music / sb.sfx`.
- Inputs: per slot `{left,right,up,down,jump,jc,uc}`. The client keeps its own monotonic jc/uc counters per bot
  (`virt()`), so presses that happen between two ticks are never lost and switching devices never fakes a press.
  While paused/dialogs open, inputs are all-false (counters frozen).
- `render.js` — one canvas, logical view 960×540 (600×540 when portrait) scaled to the window; static tiles
  pre-rendered per level to an offscreen canvas; per-theme 2-layer parallax strips pre-rendered per theme; camera
  frames active bots, zoom 1.0–0.62, clamped; bottom padding for touch buttons. Bots/cell/hatch/entities drawn
  procedurally every frame. Uses world fields from §9 plus engine extras when present
  (`openAmt`, saw `cx/cy`, laser `x1/y1/x2/y2`, crumble `{t: countdown, gone}`), with fallbacks.
- `audio.js` — WebAudio synth SFX for every engine event (+ UI clicks), tiny procedural music per theme (+menu).
  AudioContext created on first pointer/key. M mutes (remembered).
- `input.js` — keyboard (online map: arrows/WASD/Space/Z; local P1 WASD+Space/F/G, P2 arrows+Enter//.),
  gamepads (stick/d-pad, A/X jump, Y/d-pad-up interact, Start pause, Back restart), touch buttons (pointer events,
  finger can slide between buttons). Game keys are only preventDefault'ed during play.
- `net.js` — transports `room` (claude.ai presence), `peer` (PeerJS, lazy-loaded jsDelivr→unpkg), `tabs`
  (BroadcastChannel). Auto: artifact (`window.claude.use` exists) → room (PeerJS never offered/loaded there);
  standalone → PeerJS; `#tabs` hash or Settings → Advanced → "Online play via" → Browser tabs.
- `ui.js` — DOM overlay helpers (screens, in-page dialog, toasts, HUD, lobby cards, level select). No alert/confirm/prompt.

## Protocol notes (SPEC §10.2 + small additions)
- `st.m` meta = `{scr, lv, pl:[[slot,name,active01]], at: attemptNo, tm: runTicks, msg?, cl?:[t,g,gt,best,newBest01]}`.
  `pl` third element 0 = joined mid-level (pending; added on next restart). `at` lets guests reset animations.
- Room transport: host presence `{sb:1, role:'host', n, st:{m:{...,sl:{peerLabel:slot}, fu?:[peerLabels]}, s, q}}`
  sent every 2 ticks during play, every 12 otherwise (platform coalesces). If the merged object would exceed
  4000 bytes: drop `msg`, then snapshot event list keys, then the snapshot. Guest presence `{sb:1, role:'guest', n, in:[b,jc,uc,rc]}`
  sent only on change. Joins/leaves come from `onPeers`/`peers()`; host also polls `peers()` every tick.
- Tabs/PeerJS: guests send `in` on change and at least every 250 ms; host drops a guest after 4–5 s of silence;
  guests treat 5–6 s without state as "host left". PeerJS host id `stackbots-v1-<code>`, new code on `unavailable-id`.
- Guest leaves mid-level → banner "<name> left — restarting…" for 2 s, then restart without that bot.
  Host leaves → guests get the "Host left the room" dialog on the title screen.

## Tests (`python3 test/client/run_all.py`, ~55 s; exits non-zero on failure)
- `test_smoke.py` — zero console errors, screenshots (title/lobby/select/play/pause), Local Play keyboard
  movement + jump, Esc/R/M, phone 400×800 (no horizontal scroll, touch buttons visible and working).
- `test_render.py` — injects (test-only, via `window.__SB_EXTRA_LEVELS`) a showcase level with every tile/entity type
  in all 10 themes → `shots/20-theme-*.png`; checks `dist/artifact.html` shape and size.
- `test_online.py tabs|room|peer` — 4 pages: host + 2 guests, host starts level 1, 4th guest joins mid-level (pending),
  host restarts, all 4 pages see 4 bots moving with matching positions, guest R restart request, guest leaves
  (notice + restart with 3), host leaves (guests → title dialog). `room` uses `test/fakes/fake-room.js`
  (BroadcastChannel emulation of `claude.use('room')` incl. 4 KiB merged-presence rejection and ~30 Hz coalescing)
  and asserts the host never exceeded 4 KiB; `peer` uses `test/fakes/fake-peer.js`.
- `test_flow.py` — injected tiny levels: hatch → clear screen → progress saved → Next; spikes → "got scrapped" banner →
  auto restart; last level → Credits; fake gamepad: A in local lobby adds P3, stick moves it.
- `test_unavailable.py` — PeerJS CDN blocked → readable dialog; artifact with `use('room') → null` → message, PeerJS
  never loaded, Local Play works; localStorage throwing → game still runs.
- Screenshots land in `test/client/shots/`.


## Fix round (beta report) — what changed
- **Guest prediction** (`main.js`): each guest keeps a private engine world. Every 60 Hz tick it steps its own bot with
  local input (others get no input). Guest `in` messages carry `ts` (prediction tick); the host records
  `ack[slot] = [ts, hostTickAtReceipt]` and publishes `meta.ak = [[slot, ts, rt], ...]`. On each snapshot (host tick k) the
  guest rolls back: `applySnapshot` into the private world, restores coyote/jump-buffer/drop timers and the engine's
  press-edge state (`world._in[slot]`) from its own history at local tick `ts + (k - rt)`, then replays the recorded
  inputs up to now. The visual difference glides out (τ 90 ms); errors over ~1 tile snap. Prediction is disabled (blends to
  the interpolated authority over ~80 ms) on tether levels, when not in play, and while touching other bots vertically,
  crates or platforms (plus 0.3 s hysteresis). Own jump/land SFX play from the prediction.
- **Adaptive buffer** (`main.js`): snapshots are buffered by host tick. Host-time offset tracks the fastest arrivals,
  lateness p95 over the last 90 snapshots sets the delay D = gap + p95 + 6 ms (30–450 ms). An elastic playout clock runs
  at 0.8–1.2× (slows early when the buffer runs dry, never more than 3 ticks past the newest snapshot, short velocity
  extrapolation).
- **Camera** (`render.js`): free band between HUD bar and hint bubble (measured from the DOM; touch buttons are overlays
  and reserve nothing); intro pan cell → hatch → bots (~2.4 s, any key/tap skips; guests run it when the host's level
  loads); hold-to-peek overview (Q / Left Shift / pad LB-RB / HUD map button); edge badges for the hatch and a loose cell.
- **Phone**: rotate prompt in portrait during play (dismissable), portrait logical width 480, HUD bar wraps
  (flex) instead of overlapping, translucent touch buttons.
- Minor/polish: minPlayers warning (Back / Play anyway), springs = steel coil + chevron pad + bobbing arrow, background
  haze + muted props, hint repeated in pause, camera padding while the hint shows, lobby toasts at the bottom, host
  de-duplicates names ("Gizmo 2"), timer plates (and their gates/platforms/lasers) show a draining ring, bigger channel
  letters, outlined spikes, safe-centred title (no logo clipping), one-time key legend in 1-1, touch wording in the
  local lobby, relay wrong-code report 8 s after the links are up.
- Measurements (beta probes, this sandbox): guest own-bot response 64–84 ms → 12–20 ms (host 33–38).
  b4b frame-speed σ on 4 pages: tabs transport remote 51–52 / own 55–73 (host 46–52); relay with the in-process fake
  broker varies with broker stalls (remote 55–140).
- `test/client/test_feel.py` covers prediction latency/accuracy, intro + skip, peek, minPlayers dialog, unique names,
  toast placement, pause hint, phone portrait/landscape.

## Known issues / limits
- The in-process fake MQTT broker (Python, via Playwright WebSocket routing) sometimes stalls 0.3–0.7 s under 4-page
  load; remote bots then pause briefly. Real brokers should not behave like this, but D adapts up to 450 ms if they do.
- Prediction does not run while standing on/under other bots, on crates or platforms, or on tether levels (falls back to
  interpolation there).
- Tabs transport is same-browser only (by design). PeerJS uses the public PeerJS cloud + default STUN; strict NATs
  without TURN may fail to connect (error dialog shown after 20 s).
- Gamepad P3/P4 join by pressing A in the local lobby (or tapping a card to cycle devices).

## Engine integration status
- Integrated with the real `src/engine.js` (exports C, parseLevel, createWorld, reset, step, snapshot, applySnapshot,
  tileAt, isSolidFor, EVENTS, version). `node build.js` validates every level with it (30/30 ok at last build, all initial
  snapshots < 3000 B). Host presence in the room test peaks at ~450 B.
- The renderer reads engine extras: gate `openAmt`, saw box (`x,y,w,h`; `cx,cy`), laser `x1,y1,x2,y2`, button `y = 32r+26`,
  crumble `{t: countdown, gone}`, crate `gone`. The room transport trims the snapshot's `v` (event list) first if presence nears 4 KiB.

## Requests for dev-engine (nice to have, nothing blocking)
- Keep `world.entities` in level-JSON order (the client interpolates entities by index on guests).
- Keep events in `world.events` after `applySnapshot` (already done) — guests play SFX/particles from it.
