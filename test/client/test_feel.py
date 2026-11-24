"""Fix-round checks: guest prediction latency, intro pan (+skip), hold-to-peek, minPlayers warning, unique names,
lobby toasts clear of the room code, pause hint, phone portrait (rotate prompt, HUD no overlap) and landscape."""
from common import *  # noqa

# time from a key press to the guest's own bot visibly moving (same probe as beta/b4d_guestlat.py)
LAT = """(K) => new Promise(res => { setTimeout(() => res(-1), 3000); const me = SB.Game.state().slot, R = SB.Render, f0 = R.frame; let x0 = null, t0 = 0, done = false;
  R.frame = function (w, o) { const q = o && o.pp && o.pp[me], p = w.players.find(p => p.slot === me), x = q ? q.x : p.x;
    if (x0 === null) { x0 = x; t0 = performance.now(); document.dispatchEvent(new KeyboardEvent('keydown', {code: K, key: K, bubbles: true})); }
    else if (!done && Math.abs(x - x0) > 0.5) { done = true; document.dispatchEvent(new KeyboardEvent('keyup', {code: K, key: K, bubbles: true})); R.frame = f0; res(performance.now() - t0); }
    return f0.apply(this, arguments); }; })"""


def rect(pg, sel):
    return pg.evaluate('(s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }', sel)


def overlap(a, b):
    return min(a[2], b[2]) - max(a[0], b[0]) > 1 and min(a[3], b[3]) - max(a[1], b[1]) > 1


def lv_index(pg, lid):
    return [l['index'] for l in pg.evaluate('SB.Game.levels()') if l['id'] == lid][0]


def main():
    with sync_playwright() as p:
        b = launch(p)
        # ---------- guest prediction over the tabs transport ----------
        ctx = new_context(b, viewport={'width': 800, 'height': 450})
        host, g = ctx.new_page(), ctx.new_page()
        errs = watch(host, 'host') + watch(g, 'guest')
        for pg in (host, g):
            pg.goto(URL + '#tabs'); wait_for(pg, 'window.SB && SB.Game && SB.Game.state().screen === "title"')
        set_name(host, 'Gizmo'); set_name(g, 'Gizmo')
        host.click('#b-host'); wait_for(host, '!!SB.Game.state().code', 8000)
        g.fill('#in-code', state(host)['code']); g.click('#b-join')
        wait_for(g, 'SB.Game.state().slot === 1 && SB.Game.state().screen === "lobby"', 8000, 'guest joined')
        names = [r['name'] for r in state(host)['roster']]
        check(names == ['Gizmo', 'Gizmo 2'], 'host makes duplicate names unique: %s' % names)
        toast = host.locator('.toast').first
        if toast.count():
            check(not overlap(rect(host, '.toast'), rect(host, '#lobby-code')), 'lobby "joined" toast does not cover the room code')
        host.click('#b-lobby-start'); host.click('.card >> nth=0')
        for pg in (host, g):
            wait_for(pg, 'SB.Game.state().screen === "play" && SB.Game.state().players.length === 2', 6000)
        wait_for(g, 'SB.Render.introActive()', 2000, 'guest follows the host into the intro pan')
        g.keyboard.press('KeyM'); g.keyboard.press('KeyM')
        wait_for(g, '!SB.Render.introActive()', 2000, 'any key skips the intro on the guest')
        g.wait_for_timeout(1200)
        wait_for(g, 'SB.Game.netDebug().pred.valid', 4000, 'guest prediction is synced to the host')
        lat = sorted(g.evaluate(LAT, 'ArrowRight') for _ in range(3) if not g.wait_for_timeout(400))
        check(0 < lat[1] < 35, 'guest own bot reacts in %d ms (median of %s; target < 35)' % (lat[1], [round(x) for x in lat]))
        g.keyboard.down('ArrowRight'); g.wait_for_timeout(600); g.keyboard.up('ArrowRight'); g.wait_for_timeout(700)
        d = g.evaluate('SB.Game.netDebug()')
        check(d['pred']['on'] and abs(d['pred']['lastErr'] or 0) < 4, 'prediction on, last reconcile error %.1f px' % (d['pred']['lastErr'] or 0))
        gx = [q for q in state(g)['players'] if q['slot'] == 1][0]['x']
        hx = [q for q in state(host)['players'] if q['slot'] == 1][0]['x']
        check(abs(gx - hx) < 1, 'guest and host agree on the bot position after the walk (%.1f vs %.1f)' % (gx, hx))
        check(errs == [], 'no console errors (online): %s' % errs[:3])
        ctx.close()

        # ---------- intro, peek, minPlayers, pause hint (desktop, local) ----------
        ctx = new_context(b, viewport={'width': 960, 'height': 540})
        pg = ctx.new_page(); errs = watch(pg, 'local')
        pg.goto(URL); wait_for(pg, 'SB.Game.state().screen === "title"')
        pg.click('#b-local'); pg.click('#b-lobby-start')
        pg.click('.card >> nth=0')
        wait_for(pg, 'SB.Game.state().screen === "play"')
        pg.wait_for_timeout(150)
        info = pg.evaluate('SB.Render.introInfo()')
        k = pg.evaluate('(() => { const w = SB.Game.world(); return [w.key.x, w.key.y]; })()')
        cam = pg.evaluate('[SB.Render._cam.x, SB.Render._cam.y]')
        check(info['active'] and info['n'] == 2, 'intro pan starts at level start (cell -> hatch -> bots)')
        check(abs(cam[0] - k[0]) < 200, 'intro opens on the Power Cell (cam x %.0f, cell x %.0f)' % (cam[0], k[0]))
        shot(pg, '50-intro-cell')
        wait_for(pg, '!SB.Render.introActive()', 4000, 'intro finishes on its own (~2.5 s)')
        check(pg.is_visible('#legend'), 'one-time key legend shows in 1-1')
        pg.keyboard.press('Escape')
        check(pg.is_visible('#pause-hint') and len(pg.inner_text('#pause-hint')) > 10, 'pause menu repeats the level hint')
        pg.keyboard.press('Escape')
        z0 = pg.evaluate('SB.Render._cam.z')
        pg.keyboard.down('KeyQ'); pg.wait_for_timeout(700)
        zp = pg.evaluate('SB.Render._cam.z')
        shot(pg, '51-peek')
        pg.keyboard.up('KeyQ'); pg.wait_for_timeout(900)
        check(pg.evaluate('SB.Render.peekAmount()') < 0.05 and zp < z0 - 0.05, 'hold Q zooms out to the overview (z %.2f -> %.2f) and back' % (z0, zp))
        # needs-4 level with 2 bots -> warning, Back keeps you on select, Play anyway starts it
        pg.keyboard.press('Escape'); pg.click('#b-pselect')
        wait_for(pg, 'SB.Game.state().screen === "select"')
        i7 = lv_index(pg, '1-7')
        pg.evaluate('document.querySelectorAll(".card")[%d].click()' % i7)
        wait_for(pg, '!document.getElementById("dialog").classList.contains("hidden")', 2000, 'minPlayers warning dialog')
        txt = pg.inner_text('#dlg-text')
        check('needs 4 bots' in txt and 'you have 2' in txt, 'warning text: ' + txt[:70])
        pg.click('#dlg-btns .btn >> nth=0')
        check(state(pg)['screen'] == 'select', 'Back stays on level select')
        pg.evaluate('document.querySelectorAll(".card")[%d].click()' % i7)
        pg.click('#dlg-btns .btn >> nth=1')
        wait_for(pg, 'SB.Game.state().screen === "play" && SB.Game.state().levelId === "1-7"', 2000, 'Play anyway starts the level')
        check(errs == [], 'no console errors (local): %s' % errs[:3])
        ctx.close()

        # ---------- phone portrait / landscape ----------
        ctx = new_context(b, viewport={'width': 400, 'height': 800}, has_touch=True, is_mobile=True, device_scale_factor=2)
        pg = ctx.new_page(); errs = watch(pg, 'phone')
        pg.goto(URL); wait_for(pg, 'SB.Game.state().screen === "title"')
        pg.evaluate('SB.Game.localStart(%d, 4)' % lv_index(pg, '1-7'))
        wait_for(pg, 'SB.Game.state().screen === "play"')
        pg.wait_for_timeout(300)
        check(pg.is_visible('#rotate'), 'portrait phone shows the rotate prompt')
        shot(pg, '52-phone-rotate')
        pg.click('#b-rotate-ok')
        pg.wait_for_timeout(2800)
        check(not pg.is_visible('#rotate'), 'rotate prompt can be dismissed')
        chips = rect(pg, '#hud-chips'); title = rect(pg, '.hud-tl')
        check(not overlap(chips, title), 'HUD title and 4 player chips do not overlap at 400 px (%s / %s)' % (title, chips))
        sw = pg.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
        check(sw[0] <= sw[1], 'no horizontal scroll %s' % sw)
        shot(pg, '53-phone-portrait-play')
        pg.set_viewport_size({'width': 844, 'height': 390})
        pg.wait_for_timeout(700)
        check(not pg.is_visible('#rotate') and pg.is_visible('#touch [data-k="jump"]'), 'landscape: no prompt, touch buttons overlaid')
        shot(pg, '54-phone-landscape')
        check(errs == [], 'no console errors (phone): %s' % errs[:3])
        b.close()


if __name__ == '__main__':
    run(main)
