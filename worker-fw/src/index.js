// 実家の端末へファームウェアを配信する。画像とは別の Worker にしてある。
//
// **回復手段が回復対象に依存してはいけない。** トークンを変え間違えたり画像側の
// Worker を壊したりしたとき、同じ経路にファームウェアも乗っていると、壊れた状態を
// 直すための更新が届かなくなる。実家まで USB を持って行く以外に手がなくなる。
// 経路を分けておけば画像側が全滅していても更新できる。
//
// バイナリは Workers Static Assets（無料・25MiB/ファイル）に置く。
// 1MB あるのでスクリプトに base64 で埋め込むのは無駄が大きい。
// リポジトリには入れない（ビルド成果物なので、必要なら焼き直せばよい）。

/** 端末が設置される国。ここ以外からのアクセスは受け付けない。 */
const ALLOWED_COUNTRY = 'JP';

/** ファームウェアのパス。/fw.bin は静的アセットの実体へ橋渡しする。 */
const ASSET_PATH = '/firmware.bin';

/**
 * 内容は、一致しない位置に関わらず最後まで比べる（何文字目まで合っていたかを
 * 応答時間から推測させないため）。
 *
 * 長さが違えばその場で false を返すので、長さは応答時間から分かりうる。
 * パスワードは固定長の乱数で、長さが知られても総当たりの手間は変わらないため、
 * そこまでは揃えていない。
 */
function constantTimeEquals(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string') return false;
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Authorization: Basic base64(user:pass) を検証する。
 *
 * 画像側は Bearer トークンだが、こちらはベーシック認証にせざるを得ない。
 * ESPHome の ota.http_request.flash が受け付けるのが username / password だけで、
 * 任意のヘッダを載せられないため。
 */
function basicAuthOk(request, expected) {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Basic (.+)$/.exec(header);
  if (!match) return false;
  let decoded;
  try {
    decoded = atob(match[1]);
  } catch {
    return false;
  }
  return constantTimeEquals(decoded, expected);
}

export default {
  async fetch(request, env) {
    // 失敗はすべて 404 に揃える。403 だと「そこに何かある」と教えてしまう。
    const notFound = new Response('Not Found', { status: 404 });

    // request.cf が無いのはローカル実行時なので、その場合も拒否する（fail-closed）。
    if (request.cf?.country !== ALLOWED_COUNTRY) return notFound;

    // 認証情報が未設定なら何も配らない。設定漏れで全世界に公開されるのを防ぐ。
    //
    // 入れ替えの間だけ FW_PASSWORD_OLD も受け付ける。新しい値を焼いたファームは
    // 古い値で取りに来るしかないので、両方通さないと更新そのものが届かない。
    // 端末が新しい値に移ったことをログで確かめてから FW_PASSWORD_OLD を消す。
    if (!env.FW_USER || !env.FW_PASSWORD) return notFound;
    if (basicAuthOk(request, `${env.FW_USER}:${env.FW_PASSWORD}`)) {
      console.log('auth=current');
    } else if (env.FW_PASSWORD_OLD
      && basicAuthOk(request, `${env.FW_USER}:${env.FW_PASSWORD_OLD}`)) {
      console.log('auth=old');
    } else {
      return notFound;
    }

    const { pathname } = new URL(request.url);

    // 端末はまずここを見て、自分のビルド時刻と違えば取りに来る。
    // ビルド時刻は ESPHome がバイナリに焼き込んでおり、端末は自分の値を知っている。
    // MD5 と違って循環しないので、版番号を別に用意する必要がない。
    if (pathname === '/fw.version') {
      if (!env.FW_VERSION) return notFound;
      return new Response(env.FW_VERSION, {
        headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
      });
    }

    // ota.http_request.flash は md5 か md5_url のどちらかを必ず要求する。
    // 受信しながら計算した MD5 と照合して、壊れたものを書き込まないようにしている。
    if (pathname === '/fw.md5') {
      if (!env.FW_MD5) return notFound;
      return new Response(env.FW_MD5, {
        headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
      });
    }

    if (pathname === '/fw.bin') {
      // 静的アセットを直接公開せず、認証を通してからここで橋渡しする。
      const asset = await env.ASSETS.fetch(new URL(ASSET_PATH, request.url));
      if (!asset.ok) return notFound;
      return new Response(asset.body, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'no-store',
        },
      });
    }

    return notFound;
  },
};
