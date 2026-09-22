# reTerminal E1001 工場出荷ファームウェアのバックアップ

ESPHome を書き込む前に、フラッシュ全体を吸い出したもの。
**一度上書きすると二度と取得できない**ので、戻したくなったときのために保管している。

取得日: 2026-08-31

> **ダンプ本体はこのリポジトリに含めない。** 手元のみで保管している（理由は末尾の「なぜ
> リポジトリに置かないか」を参照）。ここに残しているのは取得と復元の手順だけ。

## ファイル

| | |
|---|---|
| `factory-firmware-e1001.bin.gz` | gzip 圧縮済み（1.0MB）。リポジトリ外で保管 |
| 展開後のサイズ | 32,047,104 bytes（フラッシュ全体 32MB のうち使用範囲 0x0〜0x1e90000） |
| 展開後の SHA-256 | `02a10603a2d5b021caa3bf8d4cb7f4bcdab647f45113909a3d0ebd66a1226d11` |

32MB が 1MB まで縮むのは、大半が `0xFF` の空き領域だから。

## 取得した個体

```
チップ    ESP32-S3 (QFN56) rev v0.2
機能      Wi-Fi, BT 5 (LE), Dual Core + LP Core, 240MHz, PSRAM 8MB (octal)
フラッシュ 32MB (Manufacturer ef / Device 4019)
MAC       44:bd:8d:xx:xx:xx   （完全な値は手元のダンプ側に記録）
```

MAC が違う個体に書き戻すと、NVS に含まれる個体固有の情報が食い違う可能性がある。

## 工場出荷時のパーティション構成

ESPHome は独自のパーティションテーブルを書くため、この構成は上書きされる。

```
nvs       data  nvs       0x009000    500KB
otadata   data  otadata   0x086000      8KB
phy_init  data  phy       0x088000      4KB
app0      app   ota_0     0x090000  12288KB
app1      app   ota_1     0xc90000  12288KB
spiffs    data  spiffs    0x1890000  6144KB
```

## 復元手順

```bash
gunzip -c factory-firmware-e1001.bin.gz > /tmp/restore.bin
esptool --port /dev/cu.usbserial-3120 --baud 230400 \
  write-flash 0x0 /tmp/restore.bin
```

**`--baud 230400` を必ず指定すること。** この個体は CH340K の USB-UART ブリッジを
UART0 で使っており、macOS のドライバとの組み合わせで **460800 以上だと連続転送が壊れる**。
実際、最初 460800 で吸い出そうとして 0.0% の時点で
`Serial data stream stopped: Possible serial noise or corruption` で失敗した。
230400 では 1557 秒かけて完走している。esptool の既定値は速すぎるので信用しない。

ポート名 `/dev/cu.usbserial-3120` は接続のたびに変わりうる。`ls /dev/cu.*` で確認する。

## 取得に使ったコマンド

```bash
esptool --port /dev/cu.usbserial-3120 --baud 230400 \
  read-flash 0x0 0x1e90000 factory-firmware-e1001.bin
```

## なぜリポジトリに置かないか

理由は2つあり、どちらか一方でも置かない判断になる。

**1. NVS に認証情報が残る。** フラッシュ全体のダンプなので NVS 領域（0x9000 から 500KB）が
そのまま入る。ここには工場ファームが動いていた時点の `sta.ssid` / `sta.pswd`、接続先 AP の
BSSID、BLE の Identity Resolving Key が平文で残っている。とくに BSSID は公開の Wi-Fi 測位
データベースで位置に逆引きできるため、ダンプ1つで設置場所が割れる。

**2. ベンダの配布物である。** 工場出荷イメージは Seeed Studio の著作物で、再配布を許諾する
ライセンスは示されていない。

ダンプを取ったら、まず NVS を確認する。`esptool read-flash` で吸っただけのバイナリは、
見た目がバイナリなので中身を意識しにくいが、認証情報は平文で入っている。
