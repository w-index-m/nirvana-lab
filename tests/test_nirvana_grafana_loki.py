"""
単体版ニルヴァーナ + Grafana / Loki(設定画面の版 13、gnmi-quickstart.sh up --loki)

- ニルヴァーナが直接受けた syslog の写しを Loki に送る(LokiPusher): ラベル・重要度・まとめ方、
  送れないときは受け口を止めずに次の回に送り直す、本物の HTTP で Loki の push API の形になっている
- 設定画面: 「Grafana と Loki も動かす」で GNMI_LOKI を WSL に渡し、ニルヴァーナの設定に loki_push を足す
- quickstart: Loki と Grafana の設定・データソース・ダッシュボード(JSON として正しい、データソースの uid が合う)、
  止めるときはプロセスが終わるまで待つ(Loki は後始末に数秒かかり、すぐ起動し直すとポートが空いていない)
本物の Loki 3.1.1・Grafana 11.3.0 での確認は docs/nirvana-gnmi-via-gnmic.md。
"""
import json
import os
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(ROOT, 'cyber-view-standalone'))
import setup_gui as G  # noqa: E402
from cvs import config as C  # noqa: E402
from cvs.syslog_receiver import LokiPusher  # noqa: E402

QS = os.path.join(ROOT, 'cyber-view-standalone', 'gnmi-quickstart.sh')


def _qs():
    with open(QS, encoding='utf-8') as f:
        return f.read()


class _FakeLoki:
    def __init__(self):
        self.bodies = []
        outer = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_POST(self):
                n = int(self.headers.get('Content-Length') or 0)
                outer.bodies.append((self.path, json.loads(self.rfile.read(n))))
                self.send_response(204)
                self.end_headers()
        self.srv = HTTPServer(('127.0.0.1', 0), H)
        self.url = f'http://127.0.0.1:{self.srv.server_port}'
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def close(self):
        self.srv.shutdown()


def test_pusher_groups_lines_by_labels_and_prefers_cisco_severity():
    p = LokiPusher('http://127.0.0.1:1')
    p.add('SW1', '10.0.0.1', '%LINK-3-UPDOWN: Interface Gi1/0/1, changed state to down', 100.5, sev=4)
    p.add('SW1', '10.0.0.1', '%LINK-3-UPDOWN: Interface Gi1/0/2, changed state to down', 100.0)
    p.add(None, '10.9.9.9', 'hello', 101.0, sev=6)
    body = p.body(p._q)
    streams = {s['stream']['device'] + '/' + s['stream']['severity']: s for s in body['streams']}
    assert set(streams) == {'SW1/err', '10.9.9.9/info'}      # %LINK-3- は <PRI> の 4 より優先して err
    sw = streams['SW1/err']
    assert sw['stream'] == {'job': 'syslog', 'source': 'nirvana', 'device': 'SW1', 'host': '10.0.0.1', 'severity': 'err'}
    assert [v[0] for v in sw['values']] == ['100000000000', '100500000000']       # ナノ秒・古い順


def test_pusher_posts_to_loki_and_requeues_when_down():
    p = LokiPusher('http://127.0.0.1:9')          # 誰も居ない
    p.add('SW1', '10.0.0.1', 'one', time.time())
    assert p.flush() == 0 and p.stats['errors'] == 1 and p.stats['last_error'] and len(p._q) == 1
    fake = _FakeLoki()
    try:
        p.url = fake.url + '/loki/api/v1/push'
        p.add('SW1', '10.0.0.1', 'two', time.time())
        assert p.flush() == 2 and p.stats['pushed'] == 2 and p.stats['last_error'] is None and not p._q
        path, body = fake.bodies[0]
        assert path == '/loki/api/v1/push'
        assert [v[1] for s in body['streams'] for v in s['values']] == ['one', 'two']
    finally:
        fake.close()


def test_pusher_drops_oldest_when_full():
    p = LokiPusher('http://127.0.0.1:9', max_queue=3)
    for i in range(5):
        p.add('SW1', 'x', f'm{i}', i)
    assert [r[2] for r in p._q] == ['m2', 'm3', 'm4'] and p.stats['dropped'] == 2


def test_collector_sends_received_syslog_to_loki_including_unknown_devices(tmp_path):
    import server
    fake = _FakeLoki()
    try:
        (tmp_path / 'c.yaml').write_text(
            'devices:\n  - {id: sw1, hostname: SW1, type: catalyst, mgmt_ip: 10.0.0.1, interfaces: [{name: Gi1/0/1}]}\n'
            f'links: []\nsources:\n  syslog: {{listen: "127.0.0.1:0", loki_push: "{fake.url}"}}\n', encoding='utf-8')
        app = server.create_app(C.load(str(tmp_path / 'c.yaml')), start_collector=False)
        col = app.state.collector
        assert col.loki_push is not None
        col.on_syslog('10.0.0.1', '%SYS-5-CONFIG_I: Configured from console', time.time(), 5)
        col.on_syslog('10.9.9.9', 'from a device not in the config', time.time(), 6)
        assert col.loki_push.flush() == 2
        devs = sorted(s['stream']['device'] for _, b in fake.bodies for s in b['streams'])
        assert devs == ['10.9.9.9', 'SW1']
        from fastapi.testclient import TestClient
        h = TestClient(app).get('/api/health').json()
        assert h['loki_push']['pushed'] == 2 and 'loki_push' not in h['errors']
    finally:
        fake.close()


def test_no_pusher_without_loki_push(tmp_path):
    import server
    (tmp_path / 'c.yaml').write_text(
        'devices:\n  - {id: sw1, hostname: SW1, type: catalyst, mgmt_ip: 10.0.0.1, interfaces: [{name: Gi1/0/1}]}\n'
        'links: []\nsources:\n  syslog: {listen: "127.0.0.1:0"}\n', encoding='utf-8')
    app = server.create_app(C.load(str(tmp_path / 'c.yaml')), start_collector=False)
    assert app.state.collector.loki_push is None


def test_setup_gui_passes_loki_to_wsl_and_config(tmp_path, monkeypatch):
    form = G.parse_form({'target': '192.168.1.1', 'password': 'x', 'loki': True})
    assert form['loki'] is True and G.parse_form({'target': '192.168.1.1', 'password': 'x', 'loki': 'false'})['loki'] is False
    monkeypatch.setattr(G, 'on_windows', lambda: True)
    argv, stdin, env = G.quickstart_cmd('up', form)
    assert env['GNMI_LOKI'] == '1' and 'GNMI_LOKI/u' in env['WSLENV'].split(':')
    text = G.nirvana_config(form)
    assert '    loki_push: http://127.0.0.1:3100' in text
    (tmp_path / 'n.yaml').write_text(text, encoding='utf-8')
    cfg = C.load(str(tmp_path / 'n.yaml'))
    assert cfg['sources']['syslog']['loki_push'] == 'http://127.0.0.1:3100'
    assert 'loki' not in cfg['sources']           # 同じ Loki を読み直すと二重に数えるので書かない
    assert 'loki_push' not in G.nirvana_config(G.parse_form({'target': '192.168.1.1', 'password': 'x'}))
    page = G.page({'loki': True})
    assert 'id="loki"' in page and 'checked' in page and "loki:$('loki').checked" in page and "'Grafana'" in page


def test_quickstart_writes_loki_grafana_and_a_valid_dashboard():
    s = _qs()
    for needle in ('--loki) LOKI=1', 'LOKI=${GNMI_LOKI:-}', 'write_loki_grafana', 'install_loki_grafana', 'check_loki_grafana',
                   'grafana/loki/releases/download/v$LOKI_VERSION/loki-linux-amd64.zip',
                   'dl.grafana.com/oss/release/grafana-$GRAFANA_VERSION.linux-amd64.tar.gz',
                   'retention_period: 336h', '[auth.anonymous]', 'default_home_dashboard_path',
                   'for f in gnmic prometheus snmp_exporter loki grafana; do'):
        assert needle in s, needle
    ds_uids = set(re.findall(r'uid: (nirvana-\w+)', s))
    assert ds_uids == {'nirvana-prom', 'nirvana-loki'}
    dash = json.loads(s[s.index("cat <<'DASHBOARD'\n") + len("cat <<'DASHBOARD'\n"):s.index('\nDASHBOARD\n')])
    assert dash['uid'] == 'nirvana-gnmi'
    used = {p['datasource']['uid'] for p in dash['panels']}
    assert used == ds_uids
    exprs = ' '.join(t['expr'] for p in dash['panels'] for t in p['targets'])
    for m in ('interfaces_interface_state_counters_in_octets', 'interfaces_interface_state_oper_status',
              'up{job="snmp"}', 'cpmCPUTotal5minRev{job="snmp"}', 'ifHCInOctets{job="snmp"}', '{job="syslog"}'):
        assert m in exprs, m
    ids = [p['id'] for p in dash['panels']]
    assert len(ids) == len(set(ids))


def test_quickstart_waits_for_stopped_processes():
    s = _qs()
    body = s[s.index('stop_all() {'):s.index('\n}\n', s.index('stop_all() {'))]
    assert 'kill -0 "$pid"' in body and 'kill -9' in body
