// 共有が成功したかを確認する。
//   npm run check                  サービスアカウントから見えるカレンダーを一覧
//   npm run check -- <カレンダーID>  そのカレンダーを直接読めるか確認して予定を表示
//
// カレンダーIDは引数が無ければ CALENDAR_ID から取る。build.js とは逆の順で、
// **引数を優先する**。npm run check は .env を読むので、env を先に見ると
// 「引数で別のカレンダーを指定したのに .env の方が使われる」が黙って起きる。
// これは特定のカレンダーを名指しで確認する道具なので、名指しの方を立てる。
//
// Actions から実行することがあり（実家からスマホで叩く用途）、そこでは
// ワークフローの入力ではなく Secrets 経由で渡す。入力にすると値が実行コマンドと
// 実行画面の両方に残り、公開リポジトリではそれがそのまま公開されるため。
//
// 出力の伏字については logging.js を参照。
import { google } from 'googleapis';
import { fetchEvents, loadCredentials } from './gcal.js';
import { ymd, addDays, describeDay } from './datetime.js';
import { eventsForDay, timeLabel } from './events.js';
import { LOG_DETAILS, mask } from './logging.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

function client() {
  const credentials = loadCredentials();
  console.log(`サービスアカウント: ${mask(credentials.client_email)}\n`);
  return google.calendar({
    version: 'v3',
    auth: new google.auth.GoogleAuth({ credentials, scopes: SCOPES }),
  });
}

const cal = client();
const calendarId = process.argv[2] ?? process.env.CALENDAR_ID;

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
    : LOG_DETAILS
      ? day.map((e) => `${timeLabel(e, key)} ${e.title}`).join(' / ')
      : `${day.length}件`;
  console.log(`   ${label} ${detail}`);
}
