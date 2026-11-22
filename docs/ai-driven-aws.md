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

## 次の一手(提案)

このラボの ALB の模擬装置を相手に、Terraform の AWS プロバイダーを向けて `plan`/`apply` まで通すと、本物の AWS を使わずに上の流れを一通り試せます。
ただし模擬装置は aws-cli の一部の命令(`/api/cli` 経由)しか受けないので、AWS の API(HTTPS の elasticloadbalancing エンドポイント)の形で受ける口を足す必要があります。
