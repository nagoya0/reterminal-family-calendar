// 気象庁の降水確率を取る。
//
// **なぜ Open-Meteo だけで済ませないか。** 気象庁の降水確率は「予報区内で1mm以上の
// 雨が降る確率」を6時間ごとに発表したもので、母がテレビや tenki.jp で見る数字は
// これ。Open-Meteo の時間ごとの確率を最大値でまとめると別の量になり、実際に
// 食い違う（ある日の夜は気象庁 70% に対し最大値方式では 84%）。装置の数字が
// 見慣れた数字と違えば、装置の方が間違っていると受け取られる。
//
// 6時間の区切り（6-12 / 12-18 / 18-24）も気象庁の発表とそのまま一致する。
//
// 降水量・気温・天気アイコンは気象庁から取れないので Open-Meteo のまま:
//   - 降水量は短期予報に含まれていない
//   - 天気コードは1日1個しか出ず、時間帯ごとのアイコンが作れない

/** 実家が属する予報区。愛知県(230000) の西部。 */
export const AREA_CODE = '230010';
const PREFECTURE = '230000';

/**
 * 6時間ごとの降水確率を { "YYYY-MM-DD": { 6: 50, 12: 60, 18: 70 } } の形で返す。
 * 添字は時間帯の開始時刻。
 *
 * 発表は今日の残りと明日までしかない。それより先は呼び出し側で Open-Meteo に
 * 落とす（3日分の画像を作っているが、端末が実際に映すのは当日分だけ）。
 */
export async function fetchPops({ prefecture = PREFECTURE, area = AREA_CODE } = {}) {
  const res = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${prefecture}.json`);
  if (!res.ok) throw new Error(`気象庁の取得に失敗しました: ${res.status}`);
  const data = await res.json();

  const series = data[0].timeSeries.find((t) => t.areas.some((a) => a.pops));
  if (!series) throw new Error('降水確率が見つかりませんでした');
  const target = series.areas.find((a) => a.area.code === area) ?? series.areas[0];

  const out = {};
  series.timeDefines.forEach((t, i) => {
    const value = target.pops[i];
    if (value === undefined || value === '') return;
    const date = t.slice(0, 10);
    const hour = Number(t.slice(11, 13));
    (out[date] ??= {})[hour] = Number(value);
  });
  return out;
}
