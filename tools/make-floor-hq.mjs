// 고화질 홀 바닥(메달리온) → 게임용 텍스처
//  - 가장자리를 부드럽게 투명화(바탕 대리석과 이음새 없이 섞이도록)
//  - 샤프닝, 약한 법선 맵, 거칠기(광택 대리석 상수) 생성
// 이미지 스케일: 안쪽 원(탁자+의자가 놓이는 반경 3.9m) 이 이미지에서 반지름 335px → 약 86 px/m, 정사각 14.6m
// 실행: node tools/make-floor-hq.mjs
import sharp from 'sharp';
import fs from 'node:fs';

const SRC = 'assets/ref/hall/floor-medallion-v2.webp';
const OUT = 'public/assets/zone02/';
fs.mkdirSync(OUT, { recursive: true });

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const SIZE_M = 12.4; // 새 이미지(정사각 문양 전체)를 12.4m 로 깐다: 안쪽 링 반지름 약 2.9m, 큰 링 약 5.4m
const PXM = 1254 / SIZE_M;

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const rgb = Buffer.from(data);

// 가장자리 알파 페더 (바깥 0.9m)
const feather = 0.03 * PXM; // 문양 테두리는 디자인된 경계라 거의 그대로 둔다
const rgba = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const e = Math.min(x, y, W - 1 - x, H - 1 - y);
  const a = smooth(0, feather, e);
  const i = (y * W + x) * 4, j = (y * W + x) * 3;
  rgba[i] = rgb[j]; rgba[i + 1] = rgb[j + 1]; rgba[i + 2] = rgb[j + 2]; rgba[i + 3] = Math.round(a * 255);
}
await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).sharpen({ sigma: 0.9, m1: 0.2, m2: 1.6 }).png({ compressionLevel: 9 }).toFile(OUT + 'hall_floor_hq_albedo.png');

// 법선: 밝기 기반 아주 약한 요철(조인트/링 경계)
const gray = Buffer.alloc(W * H);
for (let i = 0; i < W * H; i++) gray[i] = Math.round(rgb[i * 3] * 0.3 + rgb[i * 3 + 1] * 0.59 + rgb[i * 3 + 2] * 0.11);
const hs = await sharp(gray, { raw: { width: W, height: H, channels: 1 } }).blur(1.0).raw().toBuffer();
const nrm = Buffer.alloc(W * H * 3);
const NS = 3.0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const gx = (hs[y * W + Math.min(W - 1, x + 1)] - hs[y * W + Math.max(0, x - 1)]) / 255;
  const gy = (hs[Math.min(H - 1, y + 1) * W + x] - hs[Math.max(0, y - 1) * W + x]) / 255;
  let nx = -gx * NS, ny = gy * NS, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
  const k = (y * W + x) * 3; nrm[k] = (nx * 0.5 + 0.5) * 255; nrm[k + 1] = (ny * 0.5 + 0.5) * 255; nrm[k + 2] = (nz * 0.5 + 0.5) * 255;
}
await sharp(nrm, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9 }).toFile(OUT + 'hall_floor_hq_normal.png');

// 평균색 (바탕 대리석 색 맞춤용)
let r = 0, g = 0, b = 0; for (let i = 0; i < W * H; i++) { r += rgb[i * 3]; g += rgb[i * 3 + 1]; b += rgb[i * 3 + 2]; }
const n = W * H; const avg = [r / n, g / n, b / n].map(v => Math.round(v));

const meta = { px: [W, H], pxPerM: PXM, sizeM: W / PXM, centerWorld: { x: 10, z: 14 }, avg };
fs.writeFileSync(OUT + 'hall_floor_hq.json', JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta));

