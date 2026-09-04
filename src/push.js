// レイアウトを変えてから配信するまでを1コマンドにまとめる。
//
//   npm run push
//     1. カレンダーを取得して PNG と Worker 用の画像モジュールを生成
//     2. Worker をデプロイ
//
// 端末への即時反映は行わない（実家設置後、端末は自宅LANの外にいる。
// deep_sleep 中がほとんどで、いてもこの Mac と同じ Wi-Fi にはいない）。
// 反映は次の定期起床、または緑ボタンを押した起床を待つ。手元で今すぐ
// 試したい場合は web_server の refresh ボタンを直接叩けばよい:
//   curl -u admin:<web_password> -X POST http://<端末のIP>/button/refresh/press
import { execFileSync } from 'node:child_process';

const run = (cmd, args) =>
  execFileSync(cmd, args, { stdio: 'inherit', cwd: process.cwd() });

console.log('■ 画像を生成');
run('node', ['--env-file-if-exists=.env', 'src/build.js', '--no-open']);

console.log('\n■ Worker をデプロイ');
run('npx', ['wrangler', 'deploy', '--config', 'worker/wrangler.toml']);

console.log('\n配信しました。端末は次の起床で取りに来ます。');
