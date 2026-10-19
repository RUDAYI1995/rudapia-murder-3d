// ChatGPT 홀 이미지 → 게임용 텍스처 추출
//  - 탑다운 전체 평면(hall-top-full) 에서 바닥 필드를 잘라 알베도/거칠기/법선 생성 (조명 제거 + 중앙 탁자·의자 영역 채우기)
//  - 원근 이미지에서 초상화·태피스트리 크롭
// 실행: node tools/make-hall-assets.mjs
import sharp from 'sharp';
import fs from 'node:fs';

const REF = 'assets/ref/hall/';
const OUT = 'public/assets/zone02/';
fs.mkdirSync(OUT, { recursive: true });

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ───────── 1. 바닥 ─────────
// 이미지 스케일: 원탁 지름 ≈ 5m ↔ 약 138px  → 27.6 px/m. 탁자 중심 (768,505) = 월드 (10, 14)
const PXM = 27.6;
const crop = { left: 538, top: 300, width: 462, height: 430 };
const UP = 3; // 업스케일 배율 (원본이 27.6px/m 라 3배 → 약 83px/m. 런타임 디테일 레이어가 나머지 선명도를 보강)
const W = crop.width * UP, H = crop.height * UP;
const cx = (768 - crop.left) * UP, cy = (505 - crop.top) * UP;

const base = await sharp(REF + 'hall-top-full.webp').extract(crop).resize(W, H, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
const px = new Float32Array(W * H * 3);
for (let i = 0; i < px.length; i++) px[i] = base[i];

// 1-a 중앙(원탁+의자) 영역을 카펫 바깥 띠를 방사 방향으로 늘려 채움 (3D 원탁/의자가 얹히므로 바닥에 박힌 그림 제거)
const R0 = 108 * UP;            // 의자 바깥 반경(px)
const BAND0 = R0 + 10, BAND1 = R0 + 52;
const filled = new Float32Array(px);
// 카펫 바깥 띠(붉은 부분)의 평균색을 구해 단색 카펫으로 채운다 (방사 늘리기는 줄무늬가 생겨서 폐기)
const base3 = [0, 0, 0]; let cnt = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const r = Math.hypot(x - cx, y - cy);
  if (r > R0 + 24 && r < R0 + 40) { for (let c = 0; c < 3; c++) base3[c] += px[(y * W + x) * 3 + c]; cnt++; }
}
for (let c = 0; c < 3; c++) base3[c] /= cnt;
base3[0] = 128; base3[1] = 30; base3[2] = 38; // 평균색은 금장식 때문에 갈색이 되므로 깊은 붉은색으로 고정
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
    if (r >= R0 + 8) continue;
    const mixK = 1 - smooth(R0 - 6, R0 + 8, r);
    const lat = 0.5 + 0.5 * Math.sin(x / UP * 3.1) * Math.sin(y / UP * 3.1); // 은은한 격자 무늬
    const wv = 0.9 + 0.1 * hash(x >> 1, y >> 1) + 0.07 * lat;
    for (let c = 0; c < 3; c++) {
      const v = base3[c] * wv;
      filled[(y * W + x) * 3 + c] = px[(y * W + x) * 3 + c] * (1 - mixK) + v * mixK;
    }
  }
}

// 1-b 조명 제거: 저주파 밝기를 평균으로 평탄화 + 촛불 반사(밝은 점) 억제
const filledU8 = Buffer.alloc(W * H * 3);
for (let i = 0; i < filled.length; i++) filledU8[i] = clamp(Math.round(filled[i]), 0, 255);
const blur = await sharp(filledU8, { raw: { width: W, height: H, channels: 3 } }).blur(46 * UP / 2).raw().toBuffer();
const small = await sharp(filledU8, { raw: { width: W, height: H, channels: 3 } }).blur(5 * UP / 2).raw().toBuffer();
let mean = 0; for (let i = 0; i < blur.length; i++) mean += blur[i]; mean /= blur.length;
const albedo = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  const lb = (blur[i * 3] * 0.3 + blur[i * 3 + 1] * 0.59 + blur[i * 3 + 2] * 0.11) + 1;
  const gain = clamp(mean / lb, 0.55, 1.6);
  for (let c = 0; c < 3; c++) {
    let v = filledU8[i * 3 + c] * (1 + (gain - 1) * 0.85);
    // 작은 밝은 점(촛불 반사) 억제: 주변(blur 5) 대비 너무 밝으면 눌러줌
    const s = small[i * 3 + c];
    if (v > s * 1.18) v = s * 1.18 + (v - s * 1.18) * 0.25;
    albedo[i * 3 + c] = clamp(Math.round(v * 1.15), 0, 255); // 대리석이 레퍼런스처럼 밝게
  }
  // 원본이 따뜻한 촛불빛으로 찍혀 있어, 게임 조명(따뜻함)과 겹치면 주황색이 된다 → 대리석 부분 채도를 낮춰 중립 베이지로
  const r0 = albedo[i * 3], g0 = albedo[i * 3 + 1], b0 = albedo[i * 3 + 2];
  const mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0);
  const sat = mx ? (mx - mn) / mx : 0;
  const isRed = r0 > g0 * 1.3 && sat > 0.4;
  const desat = isRed ? 0.0 : 0.8 * (1 - smooth(0.3, 0.6, sat)); // 원본의 촛불빛 주황 번짐 제거
  const lum = r0 * 0.3 + g0 * 0.59 + b0 * 0.11;
  albedo[i * 3] = clamp(Math.round(r0 + (lum - r0) * desat), 0, 255);
  albedo[i * 3 + 1] = clamp(Math.round(g0 + (lum - g0) * desat), 0, 255);
  albedo[i * 3 + 2] = clamp(Math.round(b0 + (lum - b0) * desat + (isRed ? 0 : 4)), 0, 255);
}
await sharp(albedo, { raw: { width: W, height: H, channels: 3 } }).sharpen({ sigma: 1.2 * UP / 2, m1: 0.2, m2: 2.4, x1: 2, y2: 12, y3: 24 }).png({ compressionLevel: 9 }).toFile(OUT + 'hall_floor_albedo.png');

// 1-c 거칠기(카펫=거침, 대리석=반들) + 법선(조인트/문양 요철)
const rough = Buffer.alloc(W * H * 3);
const height = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const r = albedo[i * 3], g = albedo[i * 3 + 1], b = albedo[i * 3 + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const sat = mx ? (mx - mn) / mx : 0;
  const red = smooth(0.32, 0.55, sat) * (r > g * 1.25 ? 1 : 0);
  const rv = (0.4 + 0.5 * red) * 255;
  rough[i * 3] = rv; rough[i * 3 + 1] = rv; rough[i * 3 + 2] = rv;
  const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
  height[i] = lum * (1 - red * 0.0) + red * 0.12;
}
await sharp(rough, { raw: { width: W, height: H, channels: 3 } }).png().toFile(OUT + 'hall_floor_rough.png');
const nrm = Buffer.alloc(W * H * 3);
const hs = await sharp(Buffer.from(height.map(v => Math.round(v * 255))), { raw: { width: W, height: H, channels: 1 } }).blur(1.2).raw().toBuffer();
const NS = 2.2;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const gx = (hs[y * W + Math.min(W - 1, x + 1)] - hs[y * W + Math.max(0, x - 1)]) / 255;
  const gy = (hs[Math.min(H - 1, y + 1) * W + x] - hs[Math.max(0, y - 1) * W + x]) / 255;
  let nx = -gx * NS * 4, ny = gy * NS * 4, nz = 1;
  const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
  const k = (y * W + x) * 3;
  nrm[k] = (nx * 0.5 + 0.5) * 255; nrm[k + 1] = (ny * 0.5 + 0.5) * 255; nrm[k + 2] = (nz * 0.5 + 0.5) * 255;
}
await sharp(nrm, { raw: { width: W, height: H, channels: 3 } }).png().toFile(OUT + 'hall_floor_normal.png');

// 월드 배치 정보 (decal 평면 중심/크기)
const toWorld = (pxx, pyy) => [10 + (pxx - 768) / PXM, 14 + (pyy - 505) / PXM];
const [wx0, wz0] = toWorld(crop.left, crop.top), [wx1, wz1] = toWorld(crop.left + crop.width, crop.top + crop.height);
const meta = {
  floor: { cx: (wx0 + wx1) / 2, cz: (wz0 + wz1) / 2, w: wx1 - wx0, d: wz1 - wz0, px: [W, H], pxPerM: (W / (wx1 - wx0)) },
};

// ───────── 2. 남쪽 러너 (홀 남쪽 문 ~ 현관) ─────────
{
  const c = { left: 716, top: 700, width: 106, height: 138 };
  const [x0, z0] = toWorld(c.left, c.top), [x1, z1] = toWorld(c.left + c.width, c.top + c.height);
  const buf = await sharp(REF + 'hall-top-full.webp').extract(c).resize(c.width * UP, c.height * UP, { kernel: 'lanczos3' }).png().toBuffer();
  const raw = await sharp(buf).removeAlpha().raw().toBuffer();
  const bl = await sharp(buf).blur(30).removeAlpha().raw().toBuffer();
  let m = 0; for (const v of bl) m += v; m /= bl.length;
  const out = Buffer.alloc(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = clamp(Math.round(raw[i] * clamp(m / (bl[i] + 1), 0.6, 1.5) * 0.92), 0, 255);
  await sharp(out, { raw: { width: c.width * UP, height: c.height * UP, channels: 3 } }).sharpen({ sigma: 1.2 * UP / 2, m1: 0.2, m2: 2.4 }).png({ compressionLevel: 9 }).toFile(OUT + 'hall_runner_south.png');
  meta.runner = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
}

// ───────── 3. 초상화 / 태피스트리 크롭 (원근 이미지에서) ─────────
const crops = [
  ['portrait_a', 'hall-view-balcony.webp', { left: 318, top: 68, width: 104, height: 142 }],
  ['portrait_b', 'hall-view-balcony.webp', { left: 1116, top: 66, width: 106, height: 144 }],
  ['portrait_d', 'hall-view-south-c.webp', { left: 414, top: 168, width: 108, height: 130 }],
  ['portrait_e', 'hall-view-south-c.webp', { left: 1018, top: 168, width: 108, height: 130 }],
  ['tapestry_a', 'hall-view-south-c.webp', { left: 716, top: 280, width: 100, height: 204 }],
];
for (const [name, file, rect] of crops) {
  await sharp(REF + file).extract(rect).resize(rect.width * 3, rect.height * 3, { kernel: 'lanczos3' }).sharpen({ sigma: 1.4, m1: 0.2, m2: 2.2 }).png().toFile(OUT + name + '.png');
}

fs.writeFileSync(OUT + 'hall_assets.json', JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta, null, 2));

// 확인용 콘택트 시트
const names = crops.map(c => c[0]);
const cells = await Promise.all(names.map(async n => ({ input: await sharp(OUT + n + '.png').resize({ height: 300, fit: 'contain', background: '#222' }).png().toBuffer() })));
const widths = await Promise.all(cells.map(async c => (await sharp(c.input).metadata()).width));
let x = 0; const comp = cells.map((c, i) => { const o = { input: c.input, left: x, top: 0 }; x += widths[i] + 6; return o; });
await sharp({ create: { width: x, height: 300, channels: 3, background: '#222' } }).composite(comp).png().toFile(OUT + '_contact.png');
