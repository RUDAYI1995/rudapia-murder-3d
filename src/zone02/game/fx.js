// 게임 연출 요소: 이름표/말풍선, 발자국(붉은 마피아 발자국), 혈흔, 바닥 도구, 사냥꾼(가면+망토+도구) 변신, 쓰러지는 모션
import * as THREE from 'three';

// ───────── 이름표 / 말풍선 (스프라이트) ─────────
export function makeLabel({ w = 256, h = 64, scale = [1.3, 0.325] } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(scale[0], scale[1], 1);
  sp.renderOrder = 20;
  sp.userData.draw = (text, { color = '#fff', bg = 'rgba(10,12,20,0.72)', border = 'rgba(255,255,255,0.35)', font = '700 30px "Malgun Gothic", sans-serif' } = {}) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = bg; g.strokeStyle = border; g.lineWidth = 3;
    const r = 14; g.beginPath(); g.roundRect(3, 3, w - 6, h - 6, r); g.fill(); g.stroke();
    g.fillStyle = color; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2, w - 24);
    tex.needsUpdate = true;
  };
  return sp;
}

// ───────── 발자국 / 혈흔 ─────────
export class Prints {
  // 발자국은 모두 기록하지만(서버 진실 기록), 화면에는 colorFn(meta) 이 색을 돌려주는 것만 보인다(null 이면 숨김).
  // → 사립탐정에게만 마피아 발자국(파랑)과 마피아에게 죽은 사람의 발자국(빨강)이 보이게 할 수 있다.
  constructor(scene, max = 4000) {
    this.max = max; this.n = 0; this.i = 0; this.meta = new Array(max); this.colorFn = () => null;
    const c = document.createElement('canvas'); c.width = 32; c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(16, 40, 10, 20, 0, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(16, 10, 8, 8, 0, 0, 6.283); g.fill();
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(0.14, 0.3);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.userData.noAO = true;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.d = new THREE.Object3D(); this.d.rotation.order = 'YXZ'; this.col = new THREE.Color();
  }
  _set(idx) {
    const m = this.meta[idx], d = this.d, c = this.colorFn(m);
    if (c == null) d.scale.set(0, 0, 0); else d.scale.set(1, 1, 1);
    d.position.set(m.x, 0.03, m.z); d.rotation.set(-Math.PI / 2, m.h, 0); d.updateMatrix();
    this.mesh.setMatrixAt(idx, d.matrix); this.mesh.setColorAt(idx, this.col.set(c ?? 0x000000));
  }
  add(x, z, heading, owner, night = 0) {
    const idx = this.i; this.meta[idx] = { x, z, h: heading, owner, night };
    this._set(idx);
    this.i = (this.i + 1) % this.max; this.n = Math.min(this.max, this.n + 1); this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  refresh() { for (let i = 0; i < this.n; i++) this._set(i); this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
  // 쓸모 있는 발자국만 남기고 정리(시간 순서 유지)
  prune(keep) {
    const order = []; const start = this.n === this.max ? this.i : 0;
    for (let k = 0; k < this.n; k++) { const m = this.meta[(start + k) % this.max]; if (m && keep(m)) order.push(m); }
    this.meta = new Array(this.max); order.forEach((m, k) => { this.meta[k] = m; }); this.n = order.length; this.i = this.n % this.max; this.mesh.count = this.n; this.refresh();
  }
  clear() { this.n = 0; this.i = 0; this.mesh.count = 0; }
}
// 혈흔: 낮에는 어두운 핏자국, 밤에는 "특수한 붉은색"으로 어둠 속에서도 또렷하게 빛난다(루미놀 반응처럼).
// 조명/톤매핑 영향을 받지 않는 재질(toneMapped:false)이라 밤의 어둠에 묻히지 않는다. setBloodNight 로 매 프레임 낮밤에 맞춰 바꾼다.
export function bloodDecal(scene, x, z, size = 1.5) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(64, 64, 34, 0, 6.283); g.fill();
  for (let i = 0; i < 16; i++) { const a = Math.random() * 6.283, r = 30 + Math.random() * 28; g.beginPath(); g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 2 + Math.random() * 9, 0, 6.283); g.fill(); }
  for (let i = 0; i < 5; i++) { const a = Math.random() * 6.283; g.save(); g.translate(64, 64); g.rotate(a); g.fillRect(20, -3, 40 + Math.random() * 14, 6); g.restore(); } // 튄 줄기
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, color: 0x4a0508, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6.283; m.position.set(x, 0.035, z); m.renderOrder = 4; m.userData.noAO = true;
  // 밤에 번져 보이는 붉은 빛(가산 혼합)
  const gc = document.createElement('canvas'); gc.width = gc.height = 128; const gg = gc.getContext('2d');
  const gr = gg.createRadialGradient(64, 64, 6, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(size * 2.2, size * 2.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, toneMapped: false, color: 0xff1010, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
  glow.position.z = 0; glow.renderOrder = 5; glow.userData.noAO = true; m.add(glow); m.userData.glow = glow;
  scene.add(m);
  return m;
}
const _dayBlood = new THREE.Color(0x4a0508), _nightBlood = new THREE.Color(0xff1414);
export function setBloodNight(m, night, t) {
  const pulse = 0.88 + 0.12 * Math.sin(t * 2.6 + m.position.x);
  m.material.color.copy(_dayBlood).lerp(_nightBlood, night);
  m.material.opacity = 0.85 + 0.15 * night;
  const gl = m.userData.glow; gl.material.opacity = night * 0.6 * pulse; gl.visible = night > 0.02;
}

// ───────── 도구 (식칼 / 망치 / 밧줄) ─────────
export const TOOLS = {
  knife: { name: '식칼', zone: 'kitchen', color: 0xcfd6dd },
  hammer: { name: '망치', zone: 'utility', color: 0x8a8f96 },
  rope: { name: '밧줄', zone: 'library_b', color: 0xb89a5a },
};

export function buildToolMesh(kind, scale = 1) {
  const g = new THREE.Group();
  const std = (c, r = 0.5, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; g.add(m); return m; };
  if (kind === 'knife') {
    add(new THREE.BoxGeometry(0.035, 0.26, 0.012), std(0xd5dbe2, 0.25, 0.9), 0, 0.2, 0);
    add(new THREE.BoxGeometry(0.04, 0.1, 0.03), std(0x2a1a12, 0.8), 0, 0.02, 0);
  } else if (kind === 'hammer') {
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), std(0x6a4a2a, 0.8), 0, 0.12, 0);
    add(new THREE.BoxGeometry(0.16, 0.07, 0.07), std(0x8a8f96, 0.35, 0.85), 0, 0.3, 0);
  } else {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 20), std(0xb89a5a, 0.95)); t.rotation.x = Math.PI / 2; t.position.y = 0.05; t.castShadow = true; g.add(t);
    const t2 = t.clone(); t2.scale.set(0.8, 0.8, 1); t2.position.y = 0.09; g.add(t2);
  }
  g.scale.setScalar(scale);
  return g;
}

// 바닥에 놓인 도구 + 빛나는 표식. update(t) 로 위아래 흔들림.
export function buildToolPickup(kind) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.4, 32), new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.userData.noAO = true; g.add(ring);
  const body = buildToolMesh(kind, 1.6); body.position.y = 0.5; g.add(body);
  // (점광원은 추가하지 않는다: 광원 개수가 바뀌면 모든 재질이 다시 컴파일돼 끊긴다 → 빛나는 고리 + 기둥 모양 빔으로 표시)
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 1.3; beam.userData.noAO = true; g.add(beam);
  g.userData.update = t => { body.position.y = 0.5 + Math.sin(t * 2.2) * 0.07; body.rotation.y = t * 1.3; ring.material.opacity = 0.55 + Math.sin(t * 4) * 0.25; };
  return g;
}

// ───────── 사냥꾼(범인) 변신: 가면 + 검은 망토 + 도구 ─────────
export function applyHunterLook(model, kind) {
  removeHunterLook(model);
  const u = model.userData, g = new THREE.Group(); g.name = 'hunterLook';
  const std = (c, r = 0.8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.46, 1.25, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.95, side: THREE.DoubleSide }));
  cloak.position.set(0, 0.0, -0.04); cloak.castShadow = true; g.add(cloak);
  u.body.add(g); g.position.y = 0.1;
  const maskG = new THREE.Group(); maskG.name = 'hunterMask';
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), std(0xe9e4da, 0.45)); mask.scale.set(1, 1.08, 0.6); mask.position.set(0, 0, 0.06); mask.rotation.x = -0.1; maskG.add(mask);
  for (const sx of [-0.04, 0.04]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.016, 0.01), std(0x050505)); e.position.set(sx, 0.02, 0.118); maskG.add(e); }
  const smile = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.01), std(0x7a0d12)); smile.position.set(0, -0.045, 0.11); maskG.add(smile);
  u.head.add(maskG);
  let tool = null;
  if (kind) { tool = buildToolMesh(kind, 1.1); tool.name = 'hunterTool'; tool.position.set(0, -0.66, 0.02); tool.rotation.x = Math.PI / 2; u.armR.add(tool); }
  model.scale.setScalar(1.08);
  model.userData.hunterLook = { g, maskG, tool };
}
export function removeHunterLook(model) {
  const h = model.userData.hunterLook; if (!h) return;
  h.g.parent?.remove(h.g); h.maskG.parent?.remove(h.maskG); h.tool?.parent?.remove(h.tool);
  model.scale.setScalar(1); model.userData.hunterLook = null;
}

// ───────── 쓰러짐 ─────────
export function startFall(model, dur = 0.7) { model.rotation.order = 'YXZ'; model.userData.fall = { t: 0, dur }; }
export function updateFall(model, dt) {
  const f = model.userData.fall; if (!f) return false;
  f.t = Math.min(f.dur, f.t + dt); const k = f.t / f.dur, e = k * k * (3 - 2 * k);
  model.rotation.x = -1.5 * e; model.position.y = 0.13 * e;
  return f.t >= f.dur;
}
export function resetFall(model) { model.userData.fall = null; model.rotation.set(0, model.rotation.y, 0); model.position.y = 0; }

// ───────── 유령(영매에게만 보임): 반투명하게 떠 있는 인물 ─────────
import { buildModel } from '../character.js';
export function makeGhost(color = 0xaecbff) {
  const m = buildModel({ colors: { skin: 0xdfe8ff, jacket: 0xcfe0ff, apron: 0xbcd2ff, pants: 0xb8ccf5, shoe: 0xaec4f0, hair: 0xa8bdf0 } });
  m.traverse(o => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38, depthWrite: false, toneMapped: false }); o.castShadow = false; o.receiveShadow = false; o.userData.noAO = true; } });
  m.renderOrder = 15;
  return m;
}