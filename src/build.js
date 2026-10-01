// 本番の入口: カレンダー取得 → 今日から DAYS_AHEAD 日分（既定3日）を描画 →
// Worker 用モジュールを生成。
//
//   npm run build            dist/ に書き出してブラウザで開く
//   npm run build -- --no-open
//
// 先の日の分まで作るのは、端末が日付の変わった直後（00:30 頃）に取りに来るため。
// その時点で「その日の画像」が用意できている必要があるが、日付が変わってから
// 生成したのでは間に合わない。前日の夜のうちに翌日以降の分も作っておき、
// どれを返すかは Worker が日付で判断する。3日分あれば、Actions が何回か
// 落ちても画面は止まらない。
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fetchEvents } from './gcal.js';
import { fetchForecast } from './weather.js';
import { renderHtml } from './render.js';
import { screenshotAll, toMonochrome } from './shoot.js';
import { ymd, addDays, describeDay, startOfDay } from './datetime.js';
import { eventsForDay, timeLabel } from './events.js';
import { LOG_DETAILS, mask } from './logging.js';

const OUT = 'dist';

/**
 * 何日分の画像を作るか。DAYS_AHEAD 環境変数で変えられる。
 *
 * 端末は「今日の画像」を取りに来るので、最低でも1日分あればよい。
 * 多めに作るのは GitHub Actions の cron が遅延・破棄されうるため。
 * 3日分あれば、丸一日ぶんの実行が失われても前日以前の生成分で当日の
 * 画像が存在する。1枚あたり3KB 程度なので増やす負担は小さい。
 */
const DAYS_AHEAD = Number(process.env.DAYS_AHEAD) || 3;

/** 右列「今後の予定」が何日先まで見るか。render.js の UPCOMING_DAYS に合わせる。 */
const UPCOMING_SPAN = 30;

const calendarId = process.env.CALENDAR_ID ?? process.argv[2];
if (!calendarId) {
  console.error('CALENDAR_ID が未設定です（.env か引数で渡してください）');
  process.exit(1);
}

const now = new Date();
const today = ymd(now);

// 先の日付の画像も同じ範囲の予定を見るので、その分多く取る。
// 天気の取得に失敗しても予定だけは出す。表示が丸ごと止まる方が損失が大きい。
const [events, forecast] = await Promise.all([
  fetchEvents(calendarId, { now, days: UPCOMING_SPAN + DAYS_AHEAD }),
  fetchForecast({ days: DAYS_AHEAD }).catch((e) => {
    console.warn(`天気の取得に失敗しました: ${e.message}`);
    return [];
  }),
]);

// 取得内容をログに残す。画像だけでは何を描いたか後から追えないため。
//
// ただし予定名とカレンダーIDは既定では出さない。日付ごとの件数だけでも
// 「取得できているか」「どの日に描かれるはずか」は追えるので、障害の
// 切り分けには足りる。伏字の方針は logging.js を参照。
//
// カレンダーIDは Actions では Secrets 由来なのでログ側でも伏せられるが、
// それに頼らず出力側でも伏せる。ローカルや別のCIでは伏せられないため。
console.log(`取得: ${events.length} 件 (${mask(calendarId)})`);
for (let i = 0; i < 8; i++) {
  const key = addDays(today, i);
  const d = describeDay(key);
  const day = eventsForDay(events, key);
  const label = `${d.month}/${d.day}(${d.weekday})`.padEnd(10);

  if (day.length === 0) {
    console.log(`  ${label} —`);
  } else if (LOG_DETAILS) {
    console.log(`  ${label} ${day.map((e) => `${timeLabel(e, key)} ${e.title}`).join(' / ')}`);
  } else {
    console.log(`  ${label} ${day.length}件`);
  }
}

mkdirSync(OUT, { recursive: true });

// 各日の HTML をまとめて作ってから一括で撮る。ブラウザの起動は1回で済む。
const keys = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
const htmls = keys.map((key) =>
  // その日の朝を基準に描く。時刻そのものは表示に使っていないが、
  // 「今日」「明日」の判定に使われる。
  renderHtml(
    events,
    new Date(startOfDay(key).getTime() + 6 * 3600 * 1000),
    forecast.find((f) => f.date === key) ?? null,
  ),
);

const shots = await screenshotAll(htmls);
const images = {};

console.log('');
for (const [i, key] of keys.entries()) {
  const png = await toMonochrome(shots[i]);
  images[key] = png.toString('base64');

  // 今日の分だけは従来どおり dist に置く（実物大印刷や目視確認に使う）
  if (i === 0) writeFileSync(`${OUT}/calendar.png`, png);
  console.log(`  ${key} の画像: ${png.length} bytes`);
}

// Worker に埋め込むモジュール。どの日の画像かをキーに持たせ、
// 実際にどれを返すかは Worker が JST の現在日付で決める。
// このファイルは家族の予定を含むので git には入れない（.gitignore 済み）。
const module = `// 自動生成。編集しない。npm run build で再生成される。
export const IMAGES = ${JSON.stringify(images, null, 2)};
export const BUILT_AT = '${now.toISOString()}';
`;
mkdirSync('worker/src', { recursive: true });
writeFileSync('worker/src/image.js', module);
console.log(`\nworker/src/image.js (${module.length} bytes, ${Object.keys(images).length}日分)`);

if (!process.argv.includes('--no-open')) {
  execFileSync('open', [`${OUT}/calendar.png`]);
  console.log('開きました');
}
