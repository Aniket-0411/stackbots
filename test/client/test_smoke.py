"""Smoke test: page loads without console errors, screens render, Local Play moves bots, phone layout is sane."""
from common import *  # noqa


def main():
    with sync_playwright() as p:
        b = launch(p)
        ctx = new_context(b, viewport={'width': 1280, 'height': 720})
        pg = ctx.new_page()
        errs = watch(pg, 'desktop')
        pg.goto(URL)
        wait_for(pg, 'window.SB && SB.Game && SB.Game.state().screen === "title"', msg='title screen shows')
        pg.wait_for_timeout(700)
        shot(pg, '01-title')
        check(pg.is_visible('#b-host') and pg.is_visible('#b-local'), 'title buttons visible')

        # ---- Local Play ----
        pg.click('#b-local')
        wait_for(pg, 'SB.Game.state().screen === "lobby"', msg='lobby after Local Play')
        pg.click('.slot:nth-child(3)')   # add a third bot (idle unless pad)
        pg.click('.slot:nth-child(4)')
        pg.wait_for_timeout(400)
        shot(pg, '02-lobby-local')
        check(len(state(pg)['roster']) == 4, 'local lobby has 4 bots after adding')
        pg.click('.slot:nth-child(4)')   # idle -> removed (bots are solid: idle P3/P4 would block P2 in 1-1)
        check(len(state(pg)['roster']) == 3, 'clicking an idle card removes it')
        pg.click('#b-lobby-start')
        wait_for(pg, 'SB.Game.state().screen === "select"', msg='level select')
        pg.wait_for_timeout(300)
        shot(pg, '03-select')
        pg.click('.card >> nth=0')
        wait_for(pg, 'SB.Game.state().screen === "play"', msg='play screen')
        pg.wait_for_timeout(900)
        s0 = state(pg)
        p0 = {p['slot']: p for p in s0['players']}
        check(len(s0['players']) == 3, '3 bots in the level')
        # P1 (WASD) walks right & jumps, P2 (arrows) walks left
        pg.keyboard.down('a'); pg.keyboard.down('ArrowLeft')
        pg.wait_for_timeout(250)
        tap(pg, 'Space', 120)
        pg.wait_for_timeout(150)
        mid = {p['slot']: p for p in state(pg)['players']}
        pg.wait_for_timeout(400)
        pg.keyboard.up('a'); pg.keyboard.up('ArrowLeft')
        shot(pg, '04-play-local')
        s1 = {p['slot']: p for p in state(pg)['players']}
        check(s1[0]['x'] < p0[0]['x'] - 20, 'P1 walked left with A (%.1f -> %.1f)' % (p0[0]['x'], s1[0]['x']))
        check(s1[1]['x'] < p0[1]['x'] - 20, 'P2 walked left with arrows (%.1f -> %.1f)' % (p0[1]['x'], s1[1]['x']))
        check(mid[0]['y'] < p0[0]['y'] - 10 or not mid[0]['onGround'], 'P1 jumped (y %.1f -> %.1f)' % (p0[0]['y'], mid[0]['y']))
        check(abs(s1[2]['x'] - p0[2]['x']) < 1, 'idle bot P3 did not move')
        # pause / restart / mute
        pg.keyboard.press('Escape')
        wait_for(pg, 'SB.Game.state().paused === true', msg='Esc pauses')
        pg.wait_for_timeout(200)
        shot(pg, '05-pause')
        pg.keyboard.press('Escape')
        wait_for(pg, 'SB.Game.state().paused === false', msg='Esc resumes')
        pg.keyboard.press('r')
        pg.wait_for_timeout(200)
        s2 = {p['slot']: p for p in state(pg)['players']}
        check(abs(s2[0]['x'] - p0[0]['x']) < 2, 'R restarts the level')
        pg.keyboard.press('m')
        check(pg.evaluate('SB.Audio.isMuted()') is True, 'M mutes')
        pg.keyboard.press('m')
        check(errs == [], 'no console errors on desktop: %s' % errs[:5])
        ctx.close()

        # ---- Phone ----
        ctx = new_context(b, viewport={'width': 400, 'height': 800}, has_touch=True, is_mobile=True, device_scale_factor=2)
        pg = ctx.new_page()
        errs = watch(pg, 'phone')
        pg.goto(URL)
        wait_for(pg, 'SB.Game.state().screen === "title"')
        pg.wait_for_timeout(500)
        shot(pg, '06-phone-title')
        sw = pg.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth, document.body.scrollWidth]')
        check(sw[0] <= sw[1] and sw[2] <= sw[1], 'no horizontal scroll on phone title %s' % sw)
        pg.tap('#b-local')
        wait_for(pg, 'SB.Game.state().screen === "lobby"')
        pg.wait_for_timeout(300)
        shot(pg, '07-phone-lobby')
        pg.tap('#b-lobby-start')
        wait_for(pg, 'SB.Game.state().screen === "select"')
        shot(pg, '08-phone-select')
        pg.tap('.card >> nth=0')
        wait_for(pg, 'SB.Game.state().screen === "play"')
        pg.wait_for_timeout(600)
        check(pg.is_visible('#touch [data-k="left"]') and pg.is_visible('#touch [data-k="jump"]'), 'touch buttons visible on phone')
        x0 = state(pg)['players'][0]['x']
        box = pg.locator('#touch [data-k="left"]').bounding_box()
        pg.dispatch_event('#touch [data-k="left"]', 'pointerdown', {'pointerId': 7, 'clientX': box['x'] + 10, 'clientY': box['y'] + 10})
        pg.wait_for_timeout(500)
        pg.dispatch_event('#touch [data-k="left"]', 'pointerup', {'pointerId': 7})
        shot(pg, '09-phone-play')
        x1 = state(pg)['players'][0]['x']
        check(x1 < x0 - 20, 'touch Left button moves P1 (%.1f -> %.1f)' % (x0, x1))
        for scr in ('title',):
            pass
        sw = pg.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
        check(sw[0] <= sw[1], 'no horizontal scroll on phone play %s' % sw)
        check(errs == [], 'no console errors on phone: %s' % errs[:5])
        b.close()


if __name__ == '__main__':
    run(main)
