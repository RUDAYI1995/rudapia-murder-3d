// 주인공 턴어라운드 시트 → "3면도 입체 모델" 데이터
//  정면/측면 그림의 실루엣으로 각 부품(머리, 몸통, 팔, 허벅지, 정강이)의 단면(가로폭=정면, 두께=측면)을 높이마다 계산하고,
//  그 단면을 쌓아 입체(비주얼 헐)를 만든다. 색은 런타임에 정면/후면/측면 그림을 삼면 투영으로 입힌다.
//  → 판자(종이 인형)와 달리 어느 각도에서 봐도 부피가 있는 사람 모양이 된다.
// 출력: public/assets/zone02/hero/hero_sheet.png (투명 가장자리를 주변 색으로 번지게 한 불투명 시트), src/data/hero_hull.json
// 실행: node tools/make-hero-hull.mjs
import sharp from 'sharp';
import fs from 'node:fs';

const SRC = 'assets/ref/character/hero-turnaround.webp';
const OUT = 'public/assets/zone02/hero/';
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(OUT + f);

const S = 1.78 / 1000, FIG_TOP = 9, CX = { F: 371.5, B: 1177, S: 765 };
const worldY = py => 1.78 - (py - FIG_TOP) * S;

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const A = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : data[(y * W + x) * 4 + 3]);
const OP = 200; // 실루엣 판정 알파

// ── 1) 투명 가장자리 색 번짐(bleed): 헐 경계에서 투명 픽셀이 보이지 않게 ──
{
  const rgb = Buffer.alloc(W * H * 3), filled = new Uint8Array(W * H);
  let q = [];
  for (let i = 0; i < W * H; i++) { if (data[i * 4 + 3] > 128) { rgb[i * 3] = data[i * 4]; rgb[i * 3 + 1] = data[i * 4 + 1]; rgb[i * 3 + 2] = data[i * 4 + 2]; filled[i] = 1; q.push(i); } }
  for (let pass = 0; pass < 28; pass++) {
    const nq = [];
    for (const i of q) {
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx; if (filled[j]) continue;
        filled[j] = 1; rgb[j * 3] = rgb[i * 3]; rgb[j * 3 + 1] = rgb[i * 3 + 1]; rgb[j * 3 + 2] = rgb[i * 3 + 2]; nq.push(j);
      }
    }
    q = nq;
  }
  for (let i = 0; i < W * H; i++) if (!filled[i]) { rgb[i * 3] = 70; rgb[i * 3 + 1] = 66; rgb[i * 3 + 2] = 64; }
  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9 }).toFile(OUT + 'hero_sheet.png');
}

// ── 2) 부품별 단면 ──
const runIn = (y, x0, x1) => { // 한 줄에서 [x0,x1) 안의 불투명 구간 최소/최대
  let lo = -1, hi = -1;
  for (let x = x0; x < x1; x++) if (A(x, y) > OP) { if (lo < 0) lo = x; hi = x; }
  return lo < 0 ? null : [lo, hi + 1];
};
// name: { node, pivot(월드, 서 있을 때), rows:[y0,y1], F:[x0,x1] 정면 창, S:[x0,x1]|null 측면 창, round?:true(팔: 두께=폭), n:단면 모양 지수 }
const PARTS = {
  head: { pivot: [0, 1.68, 0], rows: [3, 213], F: [290, 470], S: [660, 850], n: 2.4 },
  torso: { pivot: [0, 0.92, 0], rows: [183, 497], F: [285, 470], S: [655, 945], n: 3.0 },
  'arm-': { pivot: [-0.205, 1.47, 0], rows: [183, 602], F: [176, 285], round: true, n: 2.2 },
  'arm+': { pivot: [0.205, 1.47, 0], rows: [183, 602], F: [470, 567], round: true, n: 2.2 },
  'thigh-': { pivot: [-0.097, 0.92, 0], rows: [492, 736], F: [250, 372], S: [680, 855], n: 2.4 },
  'thigh+': { pivot: [0.097, 0.92, 0], rows: [492, 736], F: [372, 495], S: [680, 855], n: 2.4 },
  'shin-': { pivot: [-0.097, 0.489, 0], rows: [734, 1010], F: [205, 372], S: [650, 850], n: 2.4 },
  'shin+': { pivot: [0.097, 0.489, 0], rows: [734, 1010], F: [372, 545], S: [650, 850], n: 2.4 },
};
const INSET = 2; // 경계 번짐을 피하려고 실루엣을 2px 안쪽으로
const out = { S, CX, FIG_TOP, parts: {} };
for (const [name, p] of Object.entries(PARTS)) {
  let rows = [];
  for (let y = p.rows[0]; y <= p.rows[1]; y += 4) {
    const f = runIn(y, p.F[0], p.F[1]); if (!f) continue;
    const xmin = f[0] + INSET, xmax = f[1] - INSET; if (xmax - xmin < 4) continue;
    const xc = ((xmin + xmax) / 2 - CX.F) * S, a = ((xmax - xmin) / 2) * S;
    let zc = 0, b = a * 0.95;
    if (p.S) {
      const s = runIn(y, p.S[0], p.S[1]);
      if (s) { const zf = -(s[0] + INSET - CX.S) * S, zb = -(s[1] - INSET - CX.S) * S; zc = (zf + zb) / 2; b = Math.max(0.025, (zf - zb) / 2); }
    }
    rows.push({ y: worldY(y), xc, a, zc, b });
  }
  // 줄마다 들쭉날쭉한 것을 부드럽게 (5줄 이동 평균)
  const sm = (k) => rows.map((r, i) => { let s = 0, n = 0; for (let d = -2; d <= 2; d++) { const q = rows[i + d]; if (q) { s += q[k]; n++; } } return s / n; });
  const xc = sm('xc'), a = sm('a'), zc = sm('zc'), b = sm('b');
  rows = rows.map((r, i) => [+r.y.toFixed(4), +xc[i].toFixed(4), +a[i].toFixed(4), +zc[i].toFixed(4), +b[i].toFixed(4)]);
  out.parts[name] = { pivot: p.pivot, n: p.n, rows };
}
fs.writeFileSync('src/data/hero_hull.json', JSON.stringify(out));
console.log(Object.entries(out.parts).map(([k, v]) => `${k}:${v.rows.length}`).join(' '));
