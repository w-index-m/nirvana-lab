"""
syslog を UDP で直接受ける(スタンドアロン版。Loki が無い構成向け)

設定(config.yaml の sources.syslog):
  listen: 0.0.0.0:514        # 装置の `logging host <この PC の IP>` の宛先(既定の 514)

受けた1行は、送信元 IP(= 装置の mgmt_ip)か本文の装置名で装置を決め、Loki から読んだログと同じ
Analytics.record_log に入れる。そのため syslog 観点・ログのプレート・フラップ・リンク断の SYSLOG 経路・AI ログ解析が
そのまま使える。重要度は Cisco の %FAC-<n>- を優先し、無ければ <PRI> の下3ビット。
RFC 3164(<PRI>Mmm dd hh:mm:ss host msg、Cisco の `<189>123: *Nov 22 ...: %LINK-3-UPDOWN: ...`)と
RFC 5424(<PRI>1 TIMESTAMP HOST APP PROCID MSGID SD MSG)の両方を受ける。標準ライブラリだけ。
"""
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
