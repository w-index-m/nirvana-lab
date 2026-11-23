#!/usr/bin/env python3
"""
ALB の「現物」から基本設計書(Markdown)とパラメータシート(Excel・Markdown)を起こす

値は AI に考えさせず、aws-cli の describe 系の出力(JSON)から機械的に作る。
同じ命令を、次のどちらにも投げられる:

  ラボ(このエミュレータの ALB 模擬装置、/api/cli 経由):
    python3 tools/design_docs/alb_design_docs.py --lab http://127.0.0.1:8000 --device DD-ALB --out docs/design-samples/shop-alb
  本物の AWS(手元の aws-cli と認証情報を使う。読み取りの describe しか呼ばない):
    python3 tools/design_docs/alb_design_docs.py --aws --profile readonly --region ap-northeast-1 --out out/

出力:
  basic-design.md      基本設計書の下書き(構成図・方針は値から組み立て、目的・範囲などは「人が書く」欄)
  parameter-sheet.md   パラメータシート(Markdown)
  parameter-sheet.xlsx パラメータシート(Excel、openpyxl があれば。表紙・各表・改訂履歴)
  describe.json        元にした describe の出力そのもの(いつ・どこから取ったか付き)

本物の AWS での実行はまだ確かめていない(ラボの模擬装置は aws-cli と同じ形の JSON を返す)。
"""
import argparse
import datetime
import json
import os
import shlex
import subprocess
import urllib.request

HEALTH_JA = {'healthy': '正常', 'unhealthy': '異常', 'unused': '未使用', 'initial': '確認中', 'draining': '切り離し中'}


# ── 取得 ───────────────────────────────────────────────
def lab_runner(base, device, token=None):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def run(cmd):
        req = urllib.request.Request(base.rstrip('/') + '/api/cli',
                                     data=json.dumps({'device_id': device, 'command': cmd}).encode(),
                                     headers={'Content-Type': 'application/json',
                                              **({'X-Session-Token': token} if token else {})})
        with opener.open(req, timeout=30) as r:
            out = json.loads(r.read()).get('output', '')
        return json.loads(out)
    return run


def aws_runner(profile=None, region=None):
    def run(cmd):
        argv = shlex.split(cmd) + ['--output', 'json']
        if profile:
            argv += ['--profile', profile]
        if region:
            argv += ['--region', region]
        return json.loads(subprocess.run(argv, check=True, capture_output=True, text=True).stdout)
    return run


def collect(run):
    """describe 系だけを呼んで、ALB・ターゲットグループ・ターゲット・リスナー・ルールを集める(読み取りのみ)"""
    data = {'load_balancers': run('aws elbv2 describe-load-balancers').get('LoadBalancers', []),
            'target_groups': run('aws elbv2 describe-target-groups').get('TargetGroups', []),
            'target_health': {}, 'listeners': [], 'rules': {}}
    for tg in data['target_groups']:
        arn = tg['TargetGroupArn']
        data['target_health'][arn] = run(f'aws elbv2 describe-target-health --target-group-arn {arn}').get(
            'TargetHealthDescriptions', [])
    for lb in data['load_balancers']:
        ls = run(f"aws elbv2 describe-listeners --load-balancer-arn {lb['LoadBalancerArn']}").get('Listeners', [])
        data['listeners'] += ls
        for listener in ls:
            data['rules'][listener['ListenerArn']] = run(
                f"aws elbv2 describe-rules --listener-arn {listener['ListenerArn']}").get('Rules', [])
    return data


# ── 表にする ───────────────────────────────────────────
def _name_of(arn, data):
    for tg in data['target_groups']:
        if tg['TargetGroupArn'] == arn:
            return tg['TargetGroupName']
    for lb in data['load_balancers']:
        if lb['LoadBalancerArn'] == arn:
            return lb['LoadBalancerName']
    return arn


def _action(actions, data):
    out = []
    for a in actions or []:
        if a.get('Type') == 'forward':
            out.append(f"転送 → {_name_of(a.get('TargetGroupArn', ''), data)}")
        else:
            out.append(a.get('Type', ''))
    return '、'.join(out)


def _conditions(conds):
    if not conds:
        return '(既定: どのルールにも当たらないとき)'
    return '、'.join(f"{c.get('Field')} = {', '.join(c.get('Values') or [])}" for c in conds)


def build_tables(data):
    """{表の名前: (見出し, 行の並び)}"""
    t = {}
    t['ロードバランサー'] = (['名前', '種類', 'スキーム', 'DNS 名', '状態'], [
        [lb.get('LoadBalancerName'), lb.get('Type'), lb.get('Scheme'), lb.get('DNSName'),
         (lb.get('State') or {}).get('Code')] for lb in data['load_balancers']])
    t['ターゲットグループ'] = (['名前', 'プロトコル', 'ポート', 'ターゲットの種類', 'ヘルスチェック', 'パス', '間隔(秒)',
                         'タイムアウト(秒)', '正常とみなす回数', '異常とみなす回数', '成功とみなす応答'], [
        [tg.get('TargetGroupName'), tg.get('Protocol'), tg.get('Port'), tg.get('TargetType'),
         tg.get('HealthCheckProtocol'), tg.get('HealthCheckPath'), tg.get('HealthCheckIntervalSeconds'),
         tg.get('HealthCheckTimeoutSeconds'), tg.get('HealthyThresholdCount'), tg.get('UnhealthyThresholdCount'),
         (tg.get('Matcher') or {}).get('HttpCode')] for tg in data['target_groups']])
    rows = []
    for tg in data['target_groups']:
        for d in data['target_health'].get(tg['TargetGroupArn'], []):
            st = (d.get('TargetHealth') or {}).get('State', '')
            rows.append([tg['TargetGroupName'], d['Target'].get('Id'), d['Target'].get('Port'),
                         f"{st}({HEALTH_JA.get(st, '')})" if st in HEALTH_JA else st])
    t['ターゲット'] = (['ターゲットグループ', 'IP / ID', 'ポート', '状態(取得時)'], rows)
    t['リスナー'] = (['ロードバランサー', 'プロトコル', 'ポート', '既定の動作'], [
        [_name_of(ls.get('LoadBalancerArn'), data), ls.get('Protocol'), ls.get('Port'),
         _action(ls.get('DefaultActions'), data)] for ls in data['listeners']])
    rows = []
    for ls in data['listeners']:
        for r in data['rules'].get(ls['ListenerArn'], []):
            rows.append([f"{ls.get('Protocol')}:{ls.get('Port')}", r.get('Priority'),
                         _conditions(r.get('Conditions')), _action(r.get('Actions'), data),
                         'はい' if r.get('IsDefault') else 'いいえ'])
    t['ルール'] = (['リスナー', '優先度', '条件', '動作', '既定のルール'], rows)
    return t


# ── 書き出す ───────────────────────────────────────────
def md_table(head, rows):
    esc = lambda v: '' if v is None else str(v).replace('|', '\\|')  # noqa: E731
    lines = ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)]
    lines += ['| ' + ' | '.join(esc(v) for v in r) + ' |' for r in rows]
    return '\n'.join(lines)


def mermaid(data):
    """クライアント → ALB → リスナー → ルール → ターゲットグループ → ターゲット"""
    ids = {}

    def nid(key):
        ids.setdefault(key, f'n{len(ids)}')
        return ids[key]
    lines = ['flowchart LR', '  client([利用者])']
    for lb in data['load_balancers']:
        lb_id = nid(lb['LoadBalancerArn'])
        lines.append(f"  {lb_id}[ALB {lb['LoadBalancerName']}]")
        lines.append(f'  client --> {lb_id}')
    for ls in data['listeners']:
        l_id = nid(ls['ListenerArn'])
        lines.append(f"  {l_id}{{{{リスナー {ls['Protocol']}:{ls['Port']}}}}}")
        lines.append(f"  {nid(ls['LoadBalancerArn'])} --> {l_id}")
        for r in data['rules'].get(ls['ListenerArn'], []):
            for a in r.get('Actions') or []:
                if a.get('Type') == 'forward':
                    label = '既定' if r.get('IsDefault') else _conditions(r.get('Conditions'))
                    lines.append(f"  {l_id} -- \"{label}\" --> {nid(a['TargetGroupArn'])}")
    for tg in data['target_groups']:
        t_id = nid(tg['TargetGroupArn'])
        lines.append(f"  {t_id}[(TG {tg['TargetGroupName']} {tg['Protocol']}:{tg['Port']})]")
        for d in data['target_health'].get(tg['TargetGroupArn'], []):
            key = f"{d['Target']['Id']}:{d['Target'].get('Port')}"
            lines.append(f"  {nid(key)}[{key}]")
            lines.append(f'  {t_id} --> {nid(key)}')
    return '\n'.join(lines)


def basic_design_md(data, tables, meta):
    tgs = data['target_groups']
    hc = '\n'.join(f"- **{tg['TargetGroupName']}**: {tg.get('HealthCheckProtocol')} で `{tg.get('HealthCheckPath')}` を "
                   f"{tg.get('HealthCheckIntervalSeconds')} 秒ごとに確認し、{(tg.get('Matcher') or {}).get('HttpCode')} を返せば正常。"
                   f"{tg.get('UnhealthyThresholdCount')} 回続けて失敗したら外し、{tg.get('HealthyThresholdCount')} 回続けて成功したら戻す"
                   for tg in tgs)
    routes = '\n'.join(f"- {r[2]} → {r[3]}(優先度 {r[1]})" for r in tables['ルール'][1])
    return f"""# 基本設計書(下書き): {', '.join(lb['LoadBalancerName'] for lb in data['load_balancers'])}

| 項目 | 内容 |
|---|---|
| 版 | 0.1(下書き) |
| 作成日 | {meta['date']} |
| 作成方法 | `tools/design_docs/alb_design_docs.py` が describe の出力から自動で作成({meta['source']}) |
| 状態 | **未レビュー**(人の確認と承認が要る) |

> この下書きの値はすべて describe の出力から機械的に起こしています。目的・範囲・非機能要件など、
> 値からは決まらない部分は「人が書く」としてあります。

## 1. 目的と範囲(人が書く)

- 目的:
- 対象の範囲 / 範囲外:
- 関係者:

## 2. 構成

```mermaid
{mermaid(data)}
```

## 3. 方針

### 3.1 負荷分散
- リスナーで受けた要求を、ルールの優先度の順に条件と照らし、当たったターゲットグループへ転送する。
- ターゲットグループの中では、正常なターゲットへ順番に振り分ける。

### 3.2 振り分けのルール
{routes}

### 3.3 ヘルスチェック
{hc}

## 4. 非機能要件(人が書く)

- 性能(想定の同時接続数・応答時間):
- 可用性(冗長化・AZ):
- 運用(監視・ログ・変更の手順):
- セキュリティ(公開範囲・証明書・セキュリティグループ):

## 5. パラメータ

詳しい値は別紙のパラメータシート(`parameter-sheet.xlsx` / `parameter-sheet.md`)を参照。

## 6. 確認事項(人が書く)

-
"""


def parameter_sheet_md(tables, meta):
    parts = [f"# パラメータシート\n\n作成日 {meta['date']}・取得元 {meta['source']}・describe の出力から自動作成(手で直さない)\n"]
    for name, (head, rows) in tables.items():
        parts.append(f"## {name}\n\n{md_table(head, rows)}\n")
    return '\n'.join(parts)


def write_xlsx(tables, meta, path):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter
    thin = Side(style='thin', color='999999')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    head_fill = PatternFill('solid', fgColor='F2A93B')
    wb = Workbook()
    ws = wb.active
    ws.title = '表紙'
    cover = [('文書名', 'パラメータシート(ALB)'), ('版', '0.1(下書き)'), ('作成日', meta['date']),
             ('取得元', meta['source']), ('作成方法', 'aws elbv2 describe-* の出力から自動作成(手で直さない)'),
             ('状態', '未レビュー')]
    ws['A1'] = 'パラメータシート(ALB)'
    ws['A1'].font = Font(size=16, bold=True)
    for i, (k, v) in enumerate(cover, start=3):
        ws.cell(i, 1, k).font = Font(bold=True)
        ws.cell(i, 2, v)
        for c in (1, 2):
            ws.cell(i, c).border = border
    ws.column_dimensions['A'].width = 14
    ws.column_dimensions['B'].width = 70
    for name, (head, rows) in tables.items():
        ws = wb.create_sheet(name[:31])
        for j, h in enumerate(head, start=1):
            c = ws.cell(1, j, h)
            c.font = Font(bold=True)
            c.fill = head_fill
            c.border = border
            c.alignment = Alignment(wrap_text=True, vertical='center')
        for i, r in enumerate(rows, start=2):
            for j, v in enumerate(r, start=1):
                c = ws.cell(i, j, v)
                c.border = border
                c.alignment = Alignment(wrap_text=True, vertical='top')
        for j, h in enumerate(head, start=1):
            width = max([len(str(h))] + [len(str(r[j - 1])) for r in rows if r[j - 1] is not None]) + 4
            ws.column_dimensions[get_column_letter(j)].width = min(60, max(10, width))
        ws.freeze_panes = 'A2'
    ws = wb.create_sheet('改訂履歴')
    for j, h in enumerate(['版', '日付', '内容', '作成者', '承認者'], start=1):
        c = ws.cell(1, j, h)
        c.font = Font(bold=True)
        c.fill = head_fill
        c.border = border
    for j, v in enumerate(['0.1', meta['date'], 'describe の出力から自動作成', '(自動)', ''], start=1):
        ws.cell(2, j, v).border = border
    ws.column_dimensions['C'].width = 40
    wb.save(path)


def generate(data, out_dir, source, date=None):
    os.makedirs(out_dir, exist_ok=True)
    meta = {'date': date or datetime.date.today().isoformat(), 'source': source}
    tables = build_tables(data)
    files = {}
    with open(os.path.join(out_dir, 'describe.json'), 'w', encoding='utf-8') as f:
        json.dump({'meta': meta, 'data': data}, f, ensure_ascii=False, indent=2)
    files['describe.json'] = True
    for name, text in (('basic-design.md', basic_design_md(data, tables, meta)),
                       ('parameter-sheet.md', parameter_sheet_md(tables, meta))):
        with open(os.path.join(out_dir, name), 'w', encoding='utf-8') as f:
            f.write(text)
        files[name] = True
    try:
        write_xlsx(tables, meta, os.path.join(out_dir, 'parameter-sheet.xlsx'))
        files['parameter-sheet.xlsx'] = True
    except ImportError:
        files['parameter-sheet.xlsx'] = False      # openpyxl が無ければ Markdown だけ
    return files


def main(argv=None):
    ap = argparse.ArgumentParser(description='ALB の describe の出力から基本設計書とパラメータシートを作る')
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--lab', help='ラボの URL(例 http://127.0.0.1:8000)')
    g.add_argument('--aws', action='store_true', help='手元の aws-cli で本物の AWS から取る(describe のみ)')
    ap.add_argument('--device', help='ラボの ALB 装置の ID')
    ap.add_argument('--token', default=os.environ.get('NETLAB_TOKEN'))
    ap.add_argument('--profile')
    ap.add_argument('--region')
    ap.add_argument('--out', required=True)
    ap.add_argument('--date', help='作成日(既定は今日)')
    a = ap.parse_args(argv)
    if a.lab:
        if not a.device:
            ap.error('--lab には --device が要ります')
        run, source = lab_runner(a.lab, a.device, a.token), f'ラボの模擬 ALB({a.device})'
    else:
        run, source = aws_runner(a.profile, a.region), f"AWS({a.profile or '既定のプロファイル'}・{a.region or '既定のリージョン'})"
    files = generate(collect(run), a.out, source, a.date)
    for name, ok in files.items():
        print(('作成: ' if ok else '作れず(openpyxl が無い): ') + os.path.join(a.out, name))


if __name__ == '__main__':
    main()
