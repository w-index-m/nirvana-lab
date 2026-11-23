"""
ALB の describe の出力から基本設計書とパラメータシートを作る(tools/design_docs/alb_design_docs.py)

- 呼ぶのは describe 系だけ(読み取りのみ)
- 値は describe の出力からそのまま転記される(表・構成図・方針)
- 人が書く欄が残っている、Excel にはシートがそろう
元にするのは docs/design-samples/shop-alb/describe.json(ラボの模擬 ALB から実際に取った出力)。
"""
import json
import os
import sys

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'design_docs'))
import alb_design_docs as D  # noqa: E402

SAMPLE = os.path.join(ROOT, 'docs', 'design-samples', 'shop-alb', 'describe.json')


def _data():
    with open(SAMPLE, encoding='utf-8') as f:
        return json.load(f)['data']


def test_collect_calls_only_describe_commands():
    data = _data()
    calls = []

    def run(cmd):
        calls.append(cmd)
        if cmd == 'aws elbv2 describe-load-balancers':
            return {'LoadBalancers': data['load_balancers']}
        if cmd == 'aws elbv2 describe-target-groups':
            return {'TargetGroups': data['target_groups']}
        if 'describe-target-health' in cmd:
            return {'TargetHealthDescriptions': data['target_health'][cmd.split()[-1]]}
        if 'describe-listeners' in cmd:
            return {'Listeners': data['listeners']}
        if 'describe-rules' in cmd:
            return {'Rules': data['rules'][cmd.split()[-1]]}
        raise AssertionError(cmd)
    got = D.collect(run)
    assert got == data
    assert all(c.startswith('aws elbv2 describe-') for c in calls)


def test_tables_copy_values_from_describe():
    t = D.build_tables(_data())
    tg = {r[0]: r for r in t['ターゲットグループ'][1]}
    assert tg['web-tg'][5] == '/index.html' and tg['web-tg'][6] == 15 and tg['api-tg'][6] == 30
    assert sorted(r[1] for r in t['ターゲット'][1]) == ['10.96.1.11', '10.96.1.12', '10.96.2.21']
    rules = t['ルール'][1]
    assert ['HTTP:80', '10', 'path-pattern = /api/*', '転送 → api-tg', 'いいえ'] in rules
    assert any(r[1] == 'default' and r[3] == '転送 → web-tg' and r[4] == 'はい' for r in rules)


def test_basic_design_has_diagram_policy_and_human_sections(tmp_path):
    files = D.generate(_data(), str(tmp_path), 'テスト', '2026-11-22')
    md = (tmp_path / 'basic-design.md').read_text(encoding='utf-8')
    assert '```mermaid' in md and 'flowchart LR' in md and '"path-pattern = /api/*"' in md
    assert '`/index.html` を 15 秒ごとに確認' in md
    assert md.count('(人が書く)') == 3 and '**未レビュー**' in md
    sheet = (tmp_path / 'parameter-sheet.md').read_text(encoding='utf-8')
    assert '| web-tg | HTTP | 8080 |' in sheet
    assert files['describe.json'] and files['basic-design.md'] and files['parameter-sheet.md']


def test_xlsx_has_all_sheets(tmp_path):
    openpyxl = pytest.importorskip('openpyxl')
    D.generate(_data(), str(tmp_path), 'テスト', '2026-11-22')
    wb = openpyxl.load_workbook(tmp_path / 'parameter-sheet.xlsx')
    assert wb.sheetnames == ['表紙', 'ロードバランサー', 'ターゲットグループ', 'ターゲット', 'リスナー', 'ルール', '改訂履歴']
    assert wb['ターゲットグループ']['F2'].value == '/index.html'
