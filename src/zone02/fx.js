// 분위기 효과: 창문으로 들어오는 달빛 줄기(가짜 볼류메트릭) + 떠다니는 먼지
import * as THREE from 'three';
import { zoneIdAt, STYLE } from './zones.js';

export function build(M, ctx, root) {
  const g = new THREE.Group();
  g.name = 'fx';
  g.userData.dynamic = true;
  root.add(g);

  // 달빛이 들어오는 방향 (main.js NIGHT.sunDir 와 같은 값). 빛이 나아가는 방향 = -달 방향.
  const L = new THREE.Vector3(0.45, -0.72, 0.55).normalize();

  const beamU = { night: { value: 1 }, strength: { value: 0.1 }, color: { value: new THREE.Color(0x9ab8ff) } };
  const beamMat = new THREE.ShaderMaterial({
    uniforms: beamU, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'attribute float aT; attribute float aE; varying float vT; varying float vE; void main(){ vT = aT; vE = aE; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float night, strength; uniform vec3 color; varying float vT; varying float vE; void main(){ float a = strength * night * pow(max(1.0 - vT, 0.0), 1.4) * (0.35 + 0.65 * clamp(vE, 0.0, 1.0)); gl_FragColor = vec4(color * a, a); }',
  });

  for (const w of ctx.windows) {
    if (w.noBeam) continue;
    const inward = w.axis === 'x' ? [0, 1] : [1, 0]; // 벽 법선 후보(+방향)
    const px = w.axis === 'x' ? w.c : w.fixed, pz = w.axis === 'x' ? w.fixed : w.c;
    // 실내쪽이 + 방향인지 확인
    const sPlus = STYLE[zoneIdAt(px + inward[0] * 0.6, pz + inward[1] * 0.6)] ? 1 : 0;
    const sMinus = STYLE[zoneIdAt(px - inward[0] * 0.6, pz - inward[1] * 0.6)] ? -1 : 0;
    const sign = sPlus || sMinus;
    if (!sign) continue;
    const ndotL = (inward[0] * L.x + inward[1] * L.z) * sign;
    if (ndotL <= 0.05) continue; // 달빛이 안쪽으로 들어오지 않는 창
    const half = w.w / 2;
    const corners = [[-half, w.y1], [half, w.y1], [half, w.y0], [-half, w.y0]];
    const A = [], B = [];
    for (const [u, y] of corners) {
      const x = w.axis === 'x' ? w.c + u : w.fixed, z = w.axis === 'x' ? w.fixed : w.c + u;
      A.push(new THREE.Vector3(x, y, z));
      const t = y / -L.y;
      B.push(new THREE.Vector3(x + L.x * t, 0.02, z + L.z * t));
    }
    const pos = [], aT = [], aE = [];
    const quad = (p0, p1, p2, p3, t0, t1, e) => {
      for (const [p, t, ee] of [[p0, t0, e], [p1, t0, e], [p2, t1, e], [p0, t0, e], [p2, t1, e], [p3, t1, e]]) { pos.push(p.x, p.y, p.z); aT.push(t); aE.push(ee); }
    };
    // 옆면 4개: (A_i, A_{i+1}, B_{i+1}, B_i)
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(A[i], A[j], B[j], B[i], 0, 1, i % 2 === 0 ? 0.6 : 1.0); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
    geo.setAttribute('aE', new THREE.Float32BufferAttribute(aE, 1));
    const m = new THREE.Mesh(geo, beamMat);
    m.frustumCulled = false; m.renderOrder = 5;
    g.add(m);
    // 바닥에 떨어지는 달빛 패치 (살짝 밝은 평행사변형)
    const patch = new THREE.BufferGeometry();
    const pp = [B[0], B[1], B[2], B[0], B[2], B[3]].flatMap(p => [p.x, p.y + 0.005, p.z]);
    patch.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    patch.setAttribute('aT', new THREE.Float32BufferAttribute(new Array(6).fill(0.15), 1));
    patch.setAttribute('aE', new THREE.Float32BufferAttribute(new Array(6).fill(1), 1));
    // (패치는 줄기 안쪽이 이미 더해지므로 생략)
    void patch;
  }

  // 먼지: GPU 에서 움직인다
  const N = 700;
  const pos = new Float32Array(N * 3), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = Math.random() * 39; pos[i * 3 + 1] = 0.3 + Math.random() * 3.6; pos[i * 3 + 2] = Math.random() * 24;
    ph[i] = Math.random() * 6.28;
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dg.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const dustU = { time: { value: 0 }, night: { value: 1 } };
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({
    uniforms: dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `
      attribute float aPh; uniform float time; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(time * 0.13 + aPh) * 0.6, sin(time * 0.21 + aPh * 1.7) * 0.25, cos(time * 0.11 + aPh * 0.8) * 0.6);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(60.0 / -mv.z, 1.0, 5.0);
        vA = 0.18 + 0.12 * sin(time * 0.5 + aPh * 3.0);
      }`,
    fragmentShader: `
      uniform float night; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA;
        gl_FragColor = vec4(vec3(1.0, 0.88, 0.7) * a, a);
      }`,
  }));
  dust.frustumCulled = false;
  g.add(dust);

  ctx.updaters.push((dt, t, hero, night) => {
    beamU.night.value = night;
    dustU.time.value = t;
  });
}
