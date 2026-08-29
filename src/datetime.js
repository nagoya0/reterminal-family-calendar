// 日付まわりのユーティリティ。
//
// サーバは GitHub Actions (UTC) で動き、開発機は JST という前提があるため、
// ホストのタイムゾーンには一切依存せず、常に明示的に Asia/Tokyo で計算する。
// JST は夏時間を持たず UTC+9 固定なので、日境界は単純な加減算で求められる。

export const TZ = 'Asia/Tokyo';
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const ymdFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeFormat = new Intl.DateTimeFormat('ja-JP', {
  timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
});

/** Date → "2026-08-30"（JST基準） */
export function ymd(date) {
  return ymdFormat.format(date);
}

/** "2026-08-30" → その日の JST 0:00 を指す Date */
export function startOfDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - JST_OFFSET_MS);
}

/** "2026-08-30" の n 日後のキーを返す */
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + n));
  return ymdFormat.format(new Date(shifted.getTime() - JST_OFFSET_MS));
}

/** Date → "10:00"（JST基準） */
export function hhmm(date) {
  return timeFormat.format(date);
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** "2026-08-30" → { month: 8, day: 30, weekday: '土', isSunday, isSaturday } */
export function describeDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return {
    year: y, month: m, day: d,
    weekday: WEEKDAYS[dow],
    isSunday: dow === 0,
    isSaturday: dow === 6,
  };
}
