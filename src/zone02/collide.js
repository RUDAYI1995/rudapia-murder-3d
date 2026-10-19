// 충돌: 플레이어 원 vs 축 정렬 박스/원, 카메라 스프링암용 3D 레이캐스트.
// 박스: {minX,maxX,minZ,maxZ,y0,y1}  원: {x,z,r}

export function makeColliders() {
  const boxes = [], circles = [];
  return {
    boxes, circles,
    addBox(minX, minZ, maxX, maxZ, y0 = 0, y1 = 3, tag = '') { boxes.push({ minX, maxX, minZ, maxZ, y0, y1, tag }); },
    addCenterBox(cx, cz, w, d, y0 = 0, y1 = 3, tag = '') { boxes.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, y0, y1, tag }); },
    addCircle(x, z, r, tag = '') { circles.push({ x, z, r, tag }); },
  };
}

export function resolveCircle(x, z, r, col, bounds) {
  for (let iter = 0; iter < 3; iter++) {
    for (const b of col.boxes) {
      if (b.y1 < 0.05 || b.noPlayer) continue;
      const nx = Math.min(Math.max(x, b.minX), b.maxX);
      const nz = Math.min(Math.max(z, b.minZ), b.maxZ);
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x += (dx / d) * (r - d);
        z += (dz / d) * (r - d);
      } else {
        const pl = x - b.minX, pr = b.maxX - x, pu = z - b.minZ, pd = b.maxZ - z;
        const m = Math.min(pl, pr, pu, pd);
        if (m === pl) x = b.minX - r; else if (m === pr) x = b.maxX + r; else if (m === pu) z = b.minZ - r; else z = b.maxZ + r;
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
  if (bounds) {
    x = Math.min(Math.max(x, bounds.minX + r), bounds.maxX - r);
    z = Math.min(Math.max(z, bounds.minZ + r), bounds.maxZ - r);
  }
  return { x, z };
}

const CAMERA_BLOCK = new Set(['wall', 'hedge', 'pillar', 'rack', 'fridge', 'lockers']);

// 3D 선분(from→to)과 박스(높이 포함) 교차 시 가장 가까운 비율 t(0~1) 반환. 없으면 1.
export function rayBoxesT(fx, fy, fz, tx, ty, tz, boxes, pad = 0.25) {
  const dx = tx - fx, dy = ty - fy, dz = tz - fz;
  let best = 1;
  for (const b of boxes) {
    // 카메라는 벽/울타리/기둥처럼 큰 구조물만 피한다 (가구는 통과해도 괜찮음)
    if (!CAMERA_BLOCK.has(b.tag)) continue;
    let t0 = 0, t1 = 1;
    const slab = (o, d, mn, mx) => {
      if (Math.abs(d) < 1e-9) return o >= mn && o <= mx;
      let a = (mn - o) / d, c = (mx - o) / d;
      if (a > c) { const s = a; a = c; c = s; }
      if (a > t0) t0 = a;
      if (c < t1) t1 = c;
      return t0 <= t1;
    };
    if (!slab(fx, dx, b.minX - pad, b.maxX + pad)) continue;
    if (!slab(fy, dy, b.y0 - pad, b.y1 + pad)) continue;
    if (!slab(fz, dz, b.minZ - pad, b.maxZ + pad)) continue;
    if (t0 < best) best = t0;
  }
  return best;
}
