// 절차적 PBR 재질 모음. 실제 텍스처(ChatGPT 시트)가 들어오면 같은 키로 교체하면 된다.
// 각 재질의 userData.tile = 텍스처 1장이 덮는 월드 크기(m). 지오메트리 UV 를 이 값으로 스케일한다.
import * as THREE from 'three';
import { buildPBR } from './pbr.js';
import { fbm, vnoise, hash2, smoothstep, mix, clamp01 } from './noise.js';
import { addDetail } from './detail.js';

const TAU = Math.PI * 2;

// ───────────── 픽셀 함수들 ─────────────

// 대리석 타일 (1m 타일 4×4 / 4m)
function marblePixel(u, v, o) {
  const N = 4;
  const fu = u * N, fv = v * N;
  const iu = Math.floor(fu), iv = Math.floor(fv);
  const lu = fu - iu, lv = fv - iv;
  const edge = Math.min(lu, 1 - lu, lv, 1 - lv);
  const tint = hash2(iu, iv, 5);
  const w = fbm(u, v, 4, 4, 1 + ((iu + iv * 3) & 3));
  const s = Math.abs(Math.sin((3 * u + 2 * v + 2.4 * w) * Math.PI));
  const vein = Math.pow(1 - s, 16);
  const vein2 = Math.pow(1 - Math.abs(Math.sin((2 * u - 3 * v + 3.1 * fbm(u, v, 6, 3, 9)) * Math.PI)), 22) * 0.6;
  const mott = fbm(u, v, 24, 3, 9) - 0.5;
  const base = 0.9 + 0.1 * tint;
  let r = 228 * base + mott * 26, g = 220 * base + mott * 24, b = 205 * base + mott * 22;
  const vv = Math.min(1, vein + vein2) * 0.36; // 메달리온 대리석과 결 세기를 맞추려고 옅게
  r = mix(r, 170, vv); g = mix(g, 158, vv); b = mix(b, 146, vv);
  if (edge < 0.008) { r = 138; g = 128; b = 118; o.h = 0; o.rough = 0.9; } // 줄눈: 가늘고 연하게(예전 74,68,62 는 검은 선처럼 보임)
  else {
    o.h = 0.6 + 0.4 * smoothstep(0.011, 0.035, edge) + (mott * 0.03);
    o.rough = 0.2 + 0.16 * fbm(u, v, 8, 3, 3) + vv * 0.05;
  }
  o.r = r; o.g = g; o.b = b;
}

// 마루 (플랭크, 2m)
function parquetPixel(u, v, o) {
  const rows = 8;
  const fv = v * rows, row = Math.floor(fv), lv = fv - row;
  const off = hash2(row, 0, 3);
  const fu = (u * 2 + off) % 2;
  const col = Math.floor(fu), lu = fu - col;
  const id = hash2(row, col, 11);
  const seam = lv < 0.035 || lv > 0.985 || lu < 0.02;
  const grain = 0.5 + 0.5 * Math.sin((lv * (9 + id * 7) + fbm(u, v, 16, 3, row) * 6) * TAU);
  const k = 0.7 + 0.5 * id;
  const f = 0.86 + 0.2 * grain;
  o.r = (66 + 62 * id) * f * k * 0.8 + 6; o.g = (38 + 40 * id) * f * k * 0.8 + 4; o.b = (22 + 26 * id) * f * k * 0.8 + 3;
  if (seam) { o.r *= 0.35; o.g *= 0.35; o.b *= 0.35; o.h = 0.1; o.rough = 0.9; }
  else { o.h = 0.55 + grain * 0.06; o.rough = 0.38 + 0.2 * (1 - grain); }
}

// 다마스크 벽지 (1m). base 색 + 문양 색
function damaskFactory(base, motif) {
  return function (u, v, o) {
    const fu0 = u * 2, fv = v * 2;
    const row = Math.floor(fv);
    const fu = fu0 + (row & 1) * 0.5;
    const lx = fu - Math.floor(fu) - 0.5, ly = fv - row - 0.5;
    const r = Math.hypot(lx * 1.0, ly * 0.85);
    const a = Math.atan2(ly, lx);
    const shape = 0.27 + 0.09 * Math.cos(a * 6) + 0.03 * Math.cos(a * 12);
    let m = smoothstep(shape + 0.015, shape - 0.015, r);
    const ring = 0.5 + 0.5 * Math.cos(r * 52);
    m *= 0.55 + 0.45 * ring;
    const stem = smoothstep(0.03, 0.012, Math.abs(lx)) * smoothstep(0.5, 0.36, Math.abs(ly)) * 0.8;
    const leaf = smoothstep(0.05, 0.02, Math.abs(Math.abs(lx) - 0.14 * Math.sin(ly * 9) - 0.02)) * smoothstep(0.46, 0.3, Math.abs(ly)) * 0.45;
    m = clamp01(Math.max(m, stem, leaf));
    const weave = hash2(Math.floor(u * 384), Math.floor(v * 384), 4) * 0.08 - 0.04;
    const f = 1 + weave + (fbm(u, v, 8, 3, 2) - 0.5) * 0.18;
    o.r = mix(base[0], motif[0], m) * f; o.g = mix(base[1], motif[1], m) * f; o.b = mix(base[2], motif[2], m) * f;
    o.h = 0.45 + m * 0.12 + weave * 0.5;
    o.rough = 0.85 - m * 0.2;
  };
}

// 목재 패널 (웨인스코팅, 1m)
function woodPanelPixel(u, v, o) {
  const dOuter = Math.min(u - 0.1, 0.9 - u, v - 0.08, 0.92 - v);
  const dInner = Math.min(u - 0.2, 0.8 - u, v - 0.17, 0.83 - v);
  const grain = 0.5 + 0.5 * Math.sin((v * 30 + fbm(u, v, 8, 3, 2) * 9) * TAU * 0.5);
  const base = 0.8 + 0.3 * grain;
  let h;
  if (dInner > 0) h = 0.72 + Math.min(dInner, 0.04) * 1.2;
  else if (dOuter > 0) h = 0.3 + smoothstep(0, 0.1, -dInner) * -0.1;
  else h = 0.62;
  if (dInner <= 0 && dOuter > 0) h = 0.22 + 0.2 * smoothstep(0, 0.1, dOuter);
  o.h = h;
  const shade = dInner > 0 ? 1.0 : dOuter > 0 ? 0.62 : 0.92;
  o.r = 74 * base * shade; o.g = 40 * base * shade; o.b = 27 * base * shade;
  o.rough = 0.4 + 0.15 * (1 - grain);
}

// 석조 외벽 (ashlar, 2m)
function ashlarPixel(u, v, o) {
  const rows = 4;
  const fv = v * rows, row = Math.floor(fv), lv = fv - row;
  const a = 0.25 + hash2(row, 1, 7) * 0.25, b = 0.25 + hash2(row, 2, 7) * 0.25, c = 0.25 + hash2(row, 3, 7) * 0.25;
  const s = a + b + c;
  const shift = hash2(row, 9, 7);
  const uu = (u + shift) % 1;
  const p = uu * s;
  let k, lo, hi;
  if (p < a) { k = 0; lo = 0; hi = a; } else if (p < a + b) { k = 1; lo = a; hi = a + b; } else { k = 2; lo = a + b; hi = s; }
  const lu = (p - lo) / (hi - lo);
  const edgeU = Math.min(lu * (hi - lo), (1 - lu) * (hi - lo));
  const edgeV = Math.min(lv, 1 - lv) * 0.25 * 4 * 0.5;
  const mortar = edgeU < 0.012 || Math.min(lv, 1 - lv) < 0.02;
  const id = hash2(row, k, 13);
  const n = fbm(u, v, 12, 4, 5);
  const n2 = fbm(u, v, 40, 2, 8);
  const stain = smoothstep(0.55, 0.9, fbm(u, v, 3, 3, 21)) * 0.3;
  const t = 0.78 + 0.22 * id + (n - 0.5) * 0.35 + (n2 - 0.5) * 0.12 - stain;
  if (mortar) { o.r = 58; o.g = 55; o.b = 52; o.h = 0.05; o.rough = 0.95; return; }
  const bevel = smoothstep(0.012, 0.04, Math.min(edgeU, Math.min(lv, 1 - lv) * 0.5));
  o.r = 128 * t; o.g = 121 * t; o.b = 111 * t;
  o.h = 0.45 + 0.4 * bevel + (n - 0.5) * 0.25 + (n2 - 0.5) * 0.08;
  o.rough = 0.85 + 0.1 * n;
}

// 자갈 포장 (보로노이, 2m)
function cobblePixel(u, v, o) {
  const n = 7;
  const x = u * n, y = v * n;
  const xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i, cy = yi + j;
      const wx = ((cx % n) + n) % n, wy = ((cy % n) + n) % n;
      const px = cx + 0.12 + hash2(wx, wy, 1) * 0.76;
      const py = cy + 0.12 + hash2(wx, wy, 2) * 0.76;
      const d = Math.hypot(x - px, y - py);
      if (d < f1) { f2 = f1; f1 = d; id = hash2(wx, wy, 3); } else if (d < f2) f2 = d;
    }
  }
  const edge = f2 - f1;
  const nz = fbm(u, v, 32, 3, 6);
  if (edge < 0.07) { o.r = 40; o.g = 38; o.b = 36; o.h = 0.05; o.rough = 1; return; }
  const t = 0.62 + 0.5 * id + (nz - 0.5) * 0.35;
  o.r = 118 * t; o.g = 112 * t; o.b = 104 * t;
  o.h = 0.35 + 0.5 * smoothstep(0.07, 0.35, edge) + (nz - 0.5) * 0.15;
  o.rough = 0.88;
}

// 판석 보도 (running bond, 2m)
function paversPixel(u, v, o) {
  const rows = 12;
  const fv = v * rows, row = Math.floor(fv), lv = fv - row;
  const fu = (u * 6 + (row & 1) * 0.5) % 6;
  const col = Math.floor(fu), lu = fu - col;
  const id = hash2(row, col, 17);
  const mortar = lv < 0.07 || lv > 0.95 || lu < 0.04 || lu > 0.97;
  const nz = fbm(u, v, 40, 3, 4);
  if (mortar) { o.r = 52; o.g = 50; o.b = 48; o.h = 0.05; o.rough = 1; return; }
  const t = 0.72 + 0.4 * id + (nz - 0.5) * 0.3;
  o.r = 120 * t; o.g = 116 * t; o.b = 110 * t;
  o.h = 0.55 + (nz - 0.5) * 0.12;
  o.rough = 0.82;
}

// 체크 타일 (주방, 2m)
function checkerPixel(u, v, o) {
  const N = 8;
  const fu = u * N, fv = v * N;
  const iu = Math.floor(fu), iv = Math.floor(fv);
  const lu = fu - iu, lv = fv - iv;
  const edge = Math.min(lu, 1 - lu, lv, 1 - lv);
  const black = (iu + iv) & 1;
  const nz = fbm(u, v, 48, 2, 3) - 0.5;
  if (edge < 0.025) { o.r = 98; o.g = 96; o.b = 90; o.h = 0.05; o.rough = 0.9; return; }
  const base = black ? 26 : 208;
  o.r = base + nz * 24; o.g = base + nz * 24 + (black ? 0 : -3); o.b = base + nz * 24 + (black ? 3 : -8);
  o.h = 0.6 + smoothstep(0.025, 0.06, edge) * 0.35;
  o.rough = 0.22 + 0.1 * (nz + 0.5);
}

// 서브웨이 타일 (벽, 1m)
function subwayPixel(u, v, o) {
  const rows = 8;
  const fv = v * rows, row = Math.floor(fv), lv = fv - row;
  const fu = (u * 4 + (row & 1) * 0.5) % 4;
  const lu = fu - Math.floor(fu);
  const edge = Math.min(lu, 1 - lu, lv * 2, (1 - lv) * 2);
  const nz = fbm(u, v, 40, 2, 8) - 0.5;
  if (edge < 0.03) { o.r = 150; o.g = 148; o.b = 140; o.h = 0.05; o.rough = 0.9; return; }
  o.r = 218 + nz * 18; o.g = 220 + nz * 18; o.b = 216 + nz * 18;
  o.h = 0.65 + smoothstep(0.03, 0.12, edge) * 0.3;
  o.rough = 0.18 + 0.1 * (nz + 0.5);
}

function concretePixel(u, v, o) {
  const n = fbm(u, v, 6, 5, 2), n2 = fbm(u, v, 64, 2, 9);
  const stain = smoothstep(0.5, 0.8, fbm(u, v, 3, 3, 14)) * 0.22;
  const t = 0.78 + n * 0.35 + (n2 - 0.5) * 0.1 - stain;
  o.r = 112 * t; o.g = 114 * t; o.b = 112 * t;
  o.h = 0.5 + (n - 0.5) * 0.3 + (n2 - 0.5) * 0.1;
  o.rough = 0.9;
}

function slatePixel(u, v, o) {
  const rows = 12;
  const fv = v * rows, row = Math.floor(fv), lv = fv - row;
  const fu = (u * 8 + (row & 1) * 0.5) % 8;
  const col = Math.floor(fu), lu = fu - col;
  const id = hash2(row, col, 23);
  const lap = smoothstep(0.0, 0.18, lv);
  const side = smoothstep(0, 0.05, Math.min(lu, 1 - lu));
  const t = 0.7 + 0.5 * id;
  o.r = 46 * t * (0.7 + 0.3 * lap); o.g = 52 * t * (0.7 + 0.3 * lap); o.b = 62 * t * (0.7 + 0.3 * lap);
  o.h = 0.3 + 0.6 * lap * side + (fbm(u, v, 30, 2, 3) - 0.5) * 0.1;
  o.rough = 0.6;
}

function grassPixel(u, v, o) {
  const n = fbm(u, v, 10, 5, 31), n2 = fbm(u, v, 80, 2, 9);
  const t = 0.55 + n * 0.7;
  const blade = hash2(Math.floor(u * 256), Math.floor(v * 256), 3);
  o.r = (40 + 26 * blade) * t * 0.7; o.g = (62 + 44 * blade) * t * 0.7; o.b = (32 + 12 * blade) * t * 0.7;
  o.h = 0.5 + (n2 - 0.5) * 0.35;
  o.rough = 1;
}

function gravelPixel(u, v, o) {
  const n = 30;
  const x = u * n, y = v * n;
  const xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j;
    const wx = ((cx % n) + n) % n, wy = ((cy % n) + n) % n;
    const d = Math.hypot(x - (cx + hash2(wx, wy, 1)), y - (cy + hash2(wx, wy, 2)));
    if (d < f1) { f1 = d; id = hash2(wx, wy, 3); }
  }
  const t = 0.55 + 0.7 * id;
  o.r = 104 * t; o.g = 98 * t; o.b = 90 * t;
  o.h = 1 - smoothstep(0, 0.7, f1);
  o.rough = 0.95;
}

function plasterPixel(u, v, o) {
  const n = fbm(u, v, 8, 4, 41), n2 = fbm(u, v, 90, 2, 5);
  o.r = 196 * (0.9 + n * 0.14); o.g = 186 * (0.9 + n * 0.14); o.b = 166 * (0.9 + n * 0.14);
  o.h = 0.5 + (n2 - 0.5) * 0.18 + (n - 0.5) * 0.1;
  o.rough = 0.92;
}

function hedgePixel(u, v, o) {
  const n = fbm(u, v, 18, 4, 7), l = vnoise(u, v, 64, 3);
  const t = 0.5 + n * 0.8;
  o.r = (24 + 24 * l) * t; o.g = (50 + 62 * l) * t; o.b = (24 + 14 * l) * t;
  o.h = 0.4 + l * 0.5;
  o.rough = 0.95;
}

// 홀 벽: 따뜻한 베이지 대리석 패널 (ChatGPT 홀 이미지의 벽 색감)
function hallStonePixel(u, v, o) {
  const rows = 3;
  const fv = v * rows, row = Math.floor(fv), lv = fv - row;
  const split = 0.3 + 0.4 * hash2(row, 2, 31);
  const off = hash2(row, 3, 31);
  const uu = (u + off) % 1;
  const k = uu < split ? 0 : 1;
  const lu = k === 0 ? uu / split : (uu - split) / (1 - split);
  const wid = k === 0 ? split : 1 - split;
  const edge = Math.min(lu * wid * 2, (1 - lu) * wid * 2, lv * 0.667, (1 - lv) * 0.667);
  const id = hash2(row, k, 33);
  const w = fbm(u, v, 3, 4, 7);
  const vein = Math.pow(1 - Math.abs(Math.sin((2 * u + 3 * v + 2.2 * w) * Math.PI)), 18) * 0.5;
  const mott = fbm(u, v, 18, 4, 9) - 0.5;
  const t = 0.84 + 0.18 * id + mott * 0.22 - vein * 0.25;
  if (edge < 0.006) { o.r = 112; o.g = 100; o.b = 88; o.h = 0.2; o.rough = 0.8; return; }
  o.r = 176 * t; o.g = 160 * t; o.b = 140 * t;
  o.h = 0.55 + 0.2 * smoothstep(0.006, 0.03, edge) + mott * 0.06;
  o.rough = 0.42 + 0.2 * (fbm(u, v, 10, 3, 3));
}

// 서재/침실용 어두운 마룻바닥 외에, 천장 격자 패널 (코퍼) 용 목재
function ceilingWoodPixel(u, v, o) {
  const grain = 0.5 + 0.5 * Math.sin((v * 22 + fbm(u, v, 10, 3, 4) * 7) * TAU * 0.5);
  const f = 0.7 + 0.35 * grain;
  o.r = 52 * f; o.g = 31 * f; o.b = 22 * f;
  o.h = 0.5 + grain * 0.05;
  o.rough = 0.55;
}

// ───────────── 장식용 (비타일) 데칼 ─────────────

// 홀 중앙 원형 카펫 + 대리석 인레이 (정규화 좌표 u,v → 반지름 m)
export function medallionPixel(u, v, o) {
  const x = (u - 0.5) * 12, y = (v - 0.5) * 12; // 12m 정사각
  const r = Math.hypot(x, y), a = Math.atan2(y, x);
  o.a = 0; o.h = 0.5; o.rough = 0.9; o.r = 0; o.g = 0; o.b = 0;
  const nz = hash2(Math.floor(u * 700), Math.floor(v * 700), 2) * 0.1;
  if (r > 5.6) return;
  o.a = 1;
  if (r < 4.1) {
    // 붉은 카펫: 동심 무늬 + 8각 별
    let rr = 120, gg = 22, bb = 30;
    const ring = Math.cos(r * 8) * 0.5 + 0.5;
    const star = Math.abs(Math.cos(a * 4)) ;
    const lattice = Math.abs(Math.sin(x * 5)) * Math.abs(Math.sin(y * 5));
    const t = 0.78 + ring * 0.12 + (star > 0.92 && r < 3.6 ? 0.25 : 0) + lattice * 0.08;
    rr *= t; gg *= t; bb *= t;
    if (r > 3.55 && r < 3.7) { rr = 190; gg = 150; bb = 70; }
    if (r > 3.8 && r < 4.05) { rr = 28; gg = 36; bb = 70; }
    o.r = rr + nz * 90; o.g = gg + nz * 50; o.b = bb + nz * 50; o.h = 0.55 + nz * 0.4; o.rough = 0.95;
  } else if (r < 4.3) {
    o.r = 196; o.g = 156; o.b = 78; o.h = 0.7; o.rough = 0.35; // 황동 링
  } else if (r < 5.4) {
    // 대리석 인레이 (24 구획 교차)
    const seg = Math.floor(((a + Math.PI) / TAU) * 24);
    const dark = (seg & 1) === 0;
    const band = r < 4.55 || r > 5.15;
    const inner = dark ? 0.35 : 0.9;
    const c = band ? 0.62 : inner;
    o.r = 220 * c + 8; o.g = 205 * c + 6; o.b = 180 * c + 4;
    o.h = 0.6; o.rough = 0.25;
  } else {
    o.r = 190; o.g = 150; o.b = 74; o.h = 0.72; o.rough = 0.35; // 바깥 황동 선
  }
}

// 홀 중앙 카펫 원판 (반지름 3.95m, 8m 정사각 판). 이미지 바닥의 붉은 원은 탁자·의자 영역을 단색으로 메운 부분이라 번져 보여서,
// 그 안쪽(r<3.95)을 고해상도 문양으로 다시 그려 덮는다. 바깥 테두리 띠는 이미지 그대로 둔다.
export function carpetDiscPixel(u, v, o) {
  const x = (u - 0.5) * 8, y = (v - 0.5) * 8;
  const r = Math.hypot(x, y), a = Math.atan2(y, x);
  o.a = 0; o.h = 0.5; o.rough = 0.96; o.r = 0; o.g = 0; o.b = 0;
  if (r > 3.98) return;
  o.a = r > 3.88 ? 1 - smoothstep(3.88, 3.98, r) : 1;
  const nz = hash2(Math.floor(u * 1600), Math.floor(v * 1600), 3);
  let R = 126, G = 28, B = 36;
  // 다이아몬드 격자 + 중심 메달리온
  const lx = Math.abs(((x * 1.4) % 1 + 1) % 1 - 0.5), ly = Math.abs(((y * 1.4) % 1 + 1) % 1 - 0.5);
  const lat = lx + ly;
  if (lat > 0.38 && lat < 0.47) { R = 176; G = 134; B = 64; }
  else if (lat < 0.14) { R = 92; G = 18; B = 28; }
  const star = Math.abs(Math.cos(a * 4)) * 1.15;
  if (r < 1.55) { const k = 0.5 + 0.5 * Math.cos(r * 12); R = mix(40, 188, k * 0.55); G = mix(34, 148, k * 0.55); B = mix(74, 70, k * 0.55); if (star > 0.9 && r < 1.35 && r > 0.4) { R = 196; G = 156; B = 76; } }
  // 동심 띠: 금색 / 남색
  if (r > 3.05 && r < 3.12) { R = 190; G = 150; B = 70; }
  if (r > 3.2 && r < 3.5) {
    const p = Math.abs(Math.sin(a * 24)) > 0.8 ? 1 : 0;
    R = p ? 176 : 28; G = p ? 134 : 36; B = p ? 64 : 72;
  }
  if (r > 3.58 && r < 3.66) { R = 196; G = 156; B = 76; }
  if (r > 3.72) { R = 96; G = 20; B = 30; }
  const weave = 0.9 + nz * 0.18;
  o.r = R * weave; o.g = G * weave; o.b = B * weave;
  o.h = 0.5 + nz * 0.3;
}

// 직사각 페르시아풍 러그 (가로:세로 = W:D m)
export function rugPixelFactory(W, D, field, accent) {
  return function (u, v, o) {
    const x = (u - 0.5) * W, y = (v - 0.5) * D;
    const e = Math.min(W / 2 - Math.abs(x), D / 2 - Math.abs(y));
    o.a = 1; o.rough = 0.97; o.h = 0.5;
    const nz = hash2(Math.floor(u * 900), Math.floor(v * 900), 7);
    if (e < 0) { o.a = 0; return; }
    let r, g, b;
    if (e < 0.05) { // 술 장식
      const f = 0.5 + 0.5 * Math.sin(x * 90);
      r = 210; g = 190; b = 150; o.a = f > 0.35 ? 1 : 0.0; o.h = 0.8;
    } else if (e < 0.22) {
      r = 26; g = 34; b = 66;
      const p = Math.abs(Math.sin((x + y) * 18));
      if (p > 0.85) { r = 190; g = 150; b = 72; }
    } else if (e < 0.3) { r = 196; g = 156; b = 76; }
    else if (e < 0.4) { r = 100; g = 18; b = 28; }
    else {
      r = field[0]; g = field[1]; b = field[2];
      const lx = Math.abs(((x * 1.7) % 1 + 1) % 1 - 0.5), ly = Math.abs(((y * 1.7) % 1 + 1) % 1 - 0.5);
      const l = lx + ly;
      if (l > 0.36 && l < 0.46) { r = accent[0]; g = accent[1]; b = accent[2]; }
      if (l < 0.12) { r = 196; g = 156; b = 76; }
      const med = Math.hypot(x / (W * 0.18), y / (D * 0.3));
      if (med < 1) { const k = 0.5 + 0.5 * Math.cos(med * 14); r = mix(30, 190, k * 0.6); g = mix(34, 150, k * 0.6); b = mix(70, 72, k * 0.6); }
    }
    o.r = r * (0.88 + nz * 0.16); o.g = g * (0.88 + nz * 0.16); o.b = b * (0.88 + nz * 0.16);
    o.h = 0.5 + nz * 0.25;
  };
}

// ───────────── 재질 생성 ─────────────

const DEFS = [
  ['marble', { w: 1024, tile: 4, pixel: marblePixel, rough: 1, metal: 0.0, ns: 0.6 }],
  ['parquet', { w: 512, tile: 2, pixel: parquetPixel, ns: 0.8 }],
  ['wallpaperRed', { w: 512, tile: 1, pixel: damaskFactory([92, 22, 32], [150, 70, 80]), ns: 0.7 }],
  ['wallpaperGreen', { w: 512, tile: 1, pixel: damaskFactory([30, 56, 46], [74, 116, 92]), ns: 0.7 }],
  ['woodPanel', { w: 512, tile: 1, pixel: woodPanelPixel, ns: 1.2 }],
  ['ashlar', { w: 1024, tile: 2, pixel: ashlarPixel, ns: 1.4 }],
  ['cobble', { w: 512, tile: 2, pixel: cobblePixel, ns: 1.5 }],
  ['pavers', { w: 512, tile: 2, pixel: paversPixel, ns: 1.0 }],
  ['checker', { w: 512, tile: 2, pixel: checkerPixel, ns: 0.6 }],
  ['subway', { w: 512, tile: 1, pixel: subwayPixel, ns: 0.8 }],
  ['concrete', { w: 1024, tile: 3, pixel: concretePixel, ns: 0.7 }],
  ['slate', { w: 512, tile: 2, pixel: slatePixel, ns: 1.4 }],
  ['grass', { w: 1024, tile: 4, pixel: grassPixel, ns: 0.8 }],
  ['gravel', { w: 512, tile: 2, pixel: gravelPixel, ns: 1.2 }],
  ['plaster', { w: 512, tile: 2, pixel: plasterPixel, ns: 0.5 }],
  ['hedge', { w: 512, tile: 1.5, pixel: hedgePixel, ns: 1.0 }],
  ['ceilingWood', { w: 256, tile: 1.2, pixel: ceilingWoodPixel, ns: 0.5 }],
  ['hallStone', { w: 512, tile: 2, pixel: hallStonePixel, ns: 0.9 }],
];

export async function createMaterials(onProgress = () => {}) {
  const M = {};
  const tick = () => new Promise(r => setTimeout(r, 0));
  let i = 0;
  for (const [name, d] of DEFS) {
    onProgress(`재질 생성 중… ${name} (${++i}/${DEFS.length})`);
    await tick();
    const t = buildPBR({ w: d.w, pixel: d.pixel, normalStrength: 4 });
    const mat = new THREE.MeshStandardMaterial({
      map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap,
      roughness: 1, metalness: d.metal ?? 0,
      normalScale: new THREE.Vector2(d.ns ?? 1, d.ns ?? 1),
    });
    mat.userData.tile = d.tile;
    mat.name = name; // 텍셀 밀도 검사 리포트용
    M[name] = mat;
  }

  // 데칼 (알파)
  const decal = (px, w, h, opts = {}) => {
    const t = buildPBR({ w, h, pixel: px, alpha: true, wrap: false, normalStrength: opts.ns ?? 3 });
    const mat = new THREE.MeshStandardMaterial({
      map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      alphaTest: 0.02,
    });
    return mat;
  };
  onProgress('데칼 생성 중…');
  await tick();
  // 러그/러너는 실제 크기 대비 픽셀 밀도가 낮으면 번져 보인다(예: 22m 러너를 1024px 에 늘리면 46px/m) → 해상도를 크게 올린다
  M.medallion = decal(medallionPixel, 1024, 1024);
  M.rugDining = decal(rugPixelFactory(8.4, 3.9, [120, 24, 34], [36, 44, 84]), 2048, 1024); // 244 px/m
  M.runner = decal(rugPixelFactory(1.5, 22, [96, 18, 28], [36, 44, 84]), 512, 4096);       // 가로 341 / 세로 186 px/m
  M.rugKitchen = decal(rugPixelFactory(1.2, 4.6, [40, 56, 84], [160, 130, 70]), 512, 1024);
  M.runnerHall = decal(rugPixelFactory(1.7, 7, [100, 18, 28], [36, 44, 84]), 512, 2048); // 홀 남쪽 문~메달리온 러너
  M.runnerHall.name = 'runnerHall';
  M.rugLib = decal(rugPixelFactory(4.4, 3.2, [34, 52, 84], [170, 134, 66]), 1024, 768); M.rugLib.name = 'rugLib'; // 서재 러그 (남색 바탕)
  addDetail(M.rugLib, { widthM: 4.4, heightM: 3.2, channel: 'fabric', strength: 0.35 });
  M.carpetDisc = decal(carpetDiscPixel, 2048, 2048); // 8m → 256 px/m
  M.carpetDisc.name = 'carpetDisc'; M.carpetDisc.polygonOffsetFactor = -4; M.carpetDisc.polygonOffsetUnits = -4; // 바닥 이미지 위에 겹침
  addDetail(M.carpetDisc, { widthM: 8, heightM: 8, channel: 'fabric', strength: 0.4 });
  addDetail(M.rugDining, { widthM: 8.4, heightM: 3.9, channel: 'fabric', strength: 0.35 });
  addDetail(M.runner, { widthM: 1.5, heightM: 22, channel: 'fabric', strength: 0.35 });
  addDetail(M.rugKitchen, { widthM: 1.2, heightM: 4.6, channel: 'fabric', strength: 0.35 });
  addDetail(M.runnerHall, { widthM: 1.7, heightM: 7, channel: 'fabric', strength: 0.35 });
  M.medallion.name = 'medallion'; M.rugDining.name = 'rugDining'; M.runner.name = 'runner'; M.rugKitchen.name = 'rugKitchen';

  // 단색 PBR
  const plain = (color, rough, metal, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  M.trimWood = plain(0x2a170f, 0.45, 0.0);
  M.darkWood = plain(0x3a2216, 0.5, 0.0);
  M.walnut = plain(0x4a2c1c, 0.35, 0.0);
  M.iron = plain(0x15171a, 0.45, 0.85);
  M.brass = plain(0xb48a3c, 0.3, 1.0);
  M.steel = plain(0x9aa0a6, 0.3, 0.9);
  M.stoneCap = plain(0x8f8a80, 0.8, 0.0);
  M.whiteStone = plain(0xc9c4b8, 0.6, 0.0);
  M.fabricRed = plain(0x6b1520, 0.95, 0.0);
  M.fabricNavy = plain(0x1c2540, 0.95, 0.0);
  M.leather = plain(0x3a1a12, 0.5, 0.0);
  M.leatherBlack = plain(0x14110f, 0.38, 0.0, { clearcoat: 0.4, clearcoatRoughness: 0.4 });
  M.marbleStatue = plain(0xd8d2c6, 0.35, 0.0);
  M.velvet = plain(0x5e1220, 0.98, 0.0);
  M.gold = plain(0xc79a3c, 0.28, 1.0);
  M.stoneWarm = plain(0xb4a58f, 0.55, 0.0);
  M.ceramic = plain(0xe8e6df, 0.15, 0.0);
  M.candle = plain(0xf2e8cf, 0.8, 0.0, { emissive: 0x2a2010, emissiveIntensity: 0.2 });
  M.flame = new THREE.MeshBasicMaterial({ color: 0xffc16a });
  M.water = new THREE.MeshPhysicalMaterial({ color: 0x1d4a66, roughness: 0.04, metalness: 0.0, transmission: 0, transparent: true, opacity: 0.85, clearcoat: 1 });
  M.glass = new THREE.MeshPhysicalMaterial({ color: 0xaecbd6, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false });
  M.carPaint = plain(0x0c0d10, 0.18, 0.7, { clearcoat: 1, clearcoatRoughness: 0.1 });
  M.leaf = plain(0x2e5a2a, 0.9, 0.0, { flatShading: true });
  M.pot = plain(0x6e4a38, 0.8, 0.0);
  M.soil = plain(0x2a1f18, 1, 0);
  return M;
}
