// ファームウェアをビルドして Cloudflare へ配信する。
//
//   npm run push-firmware
//
// 端末は起床のたびに /fw.version を見て、自分のビルド時刻と違えば取りに来る。
// つまりこのスクリプトを走らせた翌 00:00 までに更新が入る。緑ボタンを押せば即座。
//
// **画像の配信（npm run push / GitHub Actions）とは別の Worker を触る。**
// 経路を分けておくと、画像側が壊れても更新の経路が生きている。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const YAML = `${ROOT}firmware/reterminal-e1001.yaml`;
const BUILD = `${ROOT}firmware/.esphome/build/family-calendar`;
const BIN = `${BUILD}/.pioenvs/family-calendar/firmware.ota.bin`;
const BUILD_INFO = `${BUILD}/src/esphome/core/build_info_data.cpp`;
const PUBLIC_DIR = `${ROOT}worker-fw/public`;

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT });
}

/**
 * 端末が持っているビルド時刻を取り出す。
 *
 * ESPHome のログにも build_time_str が出るが、**そちらは形式が違う**
 * （タイムゾーンが付かない）。端末が返すのはこの生成ファイルの値なので、
 * ログではなくこちらを読む。ずれると判定が永久に不一致になり、
 * 起床のたびに 1MB を落とし続けることになる。
 */
function buildTime() {
  const src = readFileSync(BUILD_INFO, 'utf8');
  const m = /ESPHOME_BUILD_TIME_STR\[\][^=]*= "([^"]+)"/.exec(src);
  if (!m) throw new Error(`ビルド時刻を読み取れませんでした: ${BUILD_INFO}`);
  return m[1];
}

console.log('ファームウェアをビルドします');
run('esphome', ['compile', YAML]);

const version = buildTime();
const bin = readFileSync(BIN);
const md5 = createHash('md5').update(bin).digest('hex');

mkdirSync(PUBLIC_DIR, { recursive: true });
copyFileSync(BIN, `${PUBLIC_DIR}/firmware.bin`);

console.log(`\n  ビルド時刻: ${version}`);
console.log(`  MD5:        ${md5}`);
console.log(`  サイズ:     ${(bin.length / 1048576).toFixed(2)} MB\n`);

run('npx', [
  'wrangler', 'deploy',
  '--config', 'worker-fw/wrangler.toml',
  '--var', `FW_VERSION:${version}`,
  '--var', `FW_MD5:${md5}`,
]);

console.log('\n配信しました。端末は次の起床（JST 00:00）で取りに来ます。');
console.log('すぐ入れたい場合は緑ボタンを押してください。');
