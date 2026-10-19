// ═══════════════════════════════════════════════════════════════════════════
//  걷기 모듈 (three.js 용, 의존성 = three 하나뿐)
//  - WASD 이동 / Shift 달리기 / 마우스 시점 / Q·E 회전 / 휠 줌
//  - 벽·가구와 부딪히면 미끄러짐(원 vs 박스·원 충돌)
//  - 3인칭 어깨 너머 카메라: 벽·천장에 닿으면 앞으로 당겨짐(스프링암), 걸으면 카메라가 캐릭터 뒤로 자동으로 따라 돎
//  - 걷는 다리/팔 흔들기 애니메이션 (임시 인물 모델 포함, 다른 모델로 교체 가능)
//  좌표계: X 동쪽, Z 남쪽, Y 위. 캐릭터 정면은 모델의 +Z.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';

// ───────── 1. 충돌 ─────────
// 박스: {minX,maxX,minZ,maxZ,y0,y1,tag}   원: {x,z,r,tag}
export function makeColliders() {
  const boxes = [], circles = [];
  return {
    boxes, circles,
    addBox(minX, minZ, maxX, maxZ, y0 = 0, y1 = 3, tag = '') { boxes.push({ minX, maxX, minZ, maxZ, y0, y1, tag }); },
    addCenterBox(cx, cz, w, d, y0 = 0, y1 = 3, tag = '') { boxes.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, y0, y1, tag }); },
    addCircle(x, z, r, tag = '') { circles.push({ x, z, r, tag }); },
  };
}

// 원(플레이어)이 박스/원과 겹치면 밀어낸다. 한 번에 3회 반복해서 모서리에 끼어도 빠져나오게 한다.
// bounds: {minX,maxX,minZ,maxZ} 월드 바깥으로 못 나가게(선택)
export function resolveCircle(x, z, r, col, bounds) {
  for (let iter = 0; iter < 3; iter++) {
    for (const b of col.boxes) {
      if (b.y1 < 0.05 || b.noPlayer) continue;          // 바닥에 깔린 것/통과 가능 표시는 무시
      const nx = Math.min(Math.max(x, b.minX), b.maxX);
      const nz = Math.min(Math.max(z, b.minZ), b.maxZ);
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x += (dx / d) * (r - d);
        z += (dz / d) * (r - d);
      } else {                                             // 박스 안쪽에 완전히 들어간 경우: 가장 가까운 면으로 뺀다
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

// 카메라 선분(from→to)과 박스(높이 포함) 교차 시 가장 가까운 비율 t(0~1). 없으면 1.
// blockTags: 카메라가 피할 박스 태그(큰 구조물만; 가구는 통과해도 됨)
export function rayBoxesT(fx, fy, fz, tx, ty, tz, boxes, pad = 0.25, blockTags = null) {
  const dx = tx - fx, dy = ty - fy, dz = tz - fz;
  let best = 1;
  for (const b of boxes) {
    if (blockTags && !blockTags.has(b.tag)) continue;
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

// ───────── 2. 임시 인물 모델 (걷기 애니메이션 확인용). 다른 모델로 바꿀 때는 root.userData 에 같은 이름의 관절을 넣어 주면 된다 ─────────
export function buildDemoModel() {
  const root = new THREE.Group();
  const std = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const skin = std(0xc49a7c, 0.6), jacket = std(0x8f8b80, 0.9), pants = std(0x232124, 0.85), shoe = std(0x120f0e, 0.5), hair = std(0x5a3a26, 0.8);
  const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const body = new THREE.Group(); body.position.y = 0.92; root.add(body);
  const torso = add(body, new THREE.CapsuleGeometry(0.17, 0.38, 6, 14), jacket, 0, 0.3, 0); torso.scale.set(1.1, 1, 0.72);
  const head = new THREE.Group(); head.position.set(0, 0.76, 0); body.add(head);
  add(head, new THREE.SphereGeometry(0.115, 20, 16), skin, 0, 0, 0);
  add(head, new THREE.SphereGeometry(0.125, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.012, -0.012);
  const mkLimb = (x, y, radius, len, mat, tipMat) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);            // 관절 위치에서 회전
    add(pivot, new THREE.CapsuleGeometry(radius, len, 5, 10), mat, 0, -len / 2 - radius, 0);
    if (tipMat) add(pivot, new THREE.BoxGeometry(radius * 2.2, 0.07, radius * 3.6), tipMat, 0, -len - radius * 2 + 0.01, radius * 0.9);
    return pivot;
  };
  const legL = mkLimb(-0.09, 0, 0.075, 0.72, pants, shoe), legR = mkLimb(0.09, 0, 0.075, 0.72, pants, shoe);
  const armL = mkLimb(-0.23, 0.55, 0.055, 0.5, jacket, null), armR = mkLimb(0.23, 0.55, 0.055, 0.5, jacket, null);
  body.add(legL, legR, armL, armR);
  root.userData = { body, legL, legR, armL, armR, head };   // ← 걷기 애니메이션이 쓰는 관절들
  return root;
}

// ───────── 3. 걷는 캐릭터 + 카메라 ─────────
export class WalkCharacter {
  /**
   * @param {object} o
   * @param {object} o.col            makeColliders() 결과
   * @param {{x:number,z:number}} o.spawn
   * @param {object} [o.bounds]       {minX,maxX,minZ,maxZ}
   * @param {THREE.Object3D} [o.model] 없으면 임시 모델
   * @param {(x:number,z:number)=>number|null} [o.ceilingAt] 그 위치 천장 높이(m). 실내 카메라가 천장을 뚫지 않게. 야외는 null
   * @param {string[]} [o.cameraBlockTags] 카메라가 피할 박스 태그 (기본: wall, pillar)
   * @param {{tag:string,h:number}[]} [o.cameraAvoidCircles] 가는 기둥류(가로등 등)를 피할 원 목록 {x,z,r,h}
   */
  constructor(o) {
    this.col = o.col; this.bounds = o.bounds ?? null;
    this.ceilingAt = o.ceilingAt ?? null;
    this.blockTags = new Set(o.cameraBlockTags ?? ['wall', 'pillar']);
    this.camCircles = o.cameraAvoidCircles ?? [];
    this.x = o.spawn.x; this.z = o.spawn.z;
    this.heading = Math.PI;       // 캐릭터가 바라보는 방향(라디안). 0 = +Z(남), π = -Z(북)
    this.speed = 0; this.phase = 0;
    this.model = o.model ?? buildDemoModel();
    this.yaw = 0; this.pitch = 0.2; this.dist = 3.6;   // 카메라: 좌우 각도, 위아래 각도, 거리
    this.follow = true;           // 걸으면 카메라가 캐릭터 뒤로 자동으로 따라 돌아감
    this.camIdle = 9;             // 마지막 수동 시점 조작 후 경과 시간(초)
    this.camPos = new THREE.Vector3(); this.camInit = false;
    // 튜닝 값
    this.RADIUS = 0.3; this.WALK = 3.9; this.RUN = 6.2;
  }

  addTo(scene) { scene.add(this.model); }

  /** input = {f: 앞(+1)/뒤(-1), r: 오른쪽(+1)/왼쪽(-1)} */
  update(dt, input, run) {
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // 입력은 "카메라 기준" 방향. 카메라가 바라보는 쪽이 앞.
    let mx = -sin * input.f + cos * input.r;
    let mz = -cos * input.f - sin * input.r;
    const len = Math.hypot(mx, mz);
    if (len > 0.001) {
      mx /= len; mz /= len;
      const sp = run ? this.RUN : this.WALK;
      const next = resolveCircle(this.x + mx * sp * dt, this.z + mz * sp * dt, this.RADIUS, this.col, this.bounds);
      this.speed = Math.min(sp, Math.hypot(next.x - this.x, next.z - this.z) / dt);   // 벽에 막히면 실제 속도가 줄어 걷는 모션도 느려짐
      this.x = next.x; this.z = next.z;
      // 캐릭터는 이동 방향으로 부드럽게 몸을 돌린다
      const target = Math.atan2(mx, mz);
      let diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
      this.heading += diff * Math.min(1, dt * 12);
    } else this.speed = Math.max(0, this.speed - dt * 20);

    // 자동 추적 카메라: 앞으로 갈수록 빠르게(≈7/s), 옆걸음은 완만하게, 순수 후진은 안 돌림(뒤돌아 보이는 것 방지)
    this.camIdle += dt;
    if (this.follow && len > 0.001 && this.camIdle > 0.45 && !(input.f < -0.2 && Math.abs(input.r) < 0.4)) {
      const target = this.heading + Math.PI;
      const diff = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
      const fwd = Math.min(1, Math.max(0, input.f));
      this.yaw += diff * Math.min(1, dt * (1.1 + 5.9 * fwd));
    }

    // 걷기 애니메이션: 다리/팔 반대로 흔들기 + 몸 상하/좌우 흔들림
    const u = this.model.userData;
    this.phase += this.speed * dt * 2.1;
    const k = Math.min(1, this.speed / 2.5);
    const sw = Math.sin(this.phase);
    if (u.legL) {
      u.legL.rotation.x = sw * 0.75 * k; u.legR.rotation.x = -sw * 0.75 * k;
      u.armL.rotation.x = -sw * 0.6 * k; u.armR.rotation.x = sw * 0.6 * k;
      u.body.position.y = 0.92 + Math.abs(Math.cos(this.phase)) * 0.035 * k + Math.sin(performance.now() * 0.002) * 0.003;
      u.body.rotation.z = Math.sin(this.phase) * 0.025 * k;
    }
    this.model.position.set(this.x, 0, this.z);
    this.model.rotation.y = this.heading;
  }

  /** 어깨 너머 3인칭 카메라 + 벽/천장 스프링암. 매 프레임 update 뒤에 호출 */
  updateCamera(camera, dt) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);      // 카메라 오른쪽 벡터
    const shoulder = 0.45;
    const tx = this.x + rx * shoulder * 0.6, ty = 1.55, tz = this.z + rz * shoulder * 0.6;   // 바라볼 점(캐릭터 어깨 높이)
    const dx = Math.sin(this.yaw) * cp, dy = sp, dz = Math.cos(this.yaw) * cp;                 // 캐릭터에서 카메라로 향하는 방향
    let ex = tx + dx * this.dist + rx * shoulder * 0.4, ey = ty + dy * this.dist, ez = tz + dz * this.dist + rz * shoulder * 0.4;

    // 천장: 카메라가 천장을 뚫으면 그만큼 당겨 온다
    const ceil = this.ceilingAt ? this.ceilingAt(this.x, this.z) : null;
    if (ceil != null) {
      const lim = ceil - 0.22;
      if (ey > lim) { const t = (lim - ty) / (ey - ty); if (t > 0.05) { ex = tx + (ex - tx) * t; ey = lim; ez = tz + (ez - tz) * t; } else ey = lim; }
    }
    // 벽: 카메라 선분이 벽 박스와 만나면 그 앞까지만
    const t = rayBoxesT(tx, ty, tz, ex, ey, ez, this.col.boxes, 0.22, this.blockTags);
    let f = Math.max(0.12, t - 0.04);
    // 가는 기둥(가로등/화분)은 렌즈에 붙으면 화면이 검게 가려지므로 한 걸음씩 당겨서 피한다
    const clearAt = fr => { const x = tx + (ex - tx) * fr, y = ty + (ey - ty) * fr, z = tz + (ez - tz) * fr; for (const c of this.camCircles) if (y < c.h && Math.hypot(x - c.x, z - c.z) < c.r + 0.45) return false; return true; };
    while (f > 0.2 && !clearAt(f)) f -= 0.04;
    const px = tx + (ex - tx) * f, py = Math.max(0.35, ty + (ey - ty) * f), pz = tz + (ez - tz) * f;
    if (!this.camInit) { this.camPos.set(px, py, pz); this.camInit = true; }
    const k = Math.min(1, dt * (f < 1 ? 22 : 12));   // 벽에 닿을 땐 빠르게 당기고, 풀릴 땐 천천히
    this.camPos.x += (px - this.camPos.x) * k; this.camPos.y += (py - this.camPos.y) * k; this.camPos.z += (pz - this.camPos.z) * k;
    camera.position.copy(this.camPos);
    camera.lookAt(tx, ty - 0.15, tz);
  }
}

// ───────── 4. 키보드/마우스 입력 연결 ─────────
// 반환: { getInput(), dispose() }.  getInput() → { f, r, run }  (매 프레임 hero.update 에 넣는다)
export function bindWalkInput(canvas, hero, { mouseSensitivity = 0.0024, onToggle = null } = {}) {
  const keys = new Set();
  let locked = false;
  const kd = e => { if (e.repeat) return; keys.add(e.code); onToggle?.(e.code); };
  const ku = e => keys.delete(e.code);
  const click = () => { if (!locked) canvas.requestPointerLock?.(); };
  const lockChange = () => { locked = document.pointerLockElement === canvas; };
  const mm = e => {
    if (!locked && e.buttons !== 1) return;          // 포인터락 상태이거나, 마우스 왼쪽을 누른 채 드래그할 때만 시점 회전
    hero.camIdle = 0;                                // 수동 조작 중에는 자동 추적을 잠시 멈춘다
    hero.yaw -= e.movementX * mouseSensitivity;
    hero.pitch = Math.min(1.1, Math.max(-0.15, hero.pitch + e.movementY * 0.002));
  };
  const wheel = e => { hero.dist = Math.min(7, Math.max(1.8, hero.dist + e.deltaY * 0.004)); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  canvas.addEventListener('click', click); document.addEventListener('pointerlockchange', lockChange);
  window.addEventListener('mousemove', mm); window.addEventListener('wheel', wheel, { passive: true });
  return {
    getInput(dt = 0) {
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const qe = (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);   // Q/E 로 카메라 회전
      if (qe) { hero.camIdle = 0; hero.yaw += qe * dt * 1.8; }
      return { f, r, run: keys.has('ShiftLeft') || keys.has('ShiftRight') };
    },
    get locked() { return locked; },
    keys,
    dispose() {
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      canvas.removeEventListener('click', click); document.removeEventListener('pointerlockchange', lockChange);
      window.removeEventListener('mousemove', mm); window.removeEventListener('wheel', wheel);
    },
  };
}
