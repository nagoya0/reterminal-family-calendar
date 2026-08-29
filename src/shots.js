// 全シナリオを 1bit PNG に描き出し、余白を実測して表示する。
// レイアウトを変えたら必ずこれを走らせて目視確認する。
//   npm run shots            書き出しのみ
//   npm run shots -- --open  書き出して一覧をブラウザで開く
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { renderHtml } from './render.js';
import { screenshot, toMonochrome } from './shoot.js';
import { scenarios } from './scenarios.js';

const OUT = 'dist';

/** 罫線だけの行を除いて、実際に文字が占めている範囲を測る */
async function measure(png) {
  const { data, info } = await sharp(png).greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const ink = (y) => {
    let n = 0;
    for (let x = 0; x < width; x++) if (data[y * width + x] < 128) n++;
    return n;
  };
  // 縦罫線は数ピクセルしかないので、閾値未満の行は「文字なし」とみなす
  const THRESH = 15;
  let top = 0; while (top < height && ink(top) < THRESH) top++;
  let bottom = height - 1; while (bottom > 0 && ink(bottom) < THRESH) bottom--;
  return { top, bottom: height - 1 - bottom };
}

mkdirSync(OUT, { recursive: true });
const written = [];

for (const s of scenarios) {
  const png = await toMonochrome(await screenshot(renderHtml(s.build(s.now), s.now)));
  const path = `${OUT}/${s.name}.png`;
  writeFileSync(path, png);
  const m = await measure(png);
  written.push({ name: s.name, label: s.label, file: path });
  console.log(
    `${s.name.padEnd(8)} ${String(png.length).padStart(5)}B  ` +
    `上余白 ${String(m.top).padStart(2)}px / 下余白 ${String(m.bottom).padStart(2)}px  ${s.label}`
  );
}

// 4枚を1枚のページに並べる。Preview を何窓も開くより、
// タブ1つをリロードするだけで済む方が確認が速い。
// 画像には毎回変わるクエリを付けて、ブラウザのキャッシュを回避する。
const bust = Date.now();
const cards = written.map(({ name, label, file }) => `
    <figure>
      <figcaption>${name} &mdash; ${label}</figcaption>
      <img src="${file.replace('dist/', '')}?t=${bust}" width="800" height="480">
    </figure>`).join('');

writeFileSync(`${OUT}/shots.html`, `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><title>レンダリング結果</title>
<style>
  body { background: #666; color: #fff; font-family: system-ui, sans-serif; margin: 0; padding: 24px; }
  figure { margin: 0 0 28px; }
  figcaption { font-size: 13px; margin-bottom: 6px; }
  /* 実機と同じ 800×480 の等倍で並べる */
  img { display: block; width: 800px; height: 480px; background: #fff; }
</style>
</head>
<body>${cards}
</body>
</html>`);

console.log(`\n${OUT}/shots.html に ${written.length} 枚まとめました`);

if (process.argv.includes('--open')) {
  execFileSync('open', [`${OUT}/shots.html`]);
  console.log('ブラウザで開きました（以降はタブをリロードするだけで最新になります）');
}
