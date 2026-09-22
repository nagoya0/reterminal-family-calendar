// 共有が成功したかを確認する。
//   npm run check                  サービスアカウントから見えるカレンダーを一覧
//   npm run check -- <カレンダーID>  そのカレンダーを直接読めるか確認して予定を表示
//
// このスクリプトは Actions から実行することがあり（実家からスマホで叩く用途）、
// 公開リポジトリでは実行ログも公開される。そのため予定名・カレンダー名・
// アドレスの類は既定では伏せ、件数と可否だけを出す。それだけでも
// 「共有できているか」「読めているか」は判定できる。
// 手元で中身まで見たいときは LOG_EVENT_TITLES=1 を付ける。
import { google } from 'googleapis';
import { fetchEvents, loadCredentials } from './gcal.js';
import { ymd, addDays, describeDay } from './datetime.js';
import { eventsForDay, timeLabel } from './events.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

/** 中身まで出すか。既定は出さない（公開ログに載るため） */
const showDetails = process.env.LOG_EVENT_TITLES === '1';

/** 識別子を伏せる。先頭2文字だけ残して、取り違えの判別はできるようにする */
function mask(value) {
  if (showDetails) return value;
  const s = String(value ?? '');
  return s.length <= 2 ? '«伏字»' : `${s.slice(0, 2)}…«伏字»`;
}

function client() {
  const credentials = loadCredentials();
  console.log(`サービスアカウント: ${mask(credentials.client_email)}\n`);
  return google.calendar({
    version: 'v3',
    auth: new google.auth.GoogleAuth({ credentials, scopes: SCOPES }),
  });
}

const cal = client();
const calendarId = process.argv[2];

// 1) 一覧に出るか（共有されると出ることがある。出れば ID も分かる）
const list = await cal.calendarList.list();
const items = list.data.items ?? [];
console.log(`■ 見えるカレンダー: ${items.length} 件`);
for (const it of items) {
  console.log(`   [${it.accessRole}] ${mask(it.summary)}`);
  console.log(`       ID: ${mask(it.id)}`);
}
if (items.length === 0) {
  console.log('   （0件。まだ共有されていないか、共有されても一覧には出ない状態）');
}

if (!calendarId) {
  console.log('\nカレンダーIDが分かっているなら、引数に渡すと直接確認できます:');
  console.log('   npm run check -- xxxxx@group.calendar.google.com');
  process.exit(0);
}

// 2) ID を直接指定して読めるか（これが本命の判定）
console.log(`\n■ 直接アクセス: ${mask(calendarId)}`);
try {
  const meta = await cal.calendars.get({ calendarId });
  console.log(`   ✓ 読めます: 「${mask(meta.data.summary)}」 (${meta.data.timeZone})`);
} catch (e) {
  const code = e?.code ?? e?.response?.status;
  const msg = { 404: '見つかりません。共有がまだ、またはIDが違います。',
                403: '権限がありません。共有先のアドレスが違う可能性があります。' }[code];
  console.log(`   ✗ 失敗 (${code}): ${msg ?? e.message}`);
  process.exit(1);
}

// 3) 実際の予定を7日分
const now = new Date();
const events = await fetchEvents(calendarId, { now, days: 7 });
console.log(`\n■ 今日から7日分の予定: ${events.length} 件`);
const today = ymd(now);
for (let i = 0; i < 7; i++) {
  const key = addDays(today, i);
  const d = describeDay(key);
  const day = eventsForDay(events, key);
  const label = `${d.month}/${d.day}(${d.weekday})`.padEnd(10);
  const detail = day.length === 0
    ? '—'
    : showDetails
      ? day.map((e) => `${timeLabel(e, key)} ${e.title}`).join(' / ')
      : `${day.length}件`;
  console.log(`   ${label} ${detail}`);
}
