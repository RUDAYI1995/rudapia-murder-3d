// 동쪽 날개(복도·식당·주방·보안실·기계실)와 현관 소품
import * as THREE from 'three';

export function buildEast(k) {
  const { M, ctx, g, box, cyl, sph, lathe, texBox, solid, candle, sconce, chair, painting, vase, plant, pool, col, shade, put } = k;

  const decal = (mat, w, d, x, z, rotY = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = rotY;
    m.position.set(x, 0.02, z); m.receiveShadow = true; m.renderOrder = 1;
    g.add(m);
    return m;
  };
  const stdMat = (c, r = 0.7, m = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });

  // ───────── 복도 ─────────
  {
    const Z = 'corridor';
    decal(M.runner, 1.5, 22, 21.5, 12);
    for (const z of [2.4, 9, 16.5, 22.4]) sconce(22.85, 2.2, z, 'west', Z, { color: 0xffa24f, intensity: 7, distance: 8 });
    painting(22.86, 1.95, 9, 0.9, 1.2, 'west', 7);
    painting(22.86, 1.95, 16.5, 0.9, 1.2, 'west', 11);
    painting(20.14, 1.95, 9, 0.9, 1.2, 'east', 12);
    painting(20.14, 1.95, 18.5, 0.9, 1.2, 'east', 14);
    // 협탁
    box(0.4, 0.8, 1.2, M.walnut, 20.35, 0.4, 9); solid(20.35, 9, 0.4, 1.2, 0.8, 'table');
    vase(20.35, 0.8, 9, 0.8);
    plant(20.5, 22.9, 0.9);
  }

  // ───────── 식당 ─────────
  {
    const Z = 'dining';
    const TX = 31, TZ = 4.5;
    decal(M.rugDining, 8.4, 3.9, TX, TZ);
    // 긴 식탁
    box(7, 0.07, 2.2, M.walnut, TX, 0.715, TZ);
    box(6.7, 0.18, 1.9, M.darkWood, TX, 0.6, TZ);
    for (const sx of [-3.0, 3.0]) {
      lathe([[0.001, 0], [0.5, 0], [0.46, 0.06], [0.26, 0.12], [0.2, 0.3], [0.24, 0.5], [0.4, 0.68], [0.001, 0.68]], M.walnut, TX + sx, 0, TZ, g, 20);
    }
    box(5.6, 0.05, 0.3, M.walnut, TX, 0.12, TZ);
    box(6.4, 0.012, 0.7, M.fabricRed, TX, 0.756, TZ, g, false);
    // 의자 12개
    for (let i = -2; i <= 2; i++) {
      for (const sz of [-1.5, 1.5]) {
        chair(TX + i * 1.4, TZ + sz, TX + i * 1.4, TZ, { seat: M.fabricNavy });
        col.addCenterBox(TX + i * 1.4, TZ + sz * 1.05, 0.5, 0.5, 0, 1.0, 'chair');
        // 접시 + 잔
        const pz = TZ + Math.sign(sz) * 0.78;
        cyl(0.13, 0.11, 0.015, M.ceramic, TX + i * 1.4, 0.77, pz, g, 20, false);
        cyl(0.03, 0.03, 0.1, M.glass, TX + i * 1.4 + 0.2, 0.82, pz - Math.sign(sz) * 0.1, g, 10, false);
      }
    }
    for (const sx of [-4.1, 4.1]) {
      chair(TX + sx, TZ, TX, TZ, { seat: M.fabricNavy, scale: 1.12 });
      col.addCenterBox(TX + sx * 1.04, TZ, 0.55, 0.55, 0, 1.0, 'chair');
    }
    // 촛대 2개
    for (const cx of [TX - 1.6, TX + 1.6]) {
      lathe([[0.001, 0], [0.09, 0], [0.07, 0.04], [0.025, 0.12], [0.03, 0.26], [0.001, 0.28]], M.brass, cx, 0.757, TZ, g, 14);
      box(0.3, 0.02, 0.02, M.brass, cx, 1.0, TZ, g, false);
      for (const dx of [-0.15, 0, 0.15]) {
        candle(cx + dx, dx === 0 ? 1.0 : 0.99, TZ, Z, { h: 0.16, light: dx === 0 ? { color: 0xffa95a, intensity: 8, distance: 9 } : null });
      }
      cyl(0.012, 0.012, 0.25, M.brass, cx, 0.88, TZ, g, 6, false);
    }
    // 과일 그릇
    lathe([[0.001, 0], [0.1, 0], [0.18, 0.08], [0.22, 0.12], [0.19, 0.12], [0.001, 0.04]], M.brass, TX, 0.757, TZ, g, 20);
    for (let i = 0; i < 6; i++) sph(0.05, new THREE.MeshStandardMaterial({ color: [0xb02a1e, 0xc79a2a, 0x5f7a2a][i % 3], roughness: 0.6 }), TX + (i % 3 - 1) * 0.07, 0.9, TZ + (i > 2 ? 0.05 : -0.05), g, false);
    // 사이드보드 (북쪽 벽)
    box(2.8, 0.9, 0.5, M.walnut, TX, 0.45, 0.45); box(2.9, 0.05, 0.56, M.stoneCap, TX, 0.925, 0.45);
    solid(TX, 0.45, 2.8, 0.5, 0.95, 'sideboard');
    for (const dx of [-0.8, 0.2, 0.9]) lathe([[0.001, 0], [0.05, 0], [0.07, 0.1], [0.03, 0.22], [0.04, 0.3], [0.001, 0.3]], M.glass, TX + dx, 0.95, 0.45, g, 12);
    painting(TX, 2.25, 0.16, 1.6, 1.0, 'south', 21);
    for (const z of [2.0, 8.0]) { sconce(23.15, 2.1, z, 'east', Z, { color: 0xffa24f, intensity: 6, distance: 7 }); sconce(38.85, 2.1, z, 'west', Z, { color: 0xffa24f, intensity: 6, distance: 7 }); }
    plant(37.8, 1.0, 1.1); plant(24.2, 1.0, 1.1);
  }

  // ───────── 주방 ─────────
  {
    const Z = 'kitchen';
    const steel = M.steel, wood = M.walnut;
    const subTop = M.whiteStone;
    // 북쪽 벽 조리대 (layout kitchen_counter: 34.5, 9.8, 5×0.8)
    box(5, 0.86, 0.72, M.darkWood, 34.5, 0.43, 9.8); box(5.1, 0.04, 0.78, subTop, 34.5, 0.88, 9.8);
    for (let i = 0; i < 5; i++) box(0.9, 0.7, 0.02, M.trimWood, 32.5 + 0.5 + i * 1.0, 0.43, 10.18, g, false);
    box(0.7, 0.02, 0.5, steel, 33.5, 0.905, 9.8, g, false); // 싱크
    cyl(0.015, 0.015, 0.3, steel, 33.5, 1.05, 9.5, g, 8); box(0.02, 0.02, 0.15, steel, 33.5, 1.2, 9.58);
    // 가스레인지 + 후드
    box(0.9, 0.04, 0.6, M.iron, 36.0, 0.9, 9.8);
    for (const [dx, dz] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) cyl(0.09, 0.09, 0.015, M.iron, 36.0 + dx, 0.93, 9.8 + dz, g, 16, false);
    cyl(0.14, 0.14, 0.12, steel, 35.8, 0.99, 9.65, g, 18); // 냄비
    cyl(0.13, 0.12, 0.07, M.iron, 36.2, 0.97, 9.95, g, 18); box(0.28, 0.02, 0.04, M.iron, 36.45, 0.99, 9.95); // 프라이팬
    box(1.0, 0.5, 0.5, steel, 36.0, 2.2, 9.6); box(0.4, 1.0, 0.3, steel, 36.0, 2.95, 9.55);
    // 위 찬장
    box(2.6, 0.8, 0.36, M.darkWood, 33.3, 2.0, 9.35); box(1.0, 0.8, 0.36, M.darkWood, 37.8, 2.0, 9.35);
    solid(34.5, 9.8, 5, 0.8, 0.9, 'counter');
    // 아일랜드 (layout kitchen_island: 31, 13, 5×1.6)
    box(5, 0.86, 1.5, M.darkWood, 31, 0.43, 13); box(5.2, 0.07, 1.7, wood, 31, 0.895, 13);
    for (const x of [28.6, 33.4]) box(0.08, 0.86, 1.52, M.trimWood, x, 0.43, 13, g, false);
    solid(31, 13, 5, 1.6, 0.95, 'island');
    for (const x of [29.5, 31, 32.5]) { cyl(0.17, 0.17, 0.06, M.leather, x, 0.68, 14.7, g, 16); cyl(0.025, 0.025, 0.65, M.iron, x, 0.33, 14.7, g, 6); cyl(0.17, 0.2, 0.03, M.iron, x, 0.02, 14.7, g, 12, false); }
    // 칼 꽂이 + 셰프 나이프 (도구 스폰 지점 후보)
    box(0.18, 0.22, 0.12, wood, 29.6, 1.0, 12.8);
    for (let i = 0; i < 4; i++) box(0.025, 0.1, 0.02, M.iron, 29.54 + i * 0.04, 1.16, 12.8, g, false);
    box(0.4, 0.025, 0.28, wood, 31.2, 0.945, 12.9); // 도마
    box(0.22, 0.012, 0.04, steel, 31.1, 0.968, 12.9, g, false);
    // 걸어 둔 팬 랙
    box(3, 0.04, 0.05, M.iron, 31, 2.45, 13, g, false);
    for (const x of [29.8, 30.8, 31.8, 32.6]) {
      cyl(0.003, 0.003, 0.4, M.iron, x, 2.65, 13, g, 4, false);
      const pan = cyl(0.14, 0.12, 0.035, M.iron, x, 2.2, 13.05, g, 20, false); pan.rotation.x = Math.PI / 2.4;
      box(0.025, 0.02, 0.3, M.iron, x, 2.2 - 0.12, 13.2 + 0.0, g, false).rotation.x = 0.5;
    }
    // 매다는 등
    for (const x of [29.5, 32.5]) {
      cyl(0.003, 0.003, 0.7, M.iron, x, 3.05, 13, g, 4, false);
      const shadeM = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 18, 1, true), stdMat(0x23262a, 0.5, 0.6, { side: THREE.DoubleSide, emissive: 0x201408, emissiveIntensity: 0.4 }));
      shadeM.position.set(x, 2.62, 13); shadeM.castShadow = true; g.add(shadeM);
      const bulb = sph(0.05, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), x, 2.55, 13, g, false);
      void bulb;
      pool.add({ x, y: 2.5, z: 13, zone: Z, color: 0xffd9a8, intensity: 10, distance: 10, flicker: 0.03 });
    }
    // 냉장고 (동쪽 벽)
    box(0.85, 2.0, 0.95, steel, 38.5, 1.0, 10.6); box(0.02, 0.5, 0.03, M.iron, 38.05, 1.35, 10.25, g, false);
    solid(38.5, 10.6, 0.85, 0.95, 2.0, 'fridge');
    // 남쪽 벽 조리대/선반
    box(4, 0.86, 0.72, M.darkWood, 26, 0.43, 16.6); box(4.1, 0.04, 0.78, subTop, 26, 0.88, 16.6); solid(26, 16.6, 4, 0.78, 0.9, 'counter');
    box(5, 0.86, 0.72, M.darkWood, 35.5, 0.43, 16.6); box(5.1, 0.04, 0.78, subTop, 35.5, 0.88, 16.6); solid(35.5, 16.6, 5, 0.78, 0.9, 'counter');
    for (const x of [26, 35.5]) { box(x < 30 ? 3.2 : 4.4, 0.04, 0.3, wood, x, 1.85, 16.8); box(x < 30 ? 3.2 : 4.4, 0.04, 0.3, wood, x, 2.35, 16.8); }
    for (let i = 0; i < 9; i++) { const x = 24.6 + i * 0.38; cyl(0.06, 0.06, 0.2, i % 2 ? M.glass : M.ceramic, x, 1.96, 16.82, g, 10, false); }
    for (let i = 0; i < 11; i++) cyl(0.07, 0.07, 0.26, i % 2 ? M.pot : M.ceramic, 33.4 + i * 0.4, 2.5, 16.82, g, 10, false);
    plant(24.0, 10.0, 0.8, false);
    // 환기구 느낌의 기둥 불빛은 주방 등으로 충분
    sconce(23.15, 2.2, 15.2, 'east', Z, { color: 0xffe0b0, intensity: 6, distance: 7 });
  }

  // ───────── 보안실 ─────────
  {
    const Z = 'security';
    // 책상 (layout security_desk: 27, 18, 3×0.8)
    box(3, 0.05, 0.8, M.steel, 27, 0.75, 18); box(0.05, 0.75, 0.8, M.steel, 25.6, 0.375, 18); box(0.05, 0.75, 0.8, M.steel, 28.4, 0.375, 18);
    box(2.9, 0.4, 0.04, M.iron, 27, 0.5, 18.34, g, false);
    solid(27, 18, 3, 0.8, 1.2, 'desk');
    // 모니터 4대 (애니메이션 화면)
    const screens = [];
    const mkScreen = () => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 80;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.3, color: 0x000000 });
      screens.push({ c, t, mat, n: screens.length });
      return mat;
    };
    const mons = [[-0.9, 0.0], [-0.3, 0.0], [0.3, 0.0], [0.9, 0.0]];
    mons.forEach(([dx], i) => {
      const x = 27 + dx;
      box(0.54, 0.34, 0.04, M.iron, x, 1.12, 17.75);
      // 화면은 책상 앞(남쪽, +z)을 향한다
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), mkScreen());
      scr.position.set(x, 1.12, 17.772);
      g.add(scr);
      cyl(0.02, 0.03, 0.14, M.iron, x, 0.88, 17.75, g, 8, false);
    });
    box(0.5, 0.015, 0.16, M.iron, 26.7, 0.78, 18.25, g, false); box(0.06, 0.02, 0.1, M.iron, 27.4, 0.78, 18.25, g, false);
    // 의자
    cyl(0.22, 0.22, 0.07, M.leather, 27, 0.5, 19.2, g, 16); box(0.42, 0.5, 0.06, M.leather, 27, 0.82, 19.45); cyl(0.03, 0.03, 0.3, M.iron, 27, 0.3, 19.2, g, 6, false);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const l = box(0.3, 0.03, 0.04, M.iron, 27 + Math.cos(a) * 0.15, 0.1, 19.2 + Math.sin(a) * 0.15, g, false); l.rotation.y = -a; }
    // 서버 랙 + LED
    box(0.9, 2.1, 0.7, M.iron, 30.4, 1.05, 22.4); solid(30.4, 22.4, 0.9, 0.7, 2.1, 'rack');
    const ledMat = [new THREE.MeshBasicMaterial({ color: 0x3aff7a }), new THREE.MeshBasicMaterial({ color: 0xff8a3a }), new THREE.MeshBasicMaterial({ color: 0x3ab0ff })];
    const leds = [];
    for (let i = 0; i < 18; i++) { const l = box(0.025, 0.02, 0.01, ledMat[i % 3], 30.1 + (i % 6) * 0.1, 0.5 + Math.floor(i / 6) * 0.35, 22.05, g, false); leds.push(l); }
    // 서류함
    for (const x of [24.6, 25.4, 26.2]) { box(0.7, 1.3, 0.55, M.steel, x, 0.65, 23.6); solid(x, 23.6, 0.7, 0.55, 1.3, 'cabinet'); }
    // 코르크 보드 (증거 사진)
    box(1.8, 1.1, 0.04, M.pot, 23.17, 1.9, 22.0, g, false).rotation.y = Math.PI / 2;
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), stdMat([0xd8d2c0, 0xcfc8b0, 0xb8b09c][i % 3], 0.9));
      p.position.set(23.2, 1.9 + ((i * 37) % 5 - 2) * 0.12, 21.4 + (i % 4) * 0.4); p.rotation.y = Math.PI / 2; g.add(p);
    }
    // 천장 형광등 + 모니터 빛
    box(1.4, 0.05, 0.3, new THREE.MeshBasicMaterial({ color: 0xe6f2ff }), 27, 3.35, 20.5, g, false);
    pool.add({ x: 27, y: 3.1, z: 20.5, zone: Z, color: 0xcfe6ff, intensity: 9, distance: 9, flicker: 0.04, alwaysOn: true });
    pool.add({ x: 27, y: 1.2, z: 18.8, zone: Z, color: 0x6aa8ff, intensity: 3.5, distance: 5, flicker: 0.1, alwaysOn: true });
    // 화면/LED 갱신
    let acc = 0;
    ctx.updaters.push((dt, t) => {
      acc += dt;
      if (acc < 0.1) return;
      acc = 0;
      for (const s of screens) {
        const x = s.c.getContext('2d');
        x.fillStyle = '#04100a'; x.fillRect(0, 0, 128, 80);
        x.strokeStyle = '#2f8f5a'; x.lineWidth = 1;
        const rooms = [[10, 12, 50, 26], [64, 12, 54, 26], [10, 44, 36, 24], [52, 44, 66, 24]];
        for (const r of rooms) x.strokeRect(r[0], r[1], r[2], r[3]);
        const px = 20 + ((Math.sin(t * 0.7 + s.n * 2) * 0.5 + 0.5) * 90), py = 25 + ((Math.cos(t * 0.5 + s.n) * 0.5 + 0.5) * 40);
        x.fillStyle = '#d6ffd8'; x.fillRect(px, py, 3, 3);
        for (let i = 0; i < 80; i += 3) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, i, 128, 1); }
        x.fillStyle = '#7bd9a2'; x.font = '9px monospace'; x.fillText(`CAM 0${s.n + 1}`, 4, 9);
        x.fillText(`${String(Math.floor(t) % 60).padStart(2, '0')}:${String(Math.floor(t * 10) % 10)}`, 98, 77);
        s.t.needsUpdate = true;
      }
      leds.forEach((l, i) => { l.visible = Math.sin(t * (3 + (i % 5)) + i) > -0.3; });
    });
  }

  // ───────── 기계실 ─────────
  {
    const Z = 'utility';
    // 라커 (layout utility_cabinets: 35, 18.1, 4×0.8)
    for (let i = 0; i < 5; i++) {
      const x = 33.4 + i * 0.8;
      box(0.76, 2.0, 0.7, M.steel, x, 1.0, 18.1);
      box(0.5, 0.25, 0.01, M.iron, x, 1.65, 18.46, g, false);
      box(0.03, 0.2, 0.03, M.iron, x + 0.25, 1.0, 18.48, g, false);
    }
    solid(35.4, 18.1, 4, 0.8, 2.0, 'lockers');
    // 보일러 + 배관
    cyl(0.6, 0.6, 1.9, M.steel, 37.5, 0.95, 22.6, g, 24); cyl(0.55, 0.62, 0.15, M.iron, 37.5, 1.95, 22.6, g, 24);
    col.addCircle(37.5, 22.6, 0.65, 'boiler');
    for (const y of [2.5, 2.8]) { const p = cyl(0.05, 0.05, 6, M.iron, 38.75, y, 21, g, 10); p.rotation.x = Math.PI / 2; }
    cyl(0.06, 0.06, 1.5, M.iron, 37.5, 2.9, 22.6, g, 10);
    box(0.5, 0.7, 0.12, M.iron, 31.2, 1.5, 21.0, g, false); // 배전반
    for (let i = 0; i < 6; i++) box(0.04, 0.04, 0.02, i % 2 ? M.brass : M.leaf, 31.12 + 0.0, 1.25 + (i % 3) * 0.14, 20.8 + Math.floor(i / 3) * 0.2, g, false);
    // 상자/양동이
    for (const [x, z, s] of [[32.2, 23.2, 0.7], [33.0, 23.4, 0.5], [38.0, 19.0, 0.6]]) { box(s, s, s, M.pot, x, s / 2, z); solid(x, z, s, s, s, 'crate'); }
    cyl(0.18, 0.14, 0.34, M.steel, 36, 0.17, 18.9, g, 14); // 양동이
    // 케이지 램프
    sph(0.07, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), 35, 3.05, 21, g, false);
    cyl(0.003, 0.003, 0.35, M.iron, 35, 3.25, 21, g, 4, false);
    pool.add({ x: 35, y: 3.0, z: 21, zone: Z, color: 0xffd0a0, intensity: 8, distance: 9, flicker: 0.06, alwaysOn: true });
  }

  // ───────── 현관 ─────────
  {
    const Z = 'foyer';
    box(0.4, 0.8, 1.4, M.walnut, 8.35, 0.4, 27.4); solid(8.35, 27.4, 0.4, 1.4, 0.9, 'table');
    box(0.44, 0.04, 1.5, M.stoneCap, 8.35, 0.82, 27.4);
    // 탁상 램프
    cyl(0.03, 0.05, 0.3, M.brass, 8.35, 1.0, 27.4, g, 10);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.2, 16, 1, true), stdMat(0xe8d9b0, 0.8, 0, { side: THREE.DoubleSide, emissive: 0x6a4a1a, emissiveIntensity: 0.6 }));
    sh.position.set(8.35, 1.25, 27.4); g.add(sh);
    pool.add({ x: 8.4, y: 1.3, z: 27.4, zone: Z, color: 0xffc27a, intensity: 6, distance: 6, flicker: 0.03 });
    vase(8.35, 0.84, 26.7, 0.7);
    // 벤치
    box(0.45, 0.45, 1.3, M.walnut, 11.75, 0.23, 27.6); box(0.5, 0.07, 1.4, M.fabricRed, 11.75, 0.49, 27.6); solid(11.75, 27.6, 0.5, 1.4, 0.5, 'bench');
    // 매트
    if (!ctx.assets?.runner) { // 이미지 러너가 없을 때만 임시 매트
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.6), stdMat(0x1c2540, 1));
      mat.rotation.x = -Math.PI / 2; mat.position.set(10, 0.022, 27); mat.receiveShadow = true; g.add(mat);
    }
    sconce(8.15, 2.2, 25.4, 'east', Z, { color: 0xffa24f, intensity: 7, distance: 7 });
    sconce(11.85, 2.2, 25.4, 'west', Z, { color: 0xffa24f, intensity: 7, distance: 7 });
    sconce(8.15, 2.2, 28.8, 'east', Z, { color: 0xffa24f, intensity: 7, distance: 7 });
    sconce(11.85, 2.2, 28.8, 'west', Z, { color: 0xffa24f, intensity: 7, distance: 7 });
    painting(8.14, 1.9, 26.2, 0.7, 0.9, 'east', 31);
    box(2.6, 0.06, 0.5, M.stoneCap, 10, 0.03, 30.2, g, false);
  }
}
