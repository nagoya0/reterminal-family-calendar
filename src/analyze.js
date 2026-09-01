// 過去のカレンダーを集計して、レイアウト設計の根拠を得る。
//
//   npm run analyze          過去12ヶ月
//   npm run analyze -- 24    過去24ヶ月
//
// 知りたいのは「画面を見た日に、次の予定まで何日あるか」。
// これが分かれば「今日・明日」を主役にすべきか「直近の予定」を
// 主役にすべきかを実データで決められる。
//
// 予定名は集計にのみ使い、出力には出さない（医療情報などを含みうるため）。
import { fetchRange } from './gcal.js';
import { ymd, addDays, startOfDay, describeDay } from './datetime.js';
import { eventsForDay } from './events.js';

const calendarId = process.env.CALENDAR_ID ?? process.argv[3];
if (!calendarId) {
  console.error('CALENDAR_ID が未設定です');
  process.exit(1);
}

const months = Number(process.argv[2]) || 12;
const now = new Date();
const today = ymd(now);
const from = startOfDay(addDays(today, -months * 30));
const to = startOfDay(addDays(today, 1));

const events = await fetchRange(calendarId, from, to);
const totalDays = months * 30;

console.log(`■ 対象期間: ${ymd(from)} 〜 ${today}（${totalDays}日）`);
console.log(`  予定の総数: ${events.length} 件`);
if (events.length === 0) {
  console.log('  予定がありません。集計できません。');
  process.exit(0);
}
console.log(`  1週間あたり平均: ${(events.length / totalDays * 7).toFixed(1)} 件`);
console.log(`  1ヶ月あたり平均: ${(events.length / totalDays * 30).toFixed(1)} 件`);

// --- 1日あたりの件数分布 ---
const perDay = [];
for (let i = -totalDays; i < 0; i++) {
  const key = addDays(today, i);
  perDay.push({ key, n: eventsForDay(events, key).length });
}
const dist = new Map();
for (const { n } of perDay) dist.set(n, (dist.get(n) ?? 0) + 1);

console.log('\n■ 1日あたりの予定件数の分布');
const maxN = Math.max(...dist.keys());
for (let n = 0; n <= maxN; n++) {
  const c = dist.get(n) ?? 0;
  if (c === 0) continue;
  const pct = (c / totalDays * 100);
  console.log(`  ${String(n).padStart(2)}件: ${String(c).padStart(4)}日 (${pct.toFixed(1).padStart(5)}%) ${'█'.repeat(Math.round(pct / 2))}`);
}
console.log(`  1日の最大: ${maxN} 件`);

// --- 現在のレイアウトが機能するか ---
// 「今日と明日の両方が空」の日は、画面の上半分が丸ごと無駄になる
let bothEmpty = 0;
for (let i = 0; i < perDay.length - 1; i++) {
  if (perDay[i].n === 0 && perDay[i + 1].n === 0) bothEmpty++;
}
console.log('\n■ いまのレイアウト（今日＋明日を大きく）の妥当性');
console.log(`  今日も明日も予定なし: ${bothEmpty}日 (${(bothEmpty / (totalDays - 1) * 100).toFixed(1)}%)`);
console.log('    → この割合の日は、画面の上半分が「予定はありません」×2 になる');

// --- 次の予定まで何日か ---
const gaps = [];
for (let i = 0; i < perDay.length; i++) {
  let g = 0;
  while (i + g < perDay.length && perDay[i + g].n === 0) g++;
  gaps.push(i + g < perDay.length ? g : null);
}
const known = gaps.filter((g) => g !== null).sort((a, b) => a - b);
const pct = (p) => known[Math.floor(known.length * p)] ?? 0;
console.log('\n■ 画面を見た日から、次の予定までの日数');
console.log(`  中央値: ${pct(0.5)}日 / 75%点: ${pct(0.75)}日 / 90%点: ${pct(0.9)}日 / 最大: ${known[known.length - 1]}日`);
const within2 = known.filter((g) => g <= 1).length / known.length * 100;
const within7 = known.filter((g) => g <= 6).length / known.length * 100;
console.log(`  今日か明日にある: ${within2.toFixed(1)}%  ← いまのレイアウトが機能する割合`);
console.log(`  7日以内にある:    ${within7.toFixed(1)}%  ← いまの画面に何らかの形で写る割合`);

// --- 予定名の長さ（中身は出さない） ---
const lens = events.map((e) => [...e.title].length).sort((a, b) => a - b);
const lp = (p) => lens[Math.floor(lens.length * p)] ?? 0;
console.log('\n■ 予定名の文字数');
console.log(`  中央値: ${lp(0.5)} / 75%点: ${lp(0.75)} / 90%点: ${lp(0.9)} / 最大: ${lens[lens.length - 1]}`);
console.log(`  現在の1行あたりの目安は約8文字（34px時）`);

// --- 終日か時刻付きか ---
const allDay = events.filter((e) => e.allDay).length;
console.log('\n■ 種別');
console.log(`  終日: ${allDay} 件 (${(allDay / events.length * 100).toFixed(0)}%) / 時刻付き: ${events.length - allDay} 件`);

// --- 曜日の偏り ---
const dow = new Array(7).fill(0);
for (const { key, n } of perDay) {
  const d = describeDay(key);
  const idx = ['日', '月', '火', '水', '木', '金', '土'].indexOf(d.weekday);
  dow[idx] += n;
}
console.log('\n■ 曜日別の予定数');
['日', '月', '火', '水', '木', '金', '土'].forEach((w, i) => {
  console.log(`  ${w}: ${String(dow[i]).padStart(3)} ${'█'.repeat(Math.round(dow[i] / Math.max(...dow) * 30))}`);
});
