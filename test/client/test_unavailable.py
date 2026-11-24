"""Failure paths: PeerJS CDN unreachable -> clear in-page error; artifact view where room is null -> clear message,
Local Play still works; localStorage throwing -> game still runs."""
from common import *  # noqa


def main():
    with sync_playwright() as p:
        b = launch(p)
        # 1) standalone, CDNs blocked (no fake Peer): Host Online must show a readable dialog, no crash
        ctx = new_context(b, viewport={'width': 900, 'height': 600})
        pg = ctx.new_page()
        errs = watch(pg, 'nopeer')
        pg.goto(URL)
        wait_for(pg, 'SB.Game.state().screen === "title"')
        pg.click('#b-host')
        wait_for(pg, '!document.getElementById("dialog").classList.contains("hidden")', 30000, 'error dialog after PeerJS fails to load')
        txt = pg.inner_text('#dlg-text')
        check('PeerJS' in txt or 'online' in txt.lower(), 'PeerJS failure explained: "%s"' % txt)
        check(state(pg)['screen'] == 'title', 'back on the title screen')
        shot(pg, '30-peerjs-unavailable')
        pg.click('#dlg-btns .btn')
        pg.fill('#in-code', 'abcde')
        pg.click('#b-join')
        wait_for(pg, '!document.getElementById("dialog").classList.contains("hidden")', 30000, 'join error dialog')
        check(errs == [], 'no console errors: %s' % errs[:3])
        ctx.close()

        # 2) artifact view where claude.use('room') resolves null
        ctx = new_context(b, viewport={'width': 900, 'height': 600})
        ctx.add_init_script('window.__fakeRoomOpts = {nullNamespace: true};')
        ctx.add_init_script(path=os.path.join(FAKES, 'fake-room.js'))
        pg = ctx.new_page()
        errs = watch(pg, 'nullroom')
        pg.goto(URL)
        wait_for(pg, 'SB.Game.state().screen === "title"')
        wait_for(pg, 'document.getElementById("net-note").textContent.indexOf("not available") >= 0', 4000, 'title notes online play is unavailable')
        pg.click('#b-host')
        wait_for(pg, '!document.getElementById("dialog").classList.contains("hidden")', 5000, 'dialog explains room unavailable')
        check('not available' in pg.inner_text('#dlg-text'), 'room-null message shown')
        check(pg.evaluate('typeof window.Peer') == 'undefined' and pg.evaluate('document.querySelectorAll("script[src]").length') == 0, 'artifact mode never loads PeerJS')
        pg.click('#dlg-btns .btn')
        pg.click('#b-local')
        wait_for(pg, 'SB.Game.state().screen === "lobby"', 3000, 'Local Play still available')
        check(errs == [], 'no console errors: %s' % errs[:3])
        ctx.close()

        # 3) localStorage throws on every access
        ctx = new_context(b, viewport={'width': 900, 'height': 600})
        ctx.add_init_script("Object.defineProperty(window, 'localStorage', {get: function(){ throw new Error('blocked'); }});")
        pg = ctx.new_page()
        errs = watch(pg, 'nols')
        pg.goto(URL)
        wait_for(pg, 'SB.Game.state().screen === "title"', 5000, 'loads with localStorage blocked')
        pg.click('#b-local')
        pg.click('#b-lobby-start')
        pg.click('.card >> nth=0')
        wait_for(pg, 'SB.Game.state().screen === "play"', 3000, 'plays with localStorage blocked')
        pg.keyboard.press('m')
        check(errs == [], 'no console errors with localStorage blocked: %s' % errs[:3])
        b.close()


if __name__ == '__main__':
    run(main)
