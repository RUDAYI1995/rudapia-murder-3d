// 타일링 가능한(주기적) 노이즈. 절차적 텍스처가 이음새 없이 반복되도록 격자 좌표를 f 로 감싼다.

export function hash2(ix, iy, seed = 0) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = t => t * t * (3 - 2 * t);

// u,v ∈ [0,1) 를 f×f 격자로 나눈 value noise (0..1)
export function vnoise(u, v, f, seed = 0) {
  const x = u * f, y = v * f;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = smooth(x - x0), ty = smooth(y - y0);
  const xa = ((x0 % f) + f) % f, xb = (xa + 1) % f;
  const ya = ((y0 % f) + f) % f, yb = (ya + 1) % f;
  const a = hash2(xa, ya, seed), b = hash2(xb, ya, seed);
  const c = hash2(xa, yb, seed), d = hash2(xb, yb, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

export function fbm(u, v, f, oct = 4, seed = 0) {
  let amp = 0.5, sum = 0, norm = 0, freq = f;
  for (let o = 0; o < oct; o++) {
    sum += amp * vnoise(u, v, freq, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const mix = (a, b, t) => a + (b - a) * t;

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
