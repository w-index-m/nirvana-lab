# Zenn 用の原稿

Zenn CLI のリポジトリと同じ並び(`articles/` と `images/`)にしてある。

- `articles/mock-nirvana.md` … 記事本文(`published: false` の下書き)。できること・できないこと
- `articles/mock-nirvana-implementation.md` … 続編の下書き。実装の工夫(Canvas 3D・プレート配置・重さ対策・リンク断の4経路・単体版との共有・テスト)。画像は `mock-nirvana/` のものを使う
- `images/mock-nirvana/` … 記事の画像。Zenn の上限 3MB に収まるよう縮めたもの(元は `docs/images/`)

Zenn と連携した GitHub リポジトリに、この2つのフォルダをそのままコピーすれば使える。
本文の画像パスは Zenn の書き方(`/images/mock-nirvana/...`)なので、GitHub 上のプレビューでは表示されない。
