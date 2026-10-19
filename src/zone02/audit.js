// 텍셀 밀도 검사: 장면의 모든 텍스처 표면에서 "월드 1m 당 텍스처 픽셀 수"를 계산한다.
// 흐릿함의 원인은 대부분 이 값이 낮아서(저해상도 텍스처를 넓은 면에 늘림)다. window.__dbg.audit() 로 호출.
import * as THREE from 'three';

const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();

export function auditTexelDensity(scene, { minAreaM2 = 0.5 } = {}) {
  const stats = new Map();
  const add = (mat, texAreaPx, areaUV, areaWorld) => {
    if (areaWorld < 1e-9 || areaUV < 1e-12) return;
    const map = mat.map; if (!map?.image) return;
    const key = mat.name || `tex:${map.uuid.slice(0, 6)}`;
    let s = stats.get(key);
    if (!s) { s = { key, size: `${map.image.width}x${map.image.height}`, area: 0, logSum: 0, min: 1e9, max: 0 }; stats.set(key, s); }
    const density = Math.sqrt((areaUV * texAreaPx) / areaWorld);
    s.area += areaWorld; s.logSum += Math.log(density) * areaWorld; s.min = Math.min(s.min, density); s.max = Math.max(s.max, density);
  };
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.visible) return;
    const geo = o.geometry, pos = geo.attributes.position, uv = geo.attributes.uv;
    if (!pos || !uv) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const idx = geo.index;
    const triCount = idx ? idx.count / 3 : pos.count / 3;
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: triCount * 3, materialIndex: 0 }];
    for (const g of groups) {
      const mat = mats[g.materialIndex] ?? mats[0];
      if (!mat?.map?.image) continue;
      const map = mat.map, tw = map.image.width, th = map.image.height;
      const rep = Math.abs(map.repeat.x * map.repeat.y);
      for (let t = g.start / 3; t < (g.start + g.count) / 3; t++) {
        const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        A.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld); B.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld); C.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
        e1.subVectors(B, A); e2.subVectors(C, A);
        const aw = 0.5 * e1.cross(e2).length();
        const u0 = uv.getX(i0), v0 = uv.getY(i0), u1 = uv.getX(i1), v1 = uv.getY(i1), u2 = uv.getX(i2), v2 = uv.getY(i2);
        const auv = 0.5 * Math.abs((u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)) * rep;
        add(mat, tw * th, auv, aw);
      }
    }
  });
  const rows = [...stats.values()].filter(s => s.area >= minAreaM2).map(s => ({
    material: s.key, texture: s.size, areaM2: +s.area.toFixed(1),
    pxPerM: Math.round(Math.exp(s.logSum / s.area)), minPxPerM: Math.round(s.min), maxPxPerM: Math.round(s.max),
  }));
  rows.sort((a, b) => a.pxPerM - b.pxPerM);
  return rows;
}
