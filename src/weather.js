// 天気を取る。APIキー・登録・課金いずれも不要。
//
// **2つの出典を使い分けている。**
//
//   降水確率  気象庁      母がテレビや tenki.jp で見る数字と一致させるため
//   降水量    Open-Meteo  気象庁は短期予報に出していない
//   気温      Open-Meteo  地点の最高・最低
//   アイコン  Open-Meteo  気象庁の天気コードは1日1個で、時間帯ごとに割れない
//
// 当初は Open-Meteo だけで済ませ、降水確率も時間ごとの値の最大でまとめていた。
// しかしそれは気象庁の「6時間で1mm以上降る確率」とは別の量で、実際に食い違う
// （ある日の夜は気象庁 70% に対し最大値方式では 84%）。詳しくは src/jma.js。
//
// アイコンの素材は Weather Icons。気象庁公式の SVG は1bit化すると
// 「晴れ」と「曇時々晴」が同じ絵になり、情報として嘘をつく（検証済み）。
//
// 母の活動時間は 6時〜24時。深夜は表示しない。

/**
 * 参照する予報の格子点。愛知県西部を含む区画。
 *
 * Open-Meteo は渡した座標を最寄りの格子点へ丸めるので、**格子点の座標を
 * そのまま指定している**。実家の正確な座標をリポジトリに残さないため。
 * private リポジトリだが、秘密情報は private でも置かない方針に従う。
 *
 * 実家の座標を渡した場合との差は、気温が 0.1℃（標高16mぶんの補正）だけ。
 * 降水確率と天気コードは72時間すべて一致する。画面の気温は整数なので
 * 表示上の差は出ない。elevation を明示すれば完全一致するが、標高も住所を
 * 絞り込む手がかりになるため指定しない。
 */
import { fetchPops } from './jma.js';
export const LOCATION = { latitude: 35.2, longitude: 137.0 };

/** この降水確率を超えたら、天気コードによらず雨寄りの絵にする */
export const RAIN_ICON_THRESHOLD = 50;

/**
 * 表示する時間帯。母の活動時間 6〜24時を3つに割る。
 * 画面の左半分（約400px）に収めるため、区分を増やしすぎない。
 */
export const BANDS = [
  { label: '朝', start: 6, hours: 6 },
  { label: '昼', start: 12, hours: 6 },
  { label: '夜', start: 18, hours: 6 },
];

/**
 * WMO の天気コードを Weather Icons のアイコン名へ対応させる。
 * 夜間は太陽ではなく月の絵にする。
 * https://open-meteo.com/en/docs の Weather variable documentation を参照。
 */
export function iconFor(code, { night = false } = {}) {
  if (code === 0 || code === 1) return night ? 'wi-night-clear' : 'wi-day-sunny';
  if (code === 2) return night ? 'wi-night-alt-cloudy' : 'wi-day-cloudy';
  if (code === 3) return 'wi-cloudy';
  if (code === 45 || code === 48) return 'wi-fog';
  if (code >= 51 && code <= 57) return 'wi-sprinkle';   // 霧雨
  if (code >= 61 && code <= 67) return 'wi-rain';       // 雨
  if (code >= 71 && code <= 77) return 'wi-snow';       // 雪
  if (code >= 80 && code <= 82) return 'wi-showers';    // にわか雨
  if (code === 85 || code === 86) return 'wi-snow';
  if (code >= 95) return 'wi-thunderstorm';
  return 'wi-cloudy';
}

/** 悪天ほど大きい値を返す。区分内で代表となるコードを選ぶのに使う。 */
function severity(code) {
  if (code >= 95) return 6;
  if (code >= 71 && code <= 86) return 5;
  if (code >= 61 && code <= 67) return 4;
  if (code >= 80 && code <= 82) return 4;
  if (code >= 51 && code <= 57) return 3;
  if (code === 45 || code === 48) return 2;
  return code <= 3 ? code * 0.1 : 1;
}

/**
 * 指定日数ぶんの天気を日付ごとに返す。
 *   [{ date, tempMax, tempMin, slots: [{ label, start, code, icon, pop, temp }] }]
 *
 * 画像は今日・明日・明後日の3日分を作るため、天気もその日数だけ要る。
 *
 * 気温は時間帯ごとではなく1日の最高・最低を使う。時間帯ごとに出しても
 * 判断は変わらず、画面を圧迫するだけのため。
 */
export async function fetchForecast({
  latitude = LOCATION.latitude,
  longitude = LOCATION.longitude,
  bands = BANDS,
  days = 3,
} = {}) {
  // 降水確率は気象庁を優先する。取れなくても画面は出す。データ源が2つに
  // 増えたぶん、片方が落ちたときに天気ごと消えないようにしておく。
  const jmaPops = await fetchPops().catch((e) => {
    console.warn(`気象庁の降水確率を取得できませんでした（Open-Meteo で代用します）: ${e.message}`);
    return null;
  });

  const params = new URLSearchParams({
    latitude, longitude,
    hourly: 'temperature_2m,precipitation,precipitation_probability,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'Asia/Tokyo',
    forecast_days: String(days),
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo の取得に失敗しました (HTTP ${res.status})`);
  const data = await res.json();

  const { time, temperature_2m: temps, precipitation_probability: pops,
          precipitation: rainMm,
          weather_code: codes } = data.hourly;

  // 時刻の文字列は "YYYY-MM-DDTHH:00"。日付ごとに添字を引けるようにする。
  const indexByDate = new Map();
  time.forEach((t, i) => {
    const date = t.slice(0, 10);
    if (!indexByDate.has(date)) indexByDate.set(date, new Map());
    indexByDate.get(date).set(Number(t.slice(11, 13)), i);
  });

  return data.daily.time.map((date, dayIdx) => {
    const hours = indexByDate.get(date) ?? new Map();

    const slots = bands.map(({ label, start, hours: span }) => {
      const idx = [];
      for (let h = start; h < start + span; h++) {
        const i = hours.get(h);
        if (i !== undefined) idx.push(i);
      }
      if (idx.length === 0) {
        return { label, start, span, code: null, icon: 'wi-cloudy', pop: null, mm: null, temp: null };
      }

      // 降水確率は気象庁の発表を使う。母がテレビや tenki.jp で見る数字と
      // 一致させるため（src/jma.js の冒頭参照）。発表が無い日は Open-Meteo の
      // 時間ごとの値の最大で代用する。別の量になるが、無いよりはよい。
      const pop = jmaPops?.[date]?.[start] ?? Math.max(...idx.map((i) => pops[i] ?? 0));

      // 降水量は6時間の合計。「この時間帯にどれだけ降るか」を答える。
      // 平均(mm/h)にすると山が消える（2mm降る1時間があっても 0.7mm/h になる）。
      // 家庭菜園で知りたいのは水やりの要否で、それは総量で決まる。
      const mm = Math.round(idx.reduce((sum, i) => sum + (rainMm[i] ?? 0), 0) * 10) / 10;
      // 天気は最も悪いものを代表にする。晴れ時々雨を晴れと出さないため。
      const code = idx.map((i) => codes[i]).sort((a, b) => severity(b) - severity(a))[0];

      // 降水確率が高いのに weather_code が晴れのままになることがある。
      // code は決定論的な予測（降水量）から出ており、確率とは別系統のため。
      // 家庭菜園では「降るかもしれない」ことが行動を変えるので、
      // 確率が高い時間帯は雨寄りの絵に寄せる。数字も併記するので
      // 利用者が自分で判断し直せる。
      const rainy = pop >= RAIN_ICON_THRESHOLD && severity(code) < 3;
      return {
        label, start, span, code, pop, mm,
        icon: rainy ? 'wi-showers' : iconFor(code, { night: start >= 18 }),
        temp: Math.round(temps[idx[0]]),
      };
    });

    return {
      date,
      tempMax: Math.round(data.daily.temperature_2m_max[dayIdx]),
      tempMin: Math.round(data.daily.temperature_2m_min[dayIdx]),
      slots,
    };
  });
}
