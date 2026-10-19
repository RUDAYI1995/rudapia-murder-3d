// 맵 데이터 → three.js 씬. 실제 아트가 오기 전까지는 절차적 지오메트리/텍스처(그레이박스)로 구성한다.
import * as THREE from 'three';
import {
  buildings, fence, hedges, props, paths, plaza, lamps, trees, fountain, toolSpawns, MAP_HALF,
} from './mansionMap.js';
import { makeTextures } from './textures.js';

// 월드 크기 기준으로 UV 를 늘려서(타일링) 벽 길이와 상관없이 텍스처 밀도를 일정하게 유지
function worldBox(w, h, d, tile = 2.5) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
    }
  }
  return g;
}

function repeatTex(tex, rx, ry) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return t;
}

const TOOL_COLORS = { knife: 0xd9d9e6, hammer: 0xd9a05b, rope: 0x9ed67a };

export function buildMap() {
  const T = makeTextures();
  const group = new THREE.Group();

  const std = (map, opts = {}) =>
    new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0.02, ...opts });
  const M = {
    wall: std(T.plaster),
    fence: std(T.brickDark),
    hedge: std(T.hedge, { roughness: 1 }),
    wood: std(T.wood),
    stone: std(T.cobble, { roughness: 0.85 }),
    dark: std(null, { color: 0x2a2523 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xbfe6e0, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, depthWrite: false,
    }),
  };

  // ── 지면 ──
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    std(repeatTex(T.grass, 140, 140)),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const plazaMesh = new THREE.Mesh(
    new THREE.CircleGeometry(plaza.r, 64),
    std(repeatTex(T.cobble, 10, 10)),
  );
  plazaMesh.rotation.x = -Math.PI / 2;
  plazaMesh.position.set(plaza.x, 0.02, plaza.z);
  plazaMesh.receiveShadow = true;
  group.add(plazaMesh);

  for (const p of paths) {
    const w = p.x1 - p.x0, d = p.z1 - p.z0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std(repeatTex(T.cobble, w / 3, d / 3)));
    m.rotation.x = -Math.PI / 2;
    m.position.set((p.x0 + p.x1) / 2, 0.015, (p.z0 + p.z1) / 2);
    m.receiveShadow = true;
    group.add(m);
  }

  // ── 건물: 바닥 + 벽 + 지붕 ──
  const roofs = [];
  for (const b of buildings) {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(b.w, b.d),
      b.style === 'glass' ? std(repeatTex(T.cobble, b.w / 4, b.d / 4), { color: 0xaab5a0 }) : std(repeatTex(T.wood, b.w / 3, b.d / 3)),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(b.cx, 0.03, b.cz);
    floor.receiveShadow = true;
    group.add(floor);

    for (const w of b.walls) {
      const mat = w.kind === 'glass' ? M.glass : M.wall;
      const mesh = new THREE.Mesh(worldBox(w.w, w.h, w.d), mat);
      mesh.position.set(w.cx, w.h / 2, w.cz);
      mesh.castShadow = w.kind !== 'glass';
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // 지붕: 안에 들어가면 사라진다(update 에서 처리)
    const roofMat = b.style === 'glass'
      ? new THREE.MeshPhysicalMaterial({ color: 0xbfe6e0, transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false })
      : new THREE.MeshStandardMaterial({ map: T.roof, roughness: 0.9, transparent: true });
    let roof;
    if (b.style === 'glass') {
      roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.6, 0.2, b.d + 0.6), roofMat);
      roof.position.set(b.cx, 3.5, b.cz);
    } else {
      const rh = b.id === 'mansion' ? 5.5 : 3;
      roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(b.w + 1.4, rh, b.d + 1.4);
      roof.position.set(b.cx, 3.4 + rh / 2, b.cz);
    }
    roof.castShadow = b.style !== 'glass';
    group.add(roof);
    roofs.push({ b, mesh: roof, mat: roofMat, baseOpacity: b.style === 'glass' ? 0.25 : 1, cur: 1 });
  }

  // ── 담장 / 울타리 ──
  for (const w of fence) {
    const mesh = new THREE.Mesh(worldBox(w.w, w.h, w.d, 2), M.fence);
    mesh.position.set(w.cx, w.h / 2, w.cz);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const w of hedges) {
    const mesh = new THREE.Mesh(worldBox(w.w, w.h, w.d, 1.6), M.hedge);
    mesh.position.set(w.cx, w.h / 2, w.cz);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  // ── 소품 ──
  const propMat = { table: M.wood, bench: M.wood, crate: M.wood, shelf: M.wood, counter: M.wall, planter: M.stone };
  for (const p of props) {
    const mesh = new THREE.Mesh(worldBox(p.w, p.h, p.d, 1.5), propMat[p.type] ?? M.wood);
    mesh.position.set(p.x, p.h / 2, p.z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    if (p.type === 'planter') {
      const bush = new THREE.Mesh(new THREE.BoxGeometry(p.w - 0.3, 0.5, p.d - 0.3), M.hedge);
      bush.position.set(p.x, p.h + 0.2, p.z);
      group.add(bush);
    }
  }

  // ── 분수 ──
  const fountainGroup = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(fountain.r, fountain.r + 0.2, 0.7, 40), M.stone);
  basin.position.y = 0.35;
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(fountain.r - 0.35, fountain.r - 0.35, 0.05, 40),
    new THREE.MeshStandardMaterial({ color: 0x2b5f86, roughness: 0.1, metalness: 0.3, emissive: 0x0a2236, emissiveIntensity: 0.6 }),
  );
  water.position.y = 0.62;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 16), M.stone);
  pillar.position.y = 1.4;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.5, 0.4, 24), M.stone);
  bowl.position.y = 2.5;
  [basin, pillar, bowl].forEach(m => { m.castShadow = m.receiveShadow = true; });
  fountainGroup.add(basin, water, pillar, bowl);
  fountainGroup.position.set(fountain.x, 0, fountain.z);
  group.add(fountainGroup);

  // ── 나무 (인스턴싱) ──
  const pines = trees.filter(t => t.kind === 'pine');
  const oaks = trees.filter(t => t.kind === 'oak');
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x1f4a2c, roughness: 1 });
  const oakMat = new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 1, flatShading: true });
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.34, 3, 8), barkMat, trees.length);
  const cones = [0, 1, 2].map(() => new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2.2, 8), pineMat, pines.length));
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), oakMat, oaks.length);
  const dummy = new THREE.Object3D();
  trees.forEach((t, i) => {
    dummy.position.set(t.x, 1.5 * t.s, t.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(t.s, t.s, t.s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
  });
  pines.forEach((t, i) => {
    cones.forEach((c, k) => {
      const s = t.s * (2.1 - k * 0.55);
      dummy.position.set(t.x, (2.2 + k * 1.5) * t.s, t.z);
      dummy.scale.set(s, t.s * (1.2 + k * 0.1), s);
      dummy.updateMatrix();
      c.setMatrixAt(i, dummy.matrix);
    });
  });
  oaks.forEach((t, i) => {
    dummy.position.set(t.x, 4.2 * t.s, t.z);
    dummy.scale.set(2.4 * t.s, 2.1 * t.s, 2.4 * t.s);
    dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
  });
  [trunks, ...cones, crowns].forEach(m => { m.castShadow = true; m.receiveShadow = true; group.add(m); });

  // ── 가로등 ──
  const lampLights = [];
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc46b, emissiveIntensity: 0 });
  lamps.forEach((l, i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.6, 8), M.dark);
    pole.position.set(l.x, 1.8, l.z);
    pole.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), lampHeadMat);
    head.position.set(l.x, 3.7, l.z);
    group.add(pole, head);
    if (i < 8) {
      const light = new THREE.PointLight(0xffc98a, 0, 20, 1.6);
      light.position.set(l.x, 3.6, l.z);
      group.add(light);
      lampLights.push(light);
    }
  });

  // ── 도구 스폰 마커 (개발 확인용, T 로 토글) ──
  const markers = new THREE.Group();
  for (const s of toolSpawns) {
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28),
      new THREE.MeshStandardMaterial({ color: TOOL_COLORS[s.tool], emissive: TOOL_COLORS[s.tool], emissiveIntensity: 1.4 }),
    );
    m.position.set(s.x, 0.9, s.z);
    m.userData.baseY = 0.9;
    markers.add(m);
  }
  group.add(markers);

  // ── 별 ──
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 900; i++) {
    const u = Math.random(), v = Math.random() * 0.9 + 0.1;
    const th = u * Math.PI * 2, ph = Math.acos(v);
    sp.push(Math.sin(ph) * Math.cos(th) * 600, Math.cos(ph) * 600, Math.sin(ph) * Math.sin(th) * 600);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xcfd9ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  return {
    group,
    markers,
    // 밤 정도(0~1)에 따라 가로등/별 갱신
    setNight(n) {
      lampLights.forEach(l => { l.intensity = 38 * n; });
      lampHeadMat.emissiveIntensity = 2.2 * n;
      starMat.opacity = Math.max(0, n * 1.2 - 0.2);
    },
    // 플레이어가 건물 안이면 지붕을 투명하게
    update(dt, px, pz, t) {
      for (const r of roofs) {
        const inside = px > r.b.x0 - 0.3 && px < r.b.x1 + 0.3 && pz > r.b.z0 - 0.3 && pz < r.b.z1 + 0.3;
        r.cur += ((inside ? 0 : 1) - r.cur) * Math.min(1, dt * 8);
        r.mat.opacity = r.baseOpacity * r.cur;
        r.mesh.visible = r.cur > 0.02;
        r.mat.depthWrite = r.cur > 0.98 && r.baseOpacity === 1;
      }
      markers.children.forEach((m, i) => {
        m.position.y = m.userData.baseY + Math.sin(t * 2 + i) * 0.12;
        m.rotation.y = t * 1.5;
      });
    },
  };
}

export { MAP_HALF };
