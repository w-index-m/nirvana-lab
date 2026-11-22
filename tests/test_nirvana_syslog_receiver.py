"""
ニルヴァーナ単体版: syslog を UDP で直接受ける(cvs/syslog_receiver.py、sources.syslog.listen)

Loki が無い構成(設定画面)でも、装置の `logging host <PC の IP>` を受けて、Loki の行と同じ流れ(syslog 観点・
ログのプレート・リンク断の SYSLOG 経路・AI ログ解析)に入れる。本物の送り手(util-linux の logger の RFC 3164 / 5424)と
Cisco 形式の行で、syslog 観点が「異常」、リンクの SYSLOG 経路が down になることを確かめた(docs/nirvana-gnmi-via-gnmic.md)。
"""
import os
import socket
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(ROOT, 'cyber-view-standalone'))
from cvs.syslog_receiver import parse  # noqa: E402


def test_parse_strips_headers_and_reads_severity():
    assert parse(b'<187>Nov 22 03:27:20 vm root: %LINK-3-UPDOWN: Interface Gi1/0/1, changed state to down') == \
        (3, '%LINK-3-UPDOWN: Interface Gi1/0/1, changed state to down')
    assert parse(b'<189>123: *Nov 22 12:30:01.123: %LINEPROTO-5-UPDOWN: Line protocol on Interface Gi1/0/1, '
                 b'changed state to down')[1].startswith('%LINEPROTO-5-UPDOWN')
    assert parse(b'<189>45: Nov 22 2026 12:30:01 JST: %SYS-5-CONFIG_I: Configured from console') == \
        (5, '%SYS-5-CONFIG_I: Configured from console')
    assert parse(b'<189>1 2026-11-22T03:27:20.1Z vm root - - - SW1 test notice') == (5, 'SW1 test notice')
    assert parse(b'plain text no pri') == (None, 'plain text no pri')


def _free_udp_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def test_received_syslog_feeds_health_logs_and_link_evidence(tmp_path):
    import server
    from cvs import config as C
    port = _free_udp_port()
    (tmp_path / 'c.yaml').write_text(
        'devices:\n'
        '  - {id: sw1, hostname: SW1, type: catalyst, mgmt_ip: 127.0.0.1, interfaces: [{name: GigabitEthernet1/0/1}]}\n'
        '  - {id: pc, hostname: PC, type: pc, snmp: false, interfaces: [{name: eth0}]}\n'
        'links:\n  - {a: sw1, a_if: GigabitEthernet1/0/1, b: pc, b_if: eth0}\n'
        f'sources:\n  syslog: {{listen: "127.0.0.1:{port}"}}\n', encoding='utf-8')
    app = server.create_app(C.load(str(tmp_path / 'c.yaml')), start_collector=False)
    col = app.state.collector
    col.syslog.start()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.sendto(b'<187>12: *Nov 22 12:30:00.001: %LINK-3-UPDOWN: Interface GigabitEthernet1/0/1, changed state to down',
                 ('127.0.0.1', port))
        for _ in range(40):
            if col.syslog.stats['received']:
                break
            time.sleep(0.05)
        assert col.log_source() == 'syslog'
        logs = col.logs(0, 10)
        assert logs and logs[-1]['msg'].startswith('%LINK-3-UPDOWN') and logs[-1]['host'] == 'SW1'
        h = col.health(300)
        sl = next(c for c in h['categories'] if c['key'] == 'syslog')
        assert sl['state'] == 'crit' and h['sources']['logs'] == 'syslog'
        link = col.snapshot(60)['links'][0]
        assert link['evidence']['SYSLOG'] == 'down'
        assert col.on_syslog('10.9.9.9', 'hello from nowhere', time.time()) is False      # 設定に無い装置は数えるだけ
        assert col.unknown_syslog == {'10.9.9.9': 1}
    finally:
        col.syslog.stop()


def test_setup_gui_listens_on_514():
    import setup_gui as G
    text = G.nirvana_config(G.parse_form({'target': '192.168.1.1', 'password': 'x'}))
    assert '  syslog:\n    listen: 0.0.0.0:514' in text
