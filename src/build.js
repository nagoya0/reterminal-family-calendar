// 本番の入口: カレンダー取得 → 今日と明日の2枚を描画 → Worker 用モジュールを生成。
//
//   npm run build            dist/ に書き出してブラウザで開く
//   npm run build -- --no-open
//
// 2枚作るのは、端末を 0時ちょうどに起こして画面を切り替えるため。
// 端末が取りに来る時点より前に「その日の画像」が用意できている必要があるが、
// 0時を過ぎてから生成したのでは間に合わない。前日のうちに翌日分も作っておき、
// どちらを返すかは Worker が日付で判断する。
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fetchEvents } from './gcal.js';
import { renderHtml } from './render.js';
import { screenshot, toMonochrome } from './shoot.js';
import { ymd, addDays, describeDay, startOfDay } from './datetime.js';
import { eventsForDay, timeLabel } from './events.js';

const OUT = 'dist';

/** 作る日数。今日と明日。 */
const DAYS_AHEAD = 2;

const calendarId = process.env.CALENDAR_ID ?? process.argv[2];
if (!calendarId) {
  console.error('CALENDAR_ID が未設定です（.env か引数で渡してください）');
  process.exit(1);
}

const now = new Date();
const today = ymd(now);

// 明日の画像にも「明後日から6日後」の帯が要るので、1日分多く取る
const events = await fetchEvents(calendarId, { now, days: 7 + DAYS_AHEAD - 1 });

// 取得内容をログに残す。画像だけでは何を描いたか後から追えないため。
console.log(`取得: ${events.length} 件 (${calendarId})`);
for (let i = 0; i < 7 + DAYS_AHEAD - 1; i++) {
  const key = addDays(today, i);
  const d = describeDay(key);
  const day = eventsForDay(events, key);
  console.log(
    `  ${`${d.month}/${d.day}(${d.weekday})`.padEnd(10)} ` +
    (day.length === 0 ? '—' : day.map((e) => `${timeLabel(e, key)} ${e.title}`).join(' / ')),
  );
}

mkdirSync(OUT, { recursive: true });
const images = {};

for (let i = 0; i < DAYS_AHEAD; i++) {
  const key = addDays(today, i);
  // その日の朝を基準に描く。時刻そのものは表示に使っていないが、
  // 「今日」「明日」の判定に使われる。
  const base = new Date(startOfDay(key).getTime() + 6 * 3600 * 1000);
  const png = await toMonochrome(await screenshot(renderHtml(events, base)));
  images[key] = png.toString('base64');

  // 今日の分だけは従来どおり dist に置く（実物大印刷や目視確認に使う）
  if (i === 0) writeFileSync(`${OUT}/calendar.png`, png);
  console.log(`\n${key} の画像: ${png.length} bytes`);
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
