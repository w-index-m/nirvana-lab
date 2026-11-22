"""
syslog を UDP で直接受ける(スタンドアロン版。Loki が無い構成向け)

設定(config.yaml の sources.syslog):
  listen: 0.0.0.0:514        # 装置の `logging host <この PC の IP>` の宛先(既定の 514)

受けた1行は、送信元 IP(= 装置の mgmt_ip)か本文の装置名で装置を決め、Loki から読んだログと同じ
Analytics.record_log に入れる。そのため syslog 観点・ログのプレート・フラップ・リンク断の SYSLOG 経路・AI ログ解析が
そのまま使える。重要度は Cisco の %FAC-<n>- を優先し、無ければ <PRI> の下3ビット。
RFC 3164(<PRI>Mmm dd hh:mm:ss host msg、Cisco の `<189>123: *Nov 22 ...: %LINK-3-UPDOWN: ...`)と
RFC 5424(<PRI>1 TIMESTAMP HOST APP PROCID MSGID SD MSG)の両方を受ける。標準ライブラリだけ。

受けた行を Grafana で見たいときは、同じ行を Loki にも送れる(LokiPusher):
  sources.syslog.loki_push: http://127.0.0.1:3100
ニルヴァーナが直接受けたまま、Loki にはその写しを入れる(ラベル job="syslog"・device・host・severity)。
このとき sources.loki で同じ Loki を読むと、同じ行を二度数えるので sources.loki は書かない。
"""
import json
import urllib.request
import re
import socket
import threading
import time

_PRI = re.compile(r'^<(\d{1,3})>')
_RFC5424 = re.compile(r'^1 \S+ \S+ \S+ \S+ \S+ (?:-|\[.*?\])\s?(.*)$', re.S)
_MON = r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'
# RFC 3164 の見出し「Mmm dd hh:mm:ss ホスト タグ:」(Linux の logger など)
_RFC3164_HDR = re.compile(r'^' + _MON + r' [ \d]\d \d\d:\d\d:\d\d \S+ (?:[\w./-]+(?:\[\d+\])?: )?')
# Cisco の「通し番号: *Mmm dd [yyyy] hh:mm:ss[.mmm] [TZ]: 」(service sequence-numbers / timestamps)
_CISCO_HDR = re.compile(r'^(?:\d+: )?(?:[*.]?' + _MON + r'\s+\d+ (?:\d{4} )?\d\d:\d\d:\d\d(?:\.\d+)?(?: [A-Z]{2,5})?: )?')


def parse(data):
    """→ (重要度 0..7 または None, 本文)"""
    text = data.decode('utf-8', 'replace').strip().strip('\x00')
    sev = None
    m = _PRI.match(text)
    if m:
        sev = int(m.group(1)) & 7
        text = text[m.end():]
        m5 = _RFC5424.match(text)
        if m5:
            text = m5.group(1)
        else:
            text = _RFC3164_HDR.sub('', text, count=1)
    text = _CISCO_HDR.sub('', text, count=1)
    return sev, text.strip()


def _addr(spec):
    host, _, port = str(spec).rpartition(':')
    return (host or '0.0.0.0', int(port or 514))


class SyslogReceiver:
    """on_message(src_ip, 本文, 時刻, 重要度) を呼ぶ"""

    def __init__(self, listen, on_message):
        self.addr = _addr(listen)
        self.on_message = on_message
        self.stats = {'received': 0, 'last': None, 'from': {}}
        self._sock = None
        self._stop = threading.Event()

    def start(self):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(self.addr)
        s.settimeout(0.5)
        self._sock = s
        threading.Thread(target=self._loop, name='syslog-receiver', daemon=True).start()
        return self

    def _loop(self):
        while not self._stop.is_set():
            try:
                data, (ip, _port) = self._sock.recvfrom(8192)
            except socket.timeout:
                continue
            except OSError:
                break
            sev, msg = parse(data)
            if not msg:
                continue
            now = time.time()
            self.stats['received'] += 1
            self.stats['last'] = now
            self.stats['from'][ip] = self.stats['from'].get(ip, 0) + 1
            try:
                self.on_message(ip, msg, now, sev)
            except Exception:  # noqa: BLE001 - 1行の失敗で受け口を止めない
                pass

    def stop(self):
        self._stop.set()
        if self._sock:
            try:
                self._sock.close()
            except OSError:
                pass


SEV_NAMES = ('emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug')
_CISCO_SEV = re.compile(r'%[\w-]+-(\d)-')


class LokiPusher:
    """受けた syslog の写しを Loki の /loki/api/v1/push へまとめて送る(1 秒ごと)。送れなくても受け口は止めない"""

    def __init__(self, url, interval=1.0, max_queue=5000):
        self.url = str(url).rstrip('/') + '/loki/api/v1/push'
        self.interval = interval
        self.max_queue = max_queue
        self.stats = {'pushed': 0, 'dropped': 0, 'errors': 0, 'last_error': None, 'last_push': None}
        self._q = []
        self._lock = threading.Lock()
        self._stop = threading.Event()
        # プロキシを通さない(社内のプロキシ設定があっても、この PC の中の Loki へ直接)
        self._open = urllib.request.build_opener(urllib.request.ProxyHandler({})).open

    def add(self, device, host_ip, msg, t, sev=None):
        m = _CISCO_SEV.search(msg)          # ニルヴァーナと同じく Cisco の %FAC-<n>- を優先し、無ければ <PRI>
        sev = int(m.group(1)) if m else (6 if sev is None else sev)
        labels = {'job': 'syslog', 'source': 'nirvana', 'device': str(device or host_ip),
                  'host': str(host_ip), 'severity': SEV_NAMES[max(0, min(7, int(sev)))]}
        with self._lock:
            if len(self._q) >= self.max_queue:
                self._q.pop(0)
                self.stats['dropped'] += 1
            self._q.append((labels, str(int(t * 1e9)), msg))

    def body(self, rows):
        streams = {}
        for labels, ts, msg in rows:
            key = tuple(sorted(labels.items()))
            streams.setdefault(key, []).append([ts, msg])
        return {'streams': [{'stream': dict(k), 'values': sorted(v)} for k, v in streams.items()]}

    def flush(self):
        with self._lock:
            rows, self._q = self._q, []
        if not rows:
            return 0
        req = urllib.request.Request(self.url, data=json.dumps(self.body(rows)).encode(),
                                     headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with self._open(req, timeout=5) as r:
                r.read()
        except Exception as e:  # noqa: BLE001 - Loki が止まっていても受け口は続ける
            self.stats['errors'] += 1
            self.stats['last_error'] = str(e)[:200]
            with self._lock:      # 次の回に送り直す(溜まりすぎた分は古い方から捨てる)
                self._q = (rows + self._q)[-self.max_queue:]
            return 0
        self.stats['pushed'] += len(rows)
        self.stats['last_push'] = time.time()
        self.stats['last_error'] = None
        return len(rows)

    def start(self):
        def loop():
            while not self._stop.wait(self.interval):
                self.flush()
        threading.Thread(target=loop, name='loki-push', daemon=True).start()
        return self

    def stop(self):
        self._stop.set()
        self.flush()
