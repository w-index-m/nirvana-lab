# 模擬 IPCOM の設定 → AWS Network Firewall(下書き・対応表・確認用の通信)

Kiro の資料 21・22 枚目「今の firewall から Network Firewall を作れる?」を、このラボで実際にやってみた記録です。
道具は `tools/fw_migrate/ipcom_to_nfw.py`、元にした模擬設定は `tools/fw_migrate/samples/ipcom-mock.conf`、
出力の見本は `docs/fw-migrate-samples/ipcom-hq/` です。

## 何をするか

```bash
python3 tools/fw_migrate/ipcom_to_nfw.py tools/fw_migrate/samples/ipcom-mock.conf --out docs/fw-migrate-samples/ipcom-hq
```

| 出力 | 中身 |
|---|---|
| `rule_group.json` | CreateRuleGroup の入力(5 つの組み合わせのステートフルルール、`STRICT_ORDER`) |
| `firewall_policy.json` | CreateFirewallPolicy の入力(暗黙の deny → `aws:drop_strict`、ログ付きの drop があれば `aws:alert_strict`) |
| `main.tf` | 同じ内容の Terraform |
| `mapping.md` / `mapping.csv` | 対応表: 元のルール 1 本ずつ → 新しいルール(sid)。状態は 移した / 要確認 / 移さない、理由つき |
| `test_flows.md` | 確認用の通信。**元の機器の判定と新しいルールの判定を両方計算して比べる** |
| `report.md` | まとめ: 数、形の確認、違いが出た通信、伏せた行、移さない行、人が決めること |

方針:

- 値は設定から機械的に写す(AI に考えさせない)。分からない行は「人が判断」に回す。
- パスワード・コミュニティ名・事前共有鍵の行は、**出力に値を一切出さない**(行番号と種類だけ)。
- sid は「元のルール番号 × 100 + 枝番」にして、新しいルールから元のルールをたどれるようにした。
- 元の機器は「インタフェースごとに上から順、一致が無ければ暗黙の deny」。新しいルールは「1 本の並びを上から(STRICT_ORDER)」。
  この 2 つの判定を同じ通信で比べることで、**インタフェースの区別が無くなったことによる違い**を見つける。

## 実行した結果(2026-11-23)

```
$ python3 tools/fw_migrate/ipcom_to_nfw.py tools/fw_migrate/samples/ipcom-mock.conf --out docs/fw-migrate-samples/ipcom-hq
ルール 6 本 → 8 本 / {'移した': 3, '要確認': 3, '移さない': 0} / 伏せた行 3 / 移さない行 1 / 通信 21 本中 違い 1 本
形の確認: {'CreateRuleGroup': 'ok', 'CreateFirewallPolicy': 'ok'}
```

- 形の確認は botocore 1.44.9(aws-cli と同じ AWS の API の型定義)で、CreateRuleGroup・CreateFirewallPolicy の入力として正しい形だと確かめた。
- **違いが 1 本見つかった**:
  - 元の機器では、LAN(lan0.1)から外への 22/tcp は、LAN 側のルール `lan-out` で許可される。
  - 新しいルールでは、WAN 側に付いていた `ssh-deny`(送信元 any → 宛先 any の 22/tcp を drop)が先に当たり、止まってしまう。
  - 元は「外から入る ssh だけ止める」つもりのルールが、インタフェースの区別が無くなって内側の通信にも効いた。
  - 対応表でも、送信元 any の外側のルール 3 本を「要確認」にしてある。
  - 直し方(人が決める): 送信元を外側のアドレスに絞る、またはルールの順番を変える。
- 機密: 3 行(管理者のパスワード、SNMP のコミュニティ名、IPsec の事前共有鍵)は値を出さず、行番号だけをレポートに出した。
  出力のどのファイルにも値が無いことはテストで確かめている。
- 移さない行: `nat static ...`(Network Firewall は NAT をしない。宛先が NAT の前と後のどちらのアドレスかを人が決める)。
  IPsec の行は、機密として伏せた方に入る。

## 確かめていないこと

- **IPCOM の構文は模擬**: 公開情報で確かめられたのは、次の骨格だけ。
  - `class-map` で条件を作り、インタフェースに `rule access <番号> in <class-map> accept audit-session-normal audit-match-none` を当てる。
  - ルールを当てると暗黙の deny が入る。
  - `match source-address ip` / `match destination-address ip` / `match destination-port 80/tcp` などの細かい書き方は、このラボで決めた模擬。
  - 富士通の公式マニュアルはこのサンドボックスからは届かず、解説記事(下の出典)も本文は読めなかった(検索結果の要約だけ)。
  - 実機の設定に使う前に、実機の版のコマンドリファレンスで確かめ、読み込みの部分を合わせる。
- `main.tf` は `terraform validate` を通していない。Terraform の AWS プロバイダを取りに行く先(registry.terraform.io)が、この環境ではブロックされている。
- 本物の AWS には入れていない。確かめたのは、変換と、API の入力の形と、2 つの判定の比べ合わせまで。
- REJECT の TCP 以外での振る舞い、ログの設定(flow / alert の送り先)、VPC・ルートテーブルの設計は、人が決める項目としてレポートに出すだけ。

模擬 IPCOM の装置(`device_type: ipcom`)は以前ユーザーの依頼で削除しており、今回も戻していない。
変換は設定の文字だけを読む。

## 出典

- 検索結果: [【IPCOM】ファイアウォールのルール設定方法と具体的なコマンド](https://mizusibuki.com/ipcom-firewallrule/)(本文は取得できず、検索結果の要約のみ)
- AWS Network Firewall の API の型定義: botocore 1.44.9 の `network-firewall` サービスモデル(StatefulAction は PASS / DROP / ALERT / REJECT、RuleOrder は DEFAULT_ACTION_ORDER / STRICT_ORDER など)
