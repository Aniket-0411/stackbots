# Stackbots

An original co-op puzzle platformer for 1–4 players. Each player controls a little robot. Bots are solid to each other, so you stand on each other's heads, push heavy crates together, hold buttons for each other and ride lifts that need several riders. Carry the **Power Cell** to the **Exit Hatch**, then get everyone inside.

**100 levels in 10 worlds:** Boot Up · Heavy Lifting · Switchyard · Skyway · Prism · Bounce House · Tied Together · Foundry · Hazard Zone · Summit.

Everything is drawn and synthesized in code. The game is one HTML file with no install, no build step for players, and no accounts.

## Play

Open `dist/stackbots.html` in Chrome, Edge or Firefox (save it locally first; preview windows block online play).

- **Online:** one person clicks **Host Online** and shares the 5-letter code; up to 3 friends click **Join Online** and type it.
- **Local Play:** up to 4 players on one computer with keyboard and gamepads.

### Host it on GitHub Pages
Settings → Pages → *Deploy from a branch* → `main` / `(root)`. The game is then at `https://<you>.github.io/<repo>/` (the root `index.html` forwards to `dist/stackbots.html`).

### Controls
| Action | Online / P1 | P2 (Local Play) | Gamepad |
|---|---|---|---|
| Move | ← → or A D | ← → | stick / d-pad |
| Jump | Space, W or ↑ | Enter or ↑ | A |
| Enter hatch / lever | ↑ or W | ↑ | d-pad up / Y |
| Drop through ledge | ↓ + Jump | ↓ + Jump | down + A |
| See whole level | hold Q or Shift | | shoulder |
| Restart / Pause / Mute | R / Esc / M | | |

Phones get on-screen buttons (landscape works best).

## How online play works
The host's browser runs the simulation (60 Hz) and sends state about 30 times a second; guests send their inputs and predict their own bot locally. Connections, chosen automatically:
1. **Direct (WebRTC)** via the public PeerJS signalling server.
2. **Relay** through free public MQTT-over-WebSocket brokers (EMQX, HiveMQ, Mosquitto). Used when a direct link can't be made.
3. **claude.ai room** when the page runs as a claude.ai artifact.
4. **Browser tabs** (BroadcastChannel) for testing on one machine: add `#tabs` to the URL.

Strict school or office networks can block both internet routes; home Wi-Fi or a phone hotspot usually works.

## Develop
Requires Node 18+ (no npm packages) and, for browser tests, Python 3 with Playwright.

```sh
node build.js                      # src/ + levels/ → dist/stackbots.html and dist/artifact.html
node tools/validate-levels.js      # level checker (structure, entities, reachability heuristics)
node test/run.js                   # engine + mechanics + per-level tests
node test/qa-proofs.js             # engine simulations of key level moves
python3 test/client/run_all.py     # headless-browser suites incl. 4-player online sessions
node tools/sim.js 1-3 --ticks 600  # run a level headlessly
```

### Layout
```
SPEC.md            game design + technical contract (physics, tiles, entities, protocol)
src/               engine.js (deterministic sim), render.js, audio.js, input.js, net.js, ui.js, main.js
levels/            world01.json … world10.json, solutions/ (intended solutions per level)
tools/             validator, sim harness, per-designer level generators
test/              Node tests, browser tests (test/client), fakes for room/PeerJS/MQTT
qa/, beta/         QA and beta-test reports and scripts
dist/              built game
NOTES-*.md         per-role notes (engine, client, designers, QA)
```

### Making levels
Levels are JSON (see `SPEC.md` §5–§7): an ASCII `map` plus `entities` (crates, buttons, levers, gates, platforms, saws, lasers). Several worlds are generated from scripts in `tools/designer-N/`; edit those and re-run them rather than the JSON. Run the validator and `node test/run.js` after any change.

## Credits
Designed and built by a team of Claude agents (engine, client, five level designers, QA, beta tester) coordinated by Claude. All characters, art, sound, names and levels are original.
