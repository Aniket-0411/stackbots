# STACKBOTS — Game Design & Technical Spec (v1)

Single source of truth for every agent (developers, level designers, QA, beta tester).
If something here is ambiguous, pick the simplest reasonable behaviour, write it down in
`NOTES-<your-role>.md`, and keep going.

## 0. Originality rule (non-negotiable)

Stackbots is an ORIGINAL co-op puzzle platformer. It is *inspired by the genre* of small
4-player shared-screen co-op puzzle games, but it must not copy any existing game.
- Do not copy, imitate or look up any existing game's characters, art, sprites, sounds,
  music, logos, names, UI layout, or level layouts. Do not search the web for other games'
  levels or assets, and do not open any other game's files.
- Characters are our own: small boxy robots ("bots"). Everything is drawn in code on canvas.
- Level layouts, names and hints are invented by our designers.

## 1. Pitch

Up to 4 friends, each on their own machine, control little robots on one shared screen.
Every level has an **Exit Hatch** (door) that is locked until a bot carries the **Power Cell**
(key) into it. Then every bot must climb into the hatch. Bots are solid to each other, so you
stand on each other's heads to reach high ledges, push heavy crates together, hold buttons
for each other, ride elevators that need several riders, and so on. If any bot dies, the
whole team restarts the level instantly (party chaos, no lives).

100 levels in 10 worlds of 10.

## 2. Coordinates & units

- Tile size `T = 32` px. Map rows top→bottom, columns left→right.
- Tile (c, r) covers x ∈ [32c, 32c+32), y ∈ [32r, 32r+32). **y grows downward.**
- Simulation runs at a fixed **60 ticks/second**. All speeds are px/tick, accelerations px/tick².
- Level JSON uses tile coordinates; the engine converts to px.
- Out of bounds: columns < 0 or ≥ cols are SOLID walls. Rows < 0 are empty sky.
  Rows ≥ rows are empty; a body whose top passes `rows*32 + 64` is dead (fell in a pit).

## 3. Physics constants (Engine.C)

| name | value | meaning |
|---|---|---|
| T | 32 | tile size px |
| PW, PH | 24, 30 | player hitbox width/height |
| GRAVITY | 0.55 | px/tick² |
| MAX_FALL | 12 | px/tick |
| RUN | 2.6 | max horizontal speed |
| ACC_GROUND | 0.5 | accel toward target speed on ground |
| DEC_GROUND | 0.6 | decel when no input on ground |
| ACC_AIR | 0.35 | accel in air (both directions) |
| JUMP_V | -9.6 | jump velocity → apex ≈ 83.8 px (2.6 tiles) |
| JUMP_CUT | -4 | if jump released while vy < JUMP_CUT, set vy = JUMP_CUT |
| COYOTE | 4 | ticks you may still jump after leaving ground |
| JUMP_BUFFER | 6 | ticks a jump press is remembered before landing |
| SPRING_V | -14 | spring launch → apex ≈ 178 px |
| CRATE_SPEED | 1.2 | px/tick while being pushed by enough bots |
| CONVEYOR | 1.4 | px/tick surface speed of `<` `>` tiles |
| PLATFORM_SPEED | 1.0 | default moving platform speed |
| DEAD_TICKS | 60 | ticks the "dead" phase lasts before automatic reset |
| CLEAR_TICKS | 120 | ticks of the "clear" phase before host shows the clear screen |
| LEASH_X | 1280 | max horizontal distance (px) between centers of the leftmost and rightmost active bots |

Jumping never inherits horizontal momentum from whatever you stood on (player, platform, conveyor):
after leaving the ground your horizontal speed is only your own.

### 3.1 Design rules that follow from the physics (designers MUST respect)

- **Climbing:** a bot standing on flat ground can climb a wall up to **2 tiles** high. Each bot
  stacked underneath adds 1 tile: max climbable height = **2 + (bots stacked below the jumper)**.
  So 3 tiles needs a 2-bot tower, 4 tiles needs 3 bots, 5 tiles needs all 4. 6+ is impossible
  without springs/platforms/crates.
- **Gaps:** a gap of **≤ 3 empty tiles** between two ledges at the same height can be jumped.
  **4+ tiles cannot** be jumped (even with coyote time). Do not rely on long jumps to lower ledges.
- **Springs** launch a bot up to **5 tiles** above the spring's floor (not 6).
- A 1-tile-high crate is a 1-tile step. A crate of height h is an h-tile step.
- Bots fit through gaps exactly 1 tile tall and 1 tile wide.
- **Nobody may be stranded.** Every level must be completable by ALL present bots reaching the
  hatch. If a team overcomes a wall by stacking, the bottom bot(s) cannot climb after them, so
  the level must give them another way up (see §8 patterns). Going DOWN is always possible.
- The leash: bots can never be more than 40 tiles apart horizontally. A bot at the extreme left
  or right of the group cannot move further away (it is blocked as if by a wall). Never design
  a puzzle that needs bots > 38 tiles apart.

## 4. Players (bots)

- Slots 0–3 with fixed colors: 0 Coral `#FF6F59`, 1 Teal `#2EC4B6`, 2 Marigold `#FFB627`,
  3 Lilac `#9D7BFF`. Each slot also has an emblem for color-blind players:
  0 circle, 1 triangle, 2 square, 3 diamond.
- Hitbox 24×30. Spawn marker digit `k` at tile (c, r) puts slot k-1 at
  x = 32c + 4, y = 32r + 2 (feet on the tile's bottom edge).
- Inputs per slot each tick: `left, right, up, down, jump` (held booleans) plus optional
  counters `jc` (jump presses so far) and `uc` (up presses so far) for network play.
  A press is detected if `held && !prevHeld` OR the counter increased since last tick.
- **Up** = interact. If the bot overlaps an unlocked hatch or a lever, an Up press interacts
  (enter hatch / flip lever) and does NOT jump. Otherwise an Up press acts as a jump press,
  and holding Up counts as holding jump (for variable jump height).
- **Down + Jump** while standing on a one-way surface (`-` tile or moving platform) drops
  through it.
- Bots are **solid to each other** on both axes. A bot can stand on another bot's head and is
  carried along horizontally (by the support's actual dx this tick) and vertically.
  Horizontal contact blocks; bots do not shove each other.
- When a bot jumps while carrying riders, riders are pushed up with it (stack jumps together).
  Upward movement of a stack stops if its top hits a ceiling.
- States: `active` (normal) or `entered` (inside the hatch: invisible, non-colliding, ignores input
  except a Down press, which steps it back out in front of the hatch).

## 5. Tiles (map characters)

| char | meaning |
|---|---|
| `.` | empty |
| `#` | solid ground |
| `-` | one-way platform: solid only from above (land on it, jump up through it) |
| `^` | spikes (kill). Hitbox: x+4..x+28, y+16..y+32 of the tile. Usually placed on top of solid ground. |
| `*` | spring: occupies bottom 12 px of the tile; anything landing on it (vy ≥ 0, feet within its top) is launched with SPRING_V. Must have solid ground below. |
| `=` | crumble block: solid; 30 ticks after something stands on it, it vanishes; it reappears 180 ticks later if nothing overlaps it. |
| `<` `>` | conveyor: solid; moves anything standing on it left/right by CONVEYOR px/tick. |
| `a` `b` `c` `d` | color wall for slot 0/1/2/3: passable ONLY by that bot; solid for every other bot, crates, the leash, lasers. If that slot is not in the game, it is solid for everyone. |
| `K` | Power Cell (key) start position (tile center). At most one. If the map has no `K`, the hatch starts unlocked. |
| `D` | Exit Hatch: this marks the hatch's BOTTOM tile; the hatch is 1 tile wide × 2 tall, so the tile above `D` must be `.`, and the tile below `D` must be solid (`#`, `=`, `<`, `>`). Exactly one per level. |
| `o` | Gear collectible (optional bonus). Counts toward the level's gear score, never required. |
| `1`–`4` | spawn for slot 0–3. Each digit exactly once. Spawn tiles count as empty and must have solid ground directly below. |

## 6. Entities (JSON `entities` array)

All coordinates in tiles. `x, y` = top-left tile unless stated. Every entity may have an
optional `"id"` string. Channel names are single uppercase letters `"A"`–`"H"`.
Channel logic: each **source** (button, lever) on channel X is either on or off.
Each **target** (gate, platform, laser) on channel X reads the channel with its `logic`:
`"all"` (default) = active iff every source on X is on; `"any"` = active iff at least one is on.

### crate
`{"type":"crate","x":10,"y":5,"w":1,"h":1,"need":1,"weight":1}`
- Solid box with gravity, `w×h` tiles (default 1×1). Bots and other crates can stand on it.
- Pushed horizontally at CRATE_SPEED only while the number of **pushers** ≥ `min(need, number of bots in game)`.
  A pusher is an active, grounded bot touching the crate's side and holding the direction toward
  it, OR a grounded bot holding that direction while touching (same side) a bot that is itself a pusher (chains count).
- A crate cannot push another crate (blocked), cannot enter solids/closed gates/color walls.
  Things standing on a moving crate ride along. Crates fall into pits and are destroyed if they fall
  out of the map (level is then probably unsolvable → players press Restart; that's fine).
- `weight` counts toward button loads (default 1).

### button
`{"type":"button","x":12,"y":9,"w":1,"channel":"A","need":1,"mode":"hold","time":180}`
- A pressure plate lying on the floor of tile row `y`, spanning `w` tiles (default 1). The tile
  below each plate tile must be solid. Plate collision: it is NOT solid (thin decoration), load is
  counted from bots (weight 1 each) and crates (their `weight`) whose bottom edge is within 2 px
  of the tile's bottom and that overlap the plate horizontally (including bots standing on a crate? NO —
  only things touching the plate itself; a bot standing on another bot does not count).
- Pressed iff load ≥ `min(need, number of bots in game)` (crates still count; `need` default 1).
- `mode`: `"hold"` (on while pressed), `"latch"` (turns on the first time it is pressed and stays on
  until level reset), `"timer"` (turns on when pressed; stays on until `time` ticks after it stops being pressed; default 180).

### lever
`{"type":"lever","x":20,"y":9,"channel":"B","on":false}`
- Occupies one tile standing on the floor. An active bot overlapping it that presses Up toggles it.
  `on` = initial state.

### gate
`{"type":"gate","x":30,"y":6,"w":1,"h":3,"channel":"A","logic":"all","invert":false}`
- A solid barrier of w×h tiles. It is OPEN (not solid) when its channel reading is active
  (or inactive, if `invert`). It never closes onto a bot or crate: if something overlaps when it should close,
  it waits until clear. Visual: striped barrier tinted with the channel color.

### platform
`{"type":"platform","x":5,"y":10,"w":3,"path":[[5,10],[5,4]],"speed":1.0,"mode":"pingpong","channel":null,"need":0}`
- A one-way (solid from above) moving platform `w` tiles wide, 12 px thick at the top of its tile.
  `path` = waypoints (tile coords of the platform's top-left); first waypoint must equal (x, y).
- Movement rules (exactly one applies):
  - `need > 0` (elevator): moves forward along the path while riders ≥ `min(need, bots in game)`;
    otherwise moves back toward the first waypoint. Riders = bots + crates standing on it (a bot standing on
    a rider bot also counts).
  - `channel` set: moves forward while the channel reading is active, back toward start while inactive.
  - neither: moves continuously; `mode` `"pingpong"` (default) or `"loop"` (returns from last to first waypoint).
  - Forward motion stops at the last waypoint (for need/channel modes).
- Carries riders. If moving would crush something against a solid, the platform does not move that tick.

### saw
`{"type":"saw","x":14,"y":8,"path":[[14,8],[20,8]],"speed":1.5,"mode":"pingpong"}`
- A spinning blade, radius 14 px, centered on the tile center of (x, y) and of each waypoint. Kills bots on
  contact (circle vs AABB, with 2 px forgiveness). Optional path (omit for static). Passes through everything.

### laser
`{"type":"laser","x":3,"y":7,"dir":"r","channel":null,"invert":false,"on":120,"off":60,"phase":0}`
- An emitter in tile (x, y) firing a beam in direction `"r"|"l"|"u"|"d"` from the emitter's edge until it hits a
  solid tile, closed gate, crate, color wall, or the map edge. Bots touching the beam die. Crates block the beam
  (classic: push a crate in front of it).
- Beam ON/OFF: if `channel` set, the beam is OFF while the channel reading is active (ON while inactive);
  `invert` flips that. Else if `on`/`off` given, it cycles: ON for `on` ticks, OFF for `off` ticks, offset by `phase`.
  Else always ON.

## 7. Level & world files

Each world is one file: `levels/world01.json` … `levels/world10.json`:
```json
{
  "world": 1,
  "name": "Boot Up",
  "theme": "meadow",
  "levels": [ { ...level 1-1... }, ..., { ...level 1-10... } ]
}
```
Each level:
```json
{
  "id": "1-1",
  "name": "Hello, World",
  "hint": "Bring the Power Cell to the hatch, then everybody hop in!",
  "minPlayers": 2,
  "tether": false,
  "tetherLength": 5,
  "map": [
    "................................",
    "...                          ..."
  ],
  "entities": []
}
```
Rules:
- All `map` rows have identical length. Use `.` for empty — never spaces.
- Width 24–96 columns, height 14–26 rows. Leave at least 2 empty rows above the highest standable surface
  so bots on top of towers aren't hidden.
- `minPlayers` (2–4): the minimum number of bots that can finish. Design for **4 bots**; most levels should also be
  finishable with fewer *if* `need` values clamp sensibly, but correctness is only required for ≥ minPlayers.
- `hint`: short (≤ 70 chars), shown for the first few seconds. Only on levels that introduce a mechanic; else `""`.
- `name`: short, original, playful (≤ 22 chars).
- `tether`: if true, bots are tied in slot order (0–1, 1–2, 2–3) by ropes of `tetherLength` tiles (default 5).
  When a rope is longer than its length, the two bots are pulled toward each other (position correction, split
  half/half, respecting collisions). A grounded bot can therefore anchor a dangling partner.
- Themes (one per world, render palette): `meadow`, `workshop`, `switchyard`, `skyway`, `prism`, `bouncy`,
  `ropeway`, `foundry`, `hazard`, `summit`.

Designers also write `levels/solutions/worldNN.md`: per level, 1–4 lines describing the intended solution
(which bot does what). QA uses these.

## 8. World plan & co-op patterns

| World | Name | Theme | Introduces |
|---|---|---|---|
| 1 | Boot Up | meadow | moving, jumping, Power Cell & hatch, stacking (2-, 3-, 4-high), gaps, spikes, gears |
| 2 | Heavy Lifting | workshop | crates: need 1–4 pushers, crates as steps, crates as pit bridges, crate towers |
| 3 | Switchyard | switchyard | buttons (hold, latch, timer), gates, need-N buttons, levers, all/any logic |
| 4 | Skyway | skyway | moving platforms, elevators that need N riders, one-way platforms, drop-through |
| 5 | Prism | prism | color walls (each bot's own path), color + cell combos |
| 6 | Bounce House | bouncy | springs, crumble blocks, conveyors |
| 7 | Tied Together | ropeway | every level `tether: true`, mixing worlds 1–6 mechanics |
| 8 | Foundry | foundry | conveyors + lasers, crates as laser shields, timer buttons |
| 9 | Hazard Zone | hazard | saws, cycling lasers, spikes, precise teamwork |
| 10 | Summit | summit | everything, longest and hardest levels |

Within each world: level 1 introduces the mechanic gently (with a hint), difficulty ramps, level 10 is a capstone.

Co-op patterns to build with (mix and invent your own):
- **Tower & rescue:** stack to put one bot on a high ledge; up there it presses a latch button / lever that lowers an
  elevator, opens a gate or drops a crate so the others can follow.
- **Crate steps:** push a crate (often needing several pushers) to a wall so everyone can climb.
- **Hold the door:** one bot stands on a hold-button keeping a gate open while the others pass; then someone on the far
  side holds another button so the first bot can follow.
- **Counterweight elevators:** an elevator with need 3 forces three bots to ride together.
- **Split paths:** color walls send each bot down its own route; each must press its own button.
- **Relay the cell:** the cell holder must be helped across.
- **Timed rush:** a timer button gives a few seconds for everyone to run through.
- **Shield:** push a crate in front of a laser to walk behind it.
- **Anchor:** (tether) one bot holds still on a ledge while a partner dangles to grab something below.

## 9. Engine contract (`src/engine.js`)

Plain JavaScript (ES2019), no dependencies, UMD: attaches `Engine` to `globalThis.SB.Engine` and to `module.exports` in Node.
**No DOM access. Deterministic** (no Math.random, no Date; use `world.tick`).

```js
Engine.C                              // constants table of §3
Engine.parseLevel(levelJson, meta?)   // -> Level (normalized). Throws Error("<id>: <problem>") if invalid.
                                      //    meta = {world, theme, worldName, index} merged in.
Engine.createWorld(level, {slots})    // slots: array of present slot numbers, e.g. [0,1,2,3] or [0,2]
Engine.reset(world)                   // back to the level's initial state, same slots
Engine.step(world, inputs)            // inputs[slot] = {left,right,up,down,jump,jc,uc} (missing = all false)
Engine.snapshot(world)                // -> compact JSON-safe object of all dynamic state (incl. events since last snapshot)
Engine.applySnapshot(world, snap)     // make a client world match the host's
Engine.tileAt(world, c, r)            // effective tile char (crumble blocks report '.' while gone)
Engine.isSolidFor(world, c, r, slot)  // helper used by renderer/QA (slot -1 = crate/neutral)
```
World object (read-only for renderer):
```js
world = {
  level, tick, phase: 'play'|'dead'|'clear', phaseTimer, deadSlot,
  players: [{slot, x, y, w, h, vx, vy, onGround, facing, state:'active'|'entered', hasKey, walk, landed}],
  key: {x, y, holder, used} | null,           // holder = slot or -1
  door: {x, y, w, h, open},                   // px
  entities: [ {id, type, x, y, w, h, ...type-specific runtime fields} ],
     // crate: vx, vy, need, weight, pushers
     // button: channel, need, mode, pressed, on, load
     // lever: channel, on
     // gate: channel, open, openAmt (0..1 animation, engine-driven)
     // platform: riders, (x,y current)
     // saw: r, angle
     // laser: dir, beamOn, len (px), x2, y2 (beam end)
  crumble: { "<c>,<r>": {t, gone} },          // only touched crumble tiles
  gears: [{x, y, taken}], gearsTaken,
  channels: {A: true, ...},
  ropes: [[slotA, slotB], ...] (tether levels),
  events: [{t:'jump'|'land'|'key'|'unlock'|'enter'|'exit'|'die'|'clear'|'press'|'release'|'lever'|'spring'|'gear'|'crumble'|'gate', x, y, slot}]
     // events are cleared at the start of each step (host accumulates them for snapshots)
}
```
Snapshot JSON must stay **under 3000 bytes** for every level (round positions to 0.1 px, short keys).

Also provide `tools/sim.js` (Node): load a level by id from `levels/`, create a world with N bots, run a scripted input
timeline, and print/return final state. Used by QA and designers:
```js
const sim = require('./tools/sim.js');
const r = sim.run('1-3', {slots:[0,1,2,3], ticks: 900, script: [
  {from: 0, to: 120, slot: 0, hold: ['right']},
  {at: 130, slot: 0, press: 'jump'}
]});   // r.world, r.phase, r.cleared, r.deaths, r.log
```

## 10. Client (browser) architecture

Source files in `src/`, concatenated by `build.js` (Node, no npm deps) into:
- `dist/stackbots.html` — full standalone document (works opened from disk or any static host).
- `dist/artifact.html` — the same page without `<!doctype>/<html>/<head>/<body>` wrapper tags, for publishing as a claude.ai
  artifact (the platform adds the skeleton; `<title>` and `<style>` go at the top of the file).

Files: `engine.js`, `levels.js` (generated from `levels/*.json` by build), `render.js`, `audio.js`, `input.js`, `net.js`,
`ui.js`, `main.js`. Everything on one `<canvas>` plus a thin HTML overlay for menus/text inputs.

### 10.1 Session model (host-authoritative)
- One machine is the **host**: it owns the session, runs `Engine.step` at 60 Hz, and sends state ~30 Hz.
- **Guests** send inputs; they never step the engine. They apply snapshots to their own world (built from the same level
  data, which every client has) and interpolate bot positions between the last two snapshots (render ~1 snapshot behind).
- Host is always slot 0; guests get the lowest free slot 1–3 in join order. Max 4.
- Host controls menus (level select, next, restart). Any player can request a restart (counter `rc` in input).
- Joining during a level: the newcomer is added on the next restart/level load (host shows "X will join next attempt").
- A guest disconnecting: host removes its bot and restarts the current level after a 2-second notice.
- Host leaving: guests see "Host left the room" and return to the title.
- Progress (cleared levels, best time, best gears) is saved in the host's localStorage (wrapped in try/catch).

### 10.2 Messages (logical protocol, same for every transport)
- guest→host: `{t:'hello', id, name, v:1}`, `{t:'in', id, b, jc, uc, rc}` (bits: left 1, right 2, up 4, down 8, jump 16),
  `{t:'bye', id}`. Send `in` on every change and at least every 250 ms.
- host→guest: `{t:'welcome', id, slot}` / `{t:'full', id}`, and state `{t:'st', m: meta, s: snapshot|null, q: seq}` at 30 Hz,
  where `meta = {scr:'lobby'|'select'|'play'|'clear'|'done', lv: levelIndex 0..99, pl: [[slot, name], ...], msg}`.

### 10.3 Transports (`net.js`, one interface, auto-selected)
1. **claude.ai room** — when `window.claude && window.claude.use` exists (page opened as a claude.ai artifact).
   `const room = await claude.use('room')` (may be `null` → explain online play is unavailable in this view).
   Everyone joins named room `'sb-' + code.toLowerCase()` via `room.join(name)`. ALL traffic goes through **presence**
   (anyone admitted may set presence; event topics are admin-only so don't use emit):
   - host: `r.presence({sb:1, role:'host', n:name, st:{m, s, q}})` every 2 ticks (platform coalesces ~30 Hz; merged object ≤ 4 KiB!).
   - guest: `r.presence({sb:1, role:'guest', n:name, in:[b, jc, uc, rc]})` on change.
   - host reads `r.peers()` each tick; a peer's identity is its `peer` label; slots are assigned by the host and published in
     meta as `sl: {peerLabel: slot}`; a guest finds its own label via the peer with `sameTab === true`.
   - `r.onPeers(change => ...)` for joins/leaves. Handle `null` namespace, `connected()` false, and terminal errors gracefully.
2. **PeerJS (WebRTC)** — standalone build. Load `https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js`
   (fallback `https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js`) on demand; constructor is `window.Peer`
   (or `window.peerjs.Peer`). Host id `'stackbots-v1-' + code`; on `unavailable-id` pick a new code.
   Guests `peer.connect(hostId, {serialization:'json', reliable:true})`. Default PeerJS cloud signalling + its default ICE servers.
3. **Same-browser tabs** (`BroadcastChannel('stackbots-' + code)`) — for local testing; reachable from an
   "Advanced" menu item and auto-used when the URL hash is `#tabs`.
Room codes: 5 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.

### 10.4 Screens
Title (name field, Host Online / Join Online (code field) / Local Play / Settings) → Lobby (big room code with copy button,
4 slot cards with names & colors, Start) → Level Select (10 world tabs × 10 level cards: id, name, ✓ cleared, best time, gears)
→ Play (HUD: level id + name top-left, player chips top-right showing in-hatch / carrying cell, timer, hint at bottom,
"Oops! <name> got scrapped" on death) → Clear (time, gears, Next / Level Select) → after 10-10: credits.
Pause on Esc: Resume / Restart / Level Select / Leave (guests: Resume / Leave). Never use alert/confirm/prompt.

### 10.5 Controls
- Online (one bot per machine): ←/→ or A/D move; Space, Z, W or ↑ jump; ↑/W also interact (hatch/lever);
  ↓/S down (Down+Jump drops through one-way); R restart; Esc pause; M mute.
- Local Play (1–4 bots on one machine): P1 = A/D/W/S, P2 = ←/→/↑/↓, P3/P4 = gamepads
  (any connected gamepad can also replace a keyboard player). Gamepad: stick/d-pad move, A jump, d-pad up / Y interact.
- Touch devices: on-screen ◀ ▶ buttons bottom-left, Jump and Up buttons bottom-right.

### 10.6 Art & audio direction (all original, drawn in code)
- **Bots:** rounded box body in slot color with a darker lower band; a dark visor across the upper half with two glowing
  LED eyes (blink occasionally; squint on jump; "x x" when scrapped); a short antenna with a bulb that glows;
  two little feet that step when walking; the slot emblem printed on the chest. Squash on landing, stretch on jump.
- **Power Cell:** a chunky glowing battery (rounded capsule with a lightning notch) that floats behind its carrier.
- **Exit Hatch:** a rounded portal frame set into the ground with a status light (red locked → green open) and a soft glow
  when open. Bots that entered show as small lit dots on the frame.
- **Tiles:** chunky blocks with a lighter top lip and subtle texture, per-world palette; parallax background silhouettes per
  theme (meadow hills; workshop pegboard; switchyard rails & signals; skyway clouds; prism crystals; bouncy balloons;
  ropeway pulleys; foundry chimneys; hazard stripes; summit peaks with stars).
- Channels A–H each have a distinct color; buttons, levers, gates, lasers and platforms show their channel color.
- Particles: dust on land/jump, sparks on death, sparkle on gear/cell. Small screen shake on death.
- Camera: shared, frames all active bots with margin, zooms between 1.0 and 0.62, smooth, clamped to level bounds.
  Logical view 960×540; canvas fills the window (letterbox only if needed).
- **Audio:** WebAudio synthesized SFX only (jump, land, cell pickup, unlock, enter, exit, clear fanfare, scrapped, button
  press/release, lever, spring, gear, crumble, gate). Optional light procedural music loop per world; mute with M.
  Audio starts after the first click/key (browser policy).
- UI type: a blocky display face for titles (Google Fonts "Bungee") + rounded body face ("Nunito"), with system fallbacks.
  The UI commits to one look (it is a game): set every color explicitly; body background explicit.
- Artifact constraints: no alert/confirm/prompt, no `<a download>`, external scripts only from cdnjs / jsdelivr / unpkg,
  stylesheets only from fonts.googleapis.com; localStorage in try/catch; works at phone width (no horizontal scroll).

## 11. Repository layout

```
SPEC.md                this file
src/                   client + engine sources
levels/world01.json …  level data (designers)
levels/solutions/      intended solutions (designers)
levels/_examples.json  2 sample levels for early engine/client testing
tools/sim.js           headless simulation harness (engine dev)
tools/validate-levels.js   level validator (QA)
test/                  automated tests (QA + devs); run with `node test/run.js`
qa/REPORT.md           QA findings
beta/REPORT.md         beta test findings + screenshots
dist/                  build output
build.js               `node build.js` → dist/
```
Each agent writes a short `NOTES-<role>.md` with decisions and open issues.
