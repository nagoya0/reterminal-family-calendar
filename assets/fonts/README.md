# フォント

## NotoSansJP-Variable.ttf

サーバ側の画面描画に使う。同梱しているのは、OS のフォントに依存すると字幅が
変わり、開発機（macOS）と GitHub Actions（Ubuntu）でレイアウトがずれるため。
読み込めない場合はビルドを失敗させている（黙って別の書体に落ちる方が困る）。

- ライセンス: SIL Open Font License 1.1

## ter-u12b.bdf / ter-u14b.bdf（Terminus）

端末側で画面右上に重ねる小さな情報表示に使う。

**TTF ではなくビットマップフォント（BDF）を選んでいる。** 本文用の書体を小さく
縮めると 1bit 化で線が飛んだり潰れたりするが、BDF は特定のピクセルサイズ用に
字形が一点ずつ設計されているため、縮小も補間も起きない。Terminus は小さい
サイズでの長時間の可読性のために作られた書体で、この用途に最も適している。

`b` はボールド。細い方（`n`）より 1bit の ePaper で残りやすい。

- ライセンス: SIL Open Font License 1.1（TERMINUS-OFL.txt）
- 出典: https://terminus-font.sourceforge.net/
