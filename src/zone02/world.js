// 월드 조립: 재질 → 건축 → (소품/외부는 추가 모듈) → 조명/충돌 등록
import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { createArchitecture } from './architecture.js';
import { makeColliders } from './collide.js';
import { LightPool } from './lights.js';
import { layout, zoneIdAt } from './zones.js';
import { batchStatic } from './batch.js';
import { loadAssets } from './assets.js';
import { prepareHorrorMaterials, buildHorrorDetails } from './horror.js';

const countMeshes = root => { let n = 0; root.traverse(o => { if (o.isMesh) n++; }); return n; };

export async function createWorld(scene, onProgress = () => {}, { horror = false } = {}) {
  const M = await createMaterials(onProgress);
  onProgress('건물 짓는 중…');
  await new Promise(r => setTimeout(r, 0));

  const assets = horror ? null : await loadAssets(onProgress);
  if (horror) await prepareHorrorMaterials(M, onProgress);
  const col = makeColliders();
  const pool = new LightPool(scene, 22);
  const ctx = { M, col, pool, windows: [], updaters: [], zoneIdAt, assets, horror };
  const root = new THREE.Group();
  scene.add(root);

  const arch = createArchitecture(M, ctx);
  root.add(arch.group);

  const parts = { root, ctx, arch };

  // 선택 모듈 (있으면 로드)
  const extra = [];
  for (const loader of [() => import('./props.js'), () => import('./exterior.js'), () => import('./fx.js')]) {
    try {
      const mod = await loader();
      onProgress('소품/외부 구성 중…');
      await new Promise(r => setTimeout(r, 0));
      if (mod.build) extra.push(mod.build(M, ctx, root));
    } catch (e) {
      if (!String(e?.message).includes('Failed to fetch dynamically imported module')) console.warn('모듈 로드 실패', e);
    }
  }

  // 주변광(fill): 촛불이 닿지 않는 곳이 완전한 검정으로 떨어지지 않도록 방/구역마다 약하고 깜빡이지 않는 광원을 둔다.
  // (실제 GI 대신 쓰는 값싼 근사. 점광원 풀에 들어가므로 가까운 것만 켜진다)
  const FILL = [
    ['corridor', 21.5, 2.8, 5], ['corridor', 21.5, 2.8, 12], ['corridor', 21.5, 2.8, 19],
    ['dining', 27, 2.6, 4.5], ['dining', 31, 2.6, 4.5], ['dining', 35, 2.6, 4.5],
    ['kitchen', 27, 2.8, 13], ['kitchen', 34, 2.8, 13],
    ['security', 27, 2.6, 20.5], ['utility', 35, 2.6, 21], ['foyer', 10, 2.4, 27],
    ['library_a', -4.5, 2.9, 5], ['library_b', -4.5, 2.9, 13],
  ];
  const FILL_OUT = [
    ['courtyard', 5, 5, 36], ['courtyard', 15, 5, 36], ['courtyard', 21, 5, 41], ['courtyard', 5, 5, 41],
    ['east_path', 41.5, 5, 6], ['east_path', 41.5, 5, 18], ['east_path', 41.5, 5, 28], ['south_path', 33, 5, 32],
  ];
  for (const [zone, x, y, z] of FILL) pool.add({ x, y, z, zone, color: 0xffd7a6, intensity: 38, distance: 13, flicker: 0, alwaysOn: true });
  for (const [zone, x, y, z] of FILL_OUT) pool.add({ x, y, z, zone, color: 0x9db8ff, intensity: 30, distance: 18, flicker: 0, alwaysOn: true });

  if (horror) buildHorrorDetails(ctx, root);

  onProgress('최적화(정적 메시 병합) 중…');
  await new Promise(r => setTimeout(r, 0));
  const before = countMeshes(root);
  const stats = batchStatic(root, new Set([...arch.ceilings, ...arch.roofs]));
  console.info(`[batch] 메시 ${before} → ${countMeshes(root)} (병합 ${stats.merged}개 / 제거 ${stats.removed}개)`);

  return {
    ...parts,
    colliders: col,
    pool,
    bounds: { minX: -10, maxX: 45, minZ: -1, maxZ: 49 },
    spawn: layout.spawn,
    setOverview(on) { arch.ceilings.forEach(c => { c.visible = !on; }); arch.roofs.forEach(r => { r.visible = !on; }); },
    update(dt, t, hero, night) {
      pool.update(dt, t, hero.x, hero.z, hero.zone, night);
      for (const u of ctx.updaters) u(dt, t, hero, night);
    },
  };
}
