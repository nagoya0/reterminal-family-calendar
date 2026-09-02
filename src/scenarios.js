// 見た目の検証用シナリオ。
// レイアウトを変えたら必ず全パターンを描き直して、崩れがないか目視する。
import { startOfDay, addDays, ymd } from './datetime.js';
import { fixtureEvents } from './fixture.js';
import { BANDS } from './weather.js';

/** シナリオ内で予定を組み立てるためのヘルパ */
function helpers(now) {
  const t = ymd(now);
  return {
    at: (o, h, m = 0) =>
      new Date(startOfDay(addDays(t, o)).getTime() + (h * 60 + m) * 60000),
    ev(o, h, m, title) {
      return { allDay: false, startsAt: this.at(o, h, m), endsAt: this.at(o, h + 1, m), title };
    },
    allDay: (o, title, days = 1) => ({
      allDay: true,
      startsAt: startOfDay(addDays(t, o)),
      endsAt: startOfDay(addDays(t, o + days)),
      title,
    }),
  };
}

/**
 * 天気のダミー。実際の取得を伴わずにレイアウトを確認するため。
 * pops は [朝, 昼, 夜]、icons は同じ並びのアイコン名。
 */
function weather(tempMax, tempMin, pops, icons, mms = [0, 0, 0]) {
  return {
    date: null,
    tempMax, tempMin,
    slots: BANDS.map((b, i) => ({
      ...b, span: b.hours, code: null, pop: pops[i], mm: mms[i], icon: icons[i], temp: tempMax,
    })),
  };
}

const SUNNY = weather(31, 24, [8, 12, 5], ['wi-day-sunny', 'wi-day-sunny', 'wi-night-clear'], [0, 0, 0]);
// 量は「1mm未満で小数が出る」「2桁」を混ぜて、帯の幅が最も厳しくなる形にしてある。
const RAINY = weather(22, 19, [76, 88, 62], ['wi-showers', 'wi-rain', 'wi-showers'], [0.5, 32, 4]);
const COLD  = weather(4, -2, [20, 30, 70], ['wi-cloudy', 'wi-cloudy', 'wi-snow'], [0, 0.2, 3]);

export const scenarios = [
  {
    name: 'typical',
    label: '実測に近い密度（今日1件、先に数件）',
    now: new Date('2026-09-02T06:00:00+09:00'),
    weather: SUNNY,
    build(now) {
      const h = helpers(now);
      return [
        h.ev(0, 9, 30, '内科 定期けんしん'),
        h.ev(1, 11, 30, '歯科'),
        h.ev(6, 10, 0, '訪問看護'),
        h.ev(12, 10, 30, '銀行の担当が来る'),
      ];
    },
  },
  {
    name: 'today-3',
    label: '今日3件（実データの最大。小さめ表示に切り替わる）',
    now: new Date('2026-09-02T06:00:00+09:00'),
    weather: SUNNY,
    build(now) {
      const h = helpers(now);
      return [
        h.ev(0, 9, 0, '内科 定期けんしん'),
        h.ev(0, 13, 30, 'デイサービス'),
        h.ev(0, 18, 0, '町内会の役員会'),
        h.ev(3, 10, 0, '訪問看護'),
      ];
    },
  },
  {
    name: 'today-4',
    label: '今日4件（想定外の密度。「他N件」で示す）',
    now: new Date('2026-09-02T06:00:00+09:00'),
    weather: SUNNY,
    build(now) {
      const h = helpers(now);
      return [
        h.ev(0, 9, 0, '内科 定期けんしん'),
        h.ev(0, 11, 0, '配達の受け取り'),
        h.ev(0, 13, 30, 'デイサービス'),
        h.ev(0, 18, 0, '町内会の役員会'),
        h.ev(3, 10, 0, '訪問看護'),
      ];
    },
  },
  {
    name: 'today-empty',
    label: '今日は予定なし（過去1年で54%を占める状態）',
    now: new Date('2026-09-02T06:00:00+09:00'),
    weather: RAINY,
    build(now) {
      const h = helpers(now);
      return [h.ev(4, 14, 0, '美容院'), h.ev(9, 9, 30, '整形外科')];
    },
  },
  {
    name: 'empty',
    label: '1ヶ月先まで予定なし',
    now: new Date('2026-09-02T06:00:00+09:00'),
    weather: SUNNY,
    build: () => [],
  },
  {
    name: 'crowded',
    label: '今後の予定が多い日（小さめ表示に切り替わる）',
    now: new Date('2026-09-02T06:00:00+09:00'),
    weather: RAINY,
    build(now) {
      const h = helpers(now);
      return [
        h.allDay(0, 'ゴミ（もえる）'),
        h.ev(0, 15, 0, 'たかしが来る'),
        h.ev(1, 9, 0, 'リハビリ'),
        h.ev(2, 13, 0, '美容院'),
        h.ev(3, 10, 0, '訪問看護'),
        h.ev(5, 14, 0, '町内会の集まり'),
        h.ev(8, 9, 30, '眼科'),
        h.ev(11, 10, 0, '敬老会'),
        h.ev(15, 13, 0, '歯科検診'),
        h.ev(22, 10, 0, '通院'),
      ];
    },
  },
  {
    name: 'long-titles',
    label: '長い予定名（省略の確認）',
    now: new Date('2026-09-02T06:00:00+09:00'),
    weather: COLD,
    build(now) {
      const h = helpers(now);
      return [
        h.ev(0, 9, 0, '市立総合医療センター 循環器内科 定期受診（紹介状を持参）'),
        h.ev(2, 10, 0, '地域包括支援センターで介護保険の更新手続き'),
        h.ev(5, 14, 0, '公民館で健康講座の受付手伝い'),
      ];
    },
  },
  {
    name: 'all-day',
    label: '終日の予定と日をまたぐ予定',
    now: new Date('2026-12-31T06:00:00+09:00'),
    weather: COLD,
    build(now) {
      const h = helpers(now);
      return [
        h.allDay(0, '大晦日'),
        { allDay: false, startsAt: h.at(0, 23), endsAt: h.at(1, 1), title: '初詣' },
        h.allDay(3, '新年会', 2),
        h.ev(9, 10, 0, '病院はじめ'),
      ];
    },
  },
];
