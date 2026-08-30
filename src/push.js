// レイアウトを変えてから実機で確認するまでを1コマンドにまとめる。
//
//   npm run push
//     1. カレンダーを取得して PNG と Worker 用の画像モジュールを生成
//     2. Worker をデプロイ
//     3. 端末に再取得を指示（Wi-Fi 経由。USB は不要）
//
// 端末側の web_server と refresh ボタンは調整用の仕組みで、
// deep_sleep を入れる段階で取り外す。
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (cmd, args) =>
  execFileSync(cmd, args, { stdio: 'inherit', cwd: process.cwd() });

/** ESPHome の secrets.yaml から値を1つ取り出す */
function secret(key) {
  const text = readFileSync('firmware/secrets.yaml', 'utf8');
  const m = new RegExp(`^${key}:\\s*"(.*)"$`, 'm').exec(text);
  if (!m) throw new Error(`firmware/secrets.yaml に ${key} がありません`);
  return m[1];
}

const host = process.env.DEVICE_HOST ?? 'family-calendar.local';

console.log('■ 画像を生成');
run('node', ['--env-file-if-exists=.env', 'src/build.js', '--no-open']);

console.log('\n■ Worker をデプロイ');
run('npx', ['wrangler', 'deploy', '--config', 'worker/wrangler.toml']);

console.log(`\n■ 端末に再取得を指示 (${host})`);
const res = execFileSync('curl', [
  '-s', '-o', '/dev/null', '-w', '%{http_code}',
  '--max-time', '25',
  '-u', `admin:${secret('web_password')}`,
  '-X', 'POST', '-d', '',
  `http://${host}/button/refresh/press`,
]).toString();

if (res.trim() === '200') {
  console.log('  完了。数秒で画面が更新されます。');
} else {
  console.log(`  失敗 (HTTP ${res})。端末が起動して Wi-Fi に繋がっているか確認してください。`);
  process.exit(1);
}
