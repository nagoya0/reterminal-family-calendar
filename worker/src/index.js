// 実家の電子ペーパー端末へカレンダー画像を配信する。
//
// 画像は image.js としてビルド時に生成され、このスクリプトに同梱される。
// PNG が数KBしかないため R2 や KV を介さない。依存サービスが減る。
// image.js は家族の予定を含むため git には入れない（.gitignore 済み）。
import { PNG_BASE64, BUILT_AT } from './image.js';

/** 端末が設置される国。ここ以外からのアクセスは受け付けない。 */
const ALLOWED_COUNTRY = 'JP';

/**
 * トークン比較は長さと内容の両方を一定時間で行う。
 * 応答時間の差から正解の文字数を推測されるのを防ぐため。
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

let cachedBytes = null;

function pngBytes() {
  if (cachedBytes) return cachedBytes;
  const binary = atob(PNG_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  cachedBytes = bytes;
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
    if (!env.ACCESS_TOKEN) return notFound;
    if (!tokenMatches(bearerToken(request), env.ACCESS_TOKEN)) return notFound;

    return new Response(pngBytes(), {
      headers: {
        'Content-Type': 'image/png',
        // 端末は1日1回しか取りに来ない。古い画像を掴ませない。
        'Cache-Control': 'no-store',
        // 表示が止まったとき、いつ生成された画像かを追えるようにする
        'X-Built-At': BUILT_AT,
      },
    });
  },
};
