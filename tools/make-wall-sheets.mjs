// ChatGPT 가 만든 벽 정면 입면도(투명 배경) → 게임용 텍스처
//  - 알파 기준으로 실루엣 높이에 맞춰 크롭, 좌우는 필라스터 중심선에서 잘라 모듈끼리 이음새 없이 이어붙임
//  - 명암에서 약한 요철(법선) 맵 생성: 조명이 균일한 그림이라 필라스터/몰딩에 입체감을 준다
//  - cut: 문처럼 "열려 있어야 하는" 영역을 투명하게 잘라냄, leaves: 잘라낸 문짝을 별도 이미지로 저장(3D 로 열어둠)
// 실행: node tools/make-wall-sheets.mjs
import sharp from 'sharp';
import fs from 'node:fs';

const REF = 'assets/ref/hall/';
const OUT = 'public/assets/zone02/';
fs.mkdirSync(OUT, { recursive: true });

// 모든 시트의 높이는 홀 벽 높이(7m)에 대응한다 (alpha 실루엣 높이 = 7m)
const WALL_H = 7.0;
const SHEETS = [
  { name: 'wall_north', file: 'wall-north-elevation.webp', xr: [78, 1178] },       // 북쪽: 큰 초상화 + 벽감 2
  // 북쪽 v2 (2026-10-14): 초상화 자리가 빈 3칸 모듈(1500x1050). 좌우 필라스터 중심선(캐피털 블록 중심)에서 잘라 2장을 10m 씩 붙인다.
  { name: 'wall_north_a', file: 'wall-north-v2-27.webp', xr: [45, 1448], widthM: 10 },
  { name: 'wall_north_b', file: 'wall-north-v2-29.webp', xr: [47, 1448], widthM: 10 },
  { name: 'wall_north_side', file: 'wall-north-elevation.webp', xr: [78, 866] },   // 남쪽 좌우 보충용 (벽감 + 큰 초상화 베이)
  { name: 'wall_north_side_b', file: 'wall-north-elevation.webp', xr: [395, 865] }, // 동쪽 벽 북쪽 보충용: 큰 초상화 베이만 (필라스터~필라스터)
  {
    // 동쪽: 열린 문틀 2개 + 태피스트리 2 + 큰 초상화 + 문 위 초상화 2. 문 구멍은 원본에서 이미 투명.
    // marks: 문 중심 x(원본 px). 엔진이 레이아웃의 문 간격(8m)에 맞춰 가로를 압축/배치한다.
    // v2 (1536x1024, 좌우 대칭): 동/서 공용. 문 중심 x = 322 / 1213.5
    name: 'wall_east', file: 'wall-eastwest-elevation-v2.webp', xr: [100, 1435], marks: { d1: 322, d2: 1213.5 },
  },
  {
    // 서쪽: 열린 문틀 2개(서재로 통함) + 태피스트리 2 + 큰 초상화(여성) + 문 위 초상화 2. 영상 왼쪽 = 월드 +z(남쪽).
    name: 'wall_west', file: 'wall-eastwest-elevation-v2.webp', xr: [100, 1435], marks: { d1: 322, d2: 1213.5 },
  },
  {
    // 남쪽 v2: 열린 문틀(알파로 이미 뚫림) + 부채꼴 채광창 + 벽감 2. 문짝 없음.
    // widthM: 원본 비율(약 7.3m)보다 가로를 늘려 문 폭을 1.75m 로 맞춘다(콜리전 문 폭 2.4m 와 비슷하게).
    name: 'wall_south', file: 'wall-south-elevation-v2.webp', xr: [80, 1172], widthM: 9.4,
  },
];

const meta = {};
for (const sh of SHEETS) {
  const src = await sharp(REF + sh.file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = src.info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (src.data[(y * W + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const pxPerM = (y1 - y0 + 1) / WALL_H;
  if (sh.xr) { x0 = sh.xr[0]; x1 = sh.xr[1] - 1; }
  const crop = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };

  // 문짝 추출 (원본 좌표)
  const leaves = {};
  for (const [lname, [lx0, ly0, lx1, ly1]] of sh.leaves ?? []) {
    const r = { left: lx0, top: ly0, width: lx1 - lx0, height: ly1 - ly0 };
    await sharp(REF + sh.file).ensureAlpha().extract(r).sharpen({ sigma: 0.9, m1: 0.2, m2: 1.8 }).png().toFile(OUT + lname + '.png');
    leaves[lname] = { w: r.width / pxPerM, h: r.height / pxPerM, cx: ((lx0 + lx1) / 2 - x0) / pxPerM };
  }

  const rgba = await sharp(REF + sh.file).ensureAlpha().extract(crop).raw().toBuffer();
  const cw = crop.width, ch = crop.height;
  const out = Buffer.from(rgba);
  // 열려 있어야 하는 영역(문) 투명 처리
  if (sh.cut) {
    const [cx0, cy0, cx1, cy1] = sh.cut;
    for (let y = cy0 - crop.top; y < cy1 - crop.top; y++) for (let x = cx0 - crop.left; x < cx1 - crop.left; x++) {
      if (x >= 0 && x < cw && y >= 0 && y < ch) out[(y * cw + x) * 4 + 3] = 0;
    }
  }
  // 투명 픽셀 색은 중립 석재색으로 (밉맵/필터링 시 번짐 방지)
  for (let i = 0; i < cw * ch; i++) { if (out[i * 4 + 3] < 8) { out[i * 4] = 150; out[i * 4 + 1] = 138; out[i * 4 + 2] = 122; } }
  await sharp(out, { raw: { width: cw, height: ch, channels: 4 } }).sharpen({ sigma: 0.9, m1: 0.2, m2: 1.8 }).png({ compressionLevel: 9 }).toFile(OUT + sh.name + '.png');

  // 법선 (밝기 기반 약한 요철)
  const gray = Buffer.alloc(cw * ch);
  for (let i = 0; i < cw * ch; i++) gray[i] = Math.round(rgba[i * 4] * 0.3 + rgba[i * 4 + 1] * 0.59 + rgba[i * 4 + 2] * 0.11);
  const hs = await sharp(gray, { raw: { width: cw, height: ch, channels: 1 } }).blur(1.1).raw().toBuffer();
  const nrm = Buffer.alloc(cw * ch * 3);
  const NS = 5.0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const gx = (hs[y * cw + Math.min(cw - 1, x + 1)] - hs[y * cw + Math.max(0, x - 1)]) / 255;
    const gy = (hs[Math.min(ch - 1, y + 1) * cw + x] - hs[Math.max(0, y - 1) * cw + x]) / 255;
    let nx = -gx * NS, ny = gy * NS, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = (y * cw + x) * 3;
    nrm[k] = (nx * 0.5 + 0.5) * 255; nrm[k + 1] = (ny * 0.5 + 0.5) * 255; nrm[k + 2] = (nz * 0.5 + 0.5) * 255;
  }
  await sharp(nrm, { raw: { width: cw, height: ch, channels: 3 } }).png().toFile(OUT + sh.name + '_normal.png');

  const marks = {};
  for (const [k, v] of Object.entries(sh.marks ?? {})) marks[k] = (v - x0) / pxPerM; // 시트 왼쪽 가장자리 기준 m
  meta[sh.name] = { px: [cw, ch], pxPerM, widthM: sh.widthM ?? cw / pxPerM, heightM: WALL_H, leaves, marks };
}
fs.writeFileSync(OUT + 'wall_sheets.json', JSON.stringify(meta, null, 2));
for (const [k, v] of Object.entries(meta)) console.log(k, `${v.px[0]}x${v.px[1]}px`, `${v.widthM.toFixed(2)}m x ${v.heightM}m`, `${v.pxPerM.toFixed(0)}px/m`, Object.keys(v.leaves).length ? 'leaves:' + JSON.stringify(v.leaves) : '');
