"""Tiny in-process MQTT 3.1.1 broker for Playwright's WebSocket routing.

Each Broker instance is one independent public broker. Use with
    ctx.route_web_socket('wss://broker.hivemq.com:8884/mqtt', broker.handle)
Supports CONNECT, SUBSCRIBE (exact topics, QoS 0), PUBLISH (QoS 0), PINGREQ, DISCONNECT."""


class Broker:
    def __init__(self, name):
        self.name = name
        self.subs = {}
        self.published = 0
        self.connects = 0

    def _drop(self, ws):
        for s in self.subs.values():
            s.discard(ws)

    def handle(self, ws):
        st = {'buf': b''}

        def on_msg(msg):
            if isinstance(msg, str):
                return
            st['buf'] += bytes(msg)
            while True:
                b = st['buf']
                if len(b) < 2:
                    return
                mul, ln, i = 1, 0, 1
                while True:
                    if i >= len(b):
                        return
                    c = b[i]
                    i += 1
                    ln += (c & 127) * mul
                    mul *= 128
                    if not c & 128:
                        break
                if len(b) < i + ln:
                    return
                pkt, typ, body = b[:i + ln], b[0] >> 4, b[i:i + ln]
                st['buf'] = b[i + ln:]
                if typ == 1:
                    self.connects += 1
                    ws.send(bytes([0x20, 2, 0, 0]))
                elif typ == 8:
                    pid = body[0:2]
                    tl = (body[2] << 8) | body[3]
                    self.subs.setdefault(body[4:4 + tl].decode(), set()).add(ws)
                    ws.send(bytes([0x90, 3]) + pid + bytes([0]))
                elif typ == 3:
                    tl = (body[0] << 8) | body[1]
                    topic = body[2:2 + tl].decode()
                    self.published += 1
                    for w in list(self.subs.get(topic, ())):
                        try:
                            w.send(pkt)
                        except Exception:
                            self.subs[topic].discard(w)
                elif typ == 12:
                    ws.send(bytes([0xD0, 0]))
                elif typ == 14:
                    self._drop(ws)

        ws.on_message(on_msg)  # (no on_close: Playwright 1.63 raises KeyError for page-side closes)


def refuse(ws):
    """A broker that is down: accepts the socket but never answers (the client times out).
    (Calling ws.close() inside a sync-API route handler deadlocks Playwright.)"""
    ws.on_message(lambda m: None)
