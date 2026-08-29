import { ymd, addDays, describeDay } from './datetime.js';
import { eventsForDay, timeLabel } from './events.js';

/** 1日の列に表示できる最大件数。これを超えたら「ほかN件」に畳む */
const MAX_EVENTS_PER_DAY = 6;

/** 下段の帯に出す日数（明後日から6日後まで） */
const STRIP_DAYS = 5;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function renderColumn(events, dayKey, { modifier }) {
  const d = describeDay(dayKey);
  const list = eventsForDay(events, dayKey);
  const shown = list.slice(0, MAX_EVENTS_PER_DAY);
  const hidden = list.length - shown.length;

  // 予定が少ない日は文字を最大にし、2行の折り返しも許す。
  // 4件以上の日は1行・小さめに切り替える。件数が増えても列からはみ出さないことを
  // 優先する（はみ出すと途中で文字が切れて読めなくなる）。
  const dense = list.length >= 4;

  const rows = shown.map((ev) => `
        <li class="event">
          <span class="event-time">${escapeHtml(timeLabel(ev, dayKey))}</span>
          <span class="event-title">${escapeHtml(ev.title)}</span>
        </li>`).join('');

  // 「ほかN件」は一覧の外に出す。中に入れると列が埋まったとき
  // overflow で消えてしまい、予定の存在が黙って隠れる。
  const body = list.length === 0
    ? '<p class="empty">予定はありません</p>'
    : `<ul class="events">${rows}
      </ul>${hidden > 0 ? `\n      <p class="more">他${hidden}件</p>` : ''}`;

  return `
    <section class="day ${modifier}${dense ? ' dense' : ''}">
      <header class="day-head">
        <span class="day-date">${d.month}/${d.day}(${d.weekday})</span>
      </header>
      ${body}
    </section>`;
}

function renderStrip(events, todayKey) {
  const cells = [];
  for (let i = 2; i < 2 + STRIP_DAYS; i++) {
    const key = addDays(todayKey, i);
    const d = describeDay(key);
    const list = eventsForDay(events, key);
    // 帯は狭いので先頭1件だけ。時刻は付けず、複数あるときは件数で補う。
    // 表記は予定欄の「他N件」と揃える（同じ意味に別表記を混ぜない）
    const head = list[0] ? escapeHtml(list[0].title) : '—';
    const extra = list.length > 1 ? `<span class="wday-more">他${list.length - 1}件</span>` : '';
    cells.push(`
        <div class="wday">
          <div class="wday-date">${d.day === 1 ? `${d.month}/1` : d.day}<span class="wday-dow">(${d.weekday})</span></div>
          <div class="wday-body">${head}${extra}</div>
        </div>`);
  }
  return `<footer class="week">${cells.join('')}\n      </footer>`;
}

/**
 * 正規化済みイベント配列から 800×480 の HTML を組み立てる。
 * now を明示的に受け取るのは、任意の日付でプレビューできるようにするため。
 */
export function renderHtml(events, now = new Date()) {
  const todayKey = ymd(now);
  const tomorrowKey = addDays(todayKey, 1);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>family calendar</title>
<style>
${styles()}
</style>
</head>
<body>
  <div class="screen">
    <div class="days">${renderColumn(events, todayKey, { modifier: 'today' })}${renderColumn(events, tomorrowKey, { modifier: 'tomorrow' })}
    </div>
    ${renderStrip(events, todayKey)}
  </div>
</body>
</html>`;
}

/**
 * 同梱フォントの絶対 file:// URL。
 * 開発機(macOS)とビルド環境(GitHub Actions / Linux)で字幅が変わると、
 * 折り返し位置とクランプ位置がずれて調整済みのレイアウトが崩れる。
 * OS のフォントに依存せず、常にこの1ファイルだけを使う。
 */
const FONT_URL = new URL('../assets/fonts/NotoSansJP-Variable.ttf', import.meta.url).href;

function styles() {
  return `
@font-face {
  font-family: "CalendarJP";
  src: url("${FONT_URL}") format("truetype");
  font-weight: 100 900;
  font-style: normal;
}

/* 1bit 化を前提に、グレーを一切使わず #000 / #fff のみで構成する。
   アンチエイリアスも切って、閾値処理で文字が痩せるのを防ぐ。 */
* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  width: 800px; height: 480px;
  overflow: hidden;
}

body {
  background: #fff;
  color: #000;
  font-family: "CalendarJP", sans-serif;
  -webkit-font-smoothing: none;
  text-rendering: optimizeSpeed;
}

.screen { width: 800px; height: 480px; display: flex; flex-direction: column; }

/* ---- 上段: 左=きょう / 右=あした ---- */
.days { flex: 1; display: flex; min-height: 0; }

.day {
  width: 400px;
  padding: 0 16px 8px;
  display: flex; flex-direction: column;
  min-height: 0;
}
.day.tomorrow { border-left: 3px solid #000; }

.day-head {
  display: flex; align-items: center; justify-content: center;
  flex-wrap: nowrap;
  margin: 0 -16px 8px;
  padding: 5px 16px;
  overflow: hidden;
}

/* 日付は角丸の黒地に白抜き。1bit の閾値処理では曲線がギザつくが、
   細い枠線と違って「面」の境界なので階段状の粗が視覚的に目立たない。 */
.day-date {
  font-size: 28px; font-weight: 700; white-space: nowrap;
  display: inline-block;
  padding: 5px 26px;
  background: #000;
  color: #fff;
  border-radius: 999px;
}

/* ---- 予定 ---- */
.events {
  list-style: none;
  display: flex; flex-direction: column; gap: 12px;
  flex: 1; min-height: 0; overflow: hidden;
}

.event { display: flex; gap: 10px; align-items: baseline; }
.event-time  { font-size: 27px; font-weight: 700; min-width: 90px; flex-shrink: 0; }
.event-title {
  font-size: 34px; font-weight: 700; line-height: 1.18;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: auto-phrase;
}

/* 過密な日の切り替え。1行に固定して確実に収める。 */
.dense .events     { gap: 9px; }
.dense .event-time  { font-size: 23px; min-width: 78px; }
.dense .event-title { font-size: 27px; -webkit-line-clamp: 1; }

.empty { font-size: 28px; padding-top: 14px; }
.more  { font-size: 21px; font-weight: 700; padding-top: 4px; flex-shrink: 0; }

/* ---- 下段: 明後日〜6日後 ---- */
.week {
  height: 104px;
  border-top: 4px solid #000;
  display: flex;
}
.wday {
  flex: 1; min-width: 0;
  padding: 7px 8px;
  border-left: 2px solid #000;
  display: flex; flex-direction: column; gap: 3px;
}
.wday:first-child { border-left: 0; }

.wday-date { font-size: 23px; font-weight: 700; }
.wday-dow  { font-size: 17px; font-weight: 700; margin-left: 1px; }
.wday-body {
  font-size: 19px; font-weight: 700; line-height: 1.16;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.wday-more { font-weight: 700; margin-left: 4px; white-space: nowrap; }
`;
}
