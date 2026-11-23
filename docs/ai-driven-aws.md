# AI ドリブンで AWS を作るなら

「AI ドリブン開発の裏側」(`docs/ai-driven-dev-behind-the-scenes.pptx`)の 23 枚目「AI ドリブンで AWS を作るなら」と、別資料「Kiro で AWS を作る」(`docs/ai-driven-dev-kiro.pptx`)の元になる整理です(2026-11-22)。
このラボで実際にやったことと、本番の AWS に広げるときの進め方・守ることを分けて書きます。

## このラボで実際にやったこと(AWS まわり)

| やったこと | 記録 |
|---|---|
| ALB を `aws elbv2 create-load-balancer` などの aws-cli の構文で作れる模擬装置にした。本物の HTTP でヘルスチェック・path/host ルール・stickiness・フェイルオーバーを確認 | `docs/aws-alb-load-balancer.md` |
| aws-cli が実際に読む定義(GitHub の botocore の `elbv2` サービスモデルと公式実例)と突き合わせ、`IsDefault`・`Matcher` など足りない項目を直した | 同上「本家 aws-cli マニュアルとの突き合わせ」 |
| AWS の公開 IP 範囲(`ip-ranges.json`)を取り込み、通信の宛先をリージョンごとに地図へ重ねた | `docs/world-view.md` |
| 仮想クライアント・k6 で ALB の模擬装置に負荷をかけた | `docs/k6-load-testing.md`、`docs/sandbox-performance-wall.md` |

**本物の AWS アカウントへの構築は、まだしていません。** このリポジトリには Terraform・CloudFormation・CDK のコードもありません。

## 本番の AWS に広げるときの進め方

1. **人**: 要件を言う(例: 「ALB の後ろに EC2 2 台、ヘルスチェックは /health」)。
2. **Claude**: Terraform(または CloudFormation・CDK)を書く。
3. **サンドボックス**: `terraform fmt`・`validate`・`plan` を流す。鍵が無い段階は LocalStack などの模擬環境で試す。
4. **CI**: tflint・セキュリティ検査(checkov など)を通し、`plan` の結果を PR に載せる。
5. **人**: `plan` を見て、`apply` を承認する。
6. **Claude**: `aws elbv2 describe-target-health` など describe 系で出来上がりを確かめ、記録(ドキュメント)を残す。

このラボの開発と同じく、「作る」より「確かめる」に時間がかかる前提で、3〜6 を計画に入れておきます。

## 本番の AWS で守ること

- **AI に渡す鍵は plan(読み取り)用だけ**: `apply` は人の承認のあと、別の権限で行う。
- **鍵はチャットに貼らない**: GitHub Actions の OIDC など、期限付きの権限を使う。
- **外への通信は許可制**: サンドボックスから出られる先を、AWS の API の宛先だけに絞る。
- **費用と削除(destroy)は必ず人が確かめる**。

## AWS の Kiro で開発するなら

Kiro は AWS の AI 開発ツールです(VS Code 系の Code OSS をもとにしたエディタのほか、CLI・Web がある)。
この開発(Claude Code)は試していません。以下は 2026-11-22 時点の公式ドキュメントと AWS の記事で確かめた内容です。

| Kiro の仕組み | 何をするか | この開発(Claude Code)での相当 |
|---|---|---|
| Specs(仕様) | 依頼から `requirements.md`・`design.md`・`tasks.md` を先に作り、タスクの順に実装する(仕様駆動の開発) | 要件は会話で決め、結果を `docs/` に残す |
| Steering | プロジェクトの決まりを Markdown で毎回エージェントに渡す | `CLAUDE.md` |
| Hooks | ファイルの保存・作成・削除や手動で、裏で決まった作業を走らせる(`.kiro/hooks/`) | Claude Code の hooks(例: 作業の終わりに commit・push を促す) |
| クラウドセッション / 自律エージェント | 管理されたクラウドの隔離環境で作業を続ける(CLI は `kiro-cli --cloud`)。自律エージェントはプレビュー | LLM サンドボックス(今回の作業場所) |
| MCP・Powers | 外部の道具をつなぐ。Powers には SAM(サーバーレス)など AWS 向けの手引き付きのものがある | MCP(GitHub など)・skills |

**AWS 構築に使うなら**: Specs の requirements に要件、design に構成(VPC・ALB・EC2 など)、tasks に Terraform や SAM の作業を分け、
上の「本番の AWS に広げるときの進め方」(plan → 人の承認 → apply → describe で確認)に乗せる。

**注意**: Kiro のクラウドの隔離環境は、既定で外への通信に制限がない(公式ドキュメントはプロンプトインジェクションや秘密の持ち出しの危険を挙げている)。
この開発のサンドボックスは許可制。AWS の鍵を扱うなら、通信先を絞り、読み取り用の鍵だけを渡す。

出典(2026-11-22 に確認):
[Kiro の Docs(CLI)](https://kiro.dev/docs/cli)、
[Cloud sessions](https://kiro.dev/docs/cloud-sessions/)、
[Autonomous agent の sandbox](https://kiro.dev/docs/autonomous-agent/sandbox)、
[Introducing Kiro Web](https://kiro.dev/blog/introducing-kiro-web/)、
[AWS Builder Center: specs を作業単位にする IDE](https://builder.aws.com/content/3DbBI7LQgNIcs6UUj7IPPvqFHOp/aws-kiro-the-agentic-ide-that-makes-specs-the-unit-of-work)、
[SD Times: Amazon launches spec-driven AI IDE, Kiro](https://sdtimes.com/ai/amazon-launches-spec-driven-ai-ide-kiro/)。
版の番号や提供範囲(プランごとの自律エージェントなど)はよく変わるので、使う前に最新の Docs で確かめてください。

## Kiro で AWS の構築は楽になるか・条件・必要なもの

(2026-11-22 時点の公式情報で確かめた範囲。Kiro は実際には動かしていない)

**楽になる工程**: 書く(CDK・CloudFormation・Terraform。Powers に CDK/CloudFormation・SAM・Terraform 向けの手引きと道具)、
調べる(AWS の MCP サーバーでドキュメントや今のリソース)、出す(AWS MCP Server のデプロイ手順 SOP で CDK を作り CloudFormation でデプロイ、プレビュー)。
**楽にならない・増える工程**: Specs を先に作る分、最初の工程は増える(作り直しは減る)。ネットワーク構成・権限・費用の判断と、plan・出来上がりの確認は人に残る。

**条件**: 使い始めるのは難しくない。厳しく考えるべきなのは AWS の権限の渡し方。

| 項目 | 条件 |
|---|---|
| Kiro へのサインイン | GitHub・Google・AWS Builder ID・IAM Identity Center のどれか。会社で使うなら IAM Identity Center が前提 |
| プラン | 無料枠は月 50 クレジットと少ない。本格的に使うなら有料プラン(会社なら AWS 請求の Enterprise) |
| AWS への変更 | その PC に有効な AWS の認証情報と、変更に足る IAM 権限が要る |

**AWS の変更は Kiro からできる**(方法は 2 つ): ターミナルの命令(`aws`・`cdk deploy`・`terraform apply` など)、
AWS MCP Server 経由(認証は SigV4 を MCP Proxy for AWS で、または AWS Sign-in の OAuth)。どちらも認証は Kiro ではなく、
その PC の AWS の設定(`~/.aws`・環境変数・IAM ロール)を使う。

**必要なもの**: Kiro(エディタか CLI)とサインイン用のアカウント / AWS CLI とその PC で有効な認証情報(SSO の一時的なものがよい)/
CDK 2.x か Terraform(SAM を使うならその CLI)/ MCP の設定(`~/.kiro/settings/mcp.json` か Powers)/ 作るリソースに必要な分だけの IAM 権限。

**安全のためのおすすめ**: 最初は検証用の AWS アカウントで試す / Kiro に渡す権限は読み取り用、本番への apply は人が承認してから(または CI から)/
AWS Budgets で費用の上限アラート / Kiro のクラウドの隔離環境(既定で外への通信に制限なし)に強い鍵を置かない。

## VPC・Direct Connect・ALB・NLB を Kiro で作るなら

| 部品 | Kiro に任せられること | 人がやること・決めること | 特に注意すること |
|---|---|---|---|
| VPC | CIDR・サブネット(複数 AZ)・ルートテーブル・NAT・VPC エンドポイント・フローログのコード化 | CIDR の設計(オンプレや他の VPC と重ならないか)、AZ の数、NAT の数(費用) | CIDR やサブネットを後から変えると作り直しになる。最初の設計が一番大事 |
| Direct Connect | Direct Connect ゲートウェイ、仮想ゲートウェイ / Transit Gateway との関連付け、VIF(専用接続の場合)、ルートの伝搬のコード化 | 回線の申し込み・LOA・構内の配線・事業者とのやり取り。BGP の ASN・VLAN・認証キーの取り決め。オンプレ側ルーターの BGP 設定 | 物理と契約の部分はコードにできない。ホスト型接続の受け入れなどは画面や API での操作。経路を間違えると本番通信が止まる |
| ALB | リスナー・ルール・ターゲットグループ・ヘルスチェック・セキュリティグループ・WAF の関連付け | 証明書(ACM の DNS 検証)、公開範囲、ルールの優先順位の設計 | 証明書の DNS 検証は DNS 側の作業が要る。ルールの順番を間違えると別のサーバーに振り分けられる |
| NLB | リスナー・ターゲットグループ・AZ ごとの固定 IP(EIP)・クロスゾーン・TLS のコード化 | 固定 IP が必要か、送信元 IP を残すか(ターゲットの種類で変わる)、ヘルスチェックの方式 | サブネットや EIP の変更は作り直しになりやすい。送信元 IP の扱いでサーバー側のセキュリティグループの書き方が変わる |

**この 4 つを Kiro で進めるときの決まりごと**

1. **作り直し(replace)が出たら止める**: Terraform の `plan` に「forces replacement」が出たら、人が判断するまで進めない(Steering に書くか Hooks で検出)。VPC・サブネット・NLB は特に起きやすい。
2. **Direct Connect の経路は二重に確かめる**: 広告する経路・受け取る経路・優先度(AS パスの付け足しなど)を Specs の design に表で書かせ、人がオンプレ側の設定と突き合わせる。
3. **本番への反映は作業時間を決めて CI/CD から**: VPC のルートや DX の変更は全体の通信に影響する。Kiro から直接 `apply` しない。
4. **値は表で管理する**: CIDR・ASN・VLAN・EIP などはパラメータシートを正とし、コードはそこから作る。反映後は describe で確かめる(`tools/design_docs/alb_design_docs.py` を VPC・NLB・DX 向けに広げられる)。

**このラボで先に試せること**: ALB は模擬装置で振り分け・ヘルスチェック・設計書の自動作成まで。NLB は専用の模擬は無く、
L4 の振り分けは BIG-IP の模擬装置で似た動きを確かめられる。Direct Connect のオンプレ側は、ラボの Cisco・Catalyst が
本物の BGP(TCP 179)を話すので、経路の広告・フィルター・AS パスを AWS 側役の相手と組んで事前に試せる。VPC の模擬は無い
(CIDR の重なりや経路表のチェックは小さな道具で手伝える)。

## 要件定義書も Kiro で作れるか

下書きなら作れる。ただし Kiro の `requirements.md` は「機能 1 つ分」のユーザーストーリーと受け入れ条件(EARS 形式)で、
日本の要件定義書(業務要件・機能要件・非機能要件・移行・運用・制約・前提)よりずっと狭い。

| 要件定義書の章 | Kiro の requirements.md で | 補い方 |
|---|---|---|
| 機能要件 | 得意(ユーザーストーリー + EARS の受け入れ条件) | そのまま使える。粒度は人が揃える |
| 業務要件・背景・範囲 | 依頼に書いた分だけ | Steering の章立てで項目を立て、人が埋める |
| 非機能要件 | 頼まないと薄い | IPA の非機能要求グレードを項目表として Steering に入れ、項目ごとに質問させる |
| 移行・運用・制約・前提 | ほぼ出ない | ひな形の章として持たせる |

VPC・Direct Connect・ALB・NLB の要件で聞き漏らしやすいもの: 接続する拠点と帯域、冗長(DX は 2 回線か、VPN を予備にするか)、
止まってよい時間(SLA)、既存の IP 帯との重なり、公開範囲と証明書、ログの保管期間、費用の上限。

AI は聞き漏らしを減らす役で、決めるのは業務と予算を知っている人。要件定義書は合意の書類なので、関係者のレビューと承認は省けない。

## 基本設計書・詳細設計書も Kiro で作れるか

作れる。ただし出るのは開発用の設計メモ(Markdown の `requirements.md`・`design.md`・`tasks.md`)で、日本の SIer の設計書の形そのものではない。

| 日本の設計書 | Kiro で近いもの | 足りない部分 |
|---|---|---|
| 要件定義書 | requirements.md(EARS 形式の受け入れ条件) | 非機能要件(性能・可用性・運用)は頼まないと薄くなる |
| 基本設計書 | design.md の構成・方針 | 表紙・改訂履歴・会社の章立て |
| 詳細設計書・パラメータシート | design.md の一部 | 1 項目ずつの値の表(サブネット・SG のルール・ALB の設定値など) |

会社の形に寄せる: Steering に章立てと書き方を入れる / 値は AI に考えさせず IaC のコードと describe の結果から機械的に起こす /
Word は pandoc など、Excel は小さな変換スクリプトで。気をつける: レビューは省けない、機密を外部の AI に渡してよいかは社内ルールで確認。

**ラボで実際に試した**: ALB の模擬装置の describe の出力から、基本設計書とパラメータシート(Excel)を自動で作った →
`docs/design-docs-from-describe.md`(道具は `tools/design_docs/alb_design_docs.py`、出力は `docs/design-samples/shop-alb/`)。

出典(追加分): [AWS MCP Server の Deployment SOPs](https://docs.aws.amazon.com/de_de/aws-mcp/latest/userguide/agent-sops-deployment.html)、
[Getting started with the AWS MCP Server](https://docs.aws.amazon.com/de_de/agent-toolkit/latest/userguide/getting-started-aws-mcp-server.md)、
[AWS IaC MCP Server の紹介](https://aws.amazon.com/blogs/devops/introducing-the-aws-infrastructure-as-code-mcp-server-ai-powered-cdk-and-cloudformation-assistance)、
[HashiCorp の Terraform power](https://www.hashicorp.com/blog/hashicorp-is-a-kiro-powers-launch-partner)、
[Kiro の Authentication](https://kiro.dev/docs/getting-started/authentication/)、[Kiro FAQ](https://kiro.dev/faq/index)、[Kiro Pricing](https://kiro.dev/pricing/index)。

## 操作手順: Kiro で AWS を作るまで

1. **準備(人)**: Kiro を入れてサインインし、Git のリポジトリを開く。
2. **Steering(人)**: `.kiro/steering/` に product.md・tech.md・structure.md を作らせ、会社の決まり・作り直し(replace)で止めるルールを書き足す。
3. **AWS の設定(人)**: MCP・Powers を入れ、読み取り用の AWS プロファイル(SSO)を用意する。
4. **Spec を作る(Kiro)**: 依頼から requirements → design → tasks。各段階を人が読んで承認する(`.kiro/specs/<機能>/`)。
5. **タスクを実行(Kiro)**: Supervised モード(ファイルを変えるたびに人が確認)で。Kiro の既定は Autopilot。
6. **plan まで(Kiro)**: fmt・validate・plan。作り直しが出たら止める。
7. **反映(人)**: PR → CI の検査 → 人の承認 → CI/CD から apply。
8. **確かめる(Kiro)**: describe で確認し、設計書・パラメータシートを作り直す。

## Kiro で作ったら、変更も Kiro でないとだめか

だめではない。Kiro が作るのは普通の IaC コードと Markdown で Git に入り、人の手でも他の道具でも変えられる。Kiro をやめてもインフラは動く。

- **どの道具で変えても守ること**: 変更は必ず IaC から(コンソールで直接変えない)/ ずれは定期的に見つける(terraform plan・CloudFormation のドリフト検出)/
  Kiro 以外で変えたら Spec と設計書も直す / 本番への反映はいつでも PR → CI → 人の承認 → CI/CD。
- **Kiro で変えると楽なこと**: requirements と design を直してから tasks を作らせると仕様と実物が揃ったまま残る / Steering・Hooks の決まりが毎回効く /
  前回の Spec で、なぜその構成にしたかを追える。

## 作業手順書・運用手順書も Kiro で作れるか

下書きなら作れる。IaC のコードと tasks.md・describe の結果から、コマンドと確認方法の入った手順書を起こせる。

| 手順書の章 | Kiro に書かせる中身 | 人が確かめること |
|---|---|---|
| 事前確認 | 今の状態を見る describe・plan のコマンドと、期待する結果 | 作業してよい状態か(連絡・作業時間) |
| 作業手順 | 順番どおりのコマンド(CI/CD の実行手順を含む) | 順番・待ち時間・止める条件 |
| 確認方法 | 1 手順ごとの確認コマンドと、正しいときの出力 | 期待値が実物と合っているか |
| 切り戻し | 前の版に戻す手順(前のコミットで apply など) | 本当に戻せるか(作り直しは戻せないことがある) |
| 運用(日々の手順) | 監視・アラート時の確認・証明書の更新など | 担当と連絡先、判断の基準 |

こつ: 会社の手順書のひな形を Steering に入れる / 値は現物から / 検証環境で手順書どおりに一度通してから本番へ / Direct Connect の物理作業は事業者の手順と合わせる。

出典(追加分): [Kiro Docs: Autopilot と Supervised](https://kiro.dev/docs/ide/chat/autopilot/)、[Kiro Docs: First project](https://kiro.dev/docs/getting-started/first-project/index)、
[Kiro IDE preview の changelog](https://kiro.dev/changelog/ide/0-1/)。

## Claude のようにチャットで firewall も変えられるか

できる。ただし装置にログインするのではなく、手元の PC の AWS 資格情報で、aws-cli や AWS の MCP サーバーを通して API を呼ぶ形
(セキュリティグループ・ネットワーク ACL・Network Firewall・WAF など)。効くのは Kiro に渡した権限の範囲だけ。

| やり方 | 中身 | 使ってよい場面 |
|---|---|---|
| A. チャットから直接変える | Kiro が API を呼んで変える。セキュリティグループはすぐ効き、間違えると自分の接続も切れる。コードと実物がずれ、レビューも残らない | 検証環境・調査まで |
| B. チャットで IaC を直させる | 「443 を社内だけに」と頼むと IaC のルールを書き換えて plan まで出す → 人が差分を読む → PR → CI → 人の承認 → CI/CD が反映 | 本番(Kiro に本番の書き込み権限は渡さない) |

オンプレの FortiGate・Palo Alto なども、Terraform のプロバイダがあれば B と同じ流れにできる。
このラボの Claude も同じで、模擬装置はチャットから直接変えたが、自宅の実機(WS-C3650)はユーザーが手で設定した。

## 人が入る手順は、IaC の作業の前と後か

ほぼ合っている。ただし **IaC の途中(差分を読んで承認するところ)にも人が入る**。また IaC の外の作業も人の手順として書く。

| 段階 | 人がすること |
|---|---|
| 作業前 | 変更の申請と承認・作業時間・関係者への連絡 / 今のルールを記録(describe・書き出し)/ 切り戻す条件を決める |
| 途中(承認) | plan・変更セットの差分を読む(削除・0.0.0.0/0 の許可・作り直しが無いか)/ PR とデプロイの承認。反映そのものは CI/CD で、人も Kiro も手で apply しない |
| 作業後 | 通すべき通信が通り、止めるべき通信が止まるか / ログ(VPC フローログ・Firewall のログ)で確かめる / 監視・ずれの確認、完了の連絡。だめなら切り戻し |
| IaC の外 | 相手側の firewall・Direct Connect の事業者・他チームの設定、実際の利用者での確認 |

Kiro が書くのは手順書の下書きと確認のコマンドまで。決めて・承認して・確かめるのは人。

## 設定を反映するとき、Kiro にどう頼むか

「反映して」とは頼まない。頼むのは「IaC を直して plan まで出し、PR にして」まで。本番への反映は CI/CD が行う。
例: 本番 ALB のセキュリティグループで、443 番を社内の IP だけに絞る。

**0. 先に決まりを書く**(`.kiro/steering/aws-change.md`、一度だけ。これで毎回の依頼が短くなる)

```
- apply、aws の書き込み系コマンド(authorize-*/revoke-*/delete-* など)は実行しない
- 変更するのは terraform/ の下だけ
- plan に削除・作り直し・0.0.0.0/0 の許可があれば、そこで止めて報告する
- PR の本文には、plan の要約・影響範囲・切り戻し手順・作業後の確認コマンドを書く
```

| 段階 | 依頼の例 | そのあと人がすること |
|---|---|---|
| 1. Spec を作らせる | 「本番の ALB 用 SG で、443 の受け付けを 0.0.0.0/0 から社内の 203.0.113.0/24 だけに絞りたい。対象は terraform/prod/network/sg_alb.tf。Spec を作って」 | 要件・設計・作業項目を 1 段ずつ承認 |
| 2. plan まで | 「タスクを実行して。fmt・validate・plan まで。apply はしないで。削除・作り直し・0.0.0.0/0 があれば先に教えて」 | plan の差分を読む(途中の承認) |
| 3. PR にさせる | 「feature/sg-alb-restrict でコミットして PR を作って。本文に plan の要約・影響範囲・切り戻し・確認コマンドを」 | CI → 承認 → CI/CD が反映 |
| 4. 反映後に確かめる | 「反映が終わった。describe-security-groups で 443 のルールを確認して表で。パラメータシートも更新して」 | 期待どおりかを見る |

こつ: 環境・ファイル・やりたいことを具体的に / やってほしくないことを書く / 確かめ方も頼む。
「本番の SG 直しておいて」のようなあいまいな頼み方は、権限があれば Kiro が API で直接変えてしまうおそれがある。
1 行の小さな変更なら Spec を作らずチャットで「cidr を変えて plan を見せて」でもよい(Spec は後から理由を追いたい変更向け)。
Kiro は実際には動かしていない。依頼文は公式の使い方(Spec・Steering)をもとにした例。

## Kiro が IaC を作り、人が aws-cli で入れるのか

少し違う。IaC にした場合、設定を入れるのは IaC の道具(Terraform は `terraform apply`、CloudFormation は変更セットの実行、CDK は `cdk deploy`)で、
本番ではこれを CI/CD が流す。aws-cli は作業前後の確認(`describe-*` などの読み取り)に使う。

| やり方 | 設定を入れるもの | 人の役割 | 気をつけること |
|---|---|---|---|
| IaC + CI/CD(おすすめ) | パイプラインが `terraform apply` など | 差分を読んで承認 | 承認した差分だけが入る。記録が Git に残る |
| IaC + 手で入れる | 人が `terraform apply tfplan` など | 承認したうえで自分で入れる | `plan -out` で保存した差分をそのまま入れる。CloudFormation は変更セットを確かめて実行 |
| 手順書(IaC なし) | 人が aws-cli を貼り付け | 手順書を確認して入れる | コードが無いので実物とそろわない。切り戻しは別に書く。記録は CloudTrail だけ |

CI/CD が無いときは `terraform plan -out=tfplan` → 人が差分を読む → `terraform apply tfplan`。
Kiro に頼めば aws-cli の手順書(3 つ目)も書けるが、それは IaC ではない。どのやり方でも aws-cli は「確かめる」ために使うのが基本。

## 設定の正しさは、別の AI に確かめさせればよいか

良い方法。ただし人の承認の代わりではなく、確認を一段増やすもの。次の 4 段を重ねる。

| 順番 | 何で確かめるか | 何がわかるか |
|---|---|---|
| 1 | 機械的な検査(`terraform validate`・tflint・checkov・cfn-lint・cfn-guard など) | 必ず守る規則(22 番を 0.0.0.0/0 に開けない など)。何度やっても同じ結果 |
| 2 | 別の AI が、要件定義書と plan の差分を突き合わせる | 要件とのずれ・書き間違い・影響範囲の見落とし |
| 3 | 人が差分を読んで承認 | 社内の事情に合っているか。責任は人が持つ |
| 4 | 反映後に実際の通信で確かめる(VPC Reachability Analyzer・Network Access Analyzer・実際の接続) | 本当に通るか、本当に止まるか |

- 別の AI への頼み方は「これで大丈夫?」ではなく「この要件とこの plan の差分を比べて、合わない点を全部挙げて」。
- AI だけでは足りない: 社内の事情(どの IP が本社か)は知らない / 間違っていても「問題なし」と答えることがある / 書いた設定が正しくても、通るかは別。
- このラボでも、コードを読むだけでは見つからず、動かして初めて見つかったバグが多かった。

## Kiro から AWS の状態を直接見られるか

見られる。Kiro は手元の PC で動くので、Kiro のターミナルの aws-cli か AWS の MCP サーバーで、実際の AWS を読める。渡すのは読み取りの権限だけ。

| 見るもの | 例 |
|---|---|
| 設定 | `describe-security-groups`・`describe-route-tables`・`describe-load-balancers`・`describe-target-health` |
| 状態・数値 | CloudWatch のメトリクスとアラーム、Direct Connect の接続と BGP(`describe-virtual-interfaces`) |
| 変更の記録 | CloudTrail(誰がいつ何を変えたか)、AWS Config(設定の移り変わり) |
| IaC とのずれ | `terraform plan -refresh-only`、CloudFormation のドリフト検出 |

頼み方の例: 「本番の ALB のターゲットの状態と、ALB 用 SG の 443 番のルールを読み取りだけで確認して、表にして。設定は変えないで」

使うときの決まり:
- ViewOnlyAccess・SecurityAudit など設定だけを見る権限を、SSO の一時的な資格情報で渡す(ReadOnlyAccess は S3 の中身など一部のデータそのものも読める)。
- 読んだ結果(IP・構成)は AI に送られる。Lambda の環境変数などの秘密は読ませない。
- 書き込みを本当に防ぐのは権限。Steering の決まりだけに頼らない。

このラボでも Claude は `/api/cli` で装置の状態を直接読んで確かめた。設計書の道具(`tools/design_docs/alb_design_docs.py`)も describe しか呼ばない。
Kiro そのものでは試していない(公式の使い方をもとにした整理)。

## 今の firewall の設定から AWS Network Firewall を作れるか

下書きなら作れる。大事なのは、元のルール 1 本ずつが新しい設定のどこへ移ったかの**対応表**も作らせ、人が突き合わせること。

Kiro に作らせるもの:
- Network Firewall の IaC(ファイアウォールポリシー・ステートフルのルールグループ・IP セット / ポートセット = 元の機器のアドレス / サービスオブジェクト)
- 対応表: 元のルール番号 → 新しいルール。移さないものは理由
- 確認用の通信の一覧(通るべき・止まるべき)

| 今の機器(FortiGate・Palo Alto・ASA など) | AWS 側(人が決めるところ) |
|---|---|
| ゾーン(inside・outside・DMZ) | ゾーンは無い。VPC・サブネットと、ファイアウォールのエンドポイントを通すルートテーブルで通り道を作る(一番大変) |
| 上から順に評価し、最初に一致したもので決まる | 順番を守るなら strict order を選ぶ |
| NAT | Network Firewall は NAT をしない。NAT ゲートウェイなどを別に用意する |
| IPsec VPN | Site-to-Site VPN などで別に作る |
| アプリ・ユーザーの識別、ウイルス対策、URL カテゴリ | 一部はドメインの一覧・Suricata ルール・TLS 検査で置き換える。同じにはならないものもある |
| 単純な許可ルール | セキュリティグループで足りることが多い |

貼り付ける前に:
- 会社の設定は機密。VPN の事前共有鍵・管理者パスワードのハッシュ・SNMP のコミュニティ名は消すか置き換える。必要ならグローバル IP・社内のホスト名も伏せる。
- 社外の AI に渡してよいかを社内の決まりで確かめる。Kiro のデータの扱い(学習に使われる設定など)も確認する。
- 使っていないルールが混ざっている。ヒット数を見て整理してから移すと、対応表の確認が楽になる。

進め方: 1. 機密を伏せて渡し、ルールの一覧と対応表を作らせる → 2. 人が対応表を確かめる(移さない理由・ゾーンの置き換え)→
3. IaC と plan を作らせ、機械の検査・別の AI で確かめて人が承認 → 4. 検証環境で通るべき通信・止まるべき通信を全部試す →
5. できればしばらく今の機器と並行して動かし、ログを比べてから切り替える。

このラボの模擬 FortiGate・ASA で「設定 → Network Firewall と対応表」を試すことはできる(本物の AWS は無いので、確かめられるのは変換と対応表まで)。

## Kiro 以外の AWS の AI 開発ツールとの違い

| ツール | 何のための道具か | Kiro との違い |
|---|---|---|
| Kiro(エディタ・CLI・Web) | 仕様(Specs)から入って、コード・IaC を作る | — |
| Kiro CLI | ターミナルで使う Kiro | Amazon Q Developer CLI の後継(2025-11)。`q` / `q chat` もそのまま使え、Q CLI は今後は重要なセキュリティ修正のみ |
| Amazon Q Developer | 今の IDE に足す補完・チャット、AWS コンソールでの質問・調査 | 仕様から入る作りは無い。コンソール連携は Q Developer 側の機能 |
| AWS Transform | 移行・モダナイズ専用(VMware・メインフレーム・.NET) | 新しく作るのではなく、今あるものを AWS へ移す。VMware のネットワーク変換も扱う |
| AWS DevOps Agent | 運用・障害対応(原因の調査、改善の提案) | 作った後の運用の道具。2025-12 にプレビュー、2026-03 に一般提供。触れる範囲は Agent Space で決める |
| Amazon Bedrock(AgentCore) | 自分で AI エージェントを作る基盤 | 道具そのものではなく、道具を作る部品 |

**VPC・DX・ALB・NLB の仕事での使い分け**: 移す(今の VMware 環境から)= AWS Transform / 作る(要件・設計・IaC・plan、手順書・設計書の下書き)= Kiro /
相談する(コンソールで経路などを聞く)= Amazon Q Developer / 守る(障害の原因調査・改善提案)= AWS DevOps Agent / 自作する(会社独自の確認・自動化)= Amazon Bedrock。
どれを使っても、権限は最小限・本番は人の承認と CI/CD から、は同じ。Direct Connect の物理と契約はどの AI もコードにできない。

これらのツールは実際には動かしていない(2026-11-22 時点の公式情報で整理)。性能や効果の数字は AWS 自身の発表で、独立した評価ではない。

出典(追加分): [Amazon Q Developer: Kiro への移行](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/upgrade-to-kiro.md)、
[Kiro: Q からの移行](https://kiro.dev/docs/upgrade-guides/migrating-from-q/)、
[AWS ブログ: Amazon Q Developer CLI から Kiro CLI へ](https://aws.amazon.com/jp/blogs/news/kiroweeeeeeek-in-japan-day-6-amazon-q-developer-cli-to-kiro-cli)、
[Kiro IDE・Kiro CLI・Amazon Q Developer の違い](https://dev.to/kirodotdev/understanding-the-differences-kiro-ide-kiro-cli-and-amazon-q-developer-2hib)、
[AWS Transform](https://aws.amazon.com/transform/)、[AWS Transform の一般提供](https://aws.amazon.com/blogs/migration-and-modernization/aws-transform-generally-available)、
[AWS DevOps Agent(プレビュー)の発表](https://aws.amazon.com/about-aws/whats-new/2025/12/devops-agent-preview-frontier-agent-operational-excellence)、
[AWS News Blog: AWS DevOps Agent](https://aws.amazon.com/blogs/aws/aws-devops-agent-helps-you-accelerate-incident-response-and-improve-system-reliability-preview)、
[Frontier agents](https://aws.amazon.com/ai/frontier-agents)。

## 次の一手(提案)

このラボの ALB の模擬装置を相手に、Terraform の AWS プロバイダーを向けて `plan`/`apply` まで通すと、本物の AWS を使わずに上の流れを一通り試せます。
ただし模擬装置は aws-cli の一部の命令(`/api/cli` 経由)しか受けないので、AWS の API(HTTPS の elasticloadbalancing エンドポイント)の形で受ける口を足す必要があります。
