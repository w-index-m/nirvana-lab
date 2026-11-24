# 確認用の通信(元の機器と新しいルールの判定を比べる)

| # | 通信 | 入口 | 送信元 → 宛先 | 元の機器 | 新しいルール | 一致 |
|---|---|---|---|---|---|---|
| 1 | lan0.0 100 web-in に当たる | lan0.0 | 198.51.100.7 → 172.16.20.10 80/tcp | PASS(lan0.0 で許可) | PASS(sid 10000(PASS)) | ○ |
| 2 | lan0.0 100 web-in に当たる | lan0.0 | 198.51.100.7 → 172.16.20.10 443/tcp | PASS(lan0.0 で許可) | PASS(sid 10001(PASS)) | ○ |
| 3 | lan0.0 web-in の相手に telnet | lan0.0 | 198.51.100.7 → 172.16.20.10 23/tcp | DROP(lan0.0 暗黙の deny) | DROP(aws:drop_strict) | ○ |
| 4 | lan0.0 110 mail-in に当たる | lan0.0 | 198.51.100.7 → 172.16.20.11 25/tcp | PASS(lan0.0 で許可) | PASS(sid 11000(PASS)) | ○ |
| 5 | lan0.0 mail-in の相手に telnet | lan0.0 | 198.51.100.7 → 172.16.20.11 23/tcp | DROP(lan0.0 暗黙の deny) | DROP(aws:drop_strict) | ○ |
| 6 | lan0.0 120 ssh-deny に当たる | lan0.0 | 198.51.100.7 → 192.168.10.10 22/tcp | DROP(lan0.0 in 120(drop)) | DROP(sid 12000(DROP)) | ○ |
| 7 | lan0.0 ssh-deny の相手に telnet | lan0.0 | 198.51.100.7 → 192.168.10.10 23/tcp | DROP(lan0.0 暗黙の deny) | DROP(aws:drop_strict) | ○ |
| 8 | lan0.1 200 lan-smb-block に当たる | lan0.1 | 192.168.10.10 → 198.51.100.80 445/tcp | DROP(lan0.1 in 200(reject)) | DROP(sid 20000(REJECT)) | ○ |
| 9 | lan0.1 lan-smb-block の相手に telnet | lan0.1 | 192.168.10.10 → 198.51.100.80 23/tcp | PASS(lan0.1 で許可) | PASS(sid 21000(PASS)) | ○ |
| 10 | lan0.1 210 lan-out に当たる | lan0.1 | 192.168.10.10 → 198.51.100.80 8080/tcp | PASS(lan0.1 で許可) | PASS(sid 21000(PASS)) | ○ |
| 11 | lan0.2 300 dmz-dns に当たる | lan0.2 | 172.16.20.10 → 198.51.100.80 53/udp | PASS(lan0.2 で許可) | PASS(sid 30000(PASS)) | ○ |
| 12 | lan0.2 300 dmz-dns に当たる | lan0.2 | 172.16.20.10 → 198.51.100.80 53/tcp | PASS(lan0.2 で許可) | PASS(sid 30001(PASS)) | ○ |
| 13 | lan0.2 dmz-dns の相手に telnet | lan0.2 | 172.16.20.10 → 198.51.100.80 23/tcp | DROP(lan0.2 暗黙の deny) | DROP(aws:drop_strict) | ○ |
| 14 | lan0.1 から外へ 22/tcp | lan0.1 | 192.168.10.10 → 198.51.100.80 22/tcp | PASS(lan0.1 で許可) | DROP(sid 12000(DROP)) | **×** |
| 15 | lan0.1 から外へ 25/tcp | lan0.1 | 192.168.10.10 → 198.51.100.80 25/tcp | PASS(lan0.1 で許可) | PASS(sid 21000(PASS)) | ○ |
| 16 | lan0.1 から外へ 443/tcp | lan0.1 | 192.168.10.10 → 198.51.100.80 443/tcp | PASS(lan0.1 で許可) | PASS(sid 21000(PASS)) | ○ |
| 17 | lan0.1 から外へ 80/tcp | lan0.1 | 192.168.10.10 → 198.51.100.80 80/tcp | PASS(lan0.1 で許可) | PASS(sid 21000(PASS)) | ○ |
| 18 | lan0.2 から外へ 22/tcp | lan0.2 | 172.16.20.10 → 198.51.100.80 22/tcp | DROP(lan0.2 暗黙の deny) | DROP(sid 12000(DROP)) | ○ |
| 19 | lan0.2 から外へ 25/tcp | lan0.2 | 172.16.20.10 → 198.51.100.80 25/tcp | DROP(lan0.2 暗黙の deny) | DROP(aws:drop_strict) | ○ |
| 20 | lan0.2 から外へ 443/tcp | lan0.2 | 172.16.20.10 → 198.51.100.80 443/tcp | DROP(lan0.2 暗黙の deny) | DROP(aws:drop_strict) | ○ |
| 21 | lan0.2 から外へ 80/tcp | lan0.2 | 172.16.20.10 → 198.51.100.80 80/tcp | DROP(lan0.2 暗黙の deny) | DROP(aws:drop_strict) | ○ |
