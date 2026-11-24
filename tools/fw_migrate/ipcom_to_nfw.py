#!/usr/bin/env python3
"""
模擬 IPCOM EX の設定 → AWS Network Firewall の設定の下書き + 対応表 + 確認用の通信

    python3 tools/fw_migrate/ipcom_to_nfw.py tools/fw_migrate/samples/ipcom-mock.conf --out out/ipcom-hq

作るもの(--out の中):
  rule_group.json       CreateRuleGroup の入力(5 つの組み合わせのステートフルルール、STRICT_ORDER)
  firewall_policy.json  CreateFirewallPolicy の入力(暗黙の deny → aws:drop_strict)
  main.tf               同じ内容の Terraform
  mapping.md / .csv     元のルール 1 本ずつ → 新しいルール(sid)。移さないもの・要確認には理由
  test_flows.md         確認用の通信。元の機器の動き(上から順・インタフェースごと・暗黙の deny)と
                        新しいルールの動き(1 本の並び・インタフェースの区別なし)を両方計算して比べる
  report.md             まとめ(伏せた機密の行番号、移さない行、人が決めること)

方針:
  - 値は設定から機械的に写す(AI に考えさせない)。分からない行は「人が判断」に回す。
  - パスワード・コミュニティ名・事前共有鍵などの行は、出力に値を一切出さない(行番号だけ)。
  - botocore があれば、JSON を AWS の API の型定義で確かめる(無ければ確かめていないと書く)。
  - IPCOM の構文は模擬。公開情報で確かめたのは class-map と rule access の骨格と、
    ルールを当てると暗黙の deny が入ることだけ(docs/fw-migrate-ipcom-to-nfw.md)。
"""
import argparse
import csv
import ipaddress
import json
import os
import re
import sys

SECRET_RE = re.compile(r'\b(password|secret|community|pre-shared-key|key-string|psk)\b', re.I)
ACTIONS = {'accept': 'PASS', 'drop': 'DROP', 'reject': 'REJECT'}
EXTERNAL_SAMPLE = '198.51.100.7'      # 外から来る通信の送信元の例(文書用のアドレス)
EXTERNAL_DEST = '198.51.100.80'       # 外へ出る通信の宛先の例


# ── 読み込み ──
def parse(text):
    cfg = {'hostname': None, 'interfaces': {}, 'classes': {}, 'routes': [], 'secrets': [],
           'unsupported': [], 'notes': []}
    block = None          # ('if', name) / ('class', name)
    for no, raw in enumerate(text.splitlines(), 1):
        line = raw.split('!', 1)[0].rstrip() if not raw.lstrip().startswith('!') else ''
        s = line.strip()
        if not s:
            continue
        if SECRET_RE.search(s):
            cfg['secrets'].append({'line': no, 'kind': SECRET_RE.search(s).group(1).lower(),
                                   'head': s.split()[0]})
            continue
        indented = line[:1].isspace()
        if s == 'exit':
            block = None
            continue
        t = s.split()
        if not indented:
            block = None
        if block and block[0] == 'if':
            itf = cfg['interfaces'][block[1]]
            if t[0] == 'description':
                itf['description'] = ' '.join(t[1:])
            elif t[:2] == ['ip', 'address']:
                itf['address'] = _iface_addr(t[2:])
            elif t[:2] == ['rule', 'access'] and len(t) >= 6:
                itf['rules'].append({'line': no, 'number': int(t[2]), 'direction': t[3], 'class': t[4],
                                     'action': t[5], 'options': t[6:], 'interface': block[1]})
            else:
                cfg['unsupported'].append({'line': no, 'text': s, 'why': 'インタフェースの中の未対応の行'})
            continue
        if block and block[0] == 'class':
            cm = cfg['classes'][block[1]]
            if t[:3] == ['match', 'source-address', 'ip']:
                cm['src'] = t[3:]
            elif t[:3] == ['match', 'destination-address', 'ip']:
                cm['dst'] = t[3:]
            elif t[:2] == ['match', 'destination-port']:
                cm['ports'] = t[2:]
            elif t[:2] == ['match', 'protocol']:
                cm['protocol'] = t[2]
            else:
                cfg['unsupported'].append({'line': no, 'text': s, 'why': 'class-map の中の未対応の行'})
            continue
        if t[0] == 'hostname' and len(t) > 1:
            cfg['hostname'] = t[1]
        elif t[0] == 'interface' and len(t) > 1:
            cfg['interfaces'].setdefault(t[1], {'name': t[1], 'description': '', 'address': None, 'rules': []})
            block = ('if', t[1])
        elif t[0] == 'class-map' and len(t) > 1:
            mode = t[1] if len(t) > 2 else 'match-all'
            cfg['classes'][t[-1]] = {'name': t[-1], 'mode': mode, 'line': no, 'src': ['any'], 'dst': ['any'],
                                     'ports': [], 'protocol': None}
            block = ('class', t[-1])
        elif t[:2] == ['ip', 'route'] and len(t) >= 4:
            cfg['routes'].append({'line': no, 'dest': t[2], 'gateway': t[3]})
        elif t[0] == 'nat':
            cfg['unsupported'].append({'line': no, 'text': s, 'why': 'NAT。Network Firewall は NAT をしない → NAT ゲートウェイなど。'
                                       '宛先が NAT の前と後のどちらのアドレスかを人が決める'})
        elif t[0] == 'ipsec':
            cfg['unsupported'].append({'line': no, 'text': s, 'why': 'IPsec VPN → Site-to-Site VPN などで別に作る'})
        else:
            cfg['unsupported'].append({'line': no, 'text': s, 'why': '未対応(人が判断)'})
    return cfg


def _iface_addr(t):
    if not t:
        return None
    if '/' in t[0]:
        return ipaddress.ip_interface(t[0])
    if len(t) > 1:
        return ipaddress.ip_interface(f'{t[0]}/{t[1]}')
    return None


def _net(x):
    return None if x == 'any' else ipaddress.ip_network(x, strict=False)


def _ports(cm):
    """[(protocol, port)] protocol は TCP/UDP/ICMP/IP、port は文字列(ANY 可)"""
    if cm['ports']:
        out = []
        for p in cm['ports']:
            port, _, proto = p.partition('/')
            out.append(((proto or 'tcp').upper(), 'ANY' if port == 'any' else port))
        return out
    proto = (cm['protocol'] or 'ip').upper()
    return [('IP' if proto == 'ANY' else proto, 'ANY')]


def outside_interfaces(cfg):
    """デフォルトルートのゲートウェイが居るインタフェース = 外側"""
    out = set()
    for r in cfg['routes']:
        if r['dest'] in ('0.0.0.0/0', 'default'):
            gw = ipaddress.ip_address(r['gateway'])
            for name, itf in cfg['interfaces'].items():
                if itf['address'] and gw in itf['address'].network:
                    out.add(name)
    return out


# ── 変換 ──
def convert(cfg):
    rules, mapping = [], []
    outside = outside_interfaces(cfg)
    for name in cfg['interfaces']:                     # 設定に書かれたインタフェースの順 → 番号順
        for r in sorted(cfg['interfaces'][name]['rules'], key=lambda r: r['number']):
            cm = cfg['classes'].get(r['class'])
            row = {'line': r['line'], 'interface': name, 'direction': r['direction'], 'number': r['number'],
                   'class': r['class'], 'action': r['action'], 'sids': [], 'status': '移した', 'notes': []}
            if cm is None:
                row.update(status='移さない')
                row['notes'].append(f'class-map {r["class"]} が無い')
                mapping.append(row)
                continue
            if cm['mode'] != 'match-all':
                row.update(status='移さない')
                row['notes'].append(f'{cm["mode"]} は未対応(条件の「または」を人が分ける)')
                mapping.append(row)
                continue
            action = ACTIONS.get(r['action'])
            if action is None:
                row.update(status='移さない')
                row['notes'].append(f'処理 {r["action"]} は未対応')
                mapping.append(row)
                continue
            k = 0
            for src in cm['src']:
                for dst in cm['dst']:
                    for proto, port in _ports(cm):
                        sid = r['number'] * 100 + k
                        k += 1
                        rules.append({
                            'Action': action,
                            'Header': {'Protocol': proto, 'Source': 'ANY' if src == 'any' else str(_net(src)),
                                       'SourcePort': 'ANY', 'Direction': 'FORWARD',
                                       'Destination': 'ANY' if dst == 'any' else str(_net(dst)),
                                       'DestinationPort': port if proto in ('TCP', 'UDP') else 'ANY'},
                            'RuleOptions': [{'Keyword': 'sid', 'Settings': [str(sid)]}],
                        })
                        row['sids'].append(sid)
            if action == 'REJECT' and any(p != 'TCP' for p, _ in _ports(cm)):
                row['notes'].append('REJECT は TCP 以外での振る舞いを公式で確かめる')
            if 'src' in cm and cm['src'] == ['any']:
                where = '外側' if name in outside else '内側'
                row['status'] = '要確認'
                row['notes'].append(f'送信元 any。元は {name}({where})から入る通信だけに効いたが、'
                                    'Network Firewall にはインタフェースの区別が無く、どこから来た通信にも効く')
            if r['direction'] != 'in':
                row['notes'].append(f'方向 {r["direction"]}。送信元・宛先で表す(インタフェースの区別は無くなる)')
            audit = [o for o in r['options'] if o.startswith('audit-') and not o.endswith('-none')]
            if audit:
                row['notes'].append('ログ(' + ' '.join(audit) + ')→ ロギング設定(flow / alert)')
            mapping.append(row)
    return rules, mapping


def build_api(cfg, rules, name):
    host = (cfg['hostname'] or 'ipcom').lower()
    group_name = f'{name or host}-rules'
    alert = any('audit-match-normal' in r['options'] and r['action'] != 'accept'
                for itf in cfg['interfaces'].values() for r in itf['rules'])
    rule_group = {
        'RuleGroupName': group_name, 'Type': 'STATEFUL', 'Capacity': max(10, len(rules) * 2),
        'Description': f'{cfg["hostname"] or "IPCOM"} から変換した下書き(元の評価順を保つため STRICT_ORDER)',
        'RuleGroup': {'RulesSource': {'StatefulRules': rules},
                      'StatefulRuleOptions': {'RuleOrder': 'STRICT_ORDER'}},
    }
    defaults = ['aws:drop_strict'] + (['aws:alert_strict'] if alert else [])
    policy = {
        'FirewallPolicyName': f'{name or host}-policy',
        'Description': '暗黙の deny は aws:drop_strict で表す',
        'FirewallPolicy': {
            'StatelessDefaultActions': ['aws:forward_to_sfe'],
            'StatelessFragmentDefaultActions': ['aws:forward_to_sfe'],
            'StatefulEngineOptions': {'RuleOrder': 'STRICT_ORDER'},
            'StatefulDefaultActions': defaults,
            'StatefulRuleGroupReferences': [{
                'ResourceArn': f'arn:aws:network-firewall:ap-northeast-1:111122223333:stateful-rulegroup/{group_name}',
                'Priority': 100}],
        },
    }
    return rule_group, policy


def validate_api(rule_group, policy):
    """botocore(aws-cli と同じ API の型定義)で入力の形を確かめる。無ければ None"""
    try:
        import botocore.session
        from botocore.validate import ParamValidator
    except ImportError:
        return None
    m = botocore.session.get_session().get_service_model('network-firewall')
    out = {}
    for op, params in (('CreateRuleGroup', rule_group), ('CreateFirewallPolicy', policy)):
        rep = ParamValidator().validate(params, m.operation_model(op).input_shape)
        out[op] = rep.generate_report() if rep.has_errors() else 'ok'
    return {'botocore': __import__('botocore').__version__, 'results': out}


def _hcl(v):
    return json.dumps(v, ensure_ascii=False)


def terraform(rule_group, policy):
    rg = rule_group
    lines = [
        '# 模擬 IPCOM から変換した下書き。terraform validate はこのサンドボックスでは未実行。',
        'resource "aws_networkfirewall_rule_group" "ipcom" {',
        f'  name     = {_hcl(rg["RuleGroupName"])}',
        f'  type     = "STATEFUL"',
        f'  capacity = {rg["Capacity"]}',
        '  rule_group {',
        '    stateful_rule_options {',
        '      rule_order = "STRICT_ORDER"',
        '    }',
        '    rules_source {',
    ]
    for r in rg['RuleGroup']['RulesSource']['StatefulRules']:
        h = r['Header']
        lines += [
            '      stateful_rule {',
            f'        action = {_hcl(r["Action"])}',
            '        header {',
            f'          protocol         = {_hcl(h["Protocol"])}',
            f'          source           = {_hcl(h["Source"])}',
            f'          source_port      = {_hcl(h["SourcePort"])}',
            f'          direction        = {_hcl(h["Direction"])}',
            f'          destination      = {_hcl(h["Destination"])}',
            f'          destination_port = {_hcl(h["DestinationPort"])}',
            '        }',
            '        rule_option {',
            '          keyword  = "sid"',
            f'          settings = [{_hcl(r["RuleOptions"][0]["Settings"][0])}]',
            '        }',
            '      }',
        ]
    fp = policy['FirewallPolicy']
    lines += [
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_networkfirewall_firewall_policy" "ipcom" {',
        f'  name = {_hcl(policy["FirewallPolicyName"])}',
        '  firewall_policy {',
        f'    stateless_default_actions          = {_hcl(fp["StatelessDefaultActions"])}',
        f'    stateless_fragment_default_actions = {_hcl(fp["StatelessFragmentDefaultActions"])}',
        f'    stateful_default_actions           = {_hcl(fp["StatefulDefaultActions"])}',
        '    stateful_engine_options {',
        '      rule_order = "STRICT_ORDER"',
        '    }',
        '    stateful_rule_group_reference {',
        '      priority     = 100',
        '      resource_arn = aws_networkfirewall_rule_group.ipcom.arn',
        '    }',
        '  }',
        '}',
        '',
    ]
    return '\n'.join(lines)


# ── 確認用の通信: 元の機器と新しいルールの両方で判定して比べる ──
def _match_cm(cm, src, dst, proto, port):
    def addr_ok(lst, a):
        return any(x == 'any' or ipaddress.ip_address(a) in _net(x) for x in lst)
    if not addr_ok(cm['src'], src) or not addr_ok(cm['dst'], dst):
        return False
    for p, pt in _ports(cm):
        if p in ('IP', proto) and (pt == 'ANY' or p in ('IP', 'ICMP') or str(port) == pt):
            return True
    return False


def _iface_of(cfg, addr, outside):
    a = ipaddress.ip_address(addr)
    for name, itf in cfg['interfaces'].items():
        if itf['address'] and a in itf['address'].network:
            return name
    return next(iter(outside), None)


def ipcom_verdict(cfg, flow, outside):
    """元の機器: 入ってきたインタフェースの in を番号順、出ていくインタフェースの out を番号順。
    ルールのあるインタフェースで一致が無ければ暗黙の deny"""
    steps = ((flow['in'], ('in', 'any')), (_iface_of(cfg, flow['dst'], outside), ('out', 'any')))
    for itf_name, dirs in steps:
        itf = cfg['interfaces'].get(itf_name)
        rules = [r for r in (itf['rules'] if itf else []) if r['direction'] in dirs]
        if not rules:
            continue
        for r in sorted(rules, key=lambda r: r['number']):
            cm = cfg['classes'].get(r['class'])
            if cm and _match_cm(cm, flow['src'], flow['dst'], flow['proto'], flow['port']):
                if r['action'] != 'accept':
                    return 'DROP', f'{itf_name} {r["direction"]} {r["number"]}({r["action"]})'
                break
        else:
            return 'DROP', f'{itf_name} 暗黙の deny'
    return 'PASS', f'{flow["in"]} で許可'


def nfw_verdict(rules, flow):
    """新しいルール: 1 本の並びを上から(STRICT_ORDER)。一致が無ければ aws:drop_strict"""
    for r in rules:
        h = r['Header']
        if h['Protocol'] not in ('IP', flow['proto']):
            continue
        if h['Source'] != 'ANY' and ipaddress.ip_address(flow['src']) not in ipaddress.ip_network(h['Source']):
            continue
        if h['Destination'] != 'ANY' and ipaddress.ip_address(flow['dst']) not in ipaddress.ip_network(h['Destination']):
            continue
        if h['DestinationPort'] != 'ANY' and str(flow['port']) != h['DestinationPort']:
            continue
        verdict = 'PASS' if r['Action'] == 'PASS' else 'DROP'
        return verdict, f'sid {r["RuleOptions"][0]["Settings"][0]}({r["Action"]})'
    return 'DROP', 'aws:drop_strict'


def _host(net, n=10):
    net = ipaddress.ip_network(net, strict=False)
    return str(net.network_address + (n if net.num_addresses > n + 1 else 0))


def test_flows(cfg):
    outside = outside_interfaces(cfg)
    inside = [n for n in cfg['interfaces'] if n not in outside and cfg['interfaces'][n]['address']]
    flows, seen = [], set()

    def add(desc, in_if, src, dst, proto, port):
        key = (in_if, src, dst, proto, port)
        if key not in seen:
            seen.add(key)
            flows.append({'desc': desc, 'in': in_if, 'src': src, 'dst': dst, 'proto': proto, 'port': port})

    for name, itf in cfg['interfaces'].items():
        for r in sorted(itf['rules'], key=lambda r: r['number']):
            cm = cfg['classes'].get(r['class'])
            if not cm:
                continue
            src = _host(cm['src'][0]) if cm['src'][0] != 'any' else (
                EXTERNAL_SAMPLE if name in outside else _host(itf['address'].network))
            if cm['dst'][0] != 'any':
                dst = _host(cm['dst'][0], 0) if _net(cm['dst'][0]).num_addresses == 1 else _host(cm['dst'][0])
            else:
                dst = EXTERNAL_DEST if name not in outside else _host(cfg['interfaces'][inside[0]]['address'].network)
            for proto, port in _ports(cm):
                p = 'TCP' if proto == 'IP' else proto
                add(f'{name} {r["number"]} {r["class"]} に当たる', name, src, dst, p,
                    8080 if port == 'ANY' else int(port))
            add(f'{name} {r["class"]} の相手に telnet', name, src, dst, 'TCP', 23)
    # 内側から外へ、外側のルールで使っているポート(インタフェースの区別が消えると結果が変わりうる)
    out_ports = sorted({(p, pt) for n in outside for r in cfg['interfaces'][n]['rules']
                        for p, pt in _ports(cfg['classes'].get(r['class'], {'ports': [], 'protocol': None}))
                        if pt != 'ANY'})
    for n in inside:
        for proto, port in out_ports:
            add(f'{n} から外へ {port}/{proto.lower()}', n, _host(cfg['interfaces'][n]['address'].network),
                EXTERNAL_DEST, proto, int(port))
    return flows


def compare(cfg, rules, flows):
    outside = outside_interfaces(cfg)
    rows = []
    for f in flows:
        a, ra = ipcom_verdict(cfg, f, outside)
        b, rb = nfw_verdict(rules, f)
        rows.append(dict(f, ipcom=a, ipcom_by=ra, nfw=b, nfw_by=rb, same=(a == b)))
    return rows


# ── 書き出し ──
def mapping_md(mapping):
    out = ['| 行 | インタフェース | 方向 | 番号 | class-map | 処理 | 新しいルール(sid) | 状態 | 理由・注意 |',
           '|---|---|---|---|---|---|---|---|---|']
    for m in mapping:
        out.append(f'| {m["line"]} | {m["interface"]} | {m["direction"]} | {m["number"]} | {m["class"]} | {m["action"]} | '
                   f'{", ".join(map(str, m["sids"])) or "—"} | {m["status"]} | {"<br>".join(m["notes"]) or ""} |')
    return '\n'.join(out) + '\n'


def flows_md(rows):
    out = ['| # | 通信 | 入口 | 送信元 → 宛先 | 元の機器 | 新しいルール | 一致 |', '|---|---|---|---|---|---|---|']
    for i, r in enumerate(rows, 1):
        out.append(f'| {i} | {r["desc"]} | {r["in"]} | {r["src"]} → {r["dst"]} {r["port"]}/{r["proto"].lower()} | '
                   f'{r["ipcom"]}({r["ipcom_by"]}) | {r["nfw"]}({r["nfw_by"]}) | {"○" if r["same"] else "**×**"} |')
    return '\n'.join(out) + '\n'


def report_md(cfg, rules, mapping, rows, check, src_name):
    diff = [r for r in rows if not r['same']]
    out = [f'# {cfg["hostname"] or "IPCOM"} → AWS Network Firewall(下書き)', '',
           f'元の設定: `{src_name}`(模擬 IPCOM。構文の細部は実機と違う可能性がある)', '',
           '## 数', '',
           f'- 元のルール: {len(mapping)} 本 → 新しいルール {len(rules)} 本(ポート・アドレスごとに分けた)',
           f'- 状態: ' + ' / '.join(f'{k} {sum(1 for m in mapping if m["status"] == k)}' for k in ('移した', '要確認', '移さない')),
           f'- 確認用の通信: {len(rows)} 本、元の機器と結果が違うもの **{len(diff)} 本**', '']
    out += ['## 形の確認(AWS の API の型定義)', '']
    if check:
        out.append(f'botocore {check["botocore"]}: ' + ' / '.join(f'{k} {v if v == "ok" else "NG"}' for k, v in check['results'].items()))
        for k, v in check['results'].items():
            if v != 'ok':
                out += ['', f'```\n{k}: {v}\n```']
    else:
        out.append('botocore が無いので確かめていない(`pip install botocore` で確かめられる)')
    out += ['', 'main.tf は `terraform validate` を通していない。', '']
    if diff:
        out += ['## 元の機器と結果が違う通信(人が直す)', '']
        for r in diff:
            out.append(f'- {r["desc"]}: {r["src"]} → {r["dst"]} {r["port"]}/{r["proto"].lower()} は、元の機器では '
                       f'{r["ipcom"]}({r["ipcom_by"]})、新しいルールでは {r["nfw"]}({r["nfw_by"]})')
        out += ['', '多くは、インタフェースの区別が消えて「外側から入る通信だけ」のつもりのルールが内側の通信にも効くため。'
                '送信元を外側のアドレスに絞るか、ルールの順番を人が決める。', '']
    if cfg['secrets']:
        out += ['## 伏せた行(値は出力していない)', '']
        out += [f'- {s["line"]} 行目: {s["head"]} …({s["kind"]})' for s in cfg['secrets']]
        out += ['', '貼り付ける前に消すか置き換える。', '']
    if cfg['unsupported']:
        out += ['## 移さない行(人が判断)', '']
        out += [f'- {u["line"]} 行目 `{u["text"]}`: {u["why"]}' for u in cfg['unsupported']]
        out.append('')
    out += ['## 人が決めること', '',
            '- ゾーン(インタフェース)の置き換え: 次の VPC・サブネットと、ファイアウォールのエンドポイントを通すルートテーブル',
            ]
    for n, itf in cfg['interfaces'].items():
        if itf['address']:
            out.append(f'  - {n}({itf["description"] or "-"}): {itf["address"].network}')
    for r in cfg['routes']:
        out.append(f'- `ip route {r["dest"]} {r["gateway"]}`({r["line"]} 行目)→ ルートテーブル')
    out += ['- ログ: audit-* を付けたルールは、ロギング設定(flow / alert)と送り先を決める',
            '- 反映の前に、test_flows.md の通信を検証環境で実際に試す', '']
    return '\n'.join(out)


def run(path, out_dir, name=None):
    with open(path, encoding='utf-8') as f:
        cfg = parse(f.read())
    rules, mapping = convert(cfg)
    rule_group, policy = build_api(cfg, rules, name)
    check = validate_api(rule_group, policy)
    rows = compare(cfg, rules, test_flows(cfg))
    os.makedirs(out_dir, exist_ok=True)
    files = {
        'rule_group.json': json.dumps(rule_group, ensure_ascii=False, indent=2) + '\n',
        'firewall_policy.json': json.dumps(policy, ensure_ascii=False, indent=2) + '\n',
        'main.tf': terraform(rule_group, policy),
        'mapping.md': f'# 対応表: {cfg["hostname"] or "IPCOM"} → Network Firewall\n\n' + mapping_md(mapping),
        'test_flows.md': '# 確認用の通信(元の機器と新しいルールの判定を比べる)\n\n' + flows_md(rows),
        'report.md': report_md(cfg, rules, mapping, rows, check, os.path.basename(path)),
    }
    for fn, body in files.items():
        with open(os.path.join(out_dir, fn), 'w', encoding='utf-8') as f:
            f.write(body)
    with open(os.path.join(out_dir, 'mapping.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['line', 'interface', 'direction', 'number', 'class', 'action', 'sids', 'status', 'notes'])
        for m in mapping:
            w.writerow([m['line'], m['interface'], m['direction'], m['number'], m['class'], m['action'],
                        ' '.join(map(str, m['sids'])), m['status'], ' / '.join(m['notes'])])
    return {'cfg': cfg, 'rules': rules, 'mapping': mapping, 'rows': rows, 'check': check,
            'rule_group': rule_group, 'policy': policy}


def main(argv=None):
    ap = argparse.ArgumentParser(description='模擬 IPCOM の設定 → AWS Network Firewall の下書きと対応表')
    ap.add_argument('config')
    ap.add_argument('--out', required=True)
    ap.add_argument('--name', help='ルールグループ・ポリシーの名前の頭(既定はホスト名)')
    a = ap.parse_args(argv)
    res = run(a.config, a.out, a.name)
    diff = sum(1 for r in res['rows'] if not r['same'])
    st = {k: sum(1 for m in res['mapping'] if m['status'] == k) for k in ('移した', '要確認', '移さない')}
    print(f'ルール {len(res["mapping"])} 本 → {len(res["rules"])} 本 / {st} / 伏せた行 {len(res["cfg"]["secrets"])} / '
          f'移さない行 {len(res["cfg"]["unsupported"])} / 通信 {len(res["rows"])} 本中 違い {diff} 本')
    print('形の確認:', res['check']['results'] if res['check'] else 'botocore なし(未確認)')
    print('出力:', a.out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
