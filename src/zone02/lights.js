// 조명 풀: 촛불/등불은 수십 개지만 실제 PointLight 는 플레이어에서 가까운 N개만 켠다.
// (포워드 렌더러에서 라이트 수는 성능과 셰이더 컴파일을 좌우하므로 슬롯을 고정하고 재배정한다.)
import * as THREE from 'three';
import { nearZones } from './zones.js';

export class LightPool {
  constructor(scene, count = 12) {
    this.sources = [];
    this.flames = [];
    this.slots = Array.from({ length: count }, () => {
      const l = new THREE.PointLight(0xffb36b, 0, 10, 2);
      l.castShadow = false;
      scene.add(l);
      return { light: l, src: null, level: 0 };
    });
    this.selTimer = 0;
    this.chosen = new Set();
  }

  // src: {x,y,z,color,intensity,distance,zone,flicker}
  add(src) {
    src.phase = Math.random() * 100;
    src.enabled = true;
    src.flicker ??= 0.12;
    this.sources.push(src);
    return src;
  }

  // 불꽃 메시(항상 보임, 흔들림)와 함께 광원 등록
  addFlame(parent, { x, y, z, zone, scale = 1, light = null }) {
    const m = new THREE.Mesh(this.flameGeo ??= new THREE.SphereGeometry(0.022, 8, 8), this.flameMat ??= new THREE.MeshBasicMaterial({ color: 0xffc778 }));
    m.scale.set(scale, scale * 2.4, scale);
    m.position.set(x, y, z);
    m.userData.phase = Math.random() * 100;
    m.userData.baseY = y;
    m.userData.dynamic = true; // 배칭 제외 (매 프레임 흔들림)
    parent.add(m);
    this.flames.push(m);
    // 광원은 불꽃(메시)보다 벽에서 더 띄운다(dx,dz): 벽에 바짝 붙으면 벽면이 과하게 밝은 점이 된다
    if (light) this.add({ x: x + (light.dx ?? 0), y: y + 0.05 + (light.dy ?? 0), z: z + (light.dz ?? 0), zone, ...light });
    return m;
  }

  update(dt, t, px, pz, pzone, night) {
    for (const f of this.flames) {
      const k = 1 + 0.18 * Math.sin(t * 17 + f.userData.phase) + 0.1 * Math.sin(t * 31 + f.userData.phase * 2.3);
      f.scale.y = f.scale.x * 2.4 * k;
    }
    this.selTimer -= dt;
    if (this.selTimer <= 0) {
      this.selTimer = 0.15;
      const near = nearZones(pzone);
      const cand = [];
      for (const s of this.sources) {
        if (!s.enabled) continue;
        if (!near.has(s.zone)) continue;
        const d2 = (s.x - px) ** 2 + (s.z - pz) ** 2;
        cand.push([d2, s]);
      }
      cand.sort((a, b) => a[0] - b[0]);
      this.chosen = new Set(cand.slice(0, this.slots.length).map(c => c[1]));
      for (const sl of this.slots) {
        if (sl.src && !this.chosen.has(sl.src) && sl.level < 0.02) sl.src = null;
      }
      for (const s of this.chosen) {
        if (this.slots.some(sl => sl.src === s)) continue;
        const free = this.slots.find(sl => !sl.src);
        if (!free) continue;
        free.src = s;
        free.level = 0;
        free.light.position.set(s.x, s.y, s.z);
        free.light.color.set(s.color ?? 0xffb36b);
        free.light.distance = s.distance ?? 9;
      }
    }
    const dayScale = 0.3 + 0.7 * night;
    for (const sl of this.slots) {
      if (!sl.src) { sl.light.intensity = 0; continue; }
      const target = this.chosen.has(sl.src) ? 1 : 0;
      sl.level += (target - sl.level) * Math.min(1, dt * 6);
      const s = sl.src;
      const fl = 1 + s.flicker * (Math.sin(t * 13 + s.phase) * 0.6 + Math.sin(t * 29 + s.phase * 1.7) * 0.4);
      sl.light.intensity = (s.intensity ?? 8) * sl.level * fl * (s.alwaysOn ? 1 : dayScale);
    }
  }
}
