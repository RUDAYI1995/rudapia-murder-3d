// 디테일 레이어: 저해상도 이미지 텍스처(바닥/벽/러그) 위에 1m 타일의 고주파 결(대리석 잔결, 직물, 석재 입자)을 곱해
// 가까이서 볼 때의 선명함을 올린다. 진짜 해상도를 만들어 내는 것은 아니지만(원본이 더 선명해야 함) 번져 보이는 면을 크게 줄인다.
import * as THREE from 'three';
import { fbm, vnoise, hash2 } from './noise.js';

let cache = null;

// R: 대리석 잔결/반짝임 입자, G: 직물(카펫) 올, B: 석재/회벽 입자.  값 0.5 중심(평균 보존)
export function getDetailTexture() {
  if (cache) return cache;
  const S = 512, data = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S, v = (y + 0.5) / S;
      // 대리석 잔결: 가는 맥 + 입자
      const w = fbm(u, v, 6, 4, 3);
      const vein = Math.pow(1 - Math.abs(Math.sin((14 * u + 9 * v + 5 * w) * Math.PI)), 10);
      const vein2 = Math.pow(1 - Math.abs(Math.sin((-8 * u + 17 * v + 6 * fbm(u, v, 9, 3, 8)) * Math.PI)), 14);
      const grain = fbm(u, v, 96, 2, 5);
      const r = 0.5 - 0.22 * (vein + 0.6 * vein2) + (grain - 0.5) * 0.35 + 0.08;
      // 직물: 날실/씨실 교차 + 미세 요철
      const th = 128;
      const wx = Math.sin(u * th * Math.PI * 2), wy = Math.sin(v * th * Math.PI * 2);
      const weave = 0.5 + 0.18 * wx * wy + 0.1 * (hash2((x >> 0) & 255, (y >> 0) & 255, 4) - 0.5);
      // 석재 입자
      const st = 0.5 + (fbm(u, v, 64, 3, 12) - 0.5) * 0.9 + (hash2(x, y, 7) - 0.5) * 0.18;
      const k = (y * S + x) * 4;
      data[k] = Math.max(0, Math.min(255, r * 255)); data[k + 1] = Math.max(0, Math.min(255, weave * 255)); data[k + 2] = Math.max(0, Math.min(255, st * 255)); data[k + 3] = 255;
    }
  }
  const c = document.createElement('canvas'); c.width = c.height = S;
  c.getContext('2d').putImageData(new ImageData(data, S, S), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16;
  cache = t;
  return t;
}

/**
 * 머티리얼에 디테일 레이어를 붙인다.
 * @param mat       MeshStandardMaterial (map 필요)
 * @param widthM,heightM 이 머티리얼이 덮는 면의 실제 크기(m). UV 0~1 이 이 면 전체를 덮는 데칼/평면용
 * @param channel   'floor' = 거칠기 맵으로 대리석(R)/카펫(G) 자동 구분, 'stone' = B, 'fabric' = G, 'marble' = R
 * @param strength  0~1 (0.3 정도가 자연스럽다)
 */
export function addDetail(mat, { widthM, heightM, channel = 'stone', strength = 0.3, tileM = 1 }) {
  const tex = getDetailTexture();
  const rep = new THREE.Vector2(widthM / tileM, heightM / tileM);
  const pick = {
    floor: 'float m = 0.0;\n#ifdef USE_ROUGHNESSMAP\n m = smoothstep(0.55, 0.72, texture2D(roughnessMap, vRoughnessMapUv).g);\n#endif\n float dl = mix(dt.r, dt.g, m);',
    stone: 'float dl = dt.b;', fabric: 'float dl = dt.g;', marble: 'float dl = dt.r;',
  }[channel];
  mat.onBeforeCompile = shader => {
    shader.uniforms.uDetail = { value: tex };
    shader.uniforms.uDetailRep = { value: rep };
    shader.uniforms.uDetailStr = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nuniform vec2 uDetailRep;\nuniform float uDetailStr;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 dt = texture2D(uDetail, vMapUv * uDetailRep).rgb;
          ${pick}
          diffuseColor.rgb *= 1.0 + (dl - 0.5) * 2.0 * uDetailStr;
        }`);
  };
  mat.customProgramCacheKey = () => `detail-${channel}`;
  mat.needsUpdate = true;
  return mat;
}
