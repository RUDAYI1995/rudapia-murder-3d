// 임시 인물 모델(절차적 이족보행) + 3인칭 스프링암 카메라. 하림 3D 모델이 오면 buildModel 만 교체한다.
import * as THREE from 'three';
import { resolveCircle, rayBoxesT } from './collide.js';
import { zoneIdAt, STYLE } from './zones.js';

const RADIUS = 0.3;
const WALK = 3.9;
const RUN = 6.2;

export function buildModel(opts = {}) {
  const root = new THREE.Group();
  const std = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const cc = { skin: 0xc49a7c, jacket: 0x8f8b80, apron: 0x1b1a1c, pants: 0x232124, shoe: 0x120f0e, hair: 0x5a3a26, ...opts.colors }; // 주인공 등 다른 외형은 색을 바꿔서 같은 뼈대를 쓴다
  const skin = std(cc.skin, 0.6), jacket = std(cc.jacket, 0.9), apron = std(cc.apron, 0.7), pants = std(cc.pants, 0.85), shoe = std(cc.shoe, 0.5), hair = std(cc.hair, 0.8);
  const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

  const body = new THREE.Group(); body.position.y = 0.92; root.add(body);
  const torso = add(body, new THREE.CapsuleGeometry(0.17, 0.38, 6, 14), jacket, 0, 0.3, 0); torso.scale.set(1.1, 1, 0.72);
  add(body, new THREE.BoxGeometry(0.3, 0.5, 0.025), apron, 0, 0.22, 0.125);
  add(body, new THREE.BoxGeometry(0.34, 0.06, 0.2), apron, 0, -0.05, 0); // 허리 끈
  const head = new THREE.Group(); head.position.set(0, 0.76, 0); body.add(head);
  add(head, new THREE.SphereGeometry(0.115, 20, 16), skin, 0, 0, 0);
  const hr = add(head, new THREE.SphereGeometry(0.125, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.012, -0.012);
  hr.scale.set(1, 1, 1.05);
  add(head, new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), skin, 0, -0.14, 0);

  const mkLimb = (x, y, radius, len, mat, tipMat) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    add(pivot, new THREE.CapsuleGeometry(radius, len, 5, 10), mat, 0, -len / 2 - radius, 0);
    if (tipMat) add(pivot, new THREE.BoxGeometry(radius * 2.2, 0.07, radius * 3.6), tipMat, 0, -len - radius * 2 + 0.01, radius * 0.9);
    return pivot;
  };
  // 다리: 허벅지(엉덩이 관절) + 정강이(무릎 관절). 걸을 때 무릎이 접히고, 앉을 때 90° 가까이 굽는다. 서 있을 때 전체 길이는 예전(0.86m)과 같다.
  const mkLeg = x => {
    const thigh = new THREE.Group(); thigh.position.set(x, 0, 0);
    add(thigh, new THREE.CapsuleGeometry(0.075, 0.28, 5, 10), pants, 0, -0.215, 0);
    const shin = new THREE.Group(); shin.position.set(0, -0.43, 0); thigh.add(shin);
    add(shin, new THREE.CapsuleGeometry(0.07, 0.28, 5, 10), pants, 0, -0.215, 0);
    add(shin, new THREE.BoxGeometry(0.165, 0.07, 0.27), shoe, 0, -0.43, 0.07);
    return { thigh, shin };
  };
  const lgL = mkLeg(-0.09), lgR = mkLeg(0.09);
  const legL = lgL.thigh, legR = lgR.thigh;
  body.add(legL, legR);
  const armL = mkLimb(-0.23, 0.55, 0.055, 0.5, jacket, null), armR = mkLimb(0.23, 0.55, 0.055, 0.5, jacket, null);
  armL.children[0].material = jacket; armR.children[0].material = jacket;
  add(armL, new THREE.SphereGeometry(0.055, 10, 10), skin, 0, -0.66, 0); add(armR, new THREE.SphereGeometry(0.055, 10, 10), skin, 0, -0.66, 0);
  body.add(armL, armR);
  root.userData = { body, legL, legR, shinL: lgL.shin, shinR: lgR.shin, armL, armR, head };
  return root;
}

// 모델 자세 적용: phase(걸음 위상), k(걷기 세기 0~1), sit(앉음 정도 0~1). 걷기와 앉기를 섞는다.
// 앉은 자세: 엉덩이 높이 0.66m(의자 방석 위), 허벅지는 앞으로 거의 수평, 정강이는 아래로, 두 손은 무릎 위.
// ───── 걸음걸이 ─────
// 속도에 맞는 보폭(한 걸음 길이 m): 천천히 걸으면 짧게, 빠르면 길게. 사람의 보폭은 속도에 따라 이 정도로 늘어난다.
export const gaitStep = speed => Math.min(1.45, 0.55 + speed * 0.21);
// 걸음 위상은 "간 거리"에 비례해서 진행한다(보폭 하나 = 위상 π). 그래서 발이 땅에서 미끄러지지 않는다.
export const advancePhase = (phase, speed, dt) => (speed < 0.05 ? phase : phase + (speed * dt * Math.PI) / gaitStep(speed));
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 모델 자세 적용: phase(걸음 위상), k(미사용, 호환용), sit(앉음 정도 0~1), speed(실제 이동 속도 m/s). 걷기와 앉기를 섞는다.
// 걷기: 속도에 맞는 보폭만큼 다리를 벌리고(허벅지 각도 = asin(반보폭/다리길이)), 뒤로 가는 발은 곧게 밀고 앞으로 나오는 발은 무릎을 접어 가볍게 든다.
//       팔은 다리 반대로 작게 흔들고, 몸은 앞으로 살짝 기울고 골반 반대로 비틀린다. 몸 높이는 두 발이 벌어질 때 가장 낮다.
// 앉은 자세: 엉덩이 높이 0.66m(의자 방석 위), 허벅지는 앞으로 거의 수평, 정강이는 아래로, 두 손은 무릎 위.
export function poseModel(model, phase, k, sit, speed = k * 2.5) {
  const u = model.userData;
  const sw = Math.sin(phase), cw = Math.cos(phase);
  const mixv = (a, b) => a + (b - a) * sit;
  const move = ss(0.05, 0.9, speed);                       // 서 있다가 걷기 시작할 때 서서히 걷는 자세로
  const fast = ss(2.8, 5.6, speed);                         // 0 = 걷기, 1 = 달리기
  const half = gaitStep(speed) / 2;
  const amp = Math.min(0.85, Math.asin(Math.min(0.92, half / 0.86))) * move; // 허벅지 최대 각도
  const lean = (0.03 + 0.09 * fast) * move;                  // 앞으로 기울기
  const flex = (0.55 + 0.55 * fast) * move;                  // 앞으로 나오는 다리의 무릎 접힘
  const walkLegL = sw * amp - lean, walkLegR = -sw * amp - lean;
  const walkShinL = Math.max(0, -cw) * flex + 0.06 * move, walkShinR = Math.max(0, cw) * flex + 0.06 * move;
  const arm = amp * (0.55 + 0.25 * fast);
  u.legL.rotation.x = mixv(walkLegL, -1.2); u.legR.rotation.x = mixv(walkLegR, -1.2);
  u.shinL.rotation.x = mixv(walkShinL, 1.2); u.shinR.rotation.x = mixv(walkShinR, 1.2);
  u.armL.rotation.x = mixv(-sw * arm - lean * 0.5, -0.5); u.armR.rotation.x = mixv(sw * arm - lean * 0.5, -0.5);
  const bob = (0.022 + 0.03 * fast) * move;
  u.body.position.y = mixv(0.92 + Math.abs(cw) * bob + Math.sin(performance.now() * 0.002) * 0.003, 0.66);
  u.body.position.x = mixv(Math.sin(phase) * 0.012 * move, 0);   // 체중 이동
  u.body.rotation.x = mixv(lean, 0);
  u.body.rotation.y = mixv(-sw * 0.07 * move, 0);                // 걸을 때 어깨/골반이 서로 반대로 비틀림
  u.body.rotation.z = mixv(Math.sin(phase) * 0.02 * move, 0);
  if (u.pack) u.pack.visible = sit < 0.4;
}

export class Hero {
  constructor(col, spawn, bounds, model = null) {
    this.col = col; this.bounds = bounds;
    this.x = spawn.x; this.z = spawn.z;
    this.heading = Math.PI; // 북쪽(-z)을 향함: 모델 정면이 +z 이므로 π
    this.speed = 0;
    this.phase = 0;
    this.sit = 0;      // 앉음 정도 0(서 있음)~1(앉음)
    this.auto = false; // true 면 밖(회의 연출)이 위치를 조종한다
    this.model = model ?? buildModel();
    this.yaw = 0; this.pitch = 0.2; this.dist = 3.6;
    // 자동 추적 카메라: 이동하면 카메라가 캐릭터 뒤쪽으로 따라 돌아간다 (마우스를 움직이는 동안에는 수동 우선)
    this.follow = true;
    this.camIdle = 9; // 마지막 수동 시점 조작 후 경과 시간(s). 입력 쪽에서 0 으로 리셋
    this.flash = new THREE.SpotLight(0xfff0d0, 0, 28, 0.42, 0.7, 1.4);
    this.flash.castShadow = true;
    this.flash.shadow.mapSize.set(1024, 1024);
    this.flash.shadow.bias = -0.0006;
    this.flashTarget = new THREE.Object3D();
    this.flash.target = this.flashTarget;
    this.flashOn = false;
    this.zone = 'outside';
    this.camPos = new THREE.Vector3();
    this.camInit = false;
    // 카메라가 피해야 할 가는 기둥류(가로등/토피어리/화분/분수): 벽 박스만 피하면 이런 물체가 렌즈에 붙어 화면을 검게 가린다
    const H = { lamp: 3.9, topiary: 2.8, plant: 2.2, fountain: 3.2, planter: 1.5 };
    this.camCircles = col.circles.filter(c => H[c.tag]).map(c => ({ x: c.x, z: c.z, r: c.r, h: H[c.tag] }));
  }

  addTo(scene) { scene.add(this.model, this.flash, this.flashTarget); }

  update(dt, input, run) {
    const len = this.move(dt, input, run);
    this.followCam(dt, len, input);
    this.zone = zoneIdAt(this.x, this.z);
    this.poseUpdate(dt);
  }

  // 자동 조종(회의 연출 등): 위치/방향/속도(this.x, z, heading, speed)는 밖에서 정하고, 여기서는 카메라 추적과 자세만 갱신한다
  autoStep(dt) {
    this.followCam(dt, this.speed > 0.1 ? 1 : 0, { f: 1, r: 0 });
    this.zone = zoneIdAt(this.x, this.z);
    this.poseUpdate(dt);
  }

  move(dt, input, run) {
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = -sin * input.f + cos * input.r;
    let mz = -cos * input.f - sin * input.r;
    const len = Math.hypot(mx, mz);
    if (len > 0.001) {
      mx /= len; mz /= len;
      // 몸이 가려는 방향과 많이 다르면(예: 갑자기 뒤로) 제자리에서 휙 돌지 않고, 돌면서 천천히 걷기 시작한다
      const target = Math.atan2(mx, mz);
      let diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
      const turnSlow = 1 - 0.7 * ss(0.5, 2.4, Math.abs(diff));
      const sp = (run ? (this.runSpeed ?? RUN) : (this.walkSpeed ?? WALK)) * turnSlow; // 게임(밤 사냥)에서 속도를 바꿀 수 있게
      // 가속/감속: 한 번에 최고속도로 튀지 않고 부드럽게 (걷기 시작 0.12초, 멈출 때 0.15초)
      const want = sp, acc = want > this.speed ? 34 : 28;
      const spd = this.speed + Math.sign(want - this.speed) * Math.min(Math.abs(want - this.speed), acc * dt);
      const next = resolveCircle(this.x + mx * spd * dt, this.z + mz * spd * dt, RADIUS, this.col, this.bounds);
      this.speed = Math.min(spd, Math.hypot(next.x - this.x, next.z - this.z) / dt);
      this.x = next.x; this.z = next.z;
      const maxTurn = 10.5 * dt;                                     // 초당 약 600°
      this.heading += Math.max(-maxTurn, Math.min(maxTurn, diff * Math.min(1, dt * 14)));
    } else this.speed = Math.max(0, this.speed - dt * 28);
    return len;
  }

  followCam(dt, len, input) {
    // 카메라가 바라보는 방향(=캐릭터 진행 방향) 뒤로 빠르게 따라온다.
    // 앞으로 갈수록 빠르게, 옆걸음은 느리게, 순수 후진은 돌지 않는다(뒤돌아 보이는 것 방지).
    this.camIdle += dt;
    if (this.follow && len > 0.001 && this.camIdle > 0.45 && !(input.f < -0.2 && Math.abs(input.r) < 0.4)) {
      const target = this.heading + Math.PI;
      const diff = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
      const fwd = Math.min(1, Math.max(0, input.f));
      const rate = 1.1 + 5.9 * fwd; // 앞으로 갈 때는 빠르게(≈7/s), 옆걸음만 할 때는 완만하게
      this.yaw += diff * Math.min(1, dt * rate);
    }
  }

  poseUpdate(dt) {
    // 동작용 속도는 부드럽게 따라가게 한다(순간적으로 0↔최고속도로 튀지 않게)
    this.animSpeed = (this.animSpeed ?? 0) + (this.speed - (this.animSpeed ?? 0)) * Math.min(1, dt * 9);
    this.phase = advancePhase(this.phase, this.animSpeed, dt);
    poseModel(this.model, this.phase, 1, this.sit, this.animSpeed);
    this.model.position.set(this.x, 0, this.z);
    this.model.rotation.y = this.heading;

    this.flash.intensity = this.flashOn ? (this.flashPower ?? 140) : 0;
    this.flash.position.set(this.x + Math.sin(this.heading) * 0.2, 1.45, this.z + Math.cos(this.heading) * 0.2);
    this.flashTarget.position.set(this.x + Math.sin(this.heading) * 8, 0.6, this.z + Math.cos(this.heading) * 8);
  }

  // 어깨 너머 시점 + 벽/천장 충돌 스프링암
  updateCamera(camera, dt) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw); // 카메라 오른쪽
    const shoulder = 0.45;
    const tx = this.x + rx * shoulder * 0.6, ty = 1.55, tz = this.z + rz * shoulder * 0.6;
    const dx = Math.sin(this.yaw) * cp, dy = sp, dz = Math.cos(this.yaw) * cp;
    let ex = tx + dx * this.dist + rx * shoulder * 0.4, ey = ty + dy * this.dist, ez = tz + dz * this.dist + rz * shoulder * 0.4;
    // 천장
    const st = STYLE[zoneIdAt(this.x, this.z)];
    if (st) {
      const lim = st.ceilH - 0.22;
      if (ey > lim) { const t = (lim - ty) / (ey - ty); if (t > 0.05) { ex = tx + (ex - tx) * t; ey = lim; ez = tz + (ez - tz) * t; } else ey = lim; }
    }
    // 벽
    const t = rayBoxesT(tx, ty, tz, ex, ey, ez, this.col.boxes, 0.22);
    let f = Math.max(0.12, t - 0.04);
    const clearAt = fr => { const x = tx + (ex - tx) * fr, y = ty + (ey - ty) * fr, z = tz + (ez - tz) * fr; for (const c of this.camCircles) if (y < c.h && Math.hypot(x - c.x, z - c.z) < c.r + 0.45) return false; return true; };
    while (f > 0.2 && !clearAt(f)) f -= 0.04;
    const px = tx + (ex - tx) * f, py = Math.max(0.35, ty + (ey - ty) * f), pz = tz + (ez - tz) * f;
    if (!this.camInit) { this.camPos.set(px, py, pz); this.camInit = true; }
    const k = Math.min(1, dt * (f < 1 ? 22 : 12));
    this.camPos.x += (px - this.camPos.x) * k; this.camPos.y += (py - this.camPos.y) * k; this.camPos.z += (pz - this.camPos.z) * k;
    camera.position.copy(this.camPos);
    camera.lookAt(tx - dx * 0.0, ty - 0.15 - dy * 0.0, tz);
    this.updateView(camera);
  }

  // 판으로 만든 모델(heroModel.js)은 정면/후면 ↔ 측면 판 가장자리가 얇은 선으로 비치므로, 보는 각도에 따라 판을 켜고 끈다
  updateView(camera) {
    const u = this.model.userData; if (!u.planesS) return;
    const vx = camera.position.x - this.x, vz = camera.position.z - this.z, l = Math.hypot(vx, vz) || 1;
    const a = Math.abs((vx * Math.sin(this.heading) + vz * Math.cos(this.heading)) / l); // 1 = 정면/후면에서 봄, 0 = 옆에서 봄
    const showS = a < 0.96, showFB = a > 0.3; // 어깨 너머 카메라는 정확히 정면/옆이 아니라서 여유를 둔다
    for (const m of u.planesS) m.visible = showS;
    for (const m of u.planesFB) m.visible = showFB;
  }
}
