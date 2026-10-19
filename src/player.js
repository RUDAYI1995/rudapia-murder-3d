// 임시 플레이어(캡슐) + 3인칭 카메라. 하림 3D 모델이 오면 model 만 교체한다.
import * as THREE from 'three';
import { resolveCircle } from './map/collision.js';

const RADIUS = 0.4;
const WALK = 4.2;
const RUN = 6.4;

export class Player {
  constructor(col, spawn) {
    this.col = col;
    this.x = spawn.x;
    this.z = spawn.z;
    this.heading = 0; // 모델이 바라보는 각도 (+z 가 정면일 때 0)
    this.speed = 0;
    this.model = this.makePlaceholder();
    this.model.position.set(this.x, 0, this.z);

    // 3인칭 카메라 상태
    this.yaw = 0;
    this.pitch = 0.62;
    this.dist = 7.5;

    // 손전등
    this.flash = new THREE.SpotLight(0xfff0cf, 0, 34, 0.5, 0.65, 1.2);
    this.flashTarget = new THREE.Object3D();
    this.flash.target = this.flashTarget;
    this.flashOn = false;
  }

  makePlaceholder() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 6, 12), mat);
    body.position.y = 0.77;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), new THREE.MeshStandardMaterial({ color: 0xd9b89a, roughness: 0.6 }));
    head.position.y = 1.55;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0xff6b4a }));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.55, 0.28);
    [body, head, nose].forEach(m => { m.castShadow = true; });
    g.add(body, head, nose);
    return g;
  }

  addTo(scene) {
    scene.add(this.model, this.flash, this.flashTarget);
  }

  // input: { f, r } (전후/좌우 -1~1), run: boolean
  update(dt, input, run) {
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // 카메라 기준 앞/오른쪽
    let mx = -sin * input.f + cos * input.r;
    let mz = -cos * input.f - sin * input.r;
    const len = Math.hypot(mx, mz);
    if (len > 0.001) {
      mx /= len; mz /= len;
      const sp = run ? RUN : WALK;
      const next = resolveCircle(this.x + mx * sp * dt, this.z + mz * sp * dt, RADIUS, this.col);
      this.speed = Math.hypot(next.x - this.x, next.z - this.z) / dt;
      this.x = next.x; this.z = next.z;
      // 모델을 이동 방향으로 부드럽게 회전
      const target = Math.atan2(mx, mz);
      let diff = target - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.heading += diff * Math.min(1, dt * 12);
    } else {
      this.speed = 0;
    }
    this.model.position.set(this.x, 0, this.z);
    this.model.rotation.y = this.heading;
    // 걷는 동안 살짝 흔들림
    this.model.children[0].position.y = 0.77 + (this.speed > 0.1 ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.04 : 0);

    // 손전등
    this.flash.intensity = this.flashOn ? 90 : 0;
    this.flash.position.set(this.x, 1.5, this.z);
    this.flashTarget.position.set(this.x + Math.sin(this.heading) * 10, 0.5, this.z + Math.cos(this.heading) * 10);
  }

  updateCamera(camera, dt) {
    const cp = Math.cos(this.pitch);
    const tx = this.x, ty = 1.45, tz = this.z;
    const px = tx + Math.sin(this.yaw) * cp * this.dist;
    const py = ty + Math.sin(this.pitch) * this.dist;
    const pz = tz + Math.cos(this.yaw) * cp * this.dist;
    const k = Math.min(1, dt * 14);
    camera.position.x += (px - camera.position.x) * k;
    camera.position.y += (py - camera.position.y) * k;
    camera.position.z += (pz - camera.position.z) * k;
    camera.lookAt(tx, ty, tz);
  }
}
