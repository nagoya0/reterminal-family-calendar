// Google Calendar からの予定取得（サービスアカウント認証）。
//
// 親のカレンダーはサービスアカウントに「予定の表示」で共有されている。
// サービスアカウントには受信箱がなく共有の招待を承諾できないため、
// calendarList には現れないことがある。カレンダーIDを直接指定して読む。
import { readFileSync } from 'node:fs';
import { google } from 'googleapis';
import { startOfDay, addDays, ymd } from './datetime.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

/**
 * 認証情報を読む。
 * GitHub Actions では Secrets から環境変数に JSON をそのまま入れる。
 * ローカルでは既定の鍵ファイルにフォールバックする。
 */
export function loadCredentials() {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (inline) return JSON.parse(inline);

  const path = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
    ?? `${process.env.HOME}/.config/family-calendar/sa-key.json`;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function calendarClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: loadCredentials(),
    scopes: SCOPES,
  });
  return google.calendar({ version: 'v3', auth });
}

/** Calendar API のイベントを内部形式へ正規化する */
function normalize(item) {
  const allDay = Boolean(item.start?.date);
  return {
    allDay,
    // 終日イベントは date（YYYY-MM-DD、end は排他的）、時刻付きは dateTime
    startsAt: allDay ? startOfDay(item.start.date) : new Date(item.start.dateTime),
    endsAt: allDay ? startOfDay(item.end.date) : new Date(item.end.dateTime),
    title: (item.summary ?? '(タイトルなし)').trim(),
  };
}

/** 今日から days 日分の予定を取得する */
export async function fetchEvents(calendarId, { now = new Date(), days = 7 } = {}) {
  const today = ymd(now);
  return fetchRange(calendarId, startOfDay(today), startOfDay(addDays(today, days)));
}

/**
 * 任意の期間の予定を取得する。
 * singleEvents:true で繰り返し予定を個々の回に展開させる（毎週の定期予定等）。
 */
export async function fetchRange(calendarId, timeMin, timeMax) {
  const cal = calendarClient();
  const items = [];
  let pageToken;

  do {
    const res = await cal.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
      pageToken,
    });
    items.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return items
    // 辞退した予定は表示しない
    .filter((it) => it.status !== 'cancelled')
    .map(normalize);
}

/** 疎通確認用: このサービスアカウントから当該カレンダーが読めるか */
export async function probe(calendarId) {
  const cal = calendarClient();
  const meta = await cal.calendars.get({ calendarId });
  return { id: meta.data.id, summary: meta.data.summary, timeZone: meta.data.timeZone };
}
