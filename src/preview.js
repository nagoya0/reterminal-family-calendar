// ダミーデータで dist/preview.html を書き出す。ブラウザで開いて見た目を確認する用。
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderHtml } from './render.js';
import { fixtureEvents } from './fixture.js';

const now = process.argv[2] ? new Date(process.argv[2]) : new Date();
const html = renderHtml(fixtureEvents(now), now);

mkdirSync('dist', { recursive: true });
writeFileSync('dist/preview.html', html);
console.log(`dist/preview.html を書き出しました (基準日時: ${now.toISOString()})`);
