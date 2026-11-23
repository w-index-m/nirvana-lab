"""
模擬 IPCOM の設定 → AWS Network Firewall の下書き(tools/fw_migrate/ipcom_to_nfw.py)

- 読み込み: インタフェース・rule access・class-map・ルート、機密の行は値を持たない、未対応の行は人へ
- 変換: 上から順の評価を STRICT_ORDER で保つ、ポート・アドレスごとに分ける、暗黙の deny → aws:drop_strict
- 確認用の通信: 元の機器(インタフェースごと)と新しいルール(1 本の並び)の判定を比べ、違いを見つける
- 出力に機密の値が一切出ない
- botocore があれば、AWS の API の型定義に合っている
"""
import os
import sys

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'fw_migrate'))
import ipcom_to_nfw as T  # noqa: E402

SAMPLE = os.path.join(ROOT, 'tools', 'fw_migrate', 'samples', 'ipcom-mock.conf')
SECRETS = ('Hq-Adm1n-2026!', 'hq-ro-community', 'Br4nch-PSK-xyz')


def _cfg():
    with open(SAMPLE, encoding='utf-8') as f:
        return T.parse(f.read())


def test_parse_sample():
    cfg = _cfg()
    assert cfg['hostname'] == 'IPCOM-HQ'
    assert list(cfg['interfaces']) == ['lan0.0', 'lan0.1', 'lan0.2']
    assert sum(len(i['rules']) for i in cfg['interfaces'].values()) == 6
    assert set(cfg['classes']) == {'web-in', 'mail-in', 'ssh-deny', 'lan-smb-block', 'lan-out', 'dmz-dns'}
    assert cfg['classes']['web-in']['ports'] == ['80/tcp', '443/tcp']
    assert T.outside_interfaces(cfg) == {'lan0.0'}
    assert [s['kind'] for s in cfg['secrets']] == ['password', 'community', 'pre-shared-key']
    assert all(set(s) == {'line', 'kind', 'head'} for s in cfg['secrets'])          # 値は持たない
    assert [u['text'].split()[0] for u in cfg['unsupported']] == ['nat']


def test_convert_keeps_order_and_splits_ports():
    cfg = _cfg()
    rules, mapping = T.convert(cfg)
    sids = [int(r['RuleOptions'][0]['Settings'][0]) for r in rules]
    assert sids == [10000, 10001, 11000, 12000, 20000, 21000, 30000, 30001]       # 元の並びのまま
    web = rules[:2]
    assert [r['Header']['DestinationPort'] for r in web] == ['80', '443']
    assert web[0]['Header']['Destination'] == '172.16.20.10/32' and web[0]['Header']['Source'] == 'ANY'
    assert [r['Action'] for r in rules] == ['PASS', 'PASS', 'PASS', 'DROP', 'REJECT', 'PASS', 'PASS', 'PASS']
    assert rules[5]['Header']['Protocol'] == 'IP'                                   # ポート指定なし = 全部
    assert rules[7]['Header']['Protocol'] == 'TCP' and rules[6]['Header']['Protocol'] == 'UDP'
    status = {m['class']: m['status'] for m in mapping}
    assert status['web-in'] == status['ssh-deny'] == '要確認' and status['lan-out'] == '移した'
    rg, pol = T.build_api(cfg, rules, None)
    assert rg['RuleGroup']['StatefulRuleOptions']['RuleOrder'] == 'STRICT_ORDER'
    assert pol['FirewallPolicy']['StatefulDefaultActions'] == ['aws:drop_strict', 'aws:alert_strict']
    assert 'aws_networkfirewall_rule_group' in T.terraform(rg, pol)


def test_compare_finds_lost_interface_difference():
    cfg = _cfg()
    rules, _ = T.convert(cfg)
    rows = T.compare(cfg, rules, T.test_flows(cfg))
    diff = [r for r in rows if not r['same']]
    assert len(diff) == 1
    d = diff[0]
    assert (d['in'], d['port'], d['ipcom'], d['nfw']) == ('lan0.1', 22, 'PASS', 'DROP')
    assert d['nfw_by'].startswith('sid 12000')                     # 外側向けの ssh-deny が内側にも効いた
    assert any(r['ipcom_by'].endswith('暗黙の deny') and r['nfw_by'] == 'aws:drop_strict' for r in rows)


def test_outputs_have_no_secret_values(tmp_path):
    res = T.run(SAMPLE, str(tmp_path))
    names = sorted(os.listdir(tmp_path))
    assert names == ['firewall_policy.json', 'main.tf', 'mapping.csv', 'mapping.md', 'report.md',
                     'rule_group.json', 'test_flows.md']
    for n in names:
        text = (tmp_path / n).read_text(encoding='utf-8')
        for s in SECRETS:
            assert s not in text, (n, s)
    report = (tmp_path / 'report.md').read_text(encoding='utf-8')
    assert '6 行目: user' in report and 'nat static' in report and '違うもの **1 本**' in report
    assert len(res['rules']) == 8


def test_unsupported_class_forms_go_to_people(tmp_path):
    conf = ('interface lan0.0\n ip address 10.0.0.1/24\n'
            ' rule access 10 in missing accept\n rule access 20 in either accept\n'
            ' rule access 30 out web drop\n exit\n'
            'class-map match-any either\n match destination-port 80/tcp\n exit\n'
            'class-map match-all web\n match destination-address ip 10.0.0.5/32\n match destination-port 80/tcp\n exit\n')
    cfg = T.parse(conf)
    rules, mapping = T.convert(cfg)
    st = {m['number']: m for m in mapping}
    assert st[10]['status'] == '移さない' and 'class-map missing' in st[10]['notes'][0]
    assert st[20]['status'] == '移さない' and 'match-any' in st[20]['notes'][0]
    assert any('方向 out' in n for n in st[30]['notes'])
    assert len(rules) == 1


def test_api_shapes_match_botocore():
    pytest.importorskip('botocore')
    cfg = _cfg()
    rules, _ = T.convert(cfg)
    rg, pol = T.build_api(cfg, rules, None)
    assert T.validate_api(rg, pol)['results'] == {'CreateRuleGroup': 'ok', 'CreateFirewallPolicy': 'ok'}
