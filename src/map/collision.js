// 2D(xz) 충돌. 원(플레이어) vs 축 정렬 박스/원. 서버에서도 그대로 재사용한다.
import { buildings, fence, hedges, props, trees, lamps, fountain, MAP_HALF } from './mansionMap.js';

export function buildColliders() {
  const boxes = [
    ...buildings.flatMap(b => b.walls),
    ...fence,
    ...hedges,
    ...props.filter(p => p.collide).map(p => ({ cx: p.x, cz: p.z, w: p.w, d: p.d, h: p.h, kind: p.type })),
  ].map(b => ({ ...b, minX: b.cx - b.w / 2, maxX: b.cx + b.w / 2, minZ: b.cz - b.d / 2, maxZ: b.cz + b.d / 2 }));
  const circles = [
    ...trees.map(t => ({ x: t.x, z: t.z, r: t.r })),
    ...lamps.map(l => ({ x: l.x, z: l.z, r: 0.25 })),
    { x: fountain.x, z: fountain.z, r: fountain.r },
  ];
  return { boxes, circles };
}

// (x,z) 위치의 반지름 r 원을 충돌에서 밀어낸 새 위치를 돌려준다.
export function resolveCircle(x, z, r, col) {
  for (let iter = 0; iter < 3; iter++) {
    for (const b of col.boxes) {
      const nx = Math.min(Math.max(x, b.minX), b.maxX);
      const nz = Math.min(Math.max(z, b.minZ), b.maxZ);
      let dx = x - nx, dz = z - nz;
      const dist2 = dx * dx + dz * dz;
      if (dist2 >= r * r) continue;
      if (dist2 > 1e-9) {
        const dist = Math.sqrt(dist2);
        x += (dx / dist) * (r - dist);
        z += (dz / dist) * (r - dist);
      } else {
        // 중심이 박스 안: 가장 얕은 축으로 탈출
        const pushL = x - b.minX, pushR = b.maxX - x, pushU = z - b.minZ, pushD = b.maxZ - z;
        const m = Math.min(pushL, pushR, pushU, pushD);
        if (m === pushL) x = b.minX - r;
        else if (m === pushR) x = b.maxX + r;
        else if (m === pushU) z = b.minZ - r;
        else z = b.maxZ + r;
      }
    }
    for (const c of col.circles) {
      const dx = x - c.x, dz = z - c.z;
      const min = r + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || d2 < 1e-9) continue;
      const d = Math.sqrt(d2);
      x += (dx / d) * (min - d);
      z += (dz / d) * (min - d);
    }
  }
  const lim = MAP_HALF - r - 0.2;
  return { x: Math.min(Math.max(x, -lim), lim), z: Math.min(Math.max(z, -lim), lim) };
}
