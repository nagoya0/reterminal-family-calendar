import { readFileSync } from 'node:fs';
import { ymd, addDays, describeDay } from './datetime.js';
import { eventsForDay, timeLabel } from './events.js';

/**
 * 画面は左右に分ける。
 *   左 = きょうのこと（日付・気温・きょうの予定・時間帯ごとの天気）
 *   右 = 今後の予定
 *
 * 「今日を左・明日を右に大きく」という当初の構成は、実データで破綻していた。
 * 過去1年を集計すると、今日も明日も予定がない日が 54%、1日の予定は最大2件。
 * 半分以上の日で画面の上半分が「予定はありません」×2 になっていた。
 * 一方、次の予定までの日数は中央値2日、9割が6日以内にある。
 * 主役は「今日」ではなく「次に何があるか」だと実測が示している。
 *
 * 天気を入れたのは、母が家庭菜園をしており毎日見る情報だから。
 * 予定が少ない日でも画面が意味を持つ、という副次的な効果もある。
 */

/** 今後の予定を何日先まで拾うか */
const UPCOMING_DAYS = 30;

/** 右列に並べられる件数。密度によって変わる。 */
const UPCOMING_MAX = { normal: 5, dense: 7 };

/** これを超えたら小さめの表示に切り替える */
const DENSE_FROM = 6;

const FONT_URL = new URL('../assets/fonts/NotoSansJP-Variable.ttf', import.meta.url).href;
const ICON_DIR = new URL('../assets/weather-icons/', import.meta.url);

const iconCache = new Map();

/** 天気アイコンの SVG をインラインで埋め込む。塗りは黒に固定する。 */
function weatherIcon(name) {
  if (!iconCache.has(name)) {
    const svg = readFileSync(new URL(`${name}.svg`, ICON_DIR), 'utf8')
      .replace('<svg', '<svg fill="#000"');
    iconCache.set(name, svg);
  }
  return iconCache.get(name);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** 明日から UPCOMING_DAYS 日先までの予定を、日付順に平らに並べる */
function upcomingEvents(events, todayKey) {
  const out = [];
  for (let i = 1; i <= UPCOMING_DAYS; i++) {
    const key = addDays(todayKey, i);
    for (const ev of eventsForDay(events, key)) out.push({ key, ev });
  }
  return out;
}

function renderToday(events, todayKey, weather) {
  const d = describeDay(todayKey);
  const list = eventsForDay(events, todayKey);

  const body = list.length === 0
    ? '<p class="none">きょうの予定はありません</p>'
    : list.map((ev) => `
        <div class="ev">
          <div class="time">${escapeHtml(timeLabel(ev, todayKey))}</div>
          <div class="what">${escapeHtml(ev.title)}</div>
        </div>`).join('');

  const temps = weather
    ? `<span class="temp">${weather.tempMax}° / ${weather.tempMin}°</span>`
    : '';

  const bands = weather ? weather.slots.map((s) => `
        <div class="band">
          <div class="band-label">${escapeHtml(s.label)} <span class="band-hours">${s.start}-${s.start + s.span}</span></div>
          <div class="band-icon">${weatherIcon(s.icon)}</div>
          <div class="band-pop">${s.pop === null ? '—' : `${s.pop}%`}</div>
        </div>`).join('') : '';

  return `
    <div class="left">
      <header class="head">
        <span class="md">${d.month}月${d.day}日<span class="dow">(${d.weekday})</span></span>
        ${temps}
      </header>
      <div class="mine">${body}
      </div>
      ${weather ? `<footer class="weather">${bands}
      </footer>` : ''}
    </div>`;
}

function renderUpcoming(events, todayKey) {
  const all = upcomingEvents(events, todayKey);
  const dense = all.length >= DENSE_FROM;
  const shown = all.slice(0, UPCOMING_MAX[dense ? 'dense' : 'normal']);
  const hidden = all.length - shown.length;

  const rows = shown.map(({ key, ev }) => {
    const d = describeDay(key);
    return `
        <li class="row">
          <div class="when">${d.month}/${d.day}(${d.weekday})　${escapeHtml(timeLabel(ev, key))}</div>
          <div class="what">${escapeHtml(ev.title)}</div>
        </li>`;
  }).join('');

  // 「他N件」は一覧の外に出す。中に入れると列が埋まったとき overflow で消え、
  // 予定の存在が黙って隠れる。
  const body = all.length === 0
    ? '<p class="none">しばらく予定はありません</p>'
    : `<ul class="rows">${rows}
      </ul>${hidden > 0 ? `\n      <p class="more">他${hidden}件</p>` : ''}`;

  return `
    <div class="right${dense ? ' dense' : ''}">
      <h2>今後の予定</h2>${body}
    </div>`;
}

/**
 * 800×480 の HTML を組み立てる。
 * now を明示的に受け取るのは、任意の日付でプレビューできるようにするため。
 * weather は省略可（取得に失敗しても予定だけは出す）。
 */
export function renderHtml(events, now = new Date(), weather = null) {
  const todayKey = ymd(now);
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
  <div class="screen">${renderToday(events, todayKey, weather)}${renderUpcoming(events, todayKey)}
  </div>
</body>
</html>`;
}

function styles() {
  return `
/* 1bit 化を前提に、グレーを一切使わず #000 / #fff のみで構成する。
   アンチエイリアスも切って、閾値処理で文字が痩せるのを防ぐ。 */
@font-face {
  font-family: "CalendarJP";
  src: url("${FONT_URL}") format("truetype");
  font-weight: 100 900;
  font-style: normal;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html, body { width: 800px; height: 480px; overflow: hidden; }

body {
  background: #fff;
  color: #000;
  /* 同梱フォントだけを使う。OS のフォントに依存すると字幅が変わり、
     開発機とビルド環境でレイアウトがずれる。 */
  font-family: "CalendarJP", sans-serif;
  -webkit-font-smoothing: none;
  text-rendering: optimizeSpeed;
}

.screen { width: 800px; height: 480px; display: flex; }

/* ---- 左: きょうのこと ---- */
.left {
  width: 404px;
  border-right: 4px solid #000;
  display: flex; flex-direction: column;
  min-width: 0;
}

.head {
  padding: 14px 18px 10px;
  display: flex; align-items: baseline; gap: 12px;
}
.md   { font-size: 44px; font-weight: 700; white-space: nowrap; }
/* 曜日は日付より一段落として気温と同じ大きさに揃える。
   日付が主で、曜日と気温は補助という関係を字の大きさで示す。 */
.dow  { font-size: 28px; font-weight: 700; margin-left: 2px; }
.temp { font-size: 28px; font-weight: 700; margin-left: auto; white-space: nowrap; }

.mine { flex: 1; min-height: 0; padding: 0 18px; overflow: hidden; }
.ev   { margin-top: 10px; }
.time { font-size: 25px; font-weight: 700; }
.what { font-size: 33px; font-weight: 700; line-height: 1.15; word-break: auto-phrase; }
.none { font-size: 25px; font-weight: 700; margin-top: 10px; }

/* ---- 左下: 時間帯ごとの天気 ---- */
.weather { height: 170px; border-top: 4px solid #000; display: flex; }
.band {
  flex: 1; min-width: 0;
  border-left: 2px solid #000;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 2px;
}
.band:first-child { border-left: 0; }
.band-label { font-size: 24px; font-weight: 700; white-space: nowrap; }
.band-hours { font-size: 19px; font-weight: 700; }
.band-icon  { width: 86px; height: 86px; }
.band-icon svg { width: 100%; height: 100%; display: block; }
.band-pop   { font-size: 26px; font-weight: 700; }

/* ---- 右: 今後の予定 ---- */
.right {
  flex: 1; min-width: 0;
  padding: 14px 18px;
  display: flex; flex-direction: column;
}
.right h2 {
  font-size: 20px; font-weight: 700;
  border-bottom: 3px solid #000;
  padding-bottom: 3px;
  flex-shrink: 0;
}

.rows { list-style: none; flex: 1; min-height: 0; overflow: hidden;
        display: flex; flex-direction: column; gap: 14px; padding-top: 14px; }
.row .when { font-size: 22px; font-weight: 700; }
.row .what {
  font-size: 29px; font-weight: 700; line-height: 1.14;
  word-break: auto-phrase;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.right .none { font-size: 24px; font-weight: 700; padding-top: 14px; }
.more { font-size: 21px; font-weight: 700; padding-top: 4px; flex-shrink: 0; }

/* 予定が多い日は小さめに切り替える。件数が増えても列からはみ出さないことを
   優先する（はみ出すと途中で文字が切れて読めなくなる）。 */
.dense .rows { gap: 9px; }
.dense .row .when { font-size: 19px; }
.dense .row .what { font-size: 24px; -webkit-line-clamp: 1; }
`;
}
