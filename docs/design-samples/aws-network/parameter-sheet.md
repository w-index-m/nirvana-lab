# パラメータシート: サンプル商事 EC サイト 本番環境 AWS ネットワーク

> サンプル(架空の値)。`tools/design_docs/aws_network_sample.py` から作成。Excel 版は parameter-sheet.xlsx。

## VPC

| 項目 | 値 |
|---|---|
| 名前 | shop-prd-vpc |
| CIDR | 10.20.0.0/16 |
| DNS 解決 | 有効 |
| DNS ホスト名 | 有効 |
| フローログ | ALL を S3 へ(保存 1 年) |
| テナンシー | default |

## サブネット

| 名前 | 役割 | AZ | CIDR | 置くもの |
|---|---|---|---|---|
| shop-prd-pub-1a | public | 1a | 10.20.0.0/24 | ALB・NAT ゲートウェイ |
| shop-prd-pub-1c | public | 1c | 10.20.1.0/24 | ALB・NAT ゲートウェイ |
| shop-prd-fw-1a | firewall | 1a | 10.20.10.0/28 | Network Firewall エンドポイント |
| shop-prd-fw-1c | firewall | 1c | 10.20.10.16/28 | Network Firewall エンドポイント |
| shop-prd-app-1a | app | 1a | 10.20.20.0/24 | アプリケーションサーバー |
| shop-prd-app-1c | app | 1c | 10.20.21.0/24 | アプリケーションサーバー |
| shop-prd-db-1a | db | 1a | 10.20.30.0/24 | データベース |
| shop-prd-db-1c | db | 1c | 10.20.31.0/24 | データベース |

## ルートテーブル

| 名前 | 関連付け | 宛先 | 行き先 |
|---|---|---|---|
| shop-prd-rt-igw-edge | igw(エッジ関連付け) | 10.20.0.0/24 | fw-1a |
| shop-prd-rt-igw-edge | igw(エッジ関連付け) | 10.20.1.0/24 | fw-1c |
| shop-prd-rt-vgw-edge | vgw(エッジ関連付け) | 10.20.0.0/24 | fw-1a |
| shop-prd-rt-vgw-edge | vgw(エッジ関連付け) | 10.20.1.0/24 | fw-1c |
| shop-prd-rt-vgw-edge | vgw(エッジ関連付け) | 10.20.20.0/24 | fw-1a |
| shop-prd-rt-vgw-edge | vgw(エッジ関連付け) | 10.20.21.0/24 | fw-1c |
| shop-prd-rt-vgw-edge | vgw(エッジ関連付け) | 10.20.30.0/24 | fw-1a |
| shop-prd-rt-vgw-edge | vgw(エッジ関連付け) | 10.20.31.0/24 | fw-1c |
| shop-prd-rt-pub-1a | shop-prd-pub-1a | 0.0.0.0/0 | fw-1a |
| shop-prd-rt-pub-1c | shop-prd-pub-1c | 0.0.0.0/0 | fw-1c |
| shop-prd-rt-fw-1a | shop-prd-fw-1a | 0.0.0.0/0 | igw |
| shop-prd-rt-fw-1a | shop-prd-fw-1a | 192.168.0.0/16 | vgw |
| shop-prd-rt-fw-1c | shop-prd-fw-1c | 0.0.0.0/0 | igw |
| shop-prd-rt-fw-1c | shop-prd-fw-1c | 192.168.0.0/16 | vgw |
| shop-prd-rt-app-1a | shop-prd-app-1a | 0.0.0.0/0 | nat-1a |
| shop-prd-rt-app-1a | shop-prd-app-1a | 192.168.0.0/16 | fw-1a |
| shop-prd-rt-app-1c | shop-prd-app-1c | 0.0.0.0/0 | nat-1c |
| shop-prd-rt-app-1c | shop-prd-app-1c | 192.168.0.0/16 | fw-1c |
| shop-prd-rt-db-1a | shop-prd-db-1a | 192.168.0.0/16 | fw-1a |
| shop-prd-rt-db-1c | shop-prd-db-1c | 192.168.0.0/16 | fw-1c |

## SG

| SG | 向き | プロトコル | ポート | 相手 | 目的 |
|---|---|---|---|---|---|
| shop-prd-sg-alb | in | tcp | 443 | 0.0.0.0/0 | HTTPS |
| shop-prd-sg-alb | in | tcp | 80 | 0.0.0.0/0 | HTTPS へ転送するため |
| shop-prd-sg-alb | out | tcp | 8080 | shop-prd-sg-app | ターゲットへ |
| shop-prd-sg-app | in | tcp | 8080 | shop-prd-sg-alb | ALB から |
| shop-prd-sg-app | in | tcp | 22 | 192.168.100.0/24 | 運用端末から |
| shop-prd-sg-app | out | tcp | 5432 | shop-prd-sg-db | DB へ |
| shop-prd-sg-app | out | tcp | 443 | 0.0.0.0/0 | 外部 API・更新(Firewall で絞る) |
| shop-prd-sg-db | in | tcp | 5432 | shop-prd-sg-app | アプリから |

## DX

| 接続 | ロケーション | 帯域 | 種類 | VIF | VLAN | オンプレ ASN | AWS 側 IP | オンプレ側 IP | コミュニティ | 役割 |
|---|---|---|---|---|---|---|---|---|---|---|
| shop-dxcon-a | DX ロケーション A(東京) | 1Gbps | 専用接続 | shop-vif-a | 101 | 65010 | 169.254.10.1/30 | 169.254.10.2/30 | 7224:7300(高) | 主系 |
| shop-dxcon-b | DX ロケーション B(大阪) | 1Gbps | 専用接続 | shop-vif-b | 102 | 65010 | 169.254.20.1/30 | 169.254.20.2/30 | 7224:7100(低) | 副系 |
| DX ゲートウェイ | shop-dxgw |  |  |  |  |  | Amazon 側 ASN 64512 |  | 許可: 10.20.0.0/16 |  |

## ALB

| 区分 | 項目 | 値 |
|---|---|---|
| 本体 | 名前 | shop-prd-alb |
| 本体 | 種類 | internet-facing |
| 本体 | サブネット | shop-prd-pub-1a・shop-prd-pub-1c |
| 本体 | SG | shop-prd-sg-alb |
| リスナー | HTTP 80 | HTTPS:443 へ 301 で転送 / - |
| リスナー | HTTPS 443 | shop-prd-tg-app へ転送 / ELBSecurityPolicy-TLS13-1-2-2021-06 / ACM 証明書 *.shop.example.jp |
| 属性 | idle_timeout.timeout_seconds | 60 |
| 属性 | deletion_protection.enabled | true |
| 属性 | routing.http.drop_invalid_header_fields.enabled | true |
| 属性 | routing.http.xff_header_processing.mode | append |
| 属性 | access_logs.s3.enabled | true(shop-prd-alb-logs) |
| ターゲットグループ | 名前 | shop-prd-tg-app |
| ターゲットグループ | プロトコル・ポート | HTTP 8080 |
| ヘルスチェック | path | /healthz |
| ヘルスチェック | matcher | 200 |
| ヘルスチェック | interval | 30 秒 |
| ヘルスチェック | timeout | 5 秒 |
| ヘルスチェック | healthy_threshold | 5 |
| ヘルスチェック | unhealthy_threshold | 2 |

## NAT

| 名前 | サブネット | 種類 | EIP |
|---|---|---|---|
| shop-prd-nat-1a | shop-prd-pub-1a | パブリック | shop-prd-eip-nat-1a |
| shop-prd-nat-1c | shop-prd-pub-1c | パブリック | shop-prd-eip-nat-1c |

## WAF

| 優先度 | ルール | 中身 | 動作 | WCU(要確認) |
|---|---|---|---|---|
| 10 | AWSManagedRulesAmazonIpReputationList | 評判の悪い IP | 最初は Count → Block | 25 |
| 20 | AWSManagedRulesCommonRuleSet | 一般的な攻撃(OWASP 系) | 最初は Count → Block | 700 |
| 30 | AWSManagedRulesKnownBadInputsRuleSet | 既知の悪い入力 | 最初は Count → Block | 200 |
| 40 | AWSManagedRulesSQLiRuleSet | SQL インジェクション | 最初は Count → Block | 200 |
| 50 | shop-prd-rate-limit | 同じ IP から 5 分に 2,000 回を超えたら | Block | 2 |

## NFWポリシー

| 項目 | 値 |
|---|---|
| ファイアウォール | shop-prd-nfw |
| ポリシー | shop-prd-nfw-policy |
| エンドポイントのサブネット | shop-prd-fw-1a・shop-prd-fw-1c |
| 評価の順 | STRICT_ORDER |
| ステートレスの既定 | aws:forward_to_sfe |
| ステートフルの既定 | aws:drop_established + aws:alert_established |
| HOME_NET | 10.20.0.0/16・192.168.0.0/16 |
| ログ | ALERT と FLOW を S3 へ(ALERT は CloudWatch Logs にも) |
| TLS 検査 | 使わない(必要になったら別途設計) |

## NetworkFirewall

| ルールグループ | 優先度 | 動作 | プロトコル | 送信元 | 宛先 | ポート | 目的 |
|---|---|---|---|---|---|---|---|
| shop-prd-rg-5tuple | 100 | pass | TCP | ANY | 10.20.0.0/23 | 443 | インターネット → ALB(HTTPS) |
| shop-prd-rg-5tuple | 100 | pass | TCP | ANY | 10.20.0.0/23 | 80 | インターネット → ALB(HTTPS へ転送) |
| shop-prd-rg-5tuple | 100 | pass | TCP | 192.168.100.0/24 | 10.20.20.0/23 | 22 | 運用端末 → アプリ(SSH) |
| shop-prd-rg-5tuple | 100 | pass | TCP | 192.168.0.0/16 | 10.20.20.0/23 | 443 | オンプレ → アプリ(社内向け API) |
| shop-prd-rg-5tuple | 100 | drop | IP | 192.168.0.0/16 | 10.20.30.0/23 | ANY | オンプレ → DB は止める(ログに残すため明示) |
| shop-prd-rg-egress-domains | 200 | pass | TLS/HTTP | 10.20.0.0/23(NAT) | .amazonaws.com | 443 | AWS の API |
| shop-prd-rg-egress-domains | 200 | pass | TLS/HTTP | 10.20.0.0/23(NAT) | api.payment.example.com | 443 | 決済サービス(架空) |
| shop-prd-rg-egress-domains | 200 | pass | TLS/HTTP | 10.20.0.0/23(NAT) | (OS 更新の配布元: 要決定) | 443 | OS の更新 |

## 試験

| 試験 | やること | 期待する結果 | 確かめるもの |
|---|---|---|---|
| インターネット → ALB 443 | https://www.shop.example.jp/ | 200 が返る | ALB アクセスログ・NFW の FLOW |
| インターネット → ALB 80 | http://www.shop.example.jp/ | 301 で https へ | ALB アクセスログ |
| インターネット → アプリ直接 | アプリの IP へ 8080 | 届かない(パブリック IP なし) | - |
| WAF: SQL インジェクション | ?id=1' OR '1'='1 | Count 期間はログのみ、Block 後は 403 | WAF ログ |
| WAF: 回数制限 | 同じ IP から 5 分に 2,000 回超 | 403 | WAF ログ・BlockedRequests |
| アプリ → 許可ドメイン | curl https://(許可した宛先) | 通る(送信元は NAT の EIP) | NFW の FLOW |
| アプリ → 許可外ドメイン | curl https://www.example.org | 止まる | NFW の ALERT |
| 運用端末 → アプリ 22 | ssh(192.168.100.0/24 から) | 通る | NFW の FLOW・VPC フローログ |
| 一般端末 → アプリ 22 | ssh(192.168.1.0/24 から) | 止まる | NFW の ALERT |
| オンプレ → DB 5432 | psql | 止まる | NFW の ALERT |
| アプリ → DB 5432 | psql | 通る(VPC 内は SG で制御、NFW は通らない) | VPC フローログ |
| DX 主系の断 | 主系 VIF を止める | 副系で継続。切り替わりの時間を記録 | BGP の状態・ping の欠け |
| AZ 1a の停止を想定 | 1a のアプリを止める | ALB が 1c だけに送る | UnHealthyHostCount |
