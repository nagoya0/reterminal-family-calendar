// 本番の入口: カレンダー取得 → HTML → 800×480 1bit PNG。
//
//   npm run build            dist/calendar.png を書き出してブラウザで開く
//   npm run build -- --no-open
//
// カレンダーIDは CALENDAR_ID 環境変数（ローカルは .env、Actions は Secrets）。
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fetchEvents } from './gcal.js';
import { renderHtml } from './render.js';
import { screenshot, toMonochrome } from './shoot.js';
import { ymd, addDays, describeDay } from './datetime.js';
import { eventsForDay, timeLabel } from './events.js';

const OUT = 'dist';
const calendarId = process.env.CALENDAR_ID ?? process.argv[2];
if (!calendarId) {
  console.error('CALENDAR_ID が未設定です（.env か引数で渡してください）');
  process.exit(1);
}

const now = new Date();
const events = await fetchEvents(calendarId, { now, days: 7 });

// 取得できた内容をログに残す。画像だけでは何を描いたか後から追えないため。
const today = ymd(now);
console.log(`取得: ${events.length} 件 (${calendarId})`);
for (let i = 0; i < 7; i++) {
  const key = addDays(today, i);
  const d = describeDay(key);
  const day = eventsForDay(events, key);
  console.log(
    `  ${`${d.month}/${d.day}(${d.weekday})`.padEnd(10)} ` +
    (day.length === 0 ? '—' : day.map((e) => `${timeLabel(e, key)} ${e.title}`).join(' / ')),
  );
}

const png = await toMonochrome(await screenshot(renderHtml(events, now)));
mkdirSync(OUT, { recursive: true });
const path = `${OUT}/calendar.png`;
writeFileSync(path, png);
console.log(`\n${path} (${png.length} bytes)`);

// Worker に埋め込む画像モジュールを生成する。
// PNG が数KBしかないため、R2 や KV を介さずスクリプトに同梱して配信する。
// このファイルは家族の予定を含むので git には入れない（.gitignore 済み）。
const module = `// 自動生成。編集しない。npm run build で再生成される。
export const PNG_BASE64 = '${png.toString('base64')}';
export const BUILT_AT = '${now.toISOString()}';
`;
mkdirSync('worker/src', { recursive: true });
writeFileSync('worker/src/image.js', module);
console.log(`worker/src/image.js (${module.length} bytes, base64 埋め込み)`);

if (!process.argv.includes('--no-open')) {
  execFileSync('open', [path]);
  console.log('開きました');
}
