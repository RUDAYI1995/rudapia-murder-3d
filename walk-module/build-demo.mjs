// walk.js 를 demo.template.html 안에 그대로 끼워 넣어, 더블클릭만으로 열리는 단일 파일(walk-demo.html)을 만든다.
// 실행: node walk-module/build-demo.mjs
import fs from 'node:fs';
const dir = new URL('.', import.meta.url);
const walk = fs.readFileSync(new URL('walk.js', dir), 'utf8')
  .replace(/^import \* as THREE from 'three';\r?\n/m, '')
  .replace(/^export /gm, '');
const html = fs.readFileSync(new URL('demo.template.html', dir), 'utf8').replace('/*__WALK_MODULE__*/', () => walk);
fs.writeFileSync(new URL('walk-demo.html', dir), html);
console.log('walk-demo.html', (html.length / 1024).toFixed(1) + ' KB');
