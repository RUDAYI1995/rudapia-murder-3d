// 소품 제작 공통 헬퍼. 모든 광원/충돌은 월드 좌표로 등록한다.
import * as THREE from 'three';
import { mulberry32 } from '../noise.js';

export function createKit(M, ctx, g) {
  const { col, pool } = ctx;
  const rnd = mulberry32(7);

  const shade = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; return m; };
  const put = (m, parent, x, y, z) => { m.position.set(x, y, z); parent.add(m); return m; };

  const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent = g, cast = true) => put(shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), cast), parent, x, y, z);
  const cyl = (rt, rb, h, mat, x = 0, y = 0, z = 0, parent = g, seg = 24, cast = true) => put(shade(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat), cast), parent, x, y, z);
  const sph = (r, mat, x = 0, y = 0, z = 0, parent = g, cast = true) => put(shade(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat), cast), parent, x, y, z);
  const lathe = (pts, mat, x = 0, y = 0, z = 0, parent = g, seg = 32) =>
    put(shade(new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), mat)), parent, x, y, z);

  // 월드 크기 기준 UV 를 가진 박스 (텍스처 재질용)
  const texBox = (w, h, d, mat, x, y, z, parent = g) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const t = mat.userData.tile ?? 1;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const uv = geo.attributes.uv;
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
    return put(shade(new THREE.Mesh(geo, mat)), parent, x, y, z);
  };

  // 충돌 등록
  const solid = (cx, cz, w, d, h = 1, tag = 'prop') => col.addCenterBox(cx, cz, w, d, 0, h, tag);

  // ── 촛불 (월드 좌표) ──
  const candle = (x, y, z, zone, { h = 0.14, r = 0.016, light = { color: 0xffa95a, intensity: 6, distance: 8 } } = {}) => {
    cyl(r, r, h, M.candle, x, y + h / 2, z, g, 8, false);
    pool.addFlame(g, { x, y: y + h + 0.025, z, zone, scale: 1, light });
  };

  // 벽 촛대. dir: 방 안쪽을 향하는 방향('east'|'west'|'south'|'north')
  const sconce = (x, y, z, dir, zone, light = { color: 0xffa24f, intensity: 9, distance: 9 }) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.y = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 }[dir];
    g.add(grp);
    box(0.1, 0.3, 0.025, M.brass, 0, 0, 0.012, grp);
    box(0.03, 0.03, 0.2, M.brass, 0, -0.05, 0.12, grp);
    cyl(0.055, 0.035, 0.05, M.brass, 0, -0.04, 0.22, grp, 14);
    cyl(0.018, 0.018, 0.16, M.candle, 0, 0.06, 0.22, grp, 8, false);
    const f = { south: [0, 1], east: [1, 0], north: [0, -1], west: [-1, 0] }[dir];
    const fx = x + f[0] * 0.22, fz = z + f[1] * 0.22;
    pool.addFlame(g, { x: fx, y: y + 0.17, z: fz, zone, scale: 1.2, light: { ...light, dx: f[0] * 0.5, dz: f[1] * 0.5 } });
  };

  // 의자 (정면 +z)
  const chair = (x, z, faceX, faceZ, { seat = M.fabricRed, wood = M.walnut, scale = 1 } = {}) => {
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);
    grp.rotation.y = Math.atan2(faceX - x, faceZ - z);
    grp.scale.setScalar(scale);
    g.add(grp);
    box(0.5, 0.05, 0.5, wood, 0, 0.44, 0, grp);
    box(0.44, 0.07, 0.44, seat, 0, 0.5, 0.01, grp);
    for (const [sx, sz] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) cyl(0.025, 0.018, 0.42, wood, sx, 0.21, sz, grp, 8);
    box(0.04, 0.55, 0.04, wood, -0.21, 0.74, -0.23, grp); box(0.04, 0.55, 0.04, wood, 0.21, 0.74, -0.23, grp);
    box(0.5, 0.09, 0.04, wood, 0, 1.0, -0.23, grp);
    box(0.34, 0.28, 0.02, wood, 0, 0.78, -0.23, grp);
    box(0.28, 0.2, 0.025, seat, 0, 0.78, -0.215, grp);
    return grp;
  };

  // 그림 액자 (캔버스 텍스처 생성)
  const paintingTex = (seed) => {
    const r = mulberry32(seed);
    const c = document.createElement('canvas'); c.width = 256; c.height = 320;
    const x = c.getContext('2d');
    const g1 = x.createLinearGradient(0, 0, 0, 320);
    const bgs = [['#2b2a1f', '#12110c'], ['#1b2a2a', '#0b1212'], ['#3a2a1e', '#160e08'], ['#26202e', '#0e0b14']][seed % 4];
    g1.addColorStop(0, bgs[0]); g1.addColorStop(1, bgs[1]);
    x.fillStyle = g1; x.fillRect(0, 0, 256, 320);
    // 인물: 어깨, 목, 얼굴, 머리
    const coat = ['#1a1a22', '#2a1414', '#14221a', '#2a2418'][(seed >> 1) % 4];
    x.fillStyle = coat; x.beginPath(); x.ellipse(128, 330, 112, 120, 0, Math.PI, 0); x.fill();
    x.fillStyle = '#c8b9a0'; x.beginPath(); x.moveTo(104, 215); x.lineTo(152, 215); x.lineTo(140, 260); x.lineTo(116, 260); x.fill();
    const sk = x.createRadialGradient(118, 130, 8, 128, 140, 60);
    sk.addColorStop(0, '#d9b99a'); sk.addColorStop(1, '#8a6a52');
    x.fillStyle = sk; x.beginPath(); x.ellipse(128, 140, 42, 56, 0, 0, 7); x.fill();
    x.fillStyle = ['#2a1a10', '#bcb2a2', '#12100e', '#5a3a1e'][(seed >> 2) % 4];
    x.beginPath(); x.ellipse(128, 100, 48, 36, 0, Math.PI, 0); x.fill();
    x.fillStyle = 'rgba(20,10,5,0.7)'; x.beginPath(); x.ellipse(113, 138, 5, 3, 0, 0, 7); x.ellipse(143, 138, 5, 3, 0, 0, 7); x.fill();
    x.strokeStyle = 'rgba(70,40,30,0.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(118, 172); x.quadraticCurveTo(128, 176, 138, 172); x.stroke();
    // 균열/먼지
    x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1;
    for (let i = 0; i < 40; i++) { x.beginPath(); const sx = r() * 256, sy = r() * 320; x.moveTo(sx, sy); x.lineTo(sx + (r() - 0.5) * 40, sy + (r() - 0.5) * 40); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  };
  const painting = (x, y, z, w, h, dir, seed = 1) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.y = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 }[dir];
    g.add(grp);
    box(w + 0.16, h + 0.16, 0.05, M.brass, 0, 0, 0.025, grp, false);
    box(w + 0.04, h + 0.04, 0.06, M.darkWood, 0, 0, 0.028, grp, false);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: ctx.horror ? M.horrorPortrait : paintingTex(seed), roughness: ctx.horror ? 0.92 : 0.55 }));
    m.position.z = 0.062; grp.add(m);
    return grp;
  };

  const flowerMats = [0xb02030, 0xe8dcc8, 0xc83a4a, 0xf0e4d0, 0xd8b04a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  const vase = (x, y, z, s = 1, mat = M.ceramic, flowers = true, parent = g, n = 9) => {
    lathe([[0.001, 0], [0.09, 0], [0.12, 0.08], [0.1, 0.2], [0.055, 0.3], [0.07, 0.36], [0.06, 0.38], [0.04, 0.34]], mat, x, y, z, parent, 20).scale.setScalar(s);
    if (flowers) {
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * (0.09 + n * 0.006) * s;
        const fl = new THREE.Mesh(new THREE.SphereGeometry((0.045 + rnd() * 0.02) * s, 8, 8), flowerMats[i % 5]);
        fl.position.set(x + Math.cos(a) * rr, y + (0.42 + rnd() * 0.14 + (0.1 - rr) * 0.8) * s, z + Math.sin(a) * rr); fl.castShadow = true; parent.add(fl);
        const stem = cyl(0.004, 0.004, 0.2 * s, M.leaf, fl.position.x, fl.position.y - 0.1 * s, fl.position.z, parent, 4, false);
        stem.rotation.z = (rnd() - 0.5) * 0.3;
      }
      for (let i = 0; i < Math.ceil(n / 3); i++) { // 잎
        const a = (i / Math.ceil(n / 3)) * Math.PI * 2;
        const lf = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.26 * s, 4), M.leaf);
        lf.position.set(x + Math.cos(a) * 0.12 * s, y + 0.46 * s, z + Math.sin(a) * 0.12 * s); lf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); parent.add(lf);
      }
    }
  };

  // 외부 이미지(액자 포함 크롭)를 벽에 건다. dir: 방 안쪽을 향하는 방향
  const art = (x, y, z, w, h, dir, tex, { glow = 0 } = {}) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.y = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 }[dir];
    g.add(grp);
    box(w + 0.04, h + 0.04, 0.05, M.darkWood, 0, 0, 0.022, grp, false);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ name: 'portraitImage', map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: glow }));
    m.position.z = 0.05; grp.add(m);
    return grp;
  };

  // 태피스트리 (봉에 걸린 붉은 배너)
  const tapestryTexFallback = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#5e1220'; x.fillRect(0, 0, 128, 256);
    x.fillStyle = '#c79a3c'; x.fillRect(0, 0, 128, 8); x.fillRect(0, 248, 128, 8);
    x.beginPath(); x.moveTo(64, 70); x.quadraticCurveTo(40, 110, 64, 150); x.quadraticCurveTo(88, 110, 64, 70); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const tapestry = (x, y, z, w, h, dir, tex) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.y = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 }[dir];
    g.add(grp);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ name: 'tapestryImage', map: tex ?? tapestryTexFallback, color: ctx.horror ? 0x323b3e : 0xffffff, roughness: 0.96 }));
    m.position.z = 0.03; m.receiveShadow = true; grp.add(m);
    const rod = cyl(0.015, 0.015, w + 0.2, M.gold, 0, h / 2 + 0.02, 0.05, grp, 8, false); rod.rotation.z = Math.PI / 2;
    sph(0.03, M.gold, -(w / 2 + 0.1), h / 2 + 0.02, 0.05, grp, false); sph(0.03, M.gold, w / 2 + 0.1, h / 2 + 0.02, 0.05, grp, false);
    return grp;
  };

  // 대리석 흉상 (받침 위에 얹는다)
  const bust = (x, y, z, s = 1, rotY = 0) => {
    const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = rotY; g.add(grp);
    lathe([[0.001, 0], [0.2, 0], [0.2, 0.04], [0.15, 0.08], [0.17, 0.22], [0.12, 0.32], [0.06, 0.38], [0.001, 0.4]], M.marbleStatue, 0, 0, 0, grp, 18);
    sph(0.085, M.marbleStatue, 0, 0.5, 0.01, grp); cyl(0.04, 0.05, 0.1, M.marbleStatue, 0, 0.4, 0, grp, 10);
    grp.scale.setScalar(s);
    return grp;
  };

  // 크리스마스 장식 소나무 화분 (참조 이미지의 붉은 장식 나무)
  const tree = (x, z, s = 1) => {
    lathe([[0.001, 0], [0.2, 0], [0.26, 0.08], [0.3, 0.36], [0.26, 0.4], [0.22, 0.34]], M.pot, x, 0, z, g, 18).scale.setScalar(s);
    cyl(0.02, 0.03, 0.3 * s, M.darkWood, x, 0.5 * s, z, g, 6, false);
    for (let i = 0; i < 4; i++) {
      const r = (0.5 - i * 0.11) * s;
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, 0.42 * s, 10), M.leaf);
      c.position.set(x, (0.62 + i * 0.27) * s, z); c.castShadow = true; g.add(c);
    }
    const orn = [0xb02030, 0xc79a3c, 0xe8dcc8];
    for (let i = 0; i < 12; i++) {
      const h = rnd(), a = rnd() * 6.28, r = (0.42 - h * 0.34) * s;
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.035 * s, 6, 6), new THREE.MeshStandardMaterial({ color: orn[i % 3], roughness: 0.3, metalness: 0.3 }));
      o.position.set(x + Math.cos(a) * r, (0.66 + h * 0.85) * s, z + Math.sin(a) * r); g.add(o);
    }
    col.addCircle(x, z, 0.3 * s, 'plant');
  };

  // 화분 식물
  const plant = (x, z, s = 1, tall = true) => {
    lathe([[0.001, 0], [0.22, 0], [0.3, 0.1], [0.34, 0.5], [0.3, 0.6], [0.26, 0.55]], M.pot, x, 0, z, g, 20).scale.setScalar(s);
    cyl(0.28 * s, 0.28 * s, 0.04, M.soil, x, 0.52 * s, z, g, 16, false);
    const n = tall ? 14 : 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(), len = (tall ? 0.9 : 0.5) * s * (0.7 + rnd() * 0.6);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.07 * s, len, 5), M.leaf);
      leaf.position.set(x + Math.cos(a) * 0.12 * s, 0.55 * s + len / 2, z + Math.sin(a) * 0.12 * s);
      leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      leaf.castShadow = true; g.add(leaf);
    }
    col.addCircle(x, z, 0.32 * s, 'plant');
  };

  return { g, M, ctx, col, pool, rnd, shade, put, box, cyl, sph, lathe, texBox, solid, candle, sconce, chair, painting, vase, plant, paintingTex, art, tapestry, bust, tree };
}
