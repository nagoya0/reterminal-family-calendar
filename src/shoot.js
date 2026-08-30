// HTML → 800×480 の 1bit PNG。
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

export const WIDTH = 800;
export const HEIGHT = 480;

/**
 * HTML文字列を撮影してカラーPNG(Buffer)を返す。
 *
 * setContent ではなく一時ファイルへ書いて file:// で開く。
 * about:blank のままだと同梱フォントの file:// URL を読めないため。
 */
export async function screenshot(html) {
  const dir = mkdtempSync(join(tmpdir(), 'famcal-'));
  const htmlPath = join(dir, 'page.html');
  writeFileSync(htmlPath, html);

  // Ubuntu 23.10 以降は AppArmor が非特権ユーザー名前空間を制限しており、
  // GitHub Actions の runner では Chromium の sandbox が起動できない。
  // CI でだけ無効化する。予定名は Google 由来の外部入力なので、
  // ローカルでは sandbox を有効なままにしておく。
  const sandboxArgs = process.env.CI
    ? ['--no-sandbox', '--disable-setuid-sandbox']
    : [];

  const browser = await puppeteer.launch({
    args: [
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--allow-file-access-from-files',
      ...sandboxArgs,
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');

    // フォントが実際に読めたかを確認する。読めていなければ既定フォントに
    // フォールバックして字幅が変わり、レイアウトが静かに崩れる。
    const loaded = await page.evaluate(
      () => document.fonts.check('700 34px "CalendarJP"'),
    );
    if (!loaded) throw new Error('同梱フォント CalendarJP を読み込めませんでした');

    return await page.screenshot({ type: 'png', fullPage: false });
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * カラーPNG → 1bit PNG(Buffer)。
 * ESP32 側のデコード負荷とメモリを抑えるため、階調はサーバで落としきる。
 * palette:true + colours:2 の組み合わせで PNG のビット深度が 1 になる。
 */
export async function toMonochrome(pngBuffer, { threshold = 128 } = {}) {
  return sharp(pngBuffer)
    .greyscale()
    .threshold(threshold)
    .png({ palette: true, colours: 2, compressionLevel: 9, effort: 10 })
    .toBuffer();
}
