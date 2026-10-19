// 외부: 하늘/달, 지면, 숲, 앞마당(분수·자동차·정문), 외곽 길, 가로등, 경계
import * as THREE from 'three';
import { layout } from './zones.js';
import { buildPBR } from './pbr.js';
import { mulberry32, fbm } from './noise.js';

export function build(M, ctx, root) {
  const g = new THREE.Group();
  g.name = 'exterior';
  root.add(g);
  const { col, pool } = ctx;
  const rnd = mulberry32(99);

  const shade = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };
  const put = (m, x, y, z, parent = g) => { m.position.set(x, y, z); parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, parent = g, cast = true) => put(shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), cast), x, y, z, parent);
  const cyl = (rt, rb, h, mat, x, y, z, parent = g, seg = 20, cast = true) => put(shade(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat), cast), x, y, z, parent);
  const sph = (r, mat, x, y, z, parent = g, cast = true) => put(shade(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat), cast), x, y, z, parent);
  const tileBox = (w, h, d, mat, x, y, z) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const t = mat.userData.tile ?? 1;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const uv = geo.attributes.uv;
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
    return put(shade(new THREE.Mesh(geo, mat)), x, y, z);
  };
  const repeatMat = (mat, tile) => {
    const m = mat.clone();
    m.map = mat.map.clone(); m.normalMap = mat.normalMap.clone(); m.roughnessMap = mat.roughnessMap.clone();
    [m.map, m.normalMap, m.roughnessMap].forEach(t => { t.repeat.set(1 / tile, 1 / tile); t.needsUpdate = true; });
    return m;
  };

  // ───────── 하늘 / 달 / 별 ─────────
  const skyU = { night: { value: 1 }, top: { value: new THREE.Color(0x070d20) }, hor: { value: new THREE.Color(0x1b2c52) } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform float night; uniform vec3 top, hor; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
        void main(){
          float y = clamp(vP.y, 0.0, 1.0);
          vec3 dayTop = vec3(0.30,0.52,0.86), dayHor = vec3(0.72,0.82,0.92);
          vec3 c = mix(mix(dayHor, dayTop, pow(y, 0.6)), mix(hor, top, pow(y, 0.5)), night);
          vec3 q = floor(vP * 220.0);
          float s = step(0.9965, h(q)) * smoothstep(0.08, 0.5, y) * night;
          c += vec3(s) * (0.6 + 0.4 * h(q + 3.0));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  sky.renderOrder = -10;
  g.add(sky);
  const moonDir = new THREE.Vector3(-0.45, 0.72, -0.55).normalize();
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), moonMat);
  moon.position.copy(moonDir).multiplyScalar(260);
  g.add(moon);
  const haloTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(190,210,255,0.9)'); gr.addColorStop(0.25, 'rgba(120,150,230,0.25)'); gr.addColorStop(1, 'rgba(60,80,160,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  halo.scale.setScalar(120); halo.position.copy(moon.position);
  g.add(halo);

  // ───────── 지면 ─────────
  const groundMat = repeatMat(M.grass, 4);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), groundMat);
  [groundMat.map, groundMat.normalMap, groundMat.roughnessMap].forEach(t => t.repeat.set(125, 125));
  ground.rotation.x = -Math.PI / 2; ground.position.set(22, -0.03, 22); ground.receiveShadow = true;
  g.add(ground);

  // 정문 밖 도로
  const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 70), repeatMat(M.cobble, 2));
  [road.material.map, road.material.normalMap, road.material.roughnessMap].forEach(t => t.repeat.set(3, 35));
  road.rotation.x = -Math.PI / 2; road.position.set(10, 0.005, 79); road.receiveShadow = true; g.add(road);

  // ───────── 앞마당 ─────────
  const CC = { x: 10, z: 37 };
  // 타원 포장 링
  {
    const outer = new THREE.Shape(); outer.absellipse(0, 0, 9.4, 6.4, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absellipse(0, 0, 6.2, 4.2, 0, Math.PI * 2, true);
    outer.holes.push(hole);
    const geo = new THREE.ShapeGeometry(outer, 48);
    const ring = new THREE.Mesh(geo, repeatMat(M.pavers, 2));
    ring.rotation.x = -Math.PI / 2; ring.position.set(CC.x, 0.012, CC.z); ring.receiveShadow = true;
    g.add(ring);
    const lawn = new THREE.Mesh(new THREE.CircleGeometry(4.15, 48), repeatMat(M.grass, 4));
    [lawn.material.map, lawn.material.normalMap, lawn.material.roughnessMap].forEach(t => t.repeat.set(2, 2));
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(CC.x, 0.016, CC.z); lawn.receiveShadow = true;
    g.add(lawn);
    const curb = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.11, 8, 64), M.stoneCap);
    curb.rotation.x = Math.PI / 2; curb.scale.set(1, 1, 0.8); curb.position.set(CC.x, 0.06, CC.z); curb.receiveShadow = true; g.add(curb);
    // 회양목 링
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0) continue;
      const b = sph(0.5, M.leaf, CC.x + Math.cos(a) * 3.5, 0.38, CC.z + Math.sin(a) * 3.5);
      b.scale.set(1, 0.85, 1);
    }
  }

  // 분수 (layout fountain: r=2.5, h=3)
  const fx = CC.x, fz = CC.z;
  const basin = cyl(2.5, 2.6, 0.7, M.stoneCap, fx, 0.35, fz, g, 48);
  const waterTexH = buildPBR({
    w: 256, normalStrength: 6, pixel: (u, v, o) => {
      const h = 0.5 + 0.25 * Math.sin(u * 6.2832 * 6 + fbm(u, v, 4, 3, 2) * 6) * Math.sin(v * 6.2832 * 5) + (fbm(u, v, 8, 3, 5) - 0.5) * 0.4;
      o.r = 30; o.g = 70; o.b = 100; o.h = h; o.rough = 0.05;
    },
  });
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x1c4a68, roughness: 0.04, metalness: 0.0, normalMap: waterTexH.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), transparent: true, opacity: 0.88, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5 });
  waterTexH.normalMap.repeat.set(3, 3);
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(fx, 0.64, fz); g.add(water);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.09, 8, 48), M.whiteStone); lip.rotation.x = Math.PI / 2; lip.position.set(fx, 0.72, fz); g.add(lip);
  cyl(0.45, 0.6, 1.1, M.stoneCap, fx, 1.2, fz, g, 20);
  cyl(1.2, 0.5, 0.25, M.stoneCap, fx, 1.85, fz, g, 28);
  cyl(1.05, 1.05, 0.04, waterMat, fx, 1.99, fz, g, 28, false);
  cyl(0.25, 0.4, 0.8, M.stoneCap, fx, 2.4, fz, g, 16);
  cyl(0.62, 0.3, 0.16, M.stoneCap, fx, 2.9, fz, g, 20);
  // 분수 물줄기 (파티클)
  const SP = 420;
  const spPos = new Float32Array(SP * 3), spVel = new Float32Array(SP * 4);
  for (let i = 0; i < SP; i++) { spVel[i * 4 + 3] = rnd() * 3; }
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const spray = new THREE.Points(spGeo, new THREE.PointsMaterial({ map: dotTex, size: 0.06, color: 0xaecfff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  spray.frustumCulled = false; g.add(spray);
  col.addCircle(fx, fz, 2.6, 'fountain');

  // 자동차 (layout car: 18, 37, 2×1.5×5)
  {
    const car = new THREE.Group();
    const side = new THREE.Shape();
    const P = [[-2.45, 0.32], [-2.45, 0.78], [-1.85, 0.9], [-1.25, 1.36], [0.85, 1.4], [1.65, 0.96], [2.45, 0.82], [2.45, 0.32]];
    side.moveTo(P[0][0], P[0][1]); P.slice(1).forEach(p => side.lineTo(p[0], p[1])); side.closePath();
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(side, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 4, curveSegments: 8 }), M.carPaint);
    body.position.z = -0.9; shade(body); car.add(body);
    const win = new THREE.Shape();
    [[-1.1, 0.98], [-0.78, 1.33], [0.78, 1.37], [1.28, 0.98]].forEach((p, i) => (i ? win.lineTo(p[0], p[1]) : win.moveTo(p[0], p[1]))); win.closePath();
    const glass = new THREE.Mesh(new THREE.ExtrudeGeometry(win, { depth: 1.86, bevelEnabled: false }), new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.03, metalness: 0.2, clearcoat: 1 }));
    glass.position.z = -0.93; car.add(glass);
    const tyre = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    for (const [wx, wz] of [[-1.55, 0.88], [-1.55, -0.88], [1.6, 0.88], [1.6, -0.88]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 24), tyre); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.34, wz); shade(w); car.add(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.26, 16), M.steel); hub.rotation.x = Math.PI / 2; hub.position.set(wx, 0.34, wz); car.add(hub);
    }
    for (const z of [-0.7, 0.7]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); tl.position.set(-2.55, 0.8, z); car.add(tl);
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.36), new THREE.MeshBasicMaterial({ color: 0xcfe0ff })); hl.position.set(2.55, 0.8, z); car.add(hl);
    }
    car.rotation.y = Math.PI / 2 + 0.06; // 길이 방향을 z 축으로
    car.position.set(18, 0, 37.2);
    g.add(car);
    col.addCenterBox(18, 37.2, 2.1, 5.1, 0, 1.5, 'car');
  }

  // ───────── 경계: 후원 담/울타리 ─────────
  const hedgeMat = M.hedge;
  const hedge = (x0, z0, x1, z1, h = 1.7, t = 1.0) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.max(t, Math.abs(x1 - x0)), d = Math.max(t, Math.abs(z1 - z0));
    tileBox(w, h, d, hedgeMat, cx, h / 2, cz);
    col.addCenterBox(cx, cz, w, d, 0, h, 'hedge');
  };
  const stoneWall = (x0, z0, x1, z1, h = 0.9, t = 0.5) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.max(t, Math.abs(x1 - x0)), d = Math.max(t, Math.abs(z1 - z0));
    tileBox(w, h, d, M.ashlar, cx, h / 2, cz);
    box(w + 0.1, 0.1, d + 0.1, M.stoneCap, cx, h + 0.05, cz);
    col.addCenterBox(cx, cz, w, d, 0, h + 0.1, 'wall');
  };
  // 현관 앞 화단 옹벽 (z=30)
  stoneWall(0, 30, 8, 30); stoneWall(12, 30, 26, 30);
  // 서쪽 경계 / 동쪽 경계
  hedge(0, 24, 0, 44, 1.8, 1.0);
  hedge(26, 24, 26, 30); hedge(26, 34, 26, 44);
  hedge(26, 30, 39, 30); hedge(39, 24, 39, 30);
  hedge(26, 34, 44, 34);
  hedge(44, 0, 44, 34, 1.8, 1.0);
  // 북쪽 끝(동쪽 길): 석조 아치 느낌의 벽
  stoneWall(39, 0, 44, 0, 2.2, 0.8);
  // 정문 밖 좌우 (보이지 않는 담 + 생울타리)
  hedge(7, 44, 7, 56, 1.8, 1.0); hedge(13, 44, 13, 56, 1.8, 1.0);

  // ───────── 정문 ─────────
  {
    const iron = M.iron;
    // 철책/담 충돌 (layout 의 gate_0, gate_1)
    for (const w of layout.walls) {
      if (!w.id.startsWith('gate_')) continue;
      col.addBox(w.center.x - w.size.x / 2, w.center.z - 0.2, w.center.x + w.size.x / 2, w.center.z + 0.2, 0, 2.0, 'gate');
    }
    const plinth = (x0, x1) => { box(x1 - x0, 0.55, 0.5, M.ashlar, (x0 + x1) / 2, 0.275, 44); box(x1 - x0, 0.06, 0.6, M.stoneCap, (x0 + x1) / 2, 0.58, 44); };
    plinth(0, 8.5); plinth(11.5, 26);
    const rail = (x0, x1) => {
      box(x1 - x0, 0.06, 0.06, iron, (x0 + x1) / 2, 1.8, 44, g, false); box(x1 - x0, 0.06, 0.06, iron, (x0 + x1) / 2, 0.75, 44, g, false);
      for (let x = x0 + 0.1; x < x1; x += 0.2) { cyl(0.014, 0.014, 1.2, iron, x, 1.2, 44, g, 5, false); const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5), iron); sp.position.set(x, 1.86, 44); g.add(sp); }
    };
    rail(0.6, 8.0); rail(12, 25.4);
    const pillar = (x, big) => {
      const w = big ? 0.95 : 0.7, h = big ? 3.0 : 2.3;
      tileBox(w, h, w, M.ashlar, x, h / 2, 44);
      box(w + 0.18, 0.14, w + 0.18, M.stoneCap, x, h + 0.07, 44);
      box(w * 0.55, 0.3, w * 0.55, M.whiteStone, x, h + 0.29, 44);
      sph(w * 0.28, M.whiteStone, x, h + 0.58, 44);
      col.addCenterBox(x, 44, w, w, 0, h, 'pillar');
    };
    [0.35, 8.5, 11.5, 25.65].forEach((x, i) => pillar(x, i === 1 || i === 2));
    [4.5, 18.5].forEach(x => pillar(x, false));
    // 열린 철문 (안쪽으로 열림)
    for (const [hx, open, mirror] of [[9.0, 1.4, 1], [11.0, -1.4, -1]]) {
      const leaf = new THREE.Group();
      box(1.5, 0.07, 0.06, iron, 0.75, 1.9, 0, leaf, false); box(1.5, 0.07, 0.06, iron, 0.75, 0.2, 0, leaf, false);
      for (let x = 0.08; x < 1.5; x += 0.17) { cyl(0.014, 0.014, 1.7, iron, x, 1.05, 0, leaf, 5, false); const sp = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 5), iron); sp.position.set(x, 2.0, 0); leaf.add(sp); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 8, 32, Math.PI), iron); ring.position.set(0.75, 1.1, 0); leaf.add(ring);
      leaf.position.set(hx, 0, 44);
      leaf.scale.x = mirror;
      leaf.rotation.y = open;
      g.add(leaf);
    }
  }

  // ───────── 가로등 (등불) ─────────
  const lantern = (x, z, zone, h = 3.3) => {
    cyl(0.07, 0.1, h, M.iron, x, h / 2, z, g, 8);
    cyl(0.16, 0.16, 0.06, M.iron, x, 0.03, z, g, 12);
    const head = new THREE.Group(); head.position.set(x, h + 0.2, z); g.add(head);
    box(0.34, 0.04, 0.34, M.iron, 0, -0.21, 0, head); box(0.4, 0.04, 0.4, M.iron, 0, 0.25, 0, head);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.2, 4), M.iron); cone.rotation.y = Math.PI / 4; cone.position.y = 0.37; head.add(cone);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.28), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffa95a, emissiveIntensity: 1.4, transparent: true, opacity: 0.9, roughness: 0.2 }));
    head.add(gl);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.025, 0.42, 0.025, M.iron, dx * 0.15, 0, dz * 0.15, head, false);
    pool.addFlame(g, { x, y: h + 0.1, z, zone, scale: 2.2, light: { color: 0xffb066, intensity: 14, distance: 12, alwaysOn: false } });
    col.addCircle(x, z, 0.18, 'lamp');
  };
  [[6.2, 31.2, 'courtyard'], [13.8, 31.2, 'courtyard'], [1.2, 33, 'courtyard'], [24.5, 32.3, 'courtyard'], [1.2, 42.5, 'courtyard'], [24.5, 42.5, 'courtyard'],
    [42.8, 4, 'east_path'], [42.8, 14, 'east_path'], [42.8, 24, 'east_path'], [31, 32, 'south_path'], [41, 32, 'south_path']].forEach(([x, z, zn]) => lantern(x, z, zn));
  // 문기둥 위 등
  for (const x of [8.5, 11.5]) pool.addFlame(g, { x, y: 3.7, z: 44, zone: 'courtyard', scale: 2.4, light: { color: 0xffb066, intensity: 12, distance: 11 } });

  // ───────── 토피어리 / 화단 / 벤치 ─────────
  const topiary = (x, z, s = 1, kind = 'cone') => {
    cyl(0.12, 0.14, 0.4, M.soil, x, 0.2, z, g, 8, false);
    const m = kind === 'cone' ? new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 2.0 * s, 10), M.leaf) : new THREE.Mesh(new THREE.SphereGeometry(0.55 * s, 12, 10), M.leaf);
    put(shade(m), x, kind === 'cone' ? 1.3 * s : 0.9 * s, z);
    col.addCircle(x, z, 0.4 * s, 'topiary');
  };
  [[2, 27.2], [5, 27.2], [14.5, 26.5], [17.5, 27.2], [20.5, 26.5], [23.5, 27.2]].forEach(([x, z], i) => topiary(x, z, 1.1, i % 2 ? 'ball' : 'cone'));
  [[6.5, 32.5], [13.5, 32.5]].forEach(([x, z]) => topiary(x, z, 1.4, 'cone'));
  [[2, 41], [2, 35], [24, 41], [24, 36]].forEach(([x, z]) => topiary(x, z, 1.0, 'ball'));
  const bench = (x, z, rotY = 0) => {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = rotY; g.add(b);
    box(1.6, 0.06, 0.45, M.walnut, 0, 0.45, 0, b); box(1.6, 0.4, 0.05, M.walnut, 0, 0.7, -0.22, b);
    for (const sx of [-0.7, 0.7]) box(0.06, 0.45, 0.4, M.iron, sx, 0.22, 0, b);
    col.addCenterBox(x, z, rotY === 0 ? 1.6 : 0.5, rotY === 0 ? 0.5 : 1.6, 0, 0.9, 'bench');
  };
  bench(42.6, 9, -Math.PI / 2); bench(42.6, 19, -Math.PI / 2); bench(42.6, 28, -Math.PI / 2);
  bench(32, 31.2, 0);
  // 동쪽 길 화분
  for (const z of [2, 11, 21, 30]) { cyl(0.38, 0.3, 0.7, M.pot, 40.2, 0.35, z, g, 16); sph(0.4, M.leaf, 40.2, 0.95, z); col.addCircle(40.2, z, 0.42, 'planter'); }
  // 동쪽 벽면 담쟁이 느낌: 건물 외벽 아래 덤불
  for (let z = 1; z < 24; z += 1.6) { const b = sph(0.5 + rnd() * 0.3, M.leaf, 39.5, 0.4, z); b.scale.y = 0.8; }
  for (let x = 1; x < 20; x += 1.8) { const b = sph(0.45 + rnd() * 0.25, M.leaf, x, 0.35, 24.5); b.scale.y = 0.8; }

  // ───────── 숲 (인스턴싱) ─────────
  {
    const spots = [];
    const R = 60, cx0 = 22, cz0 = 30;
    for (let tries = 0; spots.length < 300 && tries < 8000; tries++) {
      const x = cx0 + (rnd() * 2 - 1) * R, z = cz0 + (rnd() * 2 - 1) * R;
      const inside = x > -17 && x < 55 && z > -11 && z < 52; // 건물 창에서 하늘/먼 숲이 보이도록 주변을 비운다
      const onRoad = Math.abs(x - 10) < 5 && z > 44;
      if (inside || onRoad) continue;
      if (spots.some(s => Math.hypot(s.x - x, s.z - z) < 3.2)) continue;
      spots.push({ x, z, s: 0.8 + rnd() * 1.1, k: rnd() < 0.62 ? 0 : 1 });
    }
    const pines = spots.filter(s => s.k === 0), oaks = spots.filter(s => s.k === 1);
    const bark = new THREE.MeshStandardMaterial({ color: 0x3c2c1f, roughness: 1 });
    const pineM = new THREE.MeshStandardMaterial({ color: 0x1a3a26, roughness: 1, flatShading: true });
    const oakM = new THREE.MeshStandardMaterial({ color: 0x27441f, roughness: 1, flatShading: true });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.34, 4, 7), bark, spots.length);
    const cones = [0, 1, 2, 3].map(() => new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2.6, 8), pineM, pines.length));
    const crowns = [0, 1].map(() => new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), oakM, oaks.length));
    const d = new THREE.Object3D();
    spots.forEach((t, i) => { d.position.set(t.x, 2 * t.s, t.z); d.rotation.set(0, 0, 0); d.scale.set(t.s, t.s, t.s); d.updateMatrix(); trunks.setMatrixAt(i, d.matrix); });
    pines.forEach((t, i) => cones.forEach((c, k) => { const s = t.s * (2.3 - k * 0.5); d.position.set(t.x, (2.6 + k * 1.7) * t.s, t.z); d.rotation.y = rnd() * 6; d.scale.set(s, t.s * 1.3, s); d.updateMatrix(); c.setMatrixAt(i, d.matrix); }));
    oaks.forEach((t, i) => crowns.forEach((c, k) => { d.position.set(t.x + (k ? 0.8 : -0.5) * t.s, (5.2 + k * 0.9) * t.s, t.z + (k ? -0.4 : 0.5) * t.s); d.rotation.set(0, 0, 0); const s = (2.8 - k * 0.5) * t.s; d.scale.set(s, s * 0.85, s); d.updateMatrix(); c.setMatrixAt(i, d.matrix); }));
    [trunks, ...cones, ...crowns].forEach(m => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
  }

  // ───────── 갱신 ─────────
  const sprayState = { t: 0 };
  ctx.updaters.push((dt, t, hero, night) => {
    skyU.night.value = night;
    moon.visible = halo.visible = night > 0.3;
    halo.material.opacity = 0.8 * night;
    waterMat.normalMap.offset.set(t * 0.02, t * 0.013);
    // 분수 입자
    for (let i = 0; i < SP; i++) {
      const j = i * 4;
      spVel[j + 3] -= dt;
      if (spVel[j + 3] <= 0) {
        const a = rnd() * Math.PI * 2, sp = 0.5 + rnd() * 1.0;
        spPos[i * 3] = fx + Math.cos(a) * 0.1; spPos[i * 3 + 1] = 3.0; spPos[i * 3 + 2] = fz + Math.sin(a) * 0.1;
        spVel[j] = Math.cos(a) * sp * 0.5; spVel[j + 1] = 1.2 + rnd() * 1.4; spVel[j + 2] = Math.sin(a) * sp * 0.5; spVel[j + 3] = 1.4 + rnd() * 0.6;
      } else {
        spVel[j + 1] -= 6.5 * dt;
        spPos[i * 3] += spVel[j] * dt; spPos[i * 3 + 1] += spVel[j + 1] * dt; spPos[i * 3 + 2] += spVel[j + 2] * dt;
        if (spPos[i * 3 + 1] < 0.7) spVel[j + 3] = 0;
      }
    }
    spGeo.attributes.position.needsUpdate = true;
  });
}
