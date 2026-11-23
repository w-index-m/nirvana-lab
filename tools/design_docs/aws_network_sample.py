#!/usr/bin/env python3
"""
AWS ネットワーク(VPC・Direct Connect・ALB・NAT・WAF・Network Firewall)の
基本設計書とパラメータシートのサンプルを、1 か所の値(DESIGN)から作る。

    python3 tools/design_docs/aws_network_sample.py --out docs/design-samples/aws-network

作るもの:
  basic-design.md       基本設計書(方針・構成図・通信フロー・各サービスの設計・可用性・運用・試験・未決事項)
  parameter-sheet.md    パラメータシート(Markdown)
  parameter-sheet.xlsx  パラメータシート(Excel、openpyxl があるとき)
  check.md              値の矛盾チェックの結果

値はすべて架空(会社名・ドメイン・IP は文書用)。本物の AWS には入れていない。
check() が確かめること:
  - サブネットが VPC の中にあり重ならない、オンプレの帯と VPC が重ならない
  - ルートの行き先が定義済みのもの(IGW・VGW・NAT・Firewall エンドポイント)
  - 同じ AZ の Firewall / NAT を使う(AZ をまたがない)
  - 外(インターネット・オンプレ)へ出る経路は必ず Firewall を通る(IGW / VGW へ直接出ない)
  - 行きと帰りが同じ Firewall エンドポイントを通る(ステートフルの検査は対称でないと切れる)
  - SG の参照先がある、WAF の WCU の合計、DX が 2 つのロケーションに分かれている
"""
import argparse
import ipaddress
import os
import sys

AZS = ['1a', '1c']

DESIGN = {
    'meta': {
        'title': 'サンプル商事 EC サイト 本番環境 AWS ネットワーク 基本設計書',
        'system': 'shop', 'env': 'prd', 'region': 'ap-northeast-1(東京)', 'version': '0.1(サンプル)',
        'onprem': '192.168.0.0/16', 'onprem_ops': '192.168.100.0/24', 'domain': 'shop.example.jp',
    },
    'vpc': {'name': 'shop-prd-vpc', 'cidr': '10.20.0.0/16', 'dns_support': True, 'dns_hostnames': True,
            'flow_logs': 'ALL を S3 へ(保存 1 年)', 'tenancy': 'default'},
    'subnets': [
        # name, role, az, cidr, 置くもの
        ('shop-prd-pub-1a', 'public', '1a', '10.20.0.0/24', 'ALB・NAT ゲートウェイ'),
        ('shop-prd-pub-1c', 'public', '1c', '10.20.1.0/24', 'ALB・NAT ゲートウェイ'),
        ('shop-prd-fw-1a', 'firewall', '1a', '10.20.10.0/28', 'Network Firewall エンドポイント'),
        ('shop-prd-fw-1c', 'firewall', '1c', '10.20.10.16/28', 'Network Firewall エンドポイント'),
        ('shop-prd-app-1a', 'app', '1a', '10.20.20.0/24', 'アプリケーションサーバー'),
        ('shop-prd-app-1c', 'app', '1c', '10.20.21.0/24', 'アプリケーションサーバー'),
        ('shop-prd-db-1a', 'db', '1a', '10.20.30.0/24', 'データベース'),
        ('shop-prd-db-1c', 'db', '1c', '10.20.31.0/24', 'データベース'),
    ],
    # ルートテーブル: name -> (関連付け先, [(宛先, 行き先)])。VPC 内の local は全テーブルに暗黙で入る
    'route_tables': {
        'shop-prd-rt-igw-edge': ('igw(エッジ関連付け)', [('10.20.0.0/24', 'fw-1a'), ('10.20.1.0/24', 'fw-1c')]),
        'shop-prd-rt-vgw-edge': ('vgw(エッジ関連付け)', [('10.20.0.0/24', 'fw-1a'), ('10.20.1.0/24', 'fw-1c'),
                                                         ('10.20.20.0/24', 'fw-1a'), ('10.20.21.0/24', 'fw-1c'),
                                                         ('10.20.30.0/24', 'fw-1a'), ('10.20.31.0/24', 'fw-1c')]),
        'shop-prd-rt-pub-1a': ('shop-prd-pub-1a', [('0.0.0.0/0', 'fw-1a')]),
        'shop-prd-rt-pub-1c': ('shop-prd-pub-1c', [('0.0.0.0/0', 'fw-1c')]),
        'shop-prd-rt-fw-1a': ('shop-prd-fw-1a', [('0.0.0.0/0', 'igw'), ('192.168.0.0/16', 'vgw')]),
        'shop-prd-rt-fw-1c': ('shop-prd-fw-1c', [('0.0.0.0/0', 'igw'), ('192.168.0.0/16', 'vgw')]),
        'shop-prd-rt-app-1a': ('shop-prd-app-1a', [('0.0.0.0/0', 'nat-1a'), ('192.168.0.0/16', 'fw-1a')]),
        'shop-prd-rt-app-1c': ('shop-prd-app-1c', [('0.0.0.0/0', 'nat-1c'), ('192.168.0.0/16', 'fw-1c')]),
        'shop-prd-rt-db-1a': ('shop-prd-db-1a', [('192.168.0.0/16', 'fw-1a')]),
        'shop-prd-rt-db-1c': ('shop-prd-db-1c', [('192.168.0.0/16', 'fw-1c')]),
    },
    'gateways': {
        'igw': 'shop-prd-igw', 'vgw': 'shop-prd-vgw',
        'nat-1a': 'shop-prd-nat-1a(shop-prd-pub-1a、EIP)', 'nat-1c': 'shop-prd-nat-1c(shop-prd-pub-1c、EIP)',
        'fw-1a': 'Network Firewall エンドポイント(shop-prd-fw-1a)', 'fw-1c': 'Network Firewall エンドポイント(shop-prd-fw-1c)',
    },
    'nat': [
        {'name': 'shop-prd-nat-1a', 'subnet': 'shop-prd-pub-1a', 'type': 'パブリック', 'eip': 'shop-prd-eip-nat-1a'},
        {'name': 'shop-prd-nat-1c', 'subnet': 'shop-prd-pub-1c', 'type': 'パブリック', 'eip': 'shop-prd-eip-nat-1c'},
    ],
    'security_groups': {
        'shop-prd-sg-alb': [('in', 'tcp', '443', '0.0.0.0/0', 'HTTPS'), ('in', 'tcp', '80', '0.0.0.0/0', 'HTTPS へ転送するため'),
                            ('out', 'tcp', '8080', 'shop-prd-sg-app', 'ターゲットへ')],
        'shop-prd-sg-app': [('in', 'tcp', '8080', 'shop-prd-sg-alb', 'ALB から'), ('in', 'tcp', '22', '192.168.100.0/24', '運用端末から'),
                            ('out', 'tcp', '5432', 'shop-prd-sg-db', 'DB へ'), ('out', 'tcp', '443', '0.0.0.0/0', '外部 API・更新(Firewall で絞る)')],
        'shop-prd-sg-db': [('in', 'tcp', '5432', 'shop-prd-sg-app', 'アプリから')],
    },
    'dx': {
        'dxgw': {'name': 'shop-dxgw', 'amazon_asn': 64512, 'allowed_prefixes': ['10.20.0.0/16']},
        'vgw': {'name': 'shop-prd-vgw', 'note': 'DX ゲートウェイに関連付け。VPC へ VGW 経由で入る通信はエッジのルートテーブルで Firewall へ'},
        'connections': [
            {'name': 'shop-dxcon-a', 'location': 'DX ロケーション A(東京)', 'bandwidth': '1Gbps', 'type': '専用接続',
             'vif': 'shop-vif-a', 'vlan': 101, 'customer_asn': 65010, 'aws_ip': '169.254.10.1/30', 'customer_ip': '169.254.10.2/30',
             'community': '7224:7300(高)', 'role': '主系'},
            {'name': 'shop-dxcon-b', 'location': 'DX ロケーション B(大阪)', 'bandwidth': '1Gbps', 'type': '専用接続',
             'vif': 'shop-vif-b', 'vlan': 102, 'customer_asn': 65010, 'aws_ip': '169.254.20.1/30', 'customer_ip': '169.254.20.2/30',
             'community': '7224:7100(低)', 'role': '副系'},
        ],
        'mtu': 1500, 'bfd': 'オンプレのルーター側で有効(300ms × 3)', 'md5': '別管理(Secrets Manager。本書に値を書かない)',
        'onprem_advertise': ['192.168.0.0/16'], 'aws_advertise': ['10.20.0.0/16'],
    },
    'alb': {
        'name': 'shop-prd-alb', 'scheme': 'internet-facing', 'ip_type': 'ipv4', 'subnets': ['shop-prd-pub-1a', 'shop-prd-pub-1c'],
        'sg': 'shop-prd-sg-alb',
        'listeners': [('HTTP', 80, 'HTTPS:443 へ 301 で転送', '-'),
                      ('HTTPS', 443, 'shop-prd-tg-app へ転送', 'ELBSecurityPolicy-TLS13-1-2-2021-06 / ACM 証明書 *.shop.example.jp')],
        'attributes': [('idle_timeout.timeout_seconds', '60'), ('deletion_protection.enabled', 'true'),
                       ('routing.http.drop_invalid_header_fields.enabled', 'true'),
                       ('routing.http.xff_header_processing.mode', 'append'),
                       ('access_logs.s3.enabled', 'true(shop-prd-alb-logs)')],
        'target_group': {'name': 'shop-prd-tg-app', 'protocol': 'HTTP', 'port': 8080, 'target_type': 'instance',
                         'health': [('path', '/healthz'), ('matcher', '200'), ('interval', '30 秒'), ('timeout', '5 秒'),
                                    ('healthy_threshold', '5'), ('unhealthy_threshold', '2')],
                         'deregistration_delay': '60 秒', 'stickiness': '無効'},
    },
    'waf': {
        'name': 'shop-prd-webacl', 'scope': 'REGIONAL(ALB に関連付け)', 'default_action': 'Allow',
        # priority, name, 中身, 動作, WCU(公式値は導入時に CheckCapacity で確認)
        'rules': [
            (10, 'AWSManagedRulesAmazonIpReputationList', '評判の悪い IP', '最初は Count → Block', 25),
            (20, 'AWSManagedRulesCommonRuleSet', '一般的な攻撃(OWASP 系)', '最初は Count → Block', 700),
            (30, 'AWSManagedRulesKnownBadInputsRuleSet', '既知の悪い入力', '最初は Count → Block', 200),
            (40, 'AWSManagedRulesSQLiRuleSet', 'SQL インジェクション', '最初は Count → Block', 200),
            (50, 'shop-prd-rate-limit', '同じ IP から 5 分に 2,000 回を超えたら', 'Block', 2),
        ],
        'logging': 'CloudWatch Logs(ロググループ名は aws-waf-logs- で始める: aws-waf-logs-shop-prd)。Authorization と Cookie は伏せる',
        'wcu_budget': 1500,
    },
    'nfw': {
        'name': 'shop-prd-nfw', 'policy': 'shop-prd-nfw-policy', 'subnets': ['shop-prd-fw-1a', 'shop-prd-fw-1c'],
        'rule_order': 'STRICT_ORDER', 'stateless_default': 'aws:forward_to_sfe',
        'stateful_default': ['aws:drop_established', 'aws:alert_established'],
        'home_net': ['10.20.0.0/16', '192.168.0.0/16'],
        'rule_groups': [
            {'name': 'shop-prd-rg-5tuple', 'priority': 100, 'type': 'ステートフル(5 つの組み合わせ)', 'rules': [
                ('pass', 'TCP', 'ANY', '10.20.0.0/23', '443', 'インターネット → ALB(HTTPS)'),
                ('pass', 'TCP', 'ANY', '10.20.0.0/23', '80', 'インターネット → ALB(HTTPS へ転送)'),
                ('pass', 'TCP', '192.168.100.0/24', '10.20.20.0/23', '22', '運用端末 → アプリ(SSH)'),
                ('pass', 'TCP', '192.168.0.0/16', '10.20.20.0/23', '443', 'オンプレ → アプリ(社内向け API)'),
                ('drop', 'IP', '192.168.0.0/16', '10.20.30.0/23', 'ANY', 'オンプレ → DB は止める(ログに残すため明示)'),
            ]},
            {'name': 'shop-prd-rg-egress-domains', 'priority': 200, 'type': 'ドメインの一覧(ALLOWLIST、TLS_SNI と HTTP_HOST)', 'rules': [
                ('pass', 'TLS/HTTP', '10.20.0.0/23(NAT)', '.amazonaws.com', '443', 'AWS の API'),
                ('pass', 'TLS/HTTP', '10.20.0.0/23(NAT)', 'api.payment.example.com', '443', '決済サービス(架空)'),
                ('pass', 'TLS/HTTP', '10.20.0.0/23(NAT)', '(OS 更新の配布元: 要決定)', '443', 'OS の更新'),
            ]},
        ],
        'logging': 'ALERT と FLOW を S3 へ(ALERT は CloudWatch Logs にも)',
        'tls_inspection': '使わない(必要になったら別途設計)',
    },
}

# 試験(通るべき / 止まるべき)
TESTS = [
    ('インターネット → ALB 443', 'https://www.shop.example.jp/', '200 が返る', 'ALB アクセスログ・NFW の FLOW'),
    ('インターネット → ALB 80', 'http://www.shop.example.jp/', '301 で https へ', 'ALB アクセスログ'),
    ('インターネット → アプリ直接', 'アプリの IP へ 8080', '届かない(パブリック IP なし)', '-'),
    ('WAF: SQL インジェクション', "?id=1' OR '1'='1", 'Count 期間はログのみ、Block 後は 403', 'WAF ログ'),
    ('WAF: 回数制限', '同じ IP から 5 分に 2,000 回超', '403', 'WAF ログ・BlockedRequests'),
    ('アプリ → 許可ドメイン', 'curl https://(許可した宛先)', '通る(送信元は NAT の EIP)', 'NFW の FLOW'),
    ('アプリ → 許可外ドメイン', 'curl https://www.example.org', '止まる', 'NFW の ALERT'),
    ('運用端末 → アプリ 22', 'ssh(192.168.100.0/24 から)', '通る', 'NFW の FLOW・VPC フローログ'),
    ('一般端末 → アプリ 22', 'ssh(192.168.1.0/24 から)', '止まる', 'NFW の ALERT'),
    ('オンプレ → DB 5432', 'psql', '止まる', 'NFW の ALERT'),
    ('アプリ → DB 5432', 'psql', '通る(VPC 内は SG で制御、NFW は通らない)', 'VPC フローログ'),
    ('DX 主系の断', '主系 VIF を止める', '副系で継続。切り替わりの時間を記録', 'BGP の状態・ping の欠け'),
    ('AZ 1a の停止を想定', '1a のアプリを止める', 'ALB が 1c だけに送る', 'UnHealthyHostCount'),
]

AVAILABILITY = [
    ('AZ 1a の障害', 'ALB は 1c へ。1c の NAT・Firewall で外へ出る(AZ ごとに独立)', 'なし(1c の容量で足りること)'),
    ('Firewall エンドポイント 1a の障害', '1a の通信が止まる(1c へは自動で寄らない)', 'ルートを 1c へ向け直す手順を運用手順書に用意'),
    ('NAT ゲートウェイ 1a の障害', '1a のアプリから外へ出られない', 'ルートを nat-1c へ向け直す(AZ をまたぐ料金に注意)'),
    ('DX 主系(A)の断', 'BGP で副系(B)へ切り替わる', 'BFD で数秒以内を目標。切り替わりの時間は試験で測る'),
    ('DX 両系の断', 'オンプレとの通信が止まる', 'Site-to-Site VPN の予備は未決事項'),
    ('アプリ 1 台の障害', 'ヘルスチェックで外れ、残りへ', 'なし'),
]

MONITORING = [
    ('Direct Connect', 'ConnectionState・VirtualInterfaceBpsEgress/Ingress', '接続の断・帯域の 80%'),
    ('ALB', 'UnHealthyHostCount・HTTPCode_ELB_5XX_Count・TargetResponseTime', '1 台以上の異常・5xx の急増・応答の遅れ'),
    ('NAT ゲートウェイ', 'ErrorPortAllocation・PacketsDropCount', '0 を超えたら'),
    ('WAF', 'BlockedRequests・CountedRequests', '急増したら'),
    ('Network Firewall', 'DroppedPackets・PassedPackets', '止めた数の急増'),
]

OPEN_ITEMS = [
    'OS 更新の配布元など、外へ出てよい宛先の一覧(業務部門と決める)',
    'DX 両系断のときの予備(Site-to-Site VPN を張るか)',
    'Network Firewall の既定アクション: 2026-06 から新しいポリシーの既定は「Application drop established(server-directed only)」。'
    '本書は drop_established + alert_established を明示する(STRICT_ORDER の推奨)。どちらにするかを確定する',
    'WAF の各マネージドルールの WCU と料金(導入時に CheckCapacity で確認。1,500 を超えると追加料金がかかる場合がある)',
    'WAF を Count から Block へ切り替える日(誤検知の確認期間)',
    'DNS(Route 53 Resolver のインバウンド / アウトバウンド エンドポイント)は別紙',
    'VPC エンドポイント(S3 のゲートウェイ型、SSM などのインタフェース型)で NAT を通さない通信を増やすか',
]


# ── 矛盾チェック ──
def _net(c):
    return ipaddress.ip_network(c)


def _subnet_by_name():
    return {s[0]: s for s in DESIGN['subnets']}


def _rt_for(target):
    for name, (assoc, routes) in DESIGN['route_tables'].items():
        if assoc == target or assoc.startswith(target):
            return name, routes
    return None, []


def _lookup(routes, dst, vpc):
    """最長一致。VPC 内は local"""
    d = ipaddress.ip_address(dst)
    if d in vpc:
        return 'local'
    best = None
    for prefix, tgt in routes:
        n = _net(prefix)
        if d in n and (best is None or n.prefixlen > best[0].prefixlen):
            best = (n, tgt)
    return best[1] if best else None


def trace(src_subnet, dst_ip):
    """サブネットから外への行き先を順にたどる。戻り値: 通った行き先の並び"""
    vpc = _net(DESIGN['vpc']['cidr'])
    hops, here = [], src_subnet
    for _ in range(6):
        _, routes = _rt_for(here)
        nxt = _lookup(routes, dst_ip, vpc)
        hops.append(nxt)
        if nxt in (None, 'local', 'igw', 'vgw'):
            return hops
        if nxt.startswith('nat-'):
            here = 'shop-prd-pub-' + nxt[-2:]       # NAT ゲートウェイのいるサブネットから出直す
        elif nxt.startswith('fw-'):
            here = 'shop-prd-fw-' + nxt[-2:]
    return hops


def return_path(edge, dst_ip):
    """IGW / VGW から戻ってくる通信がまず向かう先"""
    vpc = _net(DESIGN['vpc']['cidr'])
    routes = DESIGN['route_tables'][f'shop-prd-rt-{edge}-edge'][1]
    d = ipaddress.ip_address(dst_ip)
    best = None
    for prefix, tgt in routes:
        n = _net(prefix)
        if d in n and (best is None or n.prefixlen > best[0].prefixlen):
            best = (n, tgt)
    return best[1] if best else ('local' if d in vpc else None)


def check():
    res = []

    def ok(name, cond, detail=''):
        res.append((name, bool(cond), detail))

    vpc = _net(DESIGN['vpc']['cidr'])
    subs = DESIGN['subnets']
    nets = [(s[0], _net(s[3])) for s in subs]
    ok('サブネットが VPC の中にある', all(n.subnet_of(vpc) for _, n in nets))
    overlap = [(a, b) for i, (a, x) in enumerate(nets) for b, y in nets[i + 1:] if x.overlaps(y)]
    ok('サブネットが重ならない', not overlap, str(overlap) if overlap else '')
    ok('オンプレの帯と VPC が重ならない', not _net(DESIGN['meta']['onprem']).overlaps(vpc))

    known = set(DESIGN['gateways'])
    bad = [(rt, t) for rt, (_, routes) in DESIGN['route_tables'].items() for _, t in routes if t not in known]
    ok('ルートの行き先がすべて定義済み', not bad, str(bad) if bad else '')

    by = _subnet_by_name()
    cross = []
    for rt, (assoc, routes) in DESIGN['route_tables'].items():
        if assoc in by:
            az = by[assoc][2]
            cross += [(rt, t) for _, t in routes if t[-2:] in AZS and t[-2:] != az]
        else:   # エッジ: 宛先サブネットの AZ と同じ Firewall
            for prefix, t in routes:
                owner = [s for s in subs if _net(s[3]) == _net(prefix)]
                if owner and t[-2:] != owner[0][2]:
                    cross.append((rt, prefix, t))
    ok('同じ AZ の Firewall / NAT を使う', not cross, str(cross) if cross else '')

    direct = [(rt, t) for rt, (assoc, routes) in DESIGN['route_tables'].items()
              if assoc in by and by[assoc][1] != 'firewall' for _, t in routes if t in ('igw', 'vgw')]
    ok('外へ出る経路は必ず Firewall を通る', not direct, str(direct) if direct else '')

    flows, asym = [], []
    for name, role, az, cidr, _ in subs:
        if role == 'firewall':
            continue
        host = str(_net(cidr).network_address + 10)
        for label, dst, edge in (('インターネット', '198.51.100.80', 'igw'), ('オンプレ', '192.168.1.10', 'vgw')):
            hops = trace(name, dst)
            if hops[-1] not in ('igw', 'vgw'):
                why = '出られない(設計どおり: DB は外へ出さない)' if role == 'db' and edge == 'igw' else '出られない(要確認)'
                flows.append((name, label, ' → '.join(map(str, hops)), why))
                if why.endswith('(要確認)'):
                    asym.append((name, label))
                continue
            fw_out = [h for h in hops if h and h.startswith('fw-')]
            src_seen = host
            nat = [h for h in hops if h and h.startswith('nat-')]
            if nat:     # NAT の後ろは NAT のいるサブネットの IP で戻ってくる
                src_seen = str(_net(by['shop-prd-pub-' + nat[0][-2:]][3]).network_address + 20)
            back = return_path(edge, src_seen)
            same = bool(fw_out) and back == fw_out[0]
            flows.append((name, label, ' → '.join(hops), f'戻り: {edge} → {back}' + ('(同じ)' if same else '(違う)')))
            if not same:
                asym.append((name, label))
    ok('行きと帰りが同じ Firewall エンドポイントを通る', not asym, str(asym) if asym else '')

    sgs = DESIGN['security_groups']
    refs = [(g, r[3]) for g, rules in sgs.items() for r in rules if r[3].startswith('shop-') and r[3] not in sgs]
    ok('SG の参照先がある', not refs, str(refs) if refs else '')
    wcu = sum(r[4] for r in DESIGN['waf']['rules'])
    ok(f'WAF の WCU の合計 {wcu} が {DESIGN["waf"]["wcu_budget"]} 以内(各値は要確認)', wcu <= DESIGN['waf']['wcu_budget'])
    locs = {c['location'] for c in DESIGN['dx']['connections']}
    ok('DX が 2 つのロケーションに分かれている', len(locs) >= 2)
    comm = sorted(c['community'][:9] for c in DESIGN['dx']['connections'])
    ok('DX の主系と副系でコミュニティが違う(7224:7300 / 7224:7100)', comm == ['7224:7100', '7224:7300'])
    hn = [_net(c) for c in DESIGN['nfw']['home_net']]
    ok('Firewall の HOME_NET に VPC とオンプレが入る', vpc in hn and _net(DESIGN['meta']['onprem']) in hn)
    return res, flows


# ── 書き出し ──
def _t(header, rows):
    out = ['| ' + ' | '.join(header) + ' |', '|' + '---|' * len(header)]
    out += ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows]
    return '\n'.join(out) + '\n'


def mermaid():
    return '''```mermaid
flowchart LR
  user([インターネットの利用者]) --> igw[IGW]
  onprem([オンプレ 192.168.0.0/16]) ---|DX 主系 A / 副系 B| dxgw[DX ゲートウェイ] --- vgw[VGW]
  subgraph vpc["VPC 10.20.0.0/16"]
    subgraph a[AZ 1a]
      fwa[[Firewall 1a]]
      puba[public 1a<br/>ALB・NAT]
      appa[app 1a]
      dba[(db 1a)]
    end
    subgraph c[AZ 1c]
      fwc[[Firewall 1c]]
      pubc[public 1c<br/>ALB・NAT]
      appc[app 1c]
      dbc[(db 1c)]
    end
  end
  igw --> fwa --> puba
  igw --> fwc --> pubc
  vgw --> fwa --> appa
  vgw --> fwc --> appc
  puba -->|ALB → 8080| appa
  pubc -->|ALB → 8080| appc
  appa --> dba
  appc --> dbc
  waf{{WAF}} -.関連付け.- puba
  waf -.関連付け.- pubc
```
'''


def basic_design(results, flows):
    d, m = DESIGN, DESIGN['meta']
    s = [f'# {m["title"]}', '',
         '> **サンプルです。** 会社名・ドメイン・IP アドレス・ASN はすべて架空(文書用の範囲)。本物の AWS には入れていません。',
         '> 値は `tools/design_docs/aws_network_sample.py` の 1 か所から作り、パラメータシートと同じです。', '',
         _t(['項目', '内容'], [('版', m['version']), ('作成', '(作成者)'), ('確認', '(確認者)'), ('承認', '(承認者)'),
                              ('対象', 'VPC・Direct Connect・ALB・NAT ゲートウェイ・WAF・Network Firewall')]),
         '## 1. 目的と範囲', '',
         'EC サイトの本番環境を AWS に置き、インターネットの利用者からは ALB 経由で、社内(オンプレ)からは Direct Connect 経由で使えるようにする。'
         'インターネットとオンプレの両方の出入りを AWS Network Firewall で検査し、Web の攻撃は WAF で止める。',
         '', '範囲外(別紙): DNS(Route 53)、サーバー・DB の設計、アカウント・IAM の設計、オンプレ側ルーターの設定。', '',
         '## 2. 前提と制約', '',
         _t(['項目', '内容'], [
             ('リージョン', m['region']), ('AZ', 'ap-northeast-1a・ap-northeast-1c の 2 つ'),
             ('VPC の帯', d['vpc']['cidr'] + '(オンプレ 192.168.0.0/16 と重ならない)'),
             ('オンプレの運用端末', m['onprem_ops']), ('名前の付け方', '<システム>-<環境>-<種類>-<AZ>(例: shop-prd-app-1a)'),
             ('作り方', 'IaC(Terraform)で作り、変更も IaC から。コンソールで直接変えない')]),
         '## 3. 全体構成', '', mermaid(),
         '- AZ ごとに Firewall・NAT を持ち、**行きと帰りが同じ AZ の Firewall を通る**ようにルートを組む'
         '(ステートフルの検査は、片方向しか見えないと通信を切る)。',
         '- IGW と VGW にはエッジのルートテーブルを関連付け、入ってくる通信を Firewall へ向ける。',
         '- VPC の中どうし(ALB → アプリ、アプリ → DB)は Firewall を通らない。SG で絞る。', '',
         '## 4. 通信の流れ', '',
         _t(['#', '通信', '経路'], [
             (1, 'インターネット → Web', 'IGW → Firewall(AZ) → ALB(WAF) → アプリ。戻りは ALB → Firewall(同じ AZ) → IGW'),
             (2, 'アプリ → インターネット', 'アプリ → NAT(同じ AZ) → Firewall → IGW。Firewall から見える送信元は NAT の IP'),
             (3, 'オンプレ → アプリ', 'DX → VGW → Firewall(宛先の AZ) → アプリ。戻りはアプリ → Firewall(同じ AZ) → VGW'),
             (4, 'オンプレ → DB', 'Firewall で止める'),
             (5, 'アプリ → DB', 'VPC 内(SG で 5432 だけ許可)')]),
         '### ルートの確かめ(機械的に計算した結果)', '',
         _t(['送信元', '宛先', '行き', '戻り'], flows),
         '## 5. 方式設計', '',
         '### 5.1 VPC・サブネット', '',
         _t(['名前', '役割', 'AZ', 'CIDR', '置くもの'], d['subnets']),
         f'- DNS 解決・DNS ホスト名: 有効。フローログ: {d["vpc"]["flow_logs"]}。',
         '- Firewall のサブネットは /28(エンドポイントだけを置く)。アプリ・DB にはパブリック IP を付けない。', '',
         '### 5.2 ルートテーブル', '',
         _t(['名前', '関連付け', '宛先', '行き先'],
            [(n, a, p, d['gateways'][t]) for n, (a, rs) in d['route_tables'].items() for p, t in rs]),
         '- VGW の経路伝播はどのテーブルでも使わない(伝播させると Firewall を飛ばしてしまう)。オンプレの帯は静的に書く。',
         '- VGW のエッジには public のサブネットも書く。書かないと public → オンプレの戻りが Firewall を飛ばし、'
         '行きと帰りがずれて通信が切れる(初版はこれが漏れていて、値の矛盾チェックで見つかった)。', '',
         '### 5.3 セキュリティグループ', '',
         _t(['SG', '向き', 'プロトコル', 'ポート', '相手', '目的'], [(g,) + r for g, rs in d['security_groups'].items() for r in rs]),
         '### 5.4 Direct Connect', '',
         _t(['項目', '主系', '副系'], [
             ('接続', *(c['name'] for c in d['dx']['connections'])),
             ('ロケーション', *(c['location'] for c in d['dx']['connections'])),
             ('帯域・種類', *(c['bandwidth'] + '・' + c['type'] for c in d['dx']['connections'])),
             ('VIF(プライベート)', *(c['vif'] for c in d['dx']['connections'])),
             ('VLAN', *(c['vlan'] for c in d['dx']['connections'])),
             ('BGP(AWS 側 / オンプレ側)', *(f'{c["aws_ip"]} / {c["customer_ip"]}' for c in d['dx']['connections'])),
             ('オンプレの ASN', *(c['customer_asn'] for c in d['dx']['connections'])),
             ('付けるコミュニティ', *(c['community'] for c in d['dx']['connections']))]),
         f'- DX ゲートウェイ: {d["dx"]["dxgw"]["name"]}(Amazon 側 ASN {d["dx"]["dxgw"]["amazon_asn"]})、許可するプレフィックス '
         f'{", ".join(d["dx"]["dxgw"]["allowed_prefixes"])}。{d["dx"]["vgw"]["note"]}。',
         '- 2 つのロケーションに 1 本ずつ(片方のロケーションが止まっても続く形)。',
         '- AWS → オンプレの向きは、オンプレから広告する経路に付けるコミュニティで主系を選ぶ(7224:7300 が優先)。'
         'オンプレ → AWS の向きは、オンプレのルーターの local preference で主系を選ぶ。',
         f'- MTU {d["dx"]["mtu"]}、BFD は{d["dx"]["bfd"]}、MD5 の鍵は{d["dx"]["md5"]}。',
         f'- 広告する経路: オンプレ → AWS {", ".join(d["dx"]["onprem_advertise"])}(プライベート VIF は 100 経路まで。超えると BGP が止まる)、'
         f'AWS → オンプレ {", ".join(d["dx"]["aws_advertise"])}。', '',
         '### 5.5 ALB', '',
         _t(['項目', '値'], [('名前', d['alb']['name']), ('種類', d['alb']['scheme']), ('サブネット', '・'.join(d['alb']['subnets'])),
                            ('SG', d['alb']['sg'])]),
         _t(['リスナー', 'ポート', '動作', 'TLS'], d['alb']['listeners']),
         _t(['属性', '値'], d['alb']['attributes']),
         f'ターゲットグループ {d["alb"]["target_group"]["name"]}: {d["alb"]["target_group"]["protocol"]} {d["alb"]["target_group"]["port"]}、'
         f'{d["alb"]["target_group"]["target_type"]}、登録解除の待ち {d["alb"]["target_group"]["deregistration_delay"]}、'
         f'スティッキー {d["alb"]["target_group"]["stickiness"]}。', '',
         _t(['ヘルスチェック', '値'], d['alb']['target_group']['health']),
         '### 5.6 NAT ゲートウェイ', '',
         _t(['名前', 'サブネット', '種類', 'EIP'], [(n['name'], n['subnet'], n['type'], n['eip']) for n in d['nat']]),
         '- AZ ごとに 1 つ(AZ をまたぐ通信の料金と、片方の AZ の障害の巻き込みを避ける)。',
         '- 外の相手に許可してもらう送信元 IP は、この 2 つの EIP。', '',
         '### 5.7 WAF', '',
         f'Web ACL {d["waf"]["name"]}({d["waf"]["scope"]})、既定の動作は {d["waf"]["default_action"]}。', '',
         _t(['優先度', 'ルール', '中身', '動作', 'WCU(要確認)'], d['waf']['rules']),
         f'- ログ: {d["waf"]["logging"]}。',
         '- マネージドルールは最初 Count で入れ、誤検知を確かめてから Block にする。', '',
         '### 5.8 Network Firewall', '',
         _t(['項目', '値'], [('ファイアウォール', d['nfw']['name']), ('ポリシー', d['nfw']['policy']),
                            ('エンドポイントのサブネット', '・'.join(d['nfw']['subnets'])), ('評価の順', d['nfw']['rule_order']),
                            ('ステートレスの既定', d['nfw']['stateless_default']),
                            ('ステートフルの既定', ' + '.join(d['nfw']['stateful_default'])),
                            ('HOME_NET', '・'.join(d['nfw']['home_net'])), ('ログ', d['nfw']['logging']),
                            ('TLS 検査', d['nfw']['tls_inspection'])]),
         ]
    for g in d['nfw']['rule_groups']:
        s += [f'**{g["name"]}**(優先度 {g["priority"]}、{g["type"]})', '',
              _t(['動作', 'プロトコル', '送信元', '宛先', 'ポート', '目的'], g['rules'])]
    s += ['- アプリから外へ出る通信は NAT を通った後に検査するので、Firewall からは NAT の IP しか見えない'
          '(どのアプリかは VPC フローログで見る)。',
          '- 一覧に無い通信は drop_established で止まり、alert_established でログに残る。', '',
          '## 6. 可用性', '', _t(['起きること', '動き', '対処・備え'], AVAILABILITY),
          '## 7. 運用・監視', '', _t(['対象', 'メトリクス', 'しきい値の考え方'], MONITORING),
          '- ログの置き場所: VPC フローログ・ALB アクセスログ・Firewall のログは S3、WAF のログは CloudWatch Logs。',
          '- メトリクス名は導入時に CloudWatch で確かめる。', '',
          '## 8. 試験', '', _t(['試験', 'やること', '期待する結果', '確かめるもの'], TESTS),
          '## 9. 未決事項', ''] + [f'- {x}' for x in OPEN_ITEMS] + [
          '', '## 10. 値の矛盾チェック', '',
          _t(['チェック', '結果', '詳しく'], [(n, 'OK' if r else '**NG**', det) for n, r, det in results]),
          '## 改版履歴', '', _t(['版', '日付', '内容', '作成'], [('0.1', '(日付)', '初版(サンプル)', '(作成者)')])]
    return '\n'.join(s)


def sheets():
    d = DESIGN
    return [
        ('VPC', ['項目', '値'], [('名前', d['vpc']['name']), ('CIDR', d['vpc']['cidr']), ('DNS 解決', '有効'),
                                ('DNS ホスト名', '有効'), ('フローログ', d['vpc']['flow_logs']), ('テナンシー', d['vpc']['tenancy'])]),
        ('サブネット', ['名前', '役割', 'AZ', 'CIDR', '置くもの'], d['subnets']),
        ('ルートテーブル', ['名前', '関連付け', '宛先', '行き先'],
         [(n, a, p, t) for n, (a, rs) in d['route_tables'].items() for p, t in rs]),
        ('SG', ['SG', '向き', 'プロトコル', 'ポート', '相手', '目的'],
         [(g,) + r for g, rs in d['security_groups'].items() for r in rs]),
        ('DX', ['接続', 'ロケーション', '帯域', '種類', 'VIF', 'VLAN', 'オンプレ ASN', 'AWS 側 IP', 'オンプレ側 IP', 'コミュニティ', '役割'],
         [(c['name'], c['location'], c['bandwidth'], c['type'], c['vif'], c['vlan'], c['customer_asn'], c['aws_ip'],
           c['customer_ip'], c['community'], c['role']) for c in d['dx']['connections']]
         + [('DX ゲートウェイ', d['dx']['dxgw']['name'], '', '', '', '', '', f'Amazon 側 ASN {d["dx"]["dxgw"]["amazon_asn"]}', '',
             '許可: ' + ', '.join(d['dx']['dxgw']['allowed_prefixes']), '')]),
        ('ALB', ['区分', '項目', '値'],
         [('本体', '名前', d['alb']['name']), ('本体', '種類', d['alb']['scheme']), ('本体', 'サブネット', '・'.join(d['alb']['subnets'])),
          ('本体', 'SG', d['alb']['sg'])]
         + [('リスナー', f'{p} {port}', f'{act} / {tls}') for p, port, act, tls in d['alb']['listeners']]
         + [('属性', k, v) for k, v in d['alb']['attributes']]
         + [('ターゲットグループ', '名前', d['alb']['target_group']['name']),
            ('ターゲットグループ', 'プロトコル・ポート', f'{d["alb"]["target_group"]["protocol"]} {d["alb"]["target_group"]["port"]}')]
         + [('ヘルスチェック', k, v) for k, v in d['alb']['target_group']['health']]),
        ('NAT', ['名前', 'サブネット', '種類', 'EIP'], [(n['name'], n['subnet'], n['type'], n['eip']) for n in d['nat']]),
        ('WAF', ['優先度', 'ルール', '中身', '動作', 'WCU(要確認)'], d['waf']['rules']),
        ('NFWポリシー', ['項目', '値'],
         [('ファイアウォール', d['nfw']['name']), ('ポリシー', d['nfw']['policy']),
          ('エンドポイントのサブネット', '・'.join(d['nfw']['subnets'])), ('評価の順', d['nfw']['rule_order']),
          ('ステートレスの既定', d['nfw']['stateless_default']), ('ステートフルの既定', ' + '.join(d['nfw']['stateful_default'])),
          ('HOME_NET', '・'.join(d['nfw']['home_net'])), ('ログ', d['nfw']['logging']), ('TLS 検査', d['nfw']['tls_inspection'])]),
        ('NetworkFirewall', ['ルールグループ', '優先度', '動作', 'プロトコル', '送信元', '宛先', 'ポート', '目的'],
         [(g['name'], g['priority']) + r for g in d['nfw']['rule_groups'] for r in g['rules']]),
        ('試験', ['試験', 'やること', '期待する結果', '確かめるもの'], TESTS),
    ]


def parameter_sheet_md():
    out = [f'# パラメータシート: {DESIGN["meta"]["title"].replace(" 基本設計書", "")}', '',
           '> サンプル(架空の値)。`tools/design_docs/aws_network_sample.py` から作成。Excel 版は parameter-sheet.xlsx。', '']
    for name, header, rows in sheets():
        out += [f'## {name}', '', _t(header, rows)]
    return '\n'.join(out)


def write_xlsx(path):
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font, PatternFill
    except ImportError:
        return False
    wb = Workbook()
    wb.remove(wb.active)
    head = PatternFill('solid', fgColor='13213A')
    for name, header, rows in sheets():
        ws = wb.create_sheet(name)
        ws.append(header)
        for c in ws[1]:
            c.font = Font(bold=True, color='FFFFFF')
            c.fill = head
        for r in rows:
            ws.append(list(r))
        for col in ws.columns:
            width = max(len(str(c.value or '')) for c in col)
            ws.column_dimensions[col[0].column_letter].width = min(60, max(10, width * 1.6))
            for c in col:
                c.alignment = Alignment(wrap_text=True, vertical='top')
        ws.freeze_panes = 'A2'
        ws.page_setup.orientation = 'landscape'         # 印刷は横向き・幅を 1 ページに
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
    wb.save(path)
    return True


def generate(out_dir):
    results, flows = check()
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, 'basic-design.md'), 'w', encoding='utf-8') as f:
        f.write(basic_design(results, flows))
    with open(os.path.join(out_dir, 'parameter-sheet.md'), 'w', encoding='utf-8') as f:
        f.write(parameter_sheet_md())
    with open(os.path.join(out_dir, 'check.md'), 'w', encoding='utf-8') as f:
        f.write('# 値の矛盾チェック\n\n' + _t(['チェック', '結果', '詳しく'],
                                              [(n, 'OK' if r else 'NG', det) for n, r, det in results])
                + '\n## ルートの行きと戻り\n\n' + _t(['送信元', '宛先', '行き', '戻り'], flows))
    xlsx = write_xlsx(os.path.join(out_dir, 'parameter-sheet.xlsx'))
    return results, flows, xlsx


def main(argv=None):
    ap = argparse.ArgumentParser(description='AWS ネットワーク基本設計書・パラメータシートのサンプルを作る')
    ap.add_argument('--out', default='docs/design-samples/aws-network')
    a = ap.parse_args(argv)
    results, flows, xlsx = generate(a.out)
    for n, r, det in results:
        print(('OK  ' if r else 'NG  ') + n + (f'  {det}' if det else ''))
    print('Excel:', 'あり' if xlsx else 'なし(openpyxl が無い)', '/ 出力:', a.out)
    return 0 if all(r for _, r, _ in results) else 1


if __name__ == '__main__':
    sys.exit(main())
