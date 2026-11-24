"""4-player online session over one transport: tabs | room | peer.
usage: python3 test_online.py [tabs|room|peer|relay]
peer  = auto online mode with a fake PeerJS (direct route wins)
relay = auto online mode with PeerJS unreachable and one of three MQTT brokers down (relay route carries the game)

host + 2 guests in the lobby -> host starts the first level -> 3rd guest joins mid-level (pending)
-> host restarts -> 4 bots everywhere -> every page holds a key -> every page sees all 4 bots move
-> guest requests restart with R -> a guest leaves (host restarts with 3) -> host leaves (guests back to title)."""
import sys
from common import *  # noqa

KIND = sys.argv[1] if len(sys.argv) > 1 else 'tabs'
INIT = {'room': os.path.join(FAKES, 'fake-room.js'), 'peer': os.path.join(FAKES, 'fake-peer.js')}.get(KIND)
PAGE_URL = URL + ('#tabs' if KIND == 'tabs' else '')
BROKERS = []
EXPECT_NET = {'peer': 'online', 'relay': 'online'}.get(KIND, KIND)
NAMES = ['Hosty', 'Gus', 'Gil', 'Gwen']


def players(pg):
    return {p['slot']: p for p in state(pg)['players']}


def main():
    with sync_playwright() as p:
        b = launch(p)
        ctx = new_context(b, viewport={'width': 800, 'height': 450})
        if INIT:
            ctx.add_init_script(path=INIT)
        brokers = BROKERS
        if KIND == 'relay':
            sys.path.insert(0, FAKES)
            from mqtt_broker import Broker, refuse
            ctx.route_web_socket('wss://broker.emqx.io:8084/mqtt', refuse)
            for u in ('wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'):
                br = Broker(u)
                brokers.append(br)
                ctx.route_web_socket(u, br.handle)
        pages, errs = [], []
        for i in range(4):
            pg = ctx.new_page()
            errs.append(watch(pg, 'page%d' % i))
            pg.goto(PAGE_URL)
            pages.append(pg)
        for pg in pages:
            wait_for(pg, 'window.SB && SB.Game && SB.Game.state().screen === "title"', msg='title loads')
        host, g1, g2, g3 = pages

        # ---- host opens a room ----
        set_name(host, NAMES[0])
        host.click('#b-host')
        wait_for(host, 'SB.Game.state().screen === "lobby" && !!SB.Game.state().code', 10000, 'host lobby with code')
        st = state(host)
        check(st['net'] == EXPECT_NET, 'host uses the %s transport (got %s)' % (EXPECT_NET, st['net']))
        code = st['code']
        check(len(code) == 5 and host.inner_text('#lobby-code') == code, 'lobby shows the 5-char room code ' + code)

        def join(pg, name):
            set_name(pg, name)
            pg.fill('#in-code', code.lower())
            pg.click('#b-join')

        join(g1, NAMES[1]); join(g2, NAMES[2])
        for pg in (g1, g2):
            wait_for(pg, 'SB.Game.state().screen === "lobby" && SB.Game.state().slot != null', 12000, 'guest reaches lobby')
        wait_for(host, 'SB.Game.state().roster.length === 3', 8000, 'host roster has 3')
        check(sorted([state(g1)['slot'], state(g2)['slot']]) == [1, 2], 'guests got slots 1 and 2')
        wait_for(g2, 'SB.Game.state().roster.length === 3', 5000, 'guest sees 3 in roster')
        host.wait_for_timeout(300)
        shot(host, '10-%s-lobby-host' % KIND)
        shot(g1, '11-%s-lobby-guest' % KIND)

        # ---- host picks the first level ----
        host.click('#b-lobby-start')
        wait_for(host, 'SB.Game.state().screen === "select"')
        for pg in (g1, g2):
            wait_for(pg, 'SB.Game.state().screen === "select"', 5000, 'guests follow to level select')
        host.click('.card >> nth=0')
        for pg in (host, g1, g2):
            wait_for(pg, 'SB.Game.state().screen === "play" && SB.Game.state().players.length === 3', 6000, 'everyone in play with 3 bots')
        lid = state(host)['levelId']
        check(all(state(pg)['levelId'] == lid for pg in (g1, g2)), 'all pages on level ' + lid)

        # ---- 3rd guest joins mid-level -> pending, joins next attempt ----
        join(g3, NAMES[3])
        wait_for(g3, 'SB.Game.state().slot === 3 && SB.Game.state().screen === "play"', 12000, 'late guest gets slot 3 and sees the level')
        wait_for(host, 'SB.Game.state().roster.some(r => r.slot === 3 && r.pending)', 3000, 'late guest is pending on host')
        check(len(state(host)['players']) == 3, 'level keeps running with 3 bots while 4th is pending')
        host.keyboard.press('r')
        for pg in pages:
            wait_for(pg, 'SB.Game.state().players.length === 4', 6000, 'all pages see 4 bots after restart')
        for pg in pages:
            wait_for(pg, 'SB.Game.state().players.every(p => p.onGround)', 4000, 'bots settle')
        start = [players(pg) for pg in pages]

        # ---- every player holds "right" on their own page ----
        keys = ['d', 'ArrowRight', 'ArrowRight', 'd']
        for pg, k in zip(pages, keys):
            pg.keyboard.down(k)
        host.wait_for_timeout(700)
        for pg in (g1, g3):
            pg.keyboard.press('Space')
        host.wait_for_timeout(300)
        for pg, k in zip(pages, keys):
            pg.keyboard.up(k)
        host.wait_for_timeout(500)
        shot(host, '12-%s-play-host' % KIND)
        shot(g2, '13-%s-play-guest' % KIND)
        for i, pg in enumerate(pages):
            now = players(pg)
            moved = [s for s in range(4) if now[s]['x'] > start[i][s]['x'] + 25]
            check(len(moved) == 4, 'page%d sees all 4 bots moved right (moved=%s)' % (i, moved))
        hp = players(host)
        for i, pg in enumerate(pages[1:], 1):
            gp = players(pg)
            check(all(abs(gp[s]['x'] - hp[s]['x']) < 3 for s in range(4)), 'page%d positions match host after settling' % i)
            check(state(pg)['levelId'] == lid, 'page%d still on the same level' % i)

        # ---- guest asks for a restart (rc counter) ----
        g2.keyboard.press('r')
        wait_for(host, 'SB.Game.state().players.every(p => p.x < %f)' % (min(hp[s]['x'] for s in range(4)) - 10), 4000, 'guest R restarts the level on host')
        print('  ok  guest restart request honoured')

        if KIND == 'room':
            mx = host.evaluate('window.__fakeRoom.stats')
            check(mx['rejects'] == 0 and mx['maxBytes'] <= 4096, 'host presence stayed under 4 KiB (max %d bytes, %d rejects)' % (mx['maxBytes'], mx['rejects']))

        # ---- a guest leaves -> bot removed, level restarted after a notice ----
        g3.close()
        wait_for(host, 'document.getElementById("hud-banner").textContent.indexOf("left") >= 0', 9000, 'host shows "<name> left" notice')
        print('  ok  host notice: ' + host.inner_text('#hud-banner'))
        shot(host, '14-%s-guest-left' % KIND)
        for pg in (host, g1, g2):
            wait_for(pg, 'SB.Game.state().players.length === 3 && SB.Game.state().screen === "play"', 6000, 'level restarted with 3 bots')
        check(not any(r['slot'] == 3 for r in state(host)['roster']), 'left guest removed from roster')

        # ---- host leaves -> guests go back to title with a message ----
        host.close()
        for pg in (g1, g2):
            wait_for(pg, 'SB.Game.state().screen === "title" && !document.getElementById("dialog").classList.contains("hidden")', 12000, 'guest back at title with dialog')
        check('Host left' in g1.inner_text('#dlg-title'), 'guest dialog says the host left')
        shot(g1, '15-%s-host-left' % KIND)
        allerrs = sum(errs, [])
        check(allerrs == [], 'no console errors on any page: %s' % allerrs[:5])
        b.close()


if __name__ == '__main__':
    print('transport: ' + KIND)
    run(main)
    for br in BROKERS:
        print('  broker %s: %d connects, %d publishes' % (br.name, br.connects, br.published))
