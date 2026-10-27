// 중앙 홀 (ChatGPT 홀 이미지 기반): 2층 높이, 필라스터, 발코니, 태피스트리, 원탁, 샹들리에, 대계단
import * as THREE from 'three';
import { HALL_H } from '../zones.js';
import { addDetail } from '../detail.js';

export function buildHall(k) {
  const { M, ctx, g, box, cyl, sph, lathe, texBox, solid, sconce, chair, painting, vase, pool, col, art, tapestry, bust, tree } = k;
  const A = ctx.assets;
  const Z = 'hall';
  const HL = { color: 0xffa24f, intensity: 8, distance: 13 }; // 홀 촛대 광원 (홀이 커서 일반 방보다 강하게)
  const TC = { x: 10, z: 14 }; // 원탁 중심 (layout meeting_table)
  const DIR = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 };

  // 이미지 바닥과 어울리도록 대리석 바탕 색을 맞춘다. 새 메달리온(v2)의 밝은 대리석은 중성에 가까운 크림색(약 200,190,178)이라
  // 예전 따뜻한 베이지(0xd9c7be)는 문양보다 누렇고 어두워 보였다 → 더 밝고 중성인 색
  M.marble.color.setHex(ctx.horror ? 0x999c9c : A?.floorHQ ? 0xe8e0d8 : 0xe2cdb6);

  // ───────── 바닥: 고화질 메달리온(이미지) > 이전 이미지 > 절차적 데칼 ─────────
  if (ctx.horror) {
    // 공포 시안에서는 공통 바닥 메시의 Higgsfield 재질을 그대로 노출한다.
  } else if (A?.floorHQ) {
    const f = A.floorHQ;
    const mat = new THREE.MeshStandardMaterial({
      name: 'hallFloorHQ', map: f.map, normalMap: f.normalMap, normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.5, metalness: 0, envMapIntensity: 0.7, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    addDetail(mat, { widthM: f.sizeM, heightM: f.sizeM, channel: 'marble', strength: 0.3 }); // 85px/m 위에 1m 타일 대리석 잔결 보강
    const m = new THREE.Mesh(new THREE.PlaneGeometry(f.sizeM, f.sizeM), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(f.centerWorld.x, 0.016, f.centerWorld.z); m.receiveShadow = true; m.renderOrder = 1;
    g.add(m);
    // 홀 남쪽 문(z=24) ~ 메달리온 사이 러너 (절차적, 고해상도)
    const rm = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 7), M.runnerHall);
    rm.rotation.x = -Math.PI / 2; rm.position.set(10, 0.019, 22.6); rm.receiveShadow = true; rm.renderOrder = 2;
    g.add(rm);
  } else if (A?.floor) {
    const f = A.floor;
    const mat = new THREE.MeshStandardMaterial({
      name: 'hallFloorImage', map: f.map, roughnessMap: f.roughnessMap, normalMap: f.normalMap, roughness: 1, metalness: 0,
      normalScale: new THREE.Vector2(0.25, 0.25), envMapIntensity: 1.1,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    addDetail(mat, { widthM: f.w, heightM: f.d, channel: 'floor', strength: 0.4 }); // 저해상도(55px/m) 바닥에 1m 타일 잔결을 덧입혀 선명도 보강
    const m = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.d), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(f.cx, 0.016, f.cz); m.receiveShadow = true; m.renderOrder = 1;
    g.add(m);
    // 중앙 카펫: 이미지의 붉은 원 안쪽(탁자·의자를 메운 번진 부분)을 고해상도 문양으로 덮는다
    const cm = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), M.carpetDisc);
    cm.rotation.x = -Math.PI / 2; cm.position.set(TC.x, 0.017, TC.z); cm.receiveShadow = true; cm.renderOrder = 2;
    g.add(cm);
  } else {
    const med = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), M.medallion);
    med.rotation.x = -Math.PI / 2; med.position.set(TC.x, 0.016, TC.z); med.receiveShadow = true; med.renderOrder = 1;
    g.add(med);
  }
  if (!A?.floorHQ && A?.runner) { // 고화질 바닥이 있으면 저해상도 러너 이미지는 쓰지 않는다
    const r = A.runner;
    const rmat = new THREE.MeshStandardMaterial({
      name: 'runnerSouthImage', map: r.map, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    addDetail(rmat, { widthM: r.w, heightM: r.d, channel: 'fabric', strength: 0.4 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), rmat);
    m.rotation.x = -Math.PI / 2; m.position.set(r.cx, 0.02, r.cz); m.receiveShadow = true; m.renderOrder = 2;
    g.add(m);
  }

  // ───────── 원탁 ─────────
  cyl(2.5, 2.5, 0.09, M.walnut, TC.x, 0.75 - 0.045, TC.z, g, 72);
  cyl(2.35, 2.35, 0.1, M.leather, TC.x, 0.75 - 0.043, TC.z, g, 64, false);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.028, 8, 96), M.brass);
  rim.rotation.x = Math.PI / 2; rim.position.set(TC.x, 0.75 - 0.01, TC.z); g.add(rim);
  cyl(2.2, 2.0, 0.16, M.darkWood, TC.x, 0.6, TC.z, g, 48);
  lathe([[0.001, 0], [1.05, 0], [1.02, 0.05], [0.6, 0.1], [0.42, 0.22], [0.32, 0.38], [0.3, 0.5], [0.48, 0.62], [0.9, 0.66], [0.001, 0.66]], M.walnut, TC.x, 0, TC.z, g, 40);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = box(0.24, 0.12, 1.2, M.walnut, TC.x + Math.cos(a) * 0.78, 0.07, TC.z + Math.sin(a) * 0.78, g);
    leg.rotation.y = -a + Math.PI / 2;
  }
  if (!ctx.horror) vase(TC.x, 0.75, TC.z, 2.0, M.ceramic, true, g, 34);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.1;
    const px = TC.x + Math.cos(a) * 1.9, pz = TC.z + Math.sin(a) * 1.9;
    cyl(0.1, 0.1, 0.012, M.ceramic, px, 0.756, pz, g, 20, false);
    if (i % 2 === 0) cyl(0.035, 0.03, 0.06, M.ceramic, px + 0.04, 0.79, pz, g, 12, false);
  }
  // 의자 12개(12명이 앉는다). 위치는 meeting.js 의 SEATS 와 같아야 한다.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const cx = TC.x + Math.cos(a) * 3.25, cz = TC.z + Math.sin(a) * 3.25;
    chair(cx, cz, TC.x, TC.z, { scale: 1.08, seat: M.leatherBlack });
    col.addCenterBox(cx, cz, 0.55, 0.55, 0, 0.9, 'chair');
  }

  // ───────── 샹들리에 (2단, 촛불 20개) ─────────
  {
    const cy = 5.1;
    cyl(0.014, 0.014, HALL_H - cy - 0.2, M.iron, TC.x, (HALL_H + cy) / 2 + 0.05, TC.z, g, 6, false);
    sph(0.18, M.brass, TC.x, cy + 0.55, TC.z);
    cyl(0.05, 0.05, 0.6, M.brass, TC.x, cy + 0.25, TC.z, g, 10);
    const ring = (R, y, n) => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(R, 0.04, 10, 72), M.brass);
      r.rotation.x = Math.PI / 2; r.position.set(TC.x, y, TC.z); r.castShadow = true; g.add(r);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const cx = TC.x + Math.cos(a) * R, cz = TC.z + Math.sin(a) * R;
        cyl(0.05, 0.03, 0.06, M.brass, cx, y + 0.05, cz, g, 10, false);
        cyl(0.019, 0.019, 0.2, M.candle, cx, y + 0.18, cz, g, 8, false);
        pool.addFlame(g, { x: cx, y: y + 0.31, z: cz, zone: Z, scale: 1.3 });
        const drop = sph(0.024, M.glass, cx, y - 0.14, cz, g, false); drop.scale.y = 2.6;
        cyl(0.004, 0.004, 0.2, M.brass, cx, y - 0.06, cz, g, 4, false);
      }
    };
    ring(1.7, cy, 12);
    ring(1.05, cy + 0.42, 8);
    for (let i = 0; i < 6; i++) { // 위쪽 아치형 팔
      const a = (i / 6) * Math.PI * 2;
      const arm = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.02, 6, 16, Math.PI / 2), M.brass);
      arm.position.set(TC.x + Math.cos(a) * 0.05, cy + 0.2, TC.z + Math.sin(a) * 0.05); arm.rotation.set(0, -a, Math.PI / 2); g.add(arm);
    }
    pool.add({ x: TC.x, y: cy + 0.4, z: TC.z, zone: Z, color: 0xffb066, intensity: 115, distance: 26, flicker: 0.05 });
    // 벽/천장 반사광(GI) 대신: 홀 앞뒤에 은은한 보조광
    pool.add({ x: 10, y: 4.2, z: 5.5, zone: Z, color: 0xffd0a0, intensity: 48, distance: 20, flicker: 0.02 });
    pool.add({ x: 10, y: 4.2, z: 21, zone: Z, color: 0xffd0a0, intensity: 48, distance: 20, flicker: 0.02 });
  }

  // ───────── 대계단 (비보행: layout stair_reserve 충돌) ─────────
  {
    const LAND = 3.0, N = 17, rise = LAND / N;
    const SZ0 = 0.15, SZ1 = 2.6;
    const CX = [8.4, 11.6]; // 곡선 계단의 중심 x
    // 착지부
    texBox(10, LAND, SZ1 - SZ0, M.marble, 10, LAND / 2, (SZ0 + SZ1) / 2);
    box(10.1, 0.08, SZ1 - SZ0 + 0.08, M.stoneCap, 10, LAND + 0.04, (SZ0 + SZ1) / 2);
    box(1.5, 0.012, 2.4, M.velvet, 10, LAND + 0.086, 1.4, g, false);
    // 중앙 직선 계단 + 붉은 러너
    const run = 3.4 / N;
    for (let i = 0; i < N - 1; i++) {
      const y = LAND - (i + 1) * rise, zc = SZ1 + (i + 0.5) * run;
      texBox(3.2, y, run, M.marble, 10, y / 2, zc);
      box(3.3, 0.035, run + 0.03, M.stoneCap, 10, y + 0.0175, zc + 0.012, g, false);
      box(1.5, 0.012, run + 0.005, M.velvet, 10, y + 0.041, zc + 0.012, g, false);
      box(1.5, 0.014, 0.02, M.gold, 10, y + 0.045, zc + run / 2, g, false);
    }
    // 곡선 계단 (좌/우)
    const Rm = 2.8, Rw = 1.2, dth = (Math.PI / 2) / N;
    const flight = (cxC, sign) => {
      for (let j = 0; j < N - 1; j++) {
        const y = LAND - (j + 1) * rise;
        const th = sign < 0 ? Math.PI - (j + 0.5) * dth : (j + 0.5) * dth;
        const px = cxC + Rm * Math.cos(th), pz = SZ1 + Rm * Math.sin(th);
        const step = texBox(Rw, y, Rm * dth * 1.06, M.marble, px, y / 2, pz); step.rotation.y = -th;
        const cap = box(Rw + 0.06, 0.035, Rm * dth * 1.06 + 0.02, M.stoneCap, px, y + 0.0175, pz, g, false); cap.rotation.y = -th;
      }
      for (const R of [Rm + Rw / 2 - 0.05, Rm - Rw / 2 + 0.05]) {
        const pts = [];
        for (let j = 0; j <= N - 1; j++) {
          const th = sign < 0 ? Math.PI - j * dth : j * dth;
          pts.push(new THREE.Vector3(cxC + R * Math.cos(th), LAND - j * rise + 0.95, SZ1 + R * Math.sin(th)));
        }
        const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.04, 8), M.walnut);
        rail.castShadow = true; g.add(rail);
        for (let j = 0; j <= N - 1; j++) {
          const th = sign < 0 ? Math.PI - j * dth : j * dth;
          const bx = cxC + R * Math.cos(th), bz = SZ1 + R * Math.sin(th), by = LAND - j * rise;
          lathe([[0.001, 0], [0.03, 0.02], [0.022, 0.12], [0.04, 0.3], [0.022, 0.5], [0.03, 0.74], [0.02, 0.88], [0.001, 0.9]], M.marbleStatue, bx, by, bz, g, 8);
        }
        for (const j of [0, N - 1]) {
          const th = sign < 0 ? Math.PI - j * dth : j * dth;
          const bx = cxC + R * Math.cos(th), bz = SZ1 + R * Math.sin(th), by = LAND - j * rise;
          box(0.16, 1.15, 0.16, M.marbleStatue, bx, by + 0.57, bz);
          lathe([[0.001, 0], [0.1, 0], [0.12, 0.08], [0.07, 0.16], [0.001, 0.2]], M.brass, bx, by + 1.15, bz, g, 10);
        }
      }
    };
    flight(CX[0], -1); flight(CX[1], +1);
    // 착지부 앞 난간
    for (const [x0, x1] of [[5.05, 6.2], [13.8, 14.95]]) box(x1 - x0, 0.07, 0.09, M.walnut, (x0 + x1) / 2, LAND + 0.95, SZ1 - 0.04);
  }

  // ───────── 건축 오더: 필라스터 / 발코니 ─────────
  // 벽 안쪽 면 기준 그룹: 로컬 +z 가 방 안쪽
  const wallFrame = (x, z, dir) => { const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = DIR[dir]; g.add(grp); return grp; };
  const pilaster = (x, z, dir) => {
    const p = wallFrame(x, z, dir);
    box(0.64, 0.5, 0.22, M.stoneWarm, 0, 0.25, 0.11, p);
    box(0.44, HALL_H - 1.5, 0.15, M.hallStoneAlt ?? M.stoneWarm, 0, 0.5 + (HALL_H - 1.5) / 2 - 0.0, 0.075, p);
    box(0.62, 0.3, 0.22, M.stoneWarm, 0, HALL_H - 0.95, 0.11, p);
    box(0.74, 0.1, 0.26, M.stoneCap, 0, HALL_H - 0.75, 0.13, p);
    box(0.6, 0.08, 0.2, M.stoneCap, 0, 3.0, 0.1, p, false);
  };
  const balcony = (x, z, dir, len = 2.8) => {
    const b = wallFrame(x, z, dir);
    box(len, 0.14, 0.7, M.stoneWarm, 0, 3.5, 0.35, b);
    for (const sx of [-len / 2 + 0.3, len / 2 - 0.3]) box(0.16, 0.34, 0.5, M.stoneWarm, sx, 3.26, 0.27, b);
    box(len, 0.07, 0.08, M.walnut, 0, 4.5, 0.64, b);
    box(len, 0.06, 0.07, M.stoneWarm, 0, 3.62, 0.64, b);
    const n = Math.round(len / 0.2);
    for (let i = 0; i <= n; i++) {
      const sx = -len / 2 + 0.05 + (i / n) * (len - 0.1);
      lathe([[0.001, 0], [0.03, 0.01], [0.022, 0.1], [0.04, 0.3], [0.022, 0.5], [0.03, 0.7], [0.02, 0.84], [0.001, 0.86]], M.marbleStatue, sx, 3.65, 0.64, b, 8);
    }
    for (const sx of [-len / 2 + 0.05, len / 2 - 0.05]) box(0.12, 0.95, 0.12, M.marbleStatue, sx, 4.07, 0.64, b);
  };
  const consoleT = (x, z, dir) => { // 벽 콘솔 (길이 1.5 × 깊이 0.45)
    const b = wallFrame(x, z, dir);
    box(1.5, 0.84, 0.44, M.walnut, 0, 0.42, 0.22, b); box(1.58, 0.05, 0.5, M.stoneCap, 0, 0.865, 0.25, b);
    box(1.34, 0.5, 0.02, M.trimWood, 0, 0.45, 0.45, b, false);
    const sx = dir === 'east' || dir === 'west';
    const cx = x + (dir === 'east' ? 0.25 : dir === 'west' ? -0.25 : 0), cz = z + (dir === 'south' ? 0.25 : dir === 'north' ? -0.25 : 0);
    solid(cx, cz, sx ? 0.5 : 1.58, sx ? 1.58 : 0.5, 0.9, 'console');
    return [cx, cz];
  };

  const IN = 0.15; // 벽 안쪽 면 오프셋
  // 서쪽 벽 (x=0, 안쪽 +x → dir 'east'): 문 z=5,13 (서재로 통함)
  const WW = A?.wallWest;
  if (WW) {
    // ChatGPT 서쪽 입면도(열린 문틀 2 + 태피스트리 2 + 큰 초상화 + 문 위 초상화 2). 평면은 +x 를 향하며 영상 왼쪽 = 남쪽(z 큰 쪽).
    // 영상 왼쪽 문이 z=13, 오른쪽 문이 z=5 에 오도록 가로를 압축해 가운데에 놓고, 위아래는 북쪽 시트의 베이로 보충한다(이음새는 필라스터 중심선).
    const xf = IN + 0.012;
    const c = WW.center, sq = 8.0 / (c.marks.d2 - c.marks.d1);
    const zLeft = 13 + c.marks.d1 * sq, cWidth = c.widthM * sq, zRightEdge = zLeft - cWidth;
    const mkW = (tex, nrm, w, zc) => {
      const mat = new THREE.MeshStandardMaterial({ name: 'wallWestImage', map: tex, normalMap: nrm, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.55, metalness: 0, alphaTest: 0.5, envMapIntensity: 0.9 });
      addDetail(mat, { widthM: w, heightM: HALL_H, channel: 'stone', strength: 0.22 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.004, HALL_H), mat);
      m.rotation.y = Math.PI / 2; m.position.set(xf, HALL_H / 2, zc); m.receiveShadow = true; g.add(m);
    };
    mkW(c.map, c.normalMap, cWidth, (zLeft + zRightEdge) / 2);
    mkW(WW.sideB.map, WW.sideB.normalMap, zRightEdge, zRightEdge / 2);                  // 북쪽 보충
    const rest = 24 - zLeft, cw = rest / 2;                                              // 남쪽 보충(베이 2 x 2)
    for (let i = 0; i < 2; i++) mkW(WW.side.map, WW.side.normalMap, cw, zLeft + cw * (i + 0.5));
    for (const z of [7.82, 10.3, 17.3, 20.2]) sconce(IN, 2.4, z, 'east', Z, HL);
    for (const z of [9, 18.5]) {
      const [cx, cz] = consoleT(IN, z, 'east');
      if (!ctx.horror) vase(cx, 0.9, cz, 1.1, M.ceramic, true, g, 20);
    }
  } else {
    for (const z of [0.5, 4.4, 7.6, 10.4, 13.6, 16.4, 19.6, 23.5]) pilaster(IN, z, 'east');
    for (const z of [3, 9, 15, 21]) balcony(IN, z, 'east');
    for (const z of [6, 12, 18]) {
      tapestry(IN + 0.02, 2.1, z, 1.05, 2.3, 'east', A?.tapestry);
      const [cx, cz] = consoleT(IN, z, 'east');
      if (!ctx.horror) vase(cx, 0.9, cz, 1.1, M.ceramic, true, g, 20);
      sconce(IN, 2.2, z - 1.0, 'east', Z, HL); sconce(IN, 2.2, z + 1.0, 'east', Z, HL);
    }
  }
  // 동쪽 벽 (x=20, 안쪽 -x → dir 'west'): 문 z=5,13 / 태피스트리 z=9, 18.5
  const EW = A?.wallEast;
  if (EW) {
    // ChatGPT 동쪽 입면도(열린 문틀 2 + 태피스트리 2 + 큰 초상화): 문 중심이 레이아웃의 문(z=5, 13)에 오도록 가로를 압축해 가운데에 놓고,
    // 위아래는 북쪽 시트의 베이로 보충한다. 모든 이음새는 필라스터 중심선. 평면은 -x 를 향하며 영상 왼쪽 = 북쪽(z 작은 쪽).
    const xf = 20 - IN - 0.012;
    const c = EW.center, sq = 8.0 / (c.marks.d2 - c.marks.d1); // 문 간격 8m 에 맞춘 가로 배율
    const cWidth = c.widthM * sq, zLeft = 5 - c.marks.d1 * sq, zRight = zLeft + cWidth;
    const mkE = (tex, nrm, w, zc) => {
      const mat = new THREE.MeshStandardMaterial({ name: 'wallEastImage', map: tex, normalMap: nrm, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.55, metalness: 0, alphaTest: 0.5, envMapIntensity: 0.9 });
      addDetail(mat, { widthM: w, heightM: HALL_H, channel: 'stone', strength: 0.22 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.004, HALL_H), mat);
      m.rotation.y = -Math.PI / 2; m.position.set(xf, HALL_H / 2, zc); m.receiveShadow = true; g.add(m);
    };
    mkE(c.map, c.normalMap, cWidth, zLeft + cWidth / 2);
    mkE(EW.sideB.map, EW.sideB.normalMap, zLeft, zLeft / 2);                         // 북쪽 보충 (큰 초상화 베이 1)
    const rest = 24 - zRight, nCopies = 2, cw = rest / nCopies;                        // 남쪽 보충 (베이 2 x 2)
    for (let i = 0; i < nCopies; i++) mkE(EW.side.map, EW.side.normalMap, cw, zRight + cw * (i + 0.5));
    // 이미지에는 촛대가 없으므로 필라스터 위치(큰 초상화 양옆 등)에 촛대를 단다
    for (const z of [7.77, 10.25, 17.3, 20.2]) sconce(20 - IN, 2.4, z, 'west', Z, HL);
    for (const z of [9, 18.5]) {
      const [cx, cz] = consoleT(20 - IN, z, 'west');
      if (!ctx.horror) vase(cx, 0.9, cz, 1.1, M.ceramic, true, g, 20);
    }
  } else {
    for (const z of [0.5, 7.2, 10.8, 16.4, 20.6, 23.5]) pilaster(20 - IN, z, 'west');
    for (const z of [3, 9, 15, 21]) balcony(20 - IN, z, 'west');
    for (const z of [9, 18.5]) {
      tapestry(20 - IN - 0.02, 2.1, z, 1.05, 2.3, 'west', A?.tapestry);
      const [cx, cz] = consoleT(20 - IN, z, 'west');
      if (!ctx.horror) vase(cx, 0.9, cz, 1.1, M.ceramic, true, g, 20);
      sconce(20 - IN, 2.2, z - 1.0, 'west', Z, HL); sconce(20 - IN, 2.2, z + 1.0, 'west', Z, HL);
    }
    sconce(20 - IN, 2.4, 2.4, 'west', Z, HL); sconce(20 - IN, 2.4, 7.6, 'west', Z, HL);
  }
  // 북쪽 벽 (z=0, 안쪽 +z → dir 'south'): 계단 + 큰 초상화 + 벽감 흉상
  if (A?.wallNorth) {
    // ChatGPT 정면 입면도: 3모듈(필라스터 중심선에서 잘라 이음새 없이 이음)을 20m 벽에 붙인다.
    // 필라스터·벽감·초상화·돌림띠가 모두 이미지에 그려져 있으므로 3D 장식은 만들지 않는다.
    const wn = A.wallNorth;
    const modW = 20 / 3;
    wn.map.anisotropy = 16;
    const N2 = A.wallNorth2;
    if (N2) {
      // v2: 초상화 자리가 빈 모듈 2장(각 10m)을 필라스터 중심선(x=10)에서 맞붙인다. 큰 액자 자리 중심 x=5, 15 / 벽감 x≈1.7, 8.3, 11.7, 18.3
      [[N2.a, 5], [N2.b, 15]].forEach(([sh, cx]) => {
        sh.map.anisotropy = 16;
        const mat = new THREE.MeshStandardMaterial({ name: 'wallNorthImage', map: sh.map, roughness: 0.55, metalness: 0, alphaTest: 0.5, envMapIntensity: 0.9 });
        addDetail(mat, { widthM: 10, heightM: HALL_H, channel: 'stone', strength: 0.22 });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(10.004, HALL_H), mat);
        m.position.set(cx, HALL_H / 2, IN + 0.012); m.receiveShadow = true; g.add(m);
      });
    }
    for (let i = 0; i < 3 && !N2; i++) {
      const mat = new THREE.MeshStandardMaterial({
        name: 'wallNorthImage', map: wn.map, normalMap: wn.normalMap, normalScale: new THREE.Vector2(0.7, 0.7),
        roughness: 0.55, metalness: 0, alphaTest: 0.5, envMapIntensity: 0.9,
      });
      addDetail(mat, { widthM: modW, heightM: HALL_H, channel: 'stone', strength: 0.22 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(modW + 0.004, HALL_H), mat);
      m.position.set(modW * (i + 0.5), HALL_H / 2, IN + 0.012);
      m.receiveShadow = true;
      g.add(m);
    }
    // 가운데 큰 초상화: 새 이미지(금색 액자 포함)를 벽 그림 위에 덧걸어 기존 초상화를 완전히 가린다.
    // 기존 액자는 벽 이미지에서 x 약 500~755px / 높이 약 3.0m(월드 y 3.13 중심)라 그보다 약간 크게 건다.
    if (A.portraitBig) {
      // v2 북쪽 벽(큰 액자 자리 x=5, 15): 비어 있는 패널(안쪽 폭 약 1.78m × 높이 3.1m, 중심 y≈3.46) 안에 맞춰 건다. 예전 벽(그림이 구워진 것)이면 기존 위치/크기.
      const v2 = !!A.wallNorth2;
      const ph = v2 ? 2.7 : 3.1, pw = ph * (A.portraitBig.image.width / A.portraitBig.image.height);
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({
        name: 'portraitImage', map: A.portraitBig, alphaTest: 0.5, roughness: 0.55, metalness: 0.05,
        emissive: 0xffffff, emissiveMap: A.portraitBig, emissiveIntensity: 0.1, envMapIntensity: 0.8,
      }));
      pm.position.set(v2 ? 5 : 10, v2 ? 3.46 : 3.13, IN + 0.035); pm.castShadow = false; pm.receiveShadow = true; g.add(pm);
    }
  } else {
    for (const x of [0.5, 4.0, 16.0, 19.5]) pilaster(x, IN, 'south');
  }
  if (!A?.wallNorth) {
    const big = A?.portraits?.[0];
    if (big) art(10, 5.35, IN + 0.02, 1.6, 2.19, 'south', big, { glow: 0.12 });
    else painting(10, 5.35, IN + 0.02, 1.6, 2.2, 'south', 3);
    for (const x of [6.4, 13.6]) {
      box(1.1, 2.0, 0.22, M.stoneWarm, x, 5.1, IN + 0.11);
      box(0.84, 1.7, 0.1, M.iron, x, 5.1, IN + 0.25, g, false);
      box(0.6, 0.08, 0.3, M.stoneCap, x, 4.2, IN + 0.3);
      bust(x, 4.24, IN + 0.3, 0.9, 0);
      sconce(x + (x < 10 ? 1.1 : -1.1), 4.4, IN, 'south', Z, { color: 0xffa24f, intensity: 9, distance: 10 });
    }
    // 위층 발코니 창은 architecture 가 뚫음
  }
  // 남쪽 벽 (z=24, 안쪽 -z → dir 'north'): 문 + 초상화/콘솔
  const SW = A?.wallSouth;
  if (SW) {
    // ChatGPT 정면 입면도: 가운데(문 + 부채꼴 채광창 + 초상화 2)를 x=10 에 놓고, 좌우는 북쪽 시트의 보충 베이를 맞붙인다.
    // 이음새는 모두 필라스터 중심선. 평면은 방 안쪽(-z)을 향하므로 rotation.y = π (영상 왼쪽 = 월드 +x).
    const zf = 24 - IN - 0.012;
    const cw = SW.center.widthM, sideW = (20 - cw) / 2;
    const mk = (tex, nrm, w, x, flip = false) => {
      let map = tex, nm = nrm, ns = 0.7;
      if (flip) { map = tex.clone(); map.wrapS = THREE.RepeatWrapping; map.repeat.x = -1; map.offset.x = 1; map.needsUpdate = true; nm = nrm ? nrm.clone() : null; if (nm) { nm.wrapS = THREE.RepeatWrapping; nm.repeat.x = -1; nm.offset.x = 1; nm.needsUpdate = true; } ns = -0.7; }
      const mat = new THREE.MeshStandardMaterial({ name: 'wallSouthImage', map, normalMap: nm, normalScale: new THREE.Vector2(ns, Math.abs(ns)), roughness: 0.55, metalness: 0, alphaTest: 0.5, envMapIntensity: 0.9 });
      addDetail(mat, { widthM: w, heightM: HALL_H, channel: 'stone', strength: 0.22 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.004, HALL_H), mat);
      m.rotation.y = Math.PI; m.position.set(x, HALL_H / 2, zf); m.receiveShadow = true; g.add(m);
    };
    mk(SW.center.map, SW.center.normalMap, cw, 10);
    // 그림의 문틀 폭(약 1.75m)에 맞게 콜리전 문(2.4m)을 좁힌다
    if (!SW.leafA) { solid(8.95, 24, 0.3, 0.5, 3.4, 'wall'); solid(11.05, 24, 0.3, 0.5, 3.4, 'wall'); }
    mk(SW.side.map, SW.side.normalMap, sideW, 10 + cw / 2 + sideW / 2);          // 동쪽(영상 왼쪽 가장자리 = 모서리 필라스터)
    mk(SW.side.map, SW.side.normalMap, sideW, 10 - cw / 2 - sideW / 2, true);    // 서쪽은 좌우 반전
    // 쌍여닫이 문짝: 그림에서 잘라낸 문짝을 안쪽(홀 쪽)으로 100° 열어 둔다
    for (const [leaf, tex, side] of [['door_leaf_a', SW.leafA, 'a'], ['door_leaf_b', SW.leafB, 'b']]) {
      if (!tex) continue;
      const lw = SW.center.leaves[leaf].w, lh = SW.center.leaves[leaf].h;
      const worldCx = 10 + cw / 2 - SW.center.leaves[leaf].cx; // 영상 왼쪽 = +x
      const hingeX = side === 'a' ? worldCx + lw / 2 : worldCx - lw / 2;
      const d = side === 'a' ? -1 : 1; // 경첩에서 문 중심 쪽 방향
      const pivot = new THREE.Group();
      pivot.position.set(hingeX, 0, zf - 0.01); pivot.rotation.y = d * 1.75; g.add(pivot);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), new THREE.MeshStandardMaterial({ name: 'doorLeafImage', map: tex, roughness: 0.5, side: THREE.DoubleSide, alphaTest: 0.3 }));
      m.rotation.y = Math.PI; m.position.set(d * lw / 2, lh / 2, 0); m.castShadow = true; m.receiveShadow = true;
      pivot.add(m);
    }
  } else {
    for (const x of [0.5, 4.8, 15.2, 19.5]) pilaster(x, 24 - IN, 'north');
  }
  for (const [x, i] of [[6.7, 2], [13.3, 3]]) {
    if (!SW) {
      const tx = A?.portraits?.[i];
      if (tx) art(x, 2.55, 24 - IN - 0.02, 1.05, 1.3, 'north', tx, { glow: 0.1 });
    }
    const [cx, cz] = consoleT(x, 24 - IN, 'north');
    if (!ctx.horror) vase(cx, 0.9, cz, 1.1, M.ceramic, true, g, 20);
    if (!SW) { sconce(x - 1.0, 2.5, 24 - IN, 'north', Z, HL); sconce(x + 1.0, 2.5, 24 - IN, 'north', Z, HL); }
  }
  // 계단 아래 흉상 받침대 + 램프
  for (const x of [4.0, 16.0]) {
    box(0.6, 1.05, 0.6, M.marbleStatue, x, 0.525, 7.6); box(0.68, 0.06, 0.68, M.stoneCap, x, 1.08, 7.6);
    bust(x, 1.1, 7.6, 1.0, x < 10 ? 0.4 : -0.4);
    solid(x, 7.6, 0.62, 0.62, 1.6, 'pedestal');
  }
  for (const x of [5.5, 14.5]) {
    box(0.55, 1.1, 0.55, M.marbleStatue, x, 0.55, 7.7); box(0.62, 0.06, 0.62, M.stoneCap, x, 1.13, 7.7);
    cyl(0.04, 0.05, 0.3, M.brass, x, 1.3, 7.7, g, 8);
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffa95a, emissiveIntensity: 1.2, transparent: true, opacity: 0.9, roughness: 0.2 }));
    gl.position.set(x, 1.6, 7.7); g.add(gl);
    pool.addFlame(g, { x, y: 1.6, z: 7.7, zone: Z, scale: 1.6, light: { color: 0xffb066, intensity: 12, distance: 11 } });
    solid(x, 7.7, 0.56, 0.56, 1.6, 'pedestal');
  }
  // 장식 소나무
  if (!ctx.horror) [[1.2, 22.8], [18.8, 22.8], [1.2, 1.4], [18.8, 1.4], [7.6, 23.0], [12.4, 23.0], [1.2, 9.0], [18.7, 15.6]].forEach(([x, z]) => tree(x, z, 1.35));
}
