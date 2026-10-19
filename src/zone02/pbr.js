// 픽셀 함수 하나로 알베도 + 법선 + 거칠기 맵을 한꺼번에 만든다.
// pixel(u, v, o): o.r/g/b(0~255), o.h(높이 0~1), o.rough(0~1), o.a(0~1, 선택) 을 채운다.
import * as THREE from 'three';

export function buildPBR({ w = 512, h = w, pixel, normalStrength = 3, wrap = true, alpha = false }) {
  const n = w * h;
  const alb = new Uint8ClampedArray(n * 4);
  const rgh = new Uint8ClampedArray(n * 4);
  const hgt = new Float32Array(n);
  const o = { r: 0, g: 0, b: 0, h: 0.5, rough: 0.8, a: 1 };

  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      o.a = 1; o.h = 0.5; o.rough = 0.8;
      pixel(u, 1 - v, o); // 텍스처 v 는 위쪽이 1 (캔버스 위쪽 행 = v 큼)
      const i = y * w + x;
      const k = i * 4;
      alb[k] = o.r; alb[k + 1] = o.g; alb[k + 2] = o.b; alb[k + 3] = alpha ? o.a * 255 : 255;
      const rv = o.rough * 255;
      rgh[k] = rv; rgh[k + 1] = rv; rgh[k + 2] = rv; rgh[k + 3] = 255;
      hgt[i] = o.h;
    }
  }

  // 높이 → 법선 (Sobel 대신 중앙 차분, 타일링 시 가장자리는 감싸기)
  const nrm = new Uint8ClampedArray(n * 4);
  const at = (x, y) => {
    if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = Math.min(w - 1, Math.max(0, x)); y = Math.min(h - 1, Math.max(0, y)); }
    return hgt[y * w + x];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = at(x + 1, y) - at(x - 1, y);
      const dy = at(x, y + 1) - at(x, y - 1);
      let nx = -dx * normalStrength, ny = dy * normalStrength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const k = (y * w + x) * 4;
      nrm[k] = (nx * 0.5 + 0.5) * 255;
      nrm[k + 1] = (ny * 0.5 + 0.5) * 255;
      nrm[k + 2] = (nz * 0.5 + 0.5) * 255;
      nrm[k + 3] = 255;
    }
  }

  const toTex = (data, srgb) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 16; // 비스듬히 볼 때(바닥) 흐려지지 않게 최대치
    return t;
  };
  return { map: toTex(alb, true), normalMap: toTex(nrm, false), roughnessMap: toTex(rgh, false) };
}

// 지오메트리의 UV 를 월드 미터 기준으로 늘려 텍스처 밀도를 일정하게 유지한다.
export function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geo;
}
