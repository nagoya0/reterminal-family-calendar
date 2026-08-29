import { startOfDay, addDays, hhmm } from './datetime.js';

/**
 * 正規化済みイベントの形:
 *   { allDay: boolean, startsAt: Date, endsAt: Date, title: string }
 *
 * endsAt は排他的（終日イベントなら翌日の 0:00）。取得元が iCal でも
 * Calendar API でもこの形に揃えてから render に渡す。
 */

/** 指定日に掛かるイベントを、開始時刻順に返す */
export function eventsForDay(events, dayKey) {
  const dayStart = startOfDay(dayKey);
  const dayEnd = startOfDay(addDays(dayKey, 1));

  return events
    .filter((ev) => ev.startsAt < dayEnd && ev.endsAt > dayStart)
    .sort((a, b) => {
      // 終日を先頭に、そのあと開始時刻順
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startsAt - b.startsAt;
    });
}

/**
 * その日の表示用の時刻ラベル。
 * 前日から続いている予定は、その日のうちに終わるなら終了時刻を「〜10:00」と出す。
 * 丸一日を覆う場合だけ「終日」。深夜まで続く予定を「終日」と出すと誤解を招くため。
 */
export function timeLabel(ev, dayKey) {
  if (ev.allDay) return '終日';

  const dayStart = startOfDay(dayKey);
  if (ev.startsAt < dayStart) {
    const dayEnd = startOfDay(addDays(dayKey, 1));
    return ev.endsAt >= dayEnd ? '終日' : `〜${hhmm(ev.endsAt)}`;
  }
  return hhmm(ev.startsAt);
}
