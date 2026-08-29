import { ymd, addDays, startOfDay } from './datetime.js';

/** 実機・認証なしで見た目を確認するためのダミー予定 */
export function fixtureEvents(now = new Date()) {
  const t = ymd(now);
  const at = (dayOffset, hh, mm = 0) =>
    new Date(startOfDay(addDays(t, dayOffset)).getTime() + (hh * 60 + mm) * 60000);
  const allDay = (dayOffset, days = 1) => ({
    allDay: true,
    startsAt: startOfDay(addDays(t, dayOffset)),
    endsAt: startOfDay(addDays(t, dayOffset + days)),
  });

  return [
    { ...allDay(0), title: 'ゴミ（もえる）' },
    { allDay: false, startsAt: at(0, 10), endsAt: at(0, 11, 30), title: '内科 定期けんしん' },
    { allDay: false, startsAt: at(0, 15), endsAt: at(0, 17), title: 'たかしが来る' },
    { ...allDay(1), title: 'デイサービス' },
    { allDay: false, startsAt: at(1, 18), endsAt: at(1, 20), title: '町内会の集まり' },
    { allDay: false, startsAt: at(2, 13), endsAt: at(2, 14), title: '美容院' },
    { allDay: false, startsAt: at(4, 10), endsAt: at(4, 11), title: '訪問看護' },
    { ...allDay(5), title: '敬老会' },
    { allDay: false, startsAt: at(6, 9, 30), endsAt: at(6, 10, 30), title: '歯医者' },
  ];
}
