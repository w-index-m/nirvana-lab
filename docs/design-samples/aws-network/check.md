# 値の矛盾チェック

| チェック | 結果 | 詳しく |
|---|---|---|
| サブネットが VPC の中にある | OK |  |
| サブネットが重ならない | OK |  |
| オンプレの帯と VPC が重ならない | OK |  |
| ルートの行き先がすべて定義済み | OK |  |
| 同じ AZ の Firewall / NAT を使う | OK |  |
| 外へ出る経路は必ず Firewall を通る | OK |  |
| 行きと帰りが同じ Firewall エンドポイントを通る | OK |  |
| SG の参照先がある | OK |  |
| WAF の WCU の合計 1127 が 1500 以内(各値は要確認) | OK |  |
| DX が 2 つのロケーションに分かれている | OK |  |
| DX の主系と副系でコミュニティが違う(7224:7300 / 7224:7100) | OK |  |
| Firewall の HOME_NET に VPC とオンプレが入る | OK |  |

## ルートの行きと戻り

| 送信元 | 宛先 | 行き | 戻り |
|---|---|---|---|
| shop-prd-pub-1a | インターネット | fw-1a → igw | 戻り: igw → fw-1a(同じ) |
| shop-prd-pub-1a | オンプレ | fw-1a → vgw | 戻り: vgw → fw-1a(同じ) |
| shop-prd-pub-1c | インターネット | fw-1c → igw | 戻り: igw → fw-1c(同じ) |
| shop-prd-pub-1c | オンプレ | fw-1c → vgw | 戻り: vgw → fw-1c(同じ) |
| shop-prd-app-1a | インターネット | nat-1a → fw-1a → igw | 戻り: igw → fw-1a(同じ) |
| shop-prd-app-1a | オンプレ | fw-1a → vgw | 戻り: vgw → fw-1a(同じ) |
| shop-prd-app-1c | インターネット | nat-1c → fw-1c → igw | 戻り: igw → fw-1c(同じ) |
| shop-prd-app-1c | オンプレ | fw-1c → vgw | 戻り: vgw → fw-1c(同じ) |
| shop-prd-db-1a | インターネット | None | 出られない(設計どおり: DB は外へ出さない) |
| shop-prd-db-1a | オンプレ | fw-1a → vgw | 戻り: vgw → fw-1a(同じ) |
| shop-prd-db-1c | インターネット | None | 出られない(設計どおり: DB は外へ出さない) |
| shop-prd-db-1c | オンプレ | fw-1c → vgw | 戻り: vgw → fw-1c(同じ) |
