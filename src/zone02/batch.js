// 정적 메시 병합: 같은 재질·같은 그림자 설정·같은 공간 셀의 단일 재질 메시를 하나로 합쳐 드로우콜을 줄인다.
// (구역 단위 셀로 나눠서 프러스텀 컬링은 유지)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function batchStatic(root, exclude = new Set(), cell = 14) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const victims = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    if (exclude.has(o) || o.userData.dynamic) return;
    if (Array.isArray(o.material)) return;
    if (o.material.isShaderMaterial) return;
    const geo = o.geometry;
    if (!geo.attributes.position || !geo.attributes.normal || !geo.attributes.uv) return;
    // 부모 체인에 동적 그룹이 있으면 제외
    for (let p = o.parent; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
    const wp = new THREE.Vector3(); o.getWorldPosition(wp);
    const key = [o.material.uuid, o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, Math.floor(wp.x / cell), Math.floor(wp.z / cell), o.renderOrder].join('|');
    let b = buckets.get(key);
    if (!b) { b = { material: o.material, cast: o.castShadow, recv: o.receiveShadow, order: o.renderOrder, geos: [] }; buckets.set(key, b); }
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    // 속성 통일 (position/normal/uv 만 유지)
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    g.applyMatrix4(o.matrixWorld);
    b.geos.push(g);
    victims.push(o);
  });

  let merged = 0;
  for (const b of buckets.values()) {
    if (b.geos.length < 2) { b.geos.forEach(g => g.dispose()); b.skip = true; continue; }
    const geo = mergeGeometries(b.geos, false);
    b.geos.forEach(g => g.dispose());
    if (!geo) { b.skip = true; continue; }
    const m = new THREE.Mesh(geo, b.material);
    m.castShadow = b.cast; m.receiveShadow = b.recv; m.renderOrder = b.order;
    m.matrixAutoUpdate = false;
    b.mesh = m;
    merged += 1;
  }

  // 원본 제거 후 병합본 추가 (병합 실패/스킵된 버킷의 원본은 유지)
  const keep = new Set();
  const skipMats = new Set();
  for (const b of buckets.values()) if (b.skip) skipMats.add(b);
  let removed = 0;
  for (const o of victims) {
    const wp = new THREE.Vector3(); o.getWorldPosition(wp);
    const key = [o.material.uuid, o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, Math.floor(wp.x / cell), Math.floor(wp.z / cell), o.renderOrder].join('|');
    const b = buckets.get(key);
    if (b.skip) continue;
    o.parent.remove(o);
    o.geometry.dispose();
    removed++;
  }
  for (const b of buckets.values()) if (b.mesh) root.add(b.mesh);
  void keep; void skipMats;
  return { merged, removed };
}
