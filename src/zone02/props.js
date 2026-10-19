// 실내 소품 조립 + layout 오브젝트 충돌 등록
import * as THREE from 'three';
import { layout } from './zones.js';
import { createKit } from './props/common.js';
import { buildHall } from './props/hall.js';
import { buildEast } from './props/east.js';
import { buildLibrary } from './props/library.js';

export function build(M, ctx, root) {
  const g = new THREE.Group();
  g.name = 'props';
  root.add(g);
  const kit = createKit(M, ctx, g);

  // layout.objects 중 홀의 충돌(원탁, 의자, 계단)은 여기서 등록
  for (const o of layout.objects) {
    if (o.zone !== 'hall' || /^chair_/.test(o.id)) continue; // 의자는 hall.js 에서 12개를 직접 등록
    if (o.radius) ctx.col.addCircle(o.center.x, o.center.z, o.radius, o.id);
    else ctx.col.addCenterBox(o.center.x, o.center.z, o.size.x, o.size.z, 0, o.size.y, o.id);
  }

  buildHall(kit);
  buildEast(kit);
  buildLibrary(kit);
}
