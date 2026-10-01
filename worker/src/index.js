// 実家の電子ペーパー端末へカレンダー画像を配信する。
//
// 画像は image.js としてビルド時に生成され、このスクリプトに同梱される。
// PNG が数KBしかないため R2 や KV を介さない。依存サービスが減る。
// image.js は家族の予定を含むため git には入れない（.gitignore 済み）。
import { IMAGES, BUILT_AT } from './image.js';

/** 端末が設置される国。ここ以外からのアクセスは受け付けない。 */
const ALLOWED_COUNTRY = 'JP';

/**
 * トークンの内容は、一致しない位置に関わらず最後まで比べる（何文字目まで
 * 合っていたかを応答時間から推測させないため）。
 *
 * 長さが違えばその場で false を返すので、長さは応答時間から分かりうる。
 * トークンは固定長の乱数（192ビット）で、長さが知られても総当たりの手間は
 * 変わらないため、そこまでは揃えていない。
 */
function tokenMatches(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string') return false;
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Authorization: Bearer <token> からトークンを取り出す */
function bearerToken(request) {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  return match ? match[1] : '';
}

/**
 * JST の今日の日付を "YYYY-MM-DD" で返す。
 * JST は夏時間を持たず UTC+9 固定なので、エポックをずらして UTC 日付を読めばよい。
 */
function todayInJst() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const cache = new Map();

function pngBytes(base64) {
  const hit = cache.get(base64);
  if (hit) return hit;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  cache.set(base64, bytes);
  return bytes;
}

export default {
  async fetch(request, env) {
    // 失敗はすべて 404 に揃える。403 だと「そこに何かある」と教えてしまう。
    // 国で弾いたのかトークンで弾いたのかも区別させない。
    const notFound = new Response('Not Found', { status: 404 });

    // 接続元を国で絞る。トークンが漏れても地球上の大半から到達できなくなる。
    // request.cf が無いのはローカル実行時なので、その場合も拒否する（fail-closed）。
    if (request.cf?.country !== ALLOWED_COUNTRY) return notFound;

    const url = new URL(request.url);
    if (url.pathname !== '/cal') return notFound;

    // トークンはヘッダで受け取る。クエリ文字列だと URL ごとログに残るため。
    //
    // 入れ替えの間だけ ACCESS_TOKEN_OLD も受け付ける。端末は OTA で新しい値を
    // 受け取るまで古い値で取りに来るので、Worker 側を先に切り替えると画像が
    // 途切れる。どちらで通ったかをログに残し、端末が新しい値に移ったことを
    // 確かめてから ACCESS_TOKEN_OLD を消す。
    if (!env.ACCESS_TOKEN) return notFound;
    const given = bearerToken(request);
    if (tokenMatches(given, env.ACCESS_TOKEN)) {
      console.log('auth=current');
    } else if (env.ACCESS_TOKEN_OLD && tokenMatches(given, env.ACCESS_TOKEN_OLD)) {
      console.log('auth=old');
    } else {
      return notFound;
    }

    // 前日のうちに翌日分も作ってあるので、いま何日かで選び分ける。
    // これで端末は 0時ちょうどに取りに来ても正しい日付の画像を受け取れる。
    const date = todayInJst();
    const image = IMAGES[date];

    // 該当する日の画像が無い場合（生成が数日止まっているなど）は返さない。
    // 日付の違う画像を返すより、端末に前の表示を保たせる方がまし。
    // 全画面の再描画を無駄に走らせずに済む。
    if (!image) return notFound;

    return new Response(pngBytes(image), {
      headers: {
        'Content-Type': 'image/png',
        // 端末は1日1回しか取りに来ない。古い画像を掴ませない。
        'Cache-Control': 'no-store',
        // 表示が止まったとき、いつ生成された画像かを追えるようにする
        'X-Built-At': BUILT_AT,
        'X-Image-Date': date,
      },
    });
  },
};
