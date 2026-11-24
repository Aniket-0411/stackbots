"""4b. Jitter/lag: guest 3 walks right on flat ground in 3-1; record the drawn x of bot 4 per frame on host, guest 1 and guest 3.
usage: b4b_jitter.py [base_ms jitter_ms]  (adds that one-way delay+jitter to every WebSocket message, order kept)"""
from bt import *  # noqa
sys.path.insert(0, FAKES)
from mqtt_broker import Broker, refuse
BASE, JIT = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (0, 0)
DELAY = """(() => { const N = window.WebSocket, D = {base: %d, jit: %d};
  function W(u, p) { const ws = p === undefined ? new N(u) : new N(u, p); let last = 0;
    ws.addEventListener('message', function (e) { if (e.__ok || !D.base) return; e.stopImmediatePropagation();
      const t = Math.max(last, performance.now() + D.base + Math.random() * D.jit); last = t;
      setTimeout(() => { const m = new MessageEvent('message', {data: e.data}); m.__ok = true; ws.dispatchEvent(m); }, t - performance.now()); });
    const send = ws.send.bind(ws); let lastS = 0;
    ws.send = function (d) { if (!D.base) return send(d); const t = Math.max(lastS, performance.now() + D.base + Math.random() * D.jit); lastS = t;
      setTimeout(() => { try { send(d); } catch (e) {} }, t - performance.now()); };
    return ws; }
  W.prototype = N.prototype; Object.assign(W, {CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3}); window.WebSocket = W; })();""" % (BASE, JIT)
HOOK = """(() => { window.__fr = []; const R = SB.Render, f = R.frame;
  R.frame = function (w, o) { const q = o && o.pp && o.pp[3], p = w.players.find(p => p.slot === 3);
    window.__fr.push([performance.now(), q ? q.x : p.x]); return f.apply(this, arguments); }; })()"""

def stats(fr):
    import statistics as S
    mv = [i for i in range(1, len(fr)) if abs(fr[i][1] - fr[i - 1][1]) > 0.01]
    if not mv: return 'no motion'
    fr = fr[mv[0] - 1: mv[-1] + 1]
    v = [(b[1] - a[1]) / (b[0] - a[0]) * 1000 for a, b in zip(fr, fr[1:])]
    still = sum(1 for x in v if abs(x) < 1)
    return 'start %.0f ms, speed px/s mean %.0f sd %.0f min %.0f max %.0f, still frames %d/%d' % (
        fr[0][0], S.mean(v), S.pstdev(v), min(v), max(v), still, len(v))

def main():
    with sync_playwright() as p:
        b = launch(p)
        ctx = new_context(b, viewport={'width': 960, 'height': 540})
        ctx.add_init_script(DELAY)
        ctx.route_web_socket('wss://broker.emqx.io:8084/mqtt', refuse)
        for u in ('wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'):
            ctx.route_web_socket(u, Broker(u).handle)
        pages = [ctx.new_page() for _ in range(4)]
        for pg in pages: watch(pg); pg.goto(URL)
        for pg in pages: wait_for(pg, 'window.SB && SB.Game && SB.Game.state().screen === "title"')
        host, g1, g2, g3 = pages
        host.click('#b-host'); wait_for(host, '!!SB.Game.state().code', 15000); code = state(host)['code']
        for pg in (g1, g2, g3):
            pg.fill('#in-code', code); pg.click('#b-join'); wait_for(pg, 'SB.Game.state().slot != null', 20000)
        host.click('#b-lobby-start'); host.wait_for_timeout(300); host.click('.tab >> nth=2'); host.click('.card >> nth=0')
        for pg in pages: wait_for(pg, 'SB.Game.state().screen === "play" && SB.Game.state().players.length === 4', 8000)
        host.wait_for_timeout(1200)
        T = {}
        for n, pg in (('host', host), ('guest1 (remote bot)', g1), ('guest3 (own bot)', g3)):
            pg.evaluate(HOOK); T[n] = pg
        t0 = {n: pg.evaluate('performance.now()') for n, pg in T.items()}
        g3.keyboard.down('ArrowRight'); g3.wait_for_timeout(900)
        print(bshot(host, '4b-host-%d' % BASE), bshot(g3, '4b-guest-%d' % BASE))
        g3.wait_for_timeout(700); g3.keyboard.up('ArrowRight'); g3.wait_for_timeout(600)
        print('delay one-way %d+rand(%d) ms' % (BASE, JIT))
        for n, pg in T.items():
            fr = [(t - t0[n], x) for t, x in pg.evaluate('window.__fr')]
            print(' %-20s %s' % (n, stats(fr)))
        print(' final x host/g1/g3:', [round(pl(pg, 3)['x'], 1) for pg in (host, g1, g3)], 'errors', sum([pg._sb_errs for pg in pages], [])[:3])
run(main)
