"""
AWS ネットワーク(VPC・DX・ALB・NAT・WAF・Network Firewall)の設計書サンプル(tools/design_docs/aws_network_sample.py)

- 値の矛盾チェックがすべて OK
- チェックが本当に抜けを見つける: VGW のエッジから public を消すと行きと帰りがずれる / アプリから IGW へ直接出すと NG
- 設計書・パラメータシートに 6 つのサービスの節がそろい、両方の値が同じところから出ている
- Excel のシートがそろう(openpyxl があるとき)
"""
import copy
import os
import sys

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'design_docs'))
import aws_network_sample as S  # noqa: E402


@pytest.fixture
def design(monkeypatch):
    d = copy.deepcopy(S.DESIGN)
    monkeypatch.setattr(S, 'DESIGN', d)
    return d


def _failed(results):
    return [n for n, ok, _ in results if not ok]


def test_all_checks_pass():
    results, flows = S.check()
    assert _failed(results) == []
    assert len(results) == 12
    app = [f for f in flows if f[0] == 'shop-prd-app-1a' and f[1] == 'インターネット'][0]
    assert app[2] == 'nat-1a → fw-1a → igw' and '(同じ)' in app[3]
    db = [f for f in flows if f[0] == 'shop-prd-db-1a' and f[1] == 'インターネット'][0]
    assert '設計どおり' in db[3]


def test_missing_vgw_edge_entry_is_caught(design):
    rt = design['route_tables']['shop-prd-rt-vgw-edge']
    design['route_tables']['shop-prd-rt-vgw-edge'] = (rt[0], [r for r in rt[1] if r[0] != '10.20.0.0/24'])
    results, flows = S.check()
    assert _failed(results) == ['行きと帰りが同じ Firewall エンドポイントを通る']
    bad = [f for f in flows if f[0] == 'shop-prd-pub-1a' and f[1] == 'オンプレ'][0]
    assert bad[3] == '戻り: vgw → local(違う)'


def test_direct_route_to_igw_and_cross_az_are_caught(design):
    a, routes = design['route_tables']['shop-prd-rt-app-1a']
    design['route_tables']['shop-prd-rt-app-1a'] = (a, [('0.0.0.0/0', 'igw'), ('192.168.0.0/16', 'fw-1c')])
    failed = _failed(S.check()[0])
    assert '外へ出る経路は必ず Firewall を通る' in failed and '同じ AZ の Firewall / NAT を使う' in failed


def test_overlap_and_unknown_target_are_caught(design):
    design['subnets'].append(('shop-prd-x', 'app', '1a', '10.20.20.128/25', 'x'))
    design['route_tables']['shop-prd-rt-db-1a'] = ('shop-prd-db-1a', [('192.168.0.0/16', 'tgw')])
    failed = _failed(S.check()[0])
    assert 'サブネットが重ならない' in failed and 'ルートの行き先がすべて定義済み' in failed


def test_documents_cover_six_services(tmp_path):
    results, flows, _ = S.generate(str(tmp_path))
    basic = (tmp_path / 'basic-design.md').read_text(encoding='utf-8')
    for h in ('### 5.1 VPC', '### 5.4 Direct Connect', '### 5.5 ALB', '### 5.6 NAT', '### 5.7 WAF', '### 5.8 Network Firewall',
              '## 6. 可用性', '## 8. 試験', '## 9. 未決事項', '```mermaid'):
        assert h in basic, h
    sheet = (tmp_path / 'parameter-sheet.md').read_text(encoding='utf-8')
    for v in ('10.20.10.16/28', '7224:7300', 'ELBSecurityPolicy-TLS13-1-2-2021-06', 'aws:drop_established', 'shop-prd-eip-nat-1c'):
        assert v in basic and v in sheet, v
    assert '| NG |' not in (tmp_path / 'check.md').read_text(encoding='utf-8')


def test_excel_sheets(tmp_path):
    openpyxl = pytest.importorskip('openpyxl')
    assert S.write_xlsx(str(tmp_path / 'p.xlsx'))
    wb = openpyxl.load_workbook(tmp_path / 'p.xlsx')
    assert wb.sheetnames == ['VPC', 'サブネット', 'ルートテーブル', 'SG', 'DX', 'ALB', 'NAT', 'WAF', 'NFWポリシー', 'NetworkFirewall', '試験']
    assert wb['ルートテーブル'].max_row == 1 + sum(len(r) for _, r in S.DESIGN['route_tables'].values())
