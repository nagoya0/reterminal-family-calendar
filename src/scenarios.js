// 見た目の検証用シナリオ。
// レイアウトを変えたら必ず全パターンを描き直して、崩れがないか目視する。
import { startOfDay, addDays, ymd } from './datetime.js';
import { fixtureEvents } from './fixture.js';

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

export const scenarios = [
  {
    name: 'normal',
    label: '通常時（今日3件・明日2件）',
    now: new Date('2026-08-29T05:00:00+09:00'),
    build: (now) => fixtureEvents(now),
  },
  {
    name: 'busy',
    label: '混雑時（今日8件・明日7件、帯は2行折り返し）',
    now: new Date('2026-08-29T05:00:00+09:00'),
    build(now) {
      const h = helpers(now);
      return [
        h.allDay(0, 'ゴミ（もえる）'),
        h.ev(0, 8, 30, '朝の散歩'),
        h.ev(0, 10, 0, '内科 定期けんしん'),
        h.ev(0, 12, 0, '昼食会（公民館）'),
        h.ev(0, 14, 0, '美容院'),
        h.ev(0, 16, 0, 'たかしが来る'),
        h.ev(0, 19, 0, '町内会の役員会'),
        h.ev(0, 20, 30, '孫とビデオ通話'),
        h.allDay(1, 'デイサービス'),
        h.ev(1, 9, 0, 'リハビリ'),
        h.ev(1, 11, 0, '買い物'),
        h.ev(1, 13, 30, '訪問看護'),
        h.ev(1, 15, 0, '孫の運動会'),
        h.ev(1, 18, 0, '夕食は外で'),
        h.ev(1, 20, 0, '薬の受け取り'),
        h.ev(2, 10, 0, '市民病院で検査（朝食抜き）'),
        h.ev(3, 14, 0, '床屋'),
        h.allDay(4, '敬老会の打ち合わせ'),
        h.ev(5, 9, 0, '整形外科'),
        h.ev(6, 10, 0, '地域包括支援センター相談'),
      ];
    },
  },
  {
    name: 'newyear',
    label: '年またぎ（12/31→1/1、日をまたぐ予定、明日は予定なし）',
    now: new Date('2026-12-31T05:00:00+09:00'),
    build(now) {
      const h = helpers(now);
      return [
        h.allDay(0, '大晦日'),
        h.ev(0, 9, 0, 'おせちの受け取り（駅前のスーパー）'),
        h.ev(0, 11, 0, '床屋'),
        h.ev(0, 14, 0, 'たかしと孫が到着'),
        h.ev(0, 18, 0, '年越しそば'),
        // 23:00 開始・翌 01:00 終了。翌日側では「〜01:00」と出るのが正
        { allDay: false, startsAt: h.at(0, 23), endsAt: h.at(1, 1), title: '初詣（日付をまたぐ予定）' },
        h.ev(2, 10, 0, '親戚があいさつに来る'),
        h.ev(2, 15, 0, '買い物'),
        h.allDay(4, '病院はじめ'),
      ];
    },
  },
  {
    name: 'long',
    label: '長い予定名と、帯に複数件（省略表示の確認用）',
    now: new Date('2026-08-29T05:00:00+09:00'),
    build(now) {
      const h = helpers(now);
      return [
        // きょう: 2件（通常サイズ 34px・2行クランプ）
        h.ev(0, 9, 0, '市立総合医療センター 循環器内科 定期受診（紹介状と保険証を持参）'),
        h.ev(0, 14, 0, '地域包括支援センターの担当者と介護保険の更新について面談'),
        // あした: 5件（混雑サイズ 27px・1行クランプ）
        h.ev(1, 8, 0, '朝いちで薬局へ処方箋を出しに行く'),
        h.ev(1, 10, 0, 'デイサービスの送迎車が来る（玄関前で待つこと）'),
        h.ev(1, 13, 0, '床屋'),
        h.ev(1, 15, 0, '孫の小学校の運動会を見に行く予定'),
        h.ev(1, 18, 0, '夕飯'),
        // 帯: 複数件の日と、長い予定名の日を混ぜる
        h.ev(2, 9, 0, '整形外科'),
        h.ev(2, 11, 0, '買い物'),
        h.ev(2, 14, 0, '銀行'),
        h.ev(2, 16, 0, '友人が来る'),
        h.ev(3, 10, 0, '公民館で健康講座の受付手伝い'),
        h.ev(4, 9, 0, '眼科'),
        h.ev(4, 13, 0, '美容院'),
        h.ev(6, 10, 0, '訪問看護'),
      ];
    },
  },
  {
    name: 'empty',
    label: '予定なし（両日とも空、帯も空）',
    now: new Date('2026-08-29T05:00:00+09:00'),
    build: () => [],
  },
];
