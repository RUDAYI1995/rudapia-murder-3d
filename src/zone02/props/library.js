// 서쪽 별채: 서재(library_a) + 집무실(library_b). 홀 서쪽 벽의 문 2개(z=5, 13) 너머.
// 책은 수천 권이라 인스턴싱한다.
import * as THREE from 'three';
import { mulberry32 } from '../noise.js';

export function buildLibrary(k) {
  const { M, ctx, g, box, cyl, sph, lathe, solid, sconce, chair, vase, plant, pool, col, art } = k;
  const A = ctx.assets;
  const rnd = mulberry32(2026);
  const DIR = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 };

  // ───────── 책 (인스턴싱) ─────────
  const BOOK_COLORS = [0x5a1a1a, 0x1f3a2a, 0x23304f, 0x4a3320, 0x6b5a2a, 0x2c2c33, 0x7a3a2a, 0x3a2a4a, 0xc8b88a, 0x8a2a2a];
  const books = []; // {m: Matrix4, c: color}
  const tmpO = new THREE.Object3D();

  // 책장: (x,z) 는 책장 뒷면이 닿는 벽면 위의 중심점, dir 은 방 안쪽을 향하는 방향
  const shelf = (x, z, dir, w = 2.4) => {
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = DIR[dir]; g.add(grp);
    const D = 0.42, Hh = 2.7;
    box(w, Hh, 0.04, M.darkWood, 0, Hh / 2, 0.02, grp, false);              // 뒷판
    box(0.05, Hh, D, M.walnut, -w / 2 + 0.025, Hh / 2, D / 2, grp);        // 옆판
    box(0.05, Hh, D, M.walnut, w / 2 - 0.025, Hh / 2, D / 2, grp);
    box(w, 0.06, D + 0.04, M.walnut, 0, Hh + 0.03, D / 2 + 0.02, grp);     // 상판
    box(w, 0.14, D + 0.02, M.walnut, 0, 0.07, D / 2 + 0.01, grp);          // 하단 받침
    const rows = [0.3, 0.84, 1.38, 1.92, 2.46];
    rows.forEach(y => {
      box(w - 0.1, 0.035, D - 0.02, M.walnut, 0, y, D / 2 - 0.01, grp);
      // 이 단의 책들
      let cx = -w / 2 + 0.1; const end = w / 2 - 0.1;
      while (cx < end - 0.05) {
        const bw = 0.025 + rnd() * 0.045, bh = 0.26 + rnd() * 0.2, bd = 0.22 + rnd() * 0.08;
        if (rnd() < 0.06) { cx += 0.1 + rnd() * 0.12; continue; } // 빈 틈
        const lean = rnd() < 0.05 ? (rnd() - 0.5) * 0.35 : 0;
        tmpO.position.set(cx + bw / 2, y + 0.018 + bh / 2, 0.06 + bd / 2); tmpO.rotation.set(0, 0, lean); tmpO.scale.set(bw, bh, bd); tmpO.updateMatrix();
        books.push({ m: tmpO.matrix.clone().premultiply(grp.matrixWorld.clone().identity()), local: tmpO.matrix.clone(), grp, c: BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)] });
        cx += bw + 0.004;
      }
    });
    // 충돌
    const along = dir === 'east' || dir === 'west';
    const cxw = x + (dir === 'east' ? D / 2 : dir === 'west' ? -D / 2 : 0), czw = z + (dir === 'south' ? D / 2 : dir === 'north' ? -D / 2 : 0);
    solid(cxw, czw, along ? D : w, along ? w : D, 2.7, 'shelf');
    return grp;
  };

  const armchair = (x, z, faceX, faceZ, mat = M.leather) => {
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = Math.atan2(faceX - x, faceZ - z); g.add(grp);
    box(0.85, 0.28, 0.85, M.darkWood, 0, 0.14, 0, grp);
    box(0.78, 0.2, 0.7, mat, 0, 0.38, 0.04, grp);
    box(0.85, 0.7, 0.2, mat, 0, 0.78, -0.33, grp);
    for (const sx of [-0.4, 0.4]) box(0.16, 0.5, 0.8, mat, sx, 0.55, 0, grp);
    solid(x, z, 0.95, 0.95, 1.1, 'armchair');
  };

  const lamp = (x, y, z, zone, { shade = 0xe8d9b0, intensity = 11 } = {}) => {
    cyl(0.045, 0.06, 0.34, M.brass, x, y + 0.17, z, g, 10);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.22, 16, 1, true), new THREE.MeshStandardMaterial({ color: shade, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x6a4a1a, emissiveIntensity: 0.7 }));
    s.position.set(x, y + 0.44, z); g.add(s);
    pool.add({ x, y: y + 0.45, z, zone, color: 0xffc27a, intensity, distance: 9, flicker: 0.03 });
  };

  // ───────── 서재 A (z 1~9, 문 z=5): 책장 + 독서 공간 ─────────
  {
    const Z = 'library_a';
    for (const x of [-7.7, -5.3, -2.9]) { shelf(x, 1.15, 'south'); shelf(x, 8.85, 'north'); }
    shelf(-8.85, 2.6, 'east'); shelf(-8.85, 7.4, 'east');
    // 러그 + 독서 탁자 + 의자
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), M.rugLib);
    rug.rotation.x = -Math.PI / 2; rug.position.set(-4.4, 0.02, 5); rug.receiveShadow = true; rug.renderOrder = 1; g.add(rug);
    cyl(0.8, 0.8, 0.06, M.walnut, -4.4, 0.74, 5, g, 36); cyl(0.12, 0.2, 0.7, M.walnut, -4.4, 0.36, 5, g, 14); cyl(0.4, 0.45, 0.06, M.walnut, -4.4, 0.03, 5, g, 20);
    col.addCircle(-4.4, 5, 0.85, 'table');
    lamp(-4.4, 0.77, 5, Z);
    vase(-4.0, 0.77, 5.3, 0.6, M.ceramic, false);
    armchair(-5.9, 4.0, -4.4, 5, M.fabricRed); armchair(-5.9, 6.0, -4.4, 5, M.fabricRed); armchair(-2.7, 5.0, -4.4, 5, M.leather);
    // 문(동쪽 벽) 양옆 촛대 + 액자
    for (const z of [2.9, 7.1]) sconce(-0.15, 2.3, z, 'west', Z, { color: 0xffa24f, intensity: 9, distance: 9 });
    if (A?.portraits?.[0]) art(-0.2, 2.2, 2.3, 0.9, 1.3, 'west', A.portraits[0], { glow: 0.1 });
    if (A?.portraits?.[1]) art(-0.2, 2.2, 7.7, 0.9, 1.3, 'west', A.portraits[1], { glow: 0.1 });
    plant(-1.0, 1.9, 1.0); plant(-1.0, 8.1, 1.0);
  }

  // ───────── 집무실 B (z 9~17, 문 z=13): 책상 + 책장 ─────────
  {
    const Z = 'library_b';
    for (const x of [-7.7, -5.3, -2.9]) { shelf(x, 9.15, 'south'); shelf(x, 16.85, 'north'); }
    shelf(-8.85, 10.6, 'east'); shelf(-8.85, 15.4, 'east');
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), M.rugLib);
    rug.rotation.x = -Math.PI / 2; rug.position.set(-5.2, 0.02, 13); rug.receiveShadow = true; rug.renderOrder = 1; g.add(rug);
    // 큰 책상 (서쪽에 놓고 문을 향해 앉는다)
    box(1.0, 0.06, 2.2, M.walnut, -6.4, 0.76, 13); box(0.9, 0.7, 0.5, M.darkWood, -6.4, 0.38, 12.1); box(0.9, 0.7, 0.5, M.darkWood, -6.4, 0.38, 13.9);
    solid(-6.4, 13, 1.05, 2.25, 0.85, 'desk');
    lamp(-6.5, 0.79, 12.4, Z, { intensity: 12 });
    box(0.32, 0.015, 0.22, M.fabricRed, -6.2, 0.795, 13.5, g, false); box(0.28, 0.012, 0.2, M.leather, -6.25, 0.797, 13.6, g, false);
    chair(-5.5, 13, -6.4, 13, { seat: M.leather }); col.addCenterBox(-5.5, 13, 0.55, 0.55, 0, 1, 'chair');
    // 지구본
    cyl(0.02, 0.02, 0.6, M.brass, -2.2, 0.3, 15.6, g, 8); sph(0.28, M.leaf, -2.2, 0.85, 15.6); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.015, 8, 32), M.brass); ring.position.set(-2.2, 0.85, 15.6); ring.rotation.set(0.4, 0, 0.4); g.add(ring);
    col.addCircle(-2.2, 15.6, 0.35, 'globe');
    armchair(-2.4, 10.4, -4.5, 13, M.leather); armchair(-2.4, 11.6, -4.5, 13, M.leather);
    box(0.5, 0.45, 0.9, M.walnut, -3.5, 0.23, 11.0); solid(-3.5, 11.0, 0.55, 0.95, 0.5, 'table');
    for (const z of [10.9, 15.1]) sconce(-0.15, 2.3, z, 'west', Z, { color: 0xffa24f, intensity: 9, distance: 9 });
    if (A?.portraits?.[2]) art(-0.2, 2.2, 11.4, 0.9, 1.1, 'west', A.portraits[2], { glow: 0.1 });
    if (A?.portraits?.[3]) art(-0.2, 2.2, 14.6, 0.9, 1.1, 'west', A.portraits[3], { glow: 0.1 });
    plant(-1.0, 9.9, 1.0); plant(-1.0, 16.1, 1.0);
  }

  // ───────── 책 인스턴스 생성 (월드 행렬 반영) ─────────
  g.updateMatrixWorld(true);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 }), books.length);
  const col3 = new THREE.Color();
  books.forEach((b, i) => {
    const world = b.grp.matrixWorld.clone().multiply(b.local);
    im.setMatrixAt(i, world);
    col3.setHex(b.c).multiplyScalar(0.8 + rnd() * 0.4);
    im.setColorAt(i, col3);
  });
  im.castShadow = true; im.receiveShadow = true;
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  g.add(im);
}
