# AI ドリブンで AWS を作るなら

「AI ドリブン開発の裏側」の「AI ドリブンで AWS を作るなら」のスライドの元になる整理です(2026-11-22)。
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

## 次の一手(提案)

このラボの ALB の模擬装置を相手に、Terraform の AWS プロバイダーを向けて `plan`/`apply` まで通すと、本物の AWS を使わずに上の流れを一通り試せます。
ただし模擬装置は aws-cli の一部の命令(`/api/cli` 経由)しか受けないので、AWS の API(HTTPS の elasticloadbalancing エンドポイント)の形で受ける口を足す必要があります。
