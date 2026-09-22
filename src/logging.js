// 公開リポジトリでは Actions の実行ログも公開される。予定名・カレンダー名・
// カレンダーIDの類がログに載ると、カレンダーの中身がそのまま読めてしまう。
// 件数と可否だけでも障害の切り分けには足りるので、既定はそちらにする。
//
// 既定を「出さない」側にしてあるのは、CI かどうかの自動判定に頼ると、
// 判定を外したときに黙って漏れるため。手元で中身まで見たいときは
// LOG_EVENT_TITLES=1 を付ける。

/** 予定名や識別子をそのまま出すか。既定は出さない（公開ログに載るため） */
export const LOG_DETAILS = process.env.LOG_EVENT_TITLES === '1';

/** 識別子を伏せる。先頭2文字だけ残して、取り違えの判別はできるようにする */
export function mask(value) {
  if (LOG_DETAILS) return value;
  const s = String(value ?? '');
  return s.length <= 2 ? '«伏字»' : `${s.slice(0, 2)}…«伏字»`;
}
