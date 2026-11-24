"""4. Online over the emulated MQTT relay (PeerJS blocked): lobby, wrong code, 20 s of 4-player play, jitter, host leaves."""
from bt import *  # noqa
sys.path.insert(0, FAKES)
from mqtt_broker import Broker, refuse

HOOK = """(() => { window.__fr = []; const R = SB.Render, f = R.frame;
  R.frame = function (w, o) { try { const me = SB.Game.state().slot; const q = o && o.pp && o.pp[me];
    const p = w.players.find(p => p.slot === me); window.__fr.push([performance.now(), q ? q.x : (p ? p.x : null), p ? p.x : null]); } catch (e) {}
    return f.apply(this, arguments); }; })()"""

def stats(fr, t0, t1):
    fr = [f for f in fr if t0 <= f[0] <= t1 and f[1] is not None]
    dts = [b[0] - a[0] for a, b in zip(fr, fr[1:])]
    dxs = [abs(b[1] - a[1]) for a, b in zip(fr, fr[1:])]
    mv = [d for d in dxs if d > 0.01]
    import statistics as S
    return 'frames %d, frame dt median %.1f ms max %.0f, |dx| per frame mean %.2f sd %.2f max %.2f, still frames %d%%' % (
        len(fr), S.median(dts), max(dts), S.mean(dxs), S.pstdev(dxs), max(dxs), 100 * (len(dxs) - len(mv)) // max(1, len(dxs)))

def main():
    with sync_playwright() as p:
        b = launch(p)
        ctx = new_context(b, viewport={'width': 960, 'height': 540})
        ctx.route_web_socket('wss://broker.emqx.io:8084/mqtt', refuse)
        for u in ('wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'):
            ctx.route_web_socket(u, Broker(u).handle)
        pages = []
        for i in range(4):
            pg = ctx.new_page(); watch(pg, 'p%d' % i); pg.goto(URL); pages.append(pg)
        for pg in pages: wait_for(pg, 'window.SB && SB.Game && SB.Game.state().screen === "title"')
        host, g1, g2, g3 = pages
        # wrong code before anything exists
        set_name(g3, 'Gwen'); g3.fill('#in-code', 'qqqqq'); t0 = time.time(); g3.click('#b-join')
        try:
            wait_for(g3, '!document.getElementById("dialog").classList.contains("hidden")', 30000)
            print('WRONG CODE after %.1fs: %r' % (time.time() - t0, g3.inner_text('#dialog')[:250]))
        except Failure:
            print('WRONG CODE: no dialog after 30s; screen', state(g3)['screen'], repr(g3.inner_text('body')[:200]))
        print(bshot(g3, '4-wrong-code'))
        g3.evaluate("document.querySelectorAll('#dialog button').forEach(b => b.click())")
        # host
        set_name(host, 'Ana'); host.click('#b-host'); t0 = time.time()
        wait_for(host, 'SB.Game.state().screen === "lobby" && !!SB.Game.state().code', 15000)
        code = state(host)['code']; print('host lobby after %.1fs, code %s, net %s' % (time.time() - t0, code, state(host)['net']))
        print('HOST LOBBY TEXT:', ' | '.join(l for l in host.inner_text('#scr-lobby').split('\n') if l.strip())[:400] if host.query_selector('#scr-lobby') else '')
        for pg, n in ((g1, 'Bo'), (g2, 'Cy'), (g3, 'Gwen')):
            set_name(pg, n); pg.fill('#in-code', code.lower()); t0 = time.time(); pg.click('#b-join')
            wait_for(pg, 'SB.Game.state().screen === "lobby" && SB.Game.state().slot != null', 15000)
            print(' %s joined slot %s after %.1fs' % (n, state(pg)['slot'], time.time() - t0))
        print('GUEST LOBBY TEXT:', ' | '.join(l for l in g1.inner_text('#scr-lobby').split('\n') if l.strip())[:300])
        host.wait_for_timeout(500); print(bshot(host, '4-lobby-host'))
        host.click('#b-lobby-start'); host.wait_for_timeout(300); host.click('.card >> nth=1')
        for pg in pages: wait_for(pg, 'SB.Game.state().screen === "play" && SB.Game.state().players.length === 4', 8000)
        for pg in (host, g2): pg.evaluate(HOOK)
        host.wait_for_timeout(500)
        # 20 s of play: everyone runs right / left in bursts and jumps
        T0 = time.time(); k = 0; tA = g2.evaluate('performance.now()'); tH = host.evaluate('performance.now()')
        while time.time() - T0 < 20:
            d = 'ArrowRight' if (k // 6) % 3 != 2 else 'ArrowLeft'
            for pg in pages: pg.keyboard.down(d)
            for i, pg in enumerate(pages):
                if (k + i) % 3 == 0: pg.keyboard.press('Space')
            host.wait_for_timeout(350)
            for pg in pages: pg.keyboard.up(d)
            if k == 10:
                print(bshot(host, '4-play-host'), bshot(g2, '4-play-guest'))
            k += 1
        for pg in pages: pg.keyboard.up('ArrowRight')
        print('after 20 s:', pos(host), '| guest view:', pos(g2), '| deaths/restarts host attempt?')
        frH = host.evaluate('window.__fr'); frG = g2.evaluate('window.__fr')
        print('HOST render:', stats(frH, tH + 1000, tH + 19000))
        print('GUEST render:', stats(frG, tA + 1000, tA + 19000))
        # input latency on the guest: press right, first frame where its own drawn x moves
        g2.wait_for_timeout(800)
        lat = g2.evaluate("""() => new Promise(res => { const me = SB.Game.state().slot; const x0 = SB.Game.world().players.find(p => p.slot === me).x;
           window.__fr = []; const t0 = performance.now(); window.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowLeft', key: 'ArrowLeft'}));
           document.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true}));
           const iv = setInterval(() => { const f = window.__fr.find(f => Math.abs(f[1] - x0) > 0.5); if (f || performance.now() - t0 > 2000) { clearInterval(iv);
             document.dispatchEvent(new KeyboardEvent('keyup', {code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true})); res(f ? f[0] - t0 : -1); } }, 5); })""")
        print('guest input->own bot moves on screen: %.0f ms (emulated relay, no network delay)' % lat)
        # host leaves
        host.close(); t0 = time.time()
        wait_for(g1, 'SB.Game.state().screen === "title" && !document.getElementById("dialog").classList.contains("hidden")', 20000)
        print('HOST LEFT dialog after %.1fs: %r' % (time.time() - t0, g1.inner_text('#dialog')[:250]))
        print(bshot(g1, '4-host-left'))
        print('errors', sum([pg._sb_errs for pg in pages], [])[:5])
run(main)
