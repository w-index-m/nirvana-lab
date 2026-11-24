# AI エージェントのサンドボックス — Claude だけのもの?

「AI ドリブン開発の裏側」で使った LLM サンドボックス(Claude Code のクラウドの作業場所)が、Claude だけの特別なものかを調べた記録です(2026-11-22 時点)。

**結論: Claude だけのものではありません。** AI に実際の作業(コマンドの実行・コードの変更・テスト)をさせる道具の多くが、
同じような使い捨ての作業場所を持っています。ただし同じ製品名でも、サンドボックスがあるものとないもの(利用者の PC で直接動くもの)があります。

## 製品ごとの違い

| 製品 | 使い捨ての作業場所 | どこで動くか・外への通信 |
|---|---|---|
| Claude Code(Web・クラウド版、今回の開発) | あり | Anthropic が用意したコンテナ。外への通信は許可制のプロキシ経由 |
| OpenAI Codex(クラウド版) | あり | タスクごとのコンテナ。セットアップ中だけ外に出られ、作業中の外への通信は既定でオフ(許可した宛先だけ開けられる) |
| ChatGPT のコード実行(データ分析) | あり | 会話の中の Python 専用の隔離環境。外へは基本的に出られない |
| ChatGPT のエージェント機能 | あり | 仮想の PC(ブラウザなど)で作業 |
| GitHub Copilot のコーディングエージェント(cloud agent とも呼ばれる) | あり | GitHub Actions の使い捨て環境(自前の runner も可)。外への通信はファイアウォールで制御、リポジトリの Secrets は見えない |
| AWS の Kiro(クラウドセッション・自律エージェント) | あり | 管理されたクラウドの隔離環境。外への通信は既定で制限なし(`docs/ai-driven-aws.md`) |
| Google Jules、Devin、Cursor のバックグラウンドエージェントなど | あり | それぞれのクラウドの仮想環境 |
| エディタ内の GitHub Copilot / Claude Code(PC 版) | なし | 利用者の PC で直接動く(コマンドも利用者のターミナルで実行) |
| Microsoft 365 Copilot | 一部 | Excel の Python などはクラウドで実行。開発用の作業場所という位置づけではない |

## サンドボックスを使う理由(どの製品でも共通)

- **安全**: AI がコマンドを打っても、利用者の PC や本番環境を壊さない。
- **使い捨て**: 毎回まっさらな状態から始められ、終われば片付く。
- **出入りを絞れる**: 外への通信を許可したところだけにできる。

## この開発のサンドボックスで目立った点

- **外への通信が許可制**: dl.grafana.com や api.groq.com には届かなかった。Grafana は同じ版の公式 Docker イメージから取り出し、Groq の確認はユーザーの PC で行った。
- **中で何でも試せる**: Prometheus・Loki・Grafana・Cacti・iperf3 など本物のツールを入れて確かめられる(本物の Cacti で、DB に `path_rra` が無い実バグを見つけた)。
- **一時的で、自宅の実機には触れない**: 作業は GitHub に push して残す。実機(WS-C3650)の確認はユーザーの手元で行い、画面写真で結果をもらった。
  資料 21 枚目「作るより、確かめる方が大変」は、この往復のこと。

特別なのはサンドボックスがあること自体ではなく、**その中で本物のツールを動かし、確かめながら進めた使い方**の方です。

## 出典(2026-11-22 に確認)

- GitHub Docs: [Overview of Copilot coding agent](https://docs.github.com/copilot/concepts/coding-agent/about-copilot-coding-agent)、
  [Overview of Copilot cloud agent](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent)、
  [Customizing the agent environment](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment)、
  [self-hosted runners 対応(changelog)](https://github.blog/changelog/2025-10-28-copilot-coding-agent-now-supports-self-hosted-runners)
- OpenAI: [Codex cloud environments](https://developers.openai.com/codex/cloud/environments)、
  [Agent internet access](https://developers.openai.com/codex/cloud/agent-internet)、
  [Introducing Codex](https://openai.com/index/introducing-codex/)

各製品の機能や名前はよく変わります。表の ChatGPT のコード実行・エージェント機能、Jules・Devin・Cursor、Microsoft 365 Copilot は
Claude の知識による整理で、今回は出典で確かめていません。人前で使う前に、各社の最新の説明で確かめてください。
