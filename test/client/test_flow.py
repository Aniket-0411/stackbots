"""Game flow in Local Play with tiny injected levels: walk into the open hatch -> clear screen -> progress saved ->
Next; spikes -> "got scrapped" banner -> automatic restart; credits after the last level."""
import json
from common import *  # noqa

EMPTY = "." * 24
FLOOR = "#" * 24


def lvl(i, row, name):
    return {"id": "F-%d" % i, "name": name, "hint": "", "minPlayers": 2, "tether": False, "tetherLength": 5,
            "map": [EMPTY] * 12 + [row, FLOOR], "entities": []}


EXTRA = [{"world": 99, "name": "Flow", "theme": "bouncy", "levels": [
    lvl(1, "...1.D.2.3.4............", "Front Door"),
    lvl(2, "34.1.2...^^^.........D..", "Ouch"),
    lvl(3, "...1.D.2.3.4............", "Back Door"),
]}]

PAD = """
window.__pad = {connected: true, id: 'Fake Pad', index: 0, mapping: 'standard', axes: [0, 0, 0, 0], timestamp: 0,
  buttons: Array.from({length: 17}, () => ({pressed: false, value: 0}))};
navigator.getGamepads = function () { return [window.__pad, null, null, null]; };
window.__padSet = function (btn, on) { window.__pad.buttons[btn] = {pressed: on, value: on ? 1 : 0}; };
window.__padAxis = function (v) { window.__pad.axes[0] = v; };
"""


def px(pg, slot):
    return [p for p in state(pg)['players'] if p['slot'] == slot][0]


def walk_until(pg, key, slot, cond, limit=3000):
    pg.keyboard.down(key)
    t = 0
    while t < limit and not cond(px(pg, slot)):
        pg.wait_for_timeout(16); t += 16
    pg.keyboard.up(key)


def main():
    with sync_playwright() as p:
        b = launch(p)
        ctx = new_context(b, viewport={'width': 1024, 'height': 600})
        ctx.add_init_script('window.__SB_EXTRA_LEVELS = %s;' % json.dumps(EXTRA))
        ctx.add_init_script(PAD)
        pg = ctx.new_page()
        errs = watch(pg, 'flow')
        pg.goto(URL)
        wait_for(pg, 'SB.Game.state().screen === "title"')
        base = len(pg.evaluate('SB.Game.levels()')) - 3
        pg.evaluate('SB.Game.localStart(%d, 2)' % base)
        wait_for(pg, 'SB.Game.state().screen === "play"')
        wait_for(pg, 'SB.Game.state().players.every(p => p.onGround)', 3000, 'bots land')
        door = pg.evaluate('(function(){var d=SB.Game.world().door; return [d.x, d.x + d.w];})()')
        walk_until(pg, 'd', 0, lambda q: q['x'] + 24 > door[0] + 10)
        walk_until(pg, 'ArrowLeft', 1, lambda q: q['x'] < door[1] - 10)
        pg.wait_for_timeout(250)
        tap(pg, 'w'); tap(pg, 'ArrowUp')
        wait_for(pg, 'SB.Game.state().players.every(p => p.state === "entered")', 2000, 'both bots entered the hatch')
        pg.wait_for_timeout(600)
        shot(pg, '40-everybody-in')
        wait_for(pg, 'SB.Game.state().screen === "clear"', 4000, 'clear screen after the clear phase')
        pg.wait_for_timeout(300)
        shot(pg, '41-clear')
        prog = pg.evaluate('SB.Game.progress()')
        check('F-1' in prog and prog['F-1']['c'] == 1 and prog['F-1']['t'] > 0, 'progress saved for F-1: %s' % prog.get('F-1'))
        stored = pg.evaluate('JSON.parse(localStorage.getItem("sb.progress.v1"))')
        check(stored and 'F-1' in stored, 'progress persisted to localStorage')

        pg.click('#b-next')
        wait_for(pg, 'SB.Game.state().screen === "play" && SB.Game.state().levelId === "F-2"', 3000, 'Next starts F-2')
        wait_for(pg, 'SB.Game.state().players.every(p => p.onGround)', 3000)
        pg.keyboard.down('ArrowRight')
        wait_for(pg, 'SB.Game.state().phase === "dead"', 5000, 'walking into spikes scraps the bot')
        pg.keyboard.up('ArrowRight')
        pg.wait_for_timeout(250)
        banner = pg.inner_text('#hud-banner')
        check('scrapped' in banner and 'P2' in banner, 'banner: ' + banner.replace('\n', ' '))
        shot(pg, '42-scrapped')
        wait_for(pg, 'SB.Game.state().phase === "play"', 3000, 'level restarts automatically')
        check(px(pg, 1)['x'] < 200, 'P2 back at spawn after restart')

        # last level: clear it, Next -> credits
        pg.evaluate('SB.Game.localStart(%d, 2)' % (base + 2))
        wait_for(pg, 'SB.Game.state().screen === "play" && SB.Game.state().levelId === "F-3"')
        wait_for(pg, 'SB.Game.state().players.every(p => p.onGround)', 3000)
        walk_until(pg, 'd', 0, lambda q: q['x'] + 24 > door[0] + 10)
        walk_until(pg, 'ArrowLeft', 1, lambda q: q['x'] < door[1] - 10)
        pg.wait_for_timeout(250)
        tap(pg, 'w'); tap(pg, 'ArrowUp')
        wait_for(pg, 'SB.Game.state().screen === "clear"', 5000, 'last level cleared')
        check('Credits' in pg.inner_text('#b-next'), 'Next button says Credits on the last level')
        pg.click('#b-next')
        wait_for(pg, 'SB.Game.state().screen === "done"', 2000, 'credits screen after the last level')
        shot(pg, '43-credits')

        # gamepad: in the local lobby, pad A joins as P3, then the stick moves that bot
        pg.evaluate('SB.Game.localStart(%d, 2)' % base)
        pg.keyboard.press('Escape'); pg.click('#b-pselect'); pg.click('#b-sel-back')
        wait_for(pg, 'SB.Game.state().screen === "lobby"', 2000, 'back in local lobby')
        pg.evaluate('__padSet(0, true)'); pg.wait_for_timeout(100); pg.evaluate('__padSet(0, false)')
        wait_for(pg, 'SB.Game.state().roster.some(r => r.slot === 2 && r.dev === "pad0")', 2000, 'gamepad A press adds P3 on pad0')
        pg.click('#b-lobby-start'); pg.click('.card >> nth=0')
        wait_for(pg, 'SB.Game.state().screen === "play" && SB.Game.state().players.length === 3', 3000)
        wait_for(pg, 'SB.Game.state().players.every(p => p.onGround)', 3000)
        x0 = px(pg, 2)['x']
        pg.evaluate('__padAxis(1)'); pg.wait_for_timeout(400); pg.evaluate('__padAxis(0)')
        x1 = px(pg, 2)['x']
        check(x1 > x0 + 15, 'gamepad stick moves P3 (%.1f -> %.1f)' % (x0, x1))
        b.close()
        check(errs == [], 'no console errors: %s' % errs[:3])


if __name__ == '__main__':
    run(main)
