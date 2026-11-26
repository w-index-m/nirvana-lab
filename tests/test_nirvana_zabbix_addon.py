"""
既存の Zabbix 環境にニルヴァーナ(cyber-view-standalone)を足すときの回帰テスト(ネットワーク・docker 非依存)

- ログ: Zabbix のログ型アイテム(機器のホスト・syslog サーバーのホスト=log_hosts)と SNMP トラップの
  アイテムの履歴(history.get)を、Loki・syslog と同じ流れ(ログ一覧・SYSLOG 経路・警報)に入れる
- インストーラー: Zabbix の API からネットワーク機器・IF を読み、SNMP の ipAddrTable で IF の IP を補って
  つながりを推定する。community はホストの SNMP インタフェース → マクロ(ホスト・グローバル)の順で引く
本物の Zabbix 7.0.32 での確認は docs/nirvana-zabbix-addon.md。
"""
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest
from fastapi.testclient import TestClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(ROOT, 'cyber-view-standalone'))
import server as sa_server  # noqa: E402
from cvs import config as sa_config  # noqa: E402
from cvs import installer as inst  # noqa: E402
from cvs import sources as S  # noqa: E402


class FakeZabbix:
    """api_jsonrpc.php の必要な分だけ(params を見て返す)"""

    def __init__(self):
        self.hosts = []          # host.get の行(hostid, host, name, interfaces, parentTemplates, groups)
        self.items = []          # item.get の行(hostid, itemid, name, key_, value_type, status, lastvalue, lastclock)
        self.history = []        # (itemid, clock, value)
        self.macros = {}         # hostid or 'global' -> {macro: value}
        self.groups = {'Network': '10'}
        self.calls = []
        fake = self

        class H(BaseHTTPRequestHandler):
            def do_POST(self):  # noqa: N802
                req = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                fake.calls.append((req['method'], req['params']))
                res = fake.handle(req['method'], req['params'])
                body = json.dumps({'jsonrpc': '2.0', 'result': res, 'id': req['id']}).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *a):
                pass
        self.srv = HTTPServer(('127.0.0.1', 0), H)
        self.url = f'http://127.0.0.1:{self.srv.server_port}/api_jsonrpc.php'
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def handle(self, m, p):
        if m == 'hostgroup.get':
            return [{'groupid': self.groups[n]} for n in p['filter']['name'] if n in self.groups]
        if m == 'host.get':
            rows = self.hosts
            if 'filter' in p and 'host' in p['filter']:
                rows = [h for h in rows if h['host'] in p['filter']['host']]
            if 'groupids' in p:
                rows = [h for h in rows if set(h.get('groups', [])) & set(p['groupids'])]
            if 'hostids' in p:
                rows = [h for h in rows if h['hostid'] in p['hostids']]
            return rows
        if m == 'hostinterface.get':
            ips = p['filter']['ip']
            return [{'hostid': h['hostid'], 'ip': i['ip']} for h in self.hosts for i in h.get('interfaces', [])
                    if i.get('ip') in ips]
        if m == 'item.get':
            rows = [i for i in self.items if i['hostid'] in p.get('hostids', [])]
            f = p.get('filter') or {}
            if 'value_type' in f:
                rows = [i for i in rows if int(i['value_type']) in f['value_type']]
            if 'status' in f:
                rows = [i for i in rows if str(i.get('status', '0')) == str(f['status'])]
            sr = p.get('search') or {}
            if 'name' in sr:
                rows = [i for i in rows if sr['name'] in i['name']]
            if 'key_' in sr:
                rows = [i for i in rows if i['key_'].startswith(sr['key_'])]
            return rows
        if m == 'history.get':
            ids = set(p['itemids'])
            vt = {i['itemid']: int(i['value_type']) for i in self.items}
            return [{'itemid': i, 'clock': str(int(c)), 'ns': '0', 'value': v} for i, c, v in self.history
                    if i in ids and vt[i] == p['history'] and p['time_from'] <= c <= p['time_till']]
        if m == 'usermacro.get':
            src = self.macros.get('global', {}) if p.get('globalmacro') else {
                k: v for h in p.get('hostids', []) for k, v in self.macros.get(h, {}).items()}
            return [{'macro': k, 'value': v} for k, v in src.items()]
        if m == 'problem.get':
            return []
        return []


@pytest.fixture
def zbx():
    f = FakeZabbix()
    yield f
    f.srv.shutdown()


def _snmp_if(ip, community='{$SNMP_COMMUNITY}', version='2'):
    return {'ip': ip, 'type': '2', 'main': '1', 'useip': '1', 'available': '1',
            'details': {'version': version, 'community': community}}


def _cfg(sources):
    return sa_config.validate({
        'devices': [
            {'id': 'r1', 'hostname': 'R1', 'type': 'cisco', 'mgmt_ip': '10.9.0.1',
             'interfaces': [{'name': 'GigabitEthernet0/0/0', 'ip': '10.9.12.1', 'prefix': 30}]},
            {'id': 'r2', 'hostname': 'R2', 'type': 'cisco', 'mgmt_ip': '10.9.0.2',
             'interfaces': [{'name': 'GigabitEthernet0/0/0', 'ip': '10.9.12.2', 'prefix': 30}]},
        ],
        'links': [{'a': 'r1', 'a_if': 'GigabitEthernet0/0/0', 'b': 'r2', 'b_if': 'GigabitEthernet0/0/0'}],
        'sources': sources})


def _log_lab(zbx):
    now = time.time()
    zbx.hosts = [{'hostid': '1', 'host': 'R1', 'name': 'R1', 'interfaces': [_snmp_if('10.9.0.1')]},
                 {'hostid': '2', 'host': 'R2', 'name': 'R2', 'interfaces': [_snmp_if('10.9.0.2')]},
                 {'hostid': '9', 'host': 'syslog-srv', 'name': 'syslog-srv',
                  'interfaces': [{'ip': '127.0.0.1', 'type': '1', 'main': '1', 'available': '1'}]}]
    zbx.items = [
        # syslog サーバーのエージェントが log[] で読む(rsyslog がファイルに書いた行: 時刻 送信元 本文)
        {'hostid': '9', 'itemid': '901', 'name': 'Network syslog', 'key_': 'log[/var/log/network.log]', 'value_type': '2'},
        # 機器のホストのログ型アイテム(zabbix_sender で送る trapper)
        {'hostid': '1', 'itemid': '101', 'name': 'R1 pushed log', 'key_': 'netlab.log', 'value_type': '2'},
        # SNMP トラップ(テキスト型、複数行)
        {'hostid': '1', 'itemid': '102', 'name': 'SNMP traps', 'key_': 'snmptrap.fallback', 'value_type': '4'},
        # 関係ないテキスト型(sysDescr 等)は読まない
        {'hostid': '1', 'itemid': '103', 'name': 'System description', 'key_': 'system.descr[sysDescr.0]', 'value_type': '4'},
    ]
    zbx.history = [
        ('901', now - 20, 'Nov 26 13:35:15 10.9.0.2 %LINK-3-UPDOWN: Interface GigabitEthernet0/0/0, changed state to down'),
        ('901', now - 19, 'Nov 26 13:35:16 10.9.9.9 %SYS-5-CONFIG_I: from a device not in the config'),
        ('101', now - 15, '%OSPF-5-ADJCHG: Process 1, Nbr 10.9.12.2 on GigabitEthernet0/0/0 from FULL to DOWN'),
        ('102', now - 10, '2026-11-26T13:35:20+0900 ZBXTRAP 10.9.0.1\nPDU INFO:\n  notificationtype TRAP\n'
                          'VARBINDS:\n  IF-MIB::linkDown'),
        ('103', now - 5, 'Cisco IOS Software'),
    ]
    return now


def test_zabbix_logs_from_device_hosts_log_hosts_and_traps(zbx):
    _log_lab(zbx)
    app = sa_server.create_app(_cfg({'zabbix': {'url': zbx.url, 'token': 'x', 'log_hosts': ['syslog-srv']}}),
                               start_collector=False)
    col = app.state.collector
    assert col.poll_zabbix_logs() == 3      # syslog サーバー1(設定に無い装置の行は捨てる)+ 機器の log 1 + トラップ 1
    c = TestClient(app)
    d = c.get('/api/traffic/logs?since=0&limit=20').json()
    assert d['source'] == 'zabbix'
    got = {(x['host'], x['msg'].split(':')[0]) for x in d['logs']}
    # syslog サーバーの行は「時刻 送信元」を外し、送信元 IP(10.9.0.2 = R2)で装置を決める
    assert ('R2', '%LINK-3-UPDOWN') in got
    assert ('R1', '%OSPF-5-ADJCHG') in got
    assert any(h == 'R1' and 'IF-MIB::linkDown' in m for h, m in ((x['host'], x['msg']) for x in d['logs']))
    assert not any('Cisco IOS Software' in x['msg'] for x in d['logs'])
    ln = c.get('/api/traffic/links').json()['links'][0]
    assert ln['evidence']['SYSLOG'] == 'down' and ln['down'] is True
    h = c.get('/api/traffic/health').json()
    assert h['sources']['logs'] == 'zabbix'
    # 2 回目は同じ行を重ねて読んでも増えない
    assert col.poll_zabbix_logs() == 0


def test_zabbix_logs_can_be_turned_off(zbx):
    _log_lab(zbx)
    app = sa_server.create_app(_cfg({'zabbix': {'url': zbx.url, 'token': 'x', 'logs': False}}), start_collector=False)
    assert app.state.collector.poll_zabbix_logs() == 0
    assert not any(m == 'history.get' for m, _ in zbx.calls)


def test_log_items_only_log_type_and_snmptrap(zbx):
    _log_lab(zbx)
    z = S.Zabbix(zbx.url, token='x')
    keys = sorted(i['key'] for i in z.log_items(['1', '9']))
    assert keys == ['log[/var/log/network.log]', 'netlab.log', 'snmptrap.fallback']


def _inventory_lab(zbx):
    zbx.hosts = [
        {'hostid': '1', 'host': 'core-sw1', 'name': 'CORE-SW1', 'groups': ['10'], 'interfaces': [_snmp_if('10.9.0.1')],
         'parentTemplates': [{'name': 'Cisco Nexus 9000 Series by SNMP'}]},
        {'hostid': '2', 'host': 'R2', 'name': 'R2', 'groups': ['10'],
         'interfaces': [_snmp_if('10.9.0.2', community='plain-ro')],
         'parentTemplates': [{'name': 'Cisco IOS by SNMP'}]},
        {'hostid': '3', 'host': 'R3-v3', 'name': 'R3-v3', 'groups': ['10'],
         'interfaces': [_snmp_if('10.9.0.3', community='', version='3')], 'parentTemplates': [{'name': 'Juniper by SNMP'}]},
        {'hostid': '8', 'host': 'Zabbix server', 'name': 'Zabbix server', 'groups': ['4'],
         'interfaces': [{'ip': '127.0.0.1', 'type': '1', 'main': '1'}]},
        {'hostid': '9', 'host': 'syslog-srv', 'name': 'syslog-srv', 'groups': ['4'],
         'interfaces': [{'ip': '127.0.0.1', 'type': '1', 'main': '1'}]},
    ]
    it = lambda hid, n, ifn: {'hostid': hid, 'itemid': f'{hid}{n}', 'value_type': '3', 'key_': f'net.if.in[{n}]',  # noqa: E731
                              'name': f'Interface {ifn}(uplink): Bits received'}
    zbx.items = [it('1', 1, 'Eth1/1'), it('1', 2, 'Eth1/2'), it('2', 1, 'Gi0/0/0'), it('3', 1, 'ge-0/0/0'),
                 {'hostid': '9', 'itemid': '901', 'name': 'syslog', 'key_': 'log[/var/log/net.log]', 'value_type': '2'}]
    zbx.macros = {'1': {'{$SNMP_COMMUNITY}': 'host-ro'}, 'global': {'{$SNMP_COMMUNITY}': 'public'}}
    tables = {
        '10.9.0.1': {'ifName': {'1': 'Eth1/1', '2': 'Eth1/2', '9': 'mgmt0'},
                     'ip': {'10.9.12.1': ('1', '255.255.255.252'), '10.9.0.1': ('9', '255.255.255.0'),
                            '127.0.0.1': ('9', '255.0.0.0')}},
        '10.9.0.2': {'ifName': {'1': 'Gi0/0/0'}, 'ip': {'10.9.12.2': ('1', '255.255.255.252')}},
    }
    seen = []

    def walk(host, community, root, **kw):
        seen.append((host, community))
        t = tables[host]
        if root == inst._OID_IFNAME:
            return [(f'{root}.{k}', v) for k, v in t['ifName'].items()]
        if root == inst._OID_IFDESCR:
            return []
        if root == inst._OID_IPIFINDEX:
            return [(f'{root}.{ip}', int(v[0])) for ip, v in t['ip'].items()]
        if root == inst._OID_IPMASK:
            return [(f'{root}.{ip}', v[1]) for ip, v in t['ip'].items()]
        return []
    return walk, seen


def test_installer_builds_devices_and_links_from_zabbix(zbx):
    walk, seen = _inventory_lab(zbx)
    found = inst.detect(prometheus='http://127.0.0.1:1', loki='http://127.0.0.1:1', zabbix=zbx.url, mrtg_cfgs=[],
                        cacti_dirs=[], cacti_db_configs=[], ollama='http://127.0.0.1:1', env={'ZABBIX_TOKEN': 'x'},
                        walk=walk)
    assert found['zabbix']['hosts'] == 3 and found['zabbix']['log_hosts'] == ['syslog-srv']
    # community: ホストのマクロ(host-ro)> SNMP インタフェースに直書き(plain-ro)。v3 は問い合わせない
    assert ('10.9.0.1', 'host-ro') in seen and ('10.9.0.2', 'plain-ro') in seen
    assert not any(h == '10.9.0.3' for h, _ in seen)
    assert any('SNMPv3' in n for n in found['notes'])
    cfg = inst.build_config(found)
    devs = {d['hostname']: d for d in cfg['devices']}
    assert set(devs) == {'CORE-SW1', 'R2', 'R3-v3'}                    # サーバー(Zabbix server・syslog-srv)は入れない
    assert devs['CORE-SW1']['type'] == 'nexus' and devs['R3-v3']['type'] == 'juniper'
    assert devs['CORE-SW1']['zabbix_host'] == 'core-sw1'               # 表示名と Zabbix のホスト名が違うとき
    eth11 = next(i for i in devs['CORE-SW1']['interfaces'] if i['name'] == 'Eth1/1')
    assert eth11 == {'name': 'Eth1/1', 'ip': '10.9.12.1', 'prefix': 30}
    assert cfg['links'] == [{'a': devs['CORE-SW1']['id'], 'a_if': 'Eth1/1', 'b': devs['R2']['id'], 'b_if': 'Gi0/0/0'}]
    assert cfg['sources']['zabbix'] == {'url': zbx.url, 'token': '${ZABBIX_TOKEN}', 'log_hosts': ['syslog-srv']}
    sa_config.validate(cfg)


def test_installer_zabbix_group_community_override_and_no_probe(zbx):
    walk, seen = _inventory_lab(zbx)
    zbx.hosts[1]['groups'] = ['99']
    z = S.Zabbix(zbx.url, token='x')
    inv = inst.zabbix_inventory(z, group='Network', snmp_community='given', walk=walk)
    assert set(inv) == {'core-sw1', 'R3-v3'} and {c for _, c in seen} == {'given'}
    assert inst.zabbix_inventory(z, group='NoSuch', walk=walk) == {}
    seen.clear()
    inv = inst.zabbix_inventory(z, probe=False, walk=walk)
    assert not seen and all('ip' not in i for d in inv.values() for i in d['ifs'].values())


def test_installer_without_token_only_notes(zbx):
    found = inst.detect(prometheus='http://127.0.0.1:1', loki='http://127.0.0.1:1', zabbix=zbx.url, mrtg_cfgs=[],
                        cacti_dirs=[], cacti_db_configs=[], ollama='http://127.0.0.1:1', env={})
    assert found['zabbix'] == {'url': zbx.url} and not found['devices']
    assert any('ZABBIX_TOKEN' in n for n in found['notes'])
    assert not zbx.calls


def test_secret_macro_community_is_reported(zbx):
    walk, seen = _inventory_lab(zbx)
    zbx.macros = {}                       # 秘密のマクロは値が返らない
    notes = []
    inst.zabbix_inventory(S.Zabbix(zbx.url, token='x'), walk=walk, notes=notes)
    assert ('10.9.0.2', 'plain-ro') in seen and not any(h == '10.9.0.1' for h, _ in seen)
    assert any('community が分かりません' in n for n in notes)


def test_devices_are_matched_to_zabbix_hosts_by_management_ip(zbx):
    """設定画面が作る装置名(SW1)は Zabbix のホスト名(3650 の実名)と違う → 管理 IP で結び付ける"""
    now = int(time.time())
    zbx.hosts = [{'hostid': '7', 'host': 'C3650-CORE', 'name': 'C3650-CORE', 'interfaces': [_snmp_if('10.9.0.1')]}]
    zbx.items = [{'hostid': '7', 'itemid': '71', 'name': 'Interface Gi0/0/0(): Bits sent', 'key_': 'x', 'value_type': '3',
                  'lastvalue': '3000000', 'lastclock': str(now), 'status': '0'},
                 {'hostid': '7', 'itemid': '72', 'name': 'Interface Gi0/0/0(): Operational status', 'key_': 'y',
                  'value_type': '3', 'lastvalue': '2', 'lastclock': str(now), 'status': '0'}]
    cfg = _cfg({'zabbix': {'url': zbx.url, 'token': 'x'}})
    cfg['devices'][0]['hostname'] = 'SW1'
    app = sa_server.create_app(cfg, start_collector=False)
    hosts = app.state.collector._zabbix_hosts()
    assert hosts == {'10.9.0.1': {'hostid': '7', 'available': True}}
    ln = TestClient(app).get('/api/traffic/links').json()['links'][0]
    assert ln['source'] == 'zabbix' and ln['ab_bps'] == 3_000_000 and ln['evidence']['POLL'] == 'down'


def test_setup_gui_adds_zabbix_only_when_token_is_in_secrets():
    sys.path.insert(0, os.path.join(ROOT, 'cyber-view-standalone'))
    import setup_gui as G
    form = G.parse_form({'target': '192.168.1.1', 'password': 'x', 'community': ''})
    assert 'zabbix' not in G.nirvana_config(form, {})
    text = G.nirvana_config(form, {'ZABBIX_TOKEN': 'secret-value'})
    assert 'zabbix:' in text and 'token: ${ZABBIX_TOKEN}' in text and 'secret-value' not in text
    assert 'url: http://127.0.0.1:8080/api_jsonrpc.php' in text
    assert 'url: http://zbx:9/api' in G.nirvana_config(form, {'ZABBIX_TOKEN': 't', 'ZABBIX_URL': 'http://zbx:9/api'})
    import yaml
    sa_config.validate(yaml.safe_load(text))
