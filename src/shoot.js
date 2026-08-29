// HTML → 800×480 の 1bit PNG。
import puppeteer from 'puppeteer';
import sharp from 'sharp';

export const WIDTH = 800;
export const HEIGHT = 480;

/** HTML文字列を撮影してカラーPNG(Buffer)を返す */
export async function screenshot(html) {
  const browser = await puppeteer.launch({
    args: ['--font-render-hinting=none', '--disable-lcd-text'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    return await page.screenshot({ type: 'png', fullPage: false });
  } finally {
    await browser.close();
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
