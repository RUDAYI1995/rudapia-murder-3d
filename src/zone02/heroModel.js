// 주인공 외형: 턴어라운드 시트(assets/ref/character/hero-turnaround.webp)로 만든 "3면도 입체 모델".
//  - 모양: 정면 그림의 실루엣(가로폭)과 측면 그림의 실루엣(앞뒤 두께)으로 부품(머리·몸통·팔·허벅지·정강이)의 단면을 높이마다 만들어 쌓았다
//    (tools/make-hero-hull.mjs → src/data/hero_hull.json). 판이 아니라 부피가 있어서 어느 각도에서 봐도 사람 모양이다.
//  - 색: 정면/후면/측면 그림을 삼면 투영(triplanar)으로 입힌다. 부품마다 "서 있을 때 위치"를 기준으로 그림 좌표를 계산하므로 부품이 움직여도 그림이 따라간다.
//  - 동작: 뼈대(body, head, arm, leg, shin 관절)는 기본 인물(character.js)과 같아서 걷기·달리기·앉기 코드가 그대로 움직인다.
import * as THREE from 'three';
import hull from '../data/hero_hull.json';

const BASE = '/assets/zone02/hero/';
let sheetTex = null;
function sheet() {
  if (!sheetTex) {
    sheetTex = new THREE.TextureLoader().load(BASE + 'hero_sheet.png');
    sheetTex.colorSpace = THREE.SRGBColorSpace; sheetTex.anisotropy = 8; sheetTex.wrapS = sheetTex.wrapT = THREE.ClampToEdgeWrapping;
  }
  return sheetTex;
}

// 단면(가로·세로 반지름 a,b, 중심 xc,zc, 모양 지수 n)을 쌓아 만든 닫힌 입체. 좌표는 부품 관절(pivot) 기준.
function buildHullGeometry(part, N = 26) {
  const [px, py, pz] = part.pivot, rows = part.rows, pos = [], idx = [];
  const sgnpow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const e = 2 / part.n;
  for (const [y, xc, a, zc, b] of rows) {
    for (let j = 0; j < N; j++) {
      const t = (j / N) * Math.PI * 2;
      pos.push(xc + a * sgnpow(Math.cos(t), e) - px, y - py, zc + b * sgnpow(Math.sin(t), e) - pz);
    }
  }
  const R = rows.length;
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < N; j++) {
    const a0 = i * N + j, a1 = i * N + ((j + 1) % N), b0 = (i + 1) * N + j, b1 = (i + 1) * N + ((j + 1) % N);
    idx.push(a0, a1, b0, a1, b1, b0);
  }
  // 위아래 뚜껑
  const cap = (i, flip) => {
    const [y, xc, , zc] = rows[i]; const c = pos.length / 3;
    pos.push(xc - px, y - py, zc - pz);
    for (let j = 0; j < N; j++) { const p0 = i * N + j, p1 = i * N + ((j + 1) % N); if (flip) idx.push(c, p1, p0); else idx.push(c, p0, p1); }
  };
  cap(0, false); cap(R - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function makeMaterial(pivot) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0 });
  mat.onBeforeCompile = shader => {
    shader.uniforms.uSheet = { value: sheet() };
    shader.uniforms.uPivot = { value: new THREE.Vector3(...pivot) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest; varying vec3 vObjN; uniform vec3 uPivot;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position + uPivot; vObjN = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest; varying vec3 vObjN; uniform sampler2D uSheet;')
      .replace('#include <map_fragment>', `
        vec3 hn = normalize(vObjN);
        float wF = pow(max(hn.z, 0.0), 3.0), wB = pow(max(-hn.z, 0.0), 3.0), wS = pow(abs(hn.x), 3.0);
        float wsum = wF + wB + wS + 1e-4;
        float hpy = 9.0 + (1.78 - vRest.y) / 0.00178;
        float hv = 1.0 - hpy / 1024.0;
        vec3 cF = texture2D(uSheet, vec2((371.5 + vRest.x / 0.00178) / 1536.0, hv)).rgb;
        vec3 cB = texture2D(uSheet, vec2((1177.0 - vRest.x / 0.00178) / 1536.0, hv)).rgb;
        vec3 cS = texture2D(uSheet, vec2((765.0 - vRest.z / 0.00178) / 1536.0, hv)).rgb;
        diffuseColor.rgb = (cF * wF + cB * wB + cS * wS) / wsum;`);
  };
  mat.customProgramCacheKey = () => 'heroHull';
  return mat;
}

export function buildHeroModel() {
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.92; root.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.76, 0); body.add(head);
  const node = (x, y, parent) => { const g = new THREE.Group(); g.position.set(x, y, 0); parent.add(g); return g; };
  const armL = node(-0.205, 0.55, body), armR = node(0.205, 0.55, body);
  const legL = node(-0.097, 0, body), legR = node(0.097, 0, body);
  const shinL = node(0, -0.431, legL), shinR = node(0, -0.431, legR);

  const add = (name, group) => {
    const p = hull.parts[name];
    const m = new THREE.Mesh(buildHullGeometry(p), makeMaterial(p.pivot));
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    group.add(m); return m;
  };
  add('head', head); add('torso', body);
  add('arm-', armL); add('arm+', armR);
  add('thigh-', legL); add('thigh+', legR);
  add('shin-', shinL); add('shin+', shinR);
  root.userData = { body, legL, legR, shinL, shinR, armL, armR, head };
  return root;
}
