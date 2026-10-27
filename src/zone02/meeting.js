// 원탁 회의 연출: 나와 똑같이 생긴 AI 7명 + 플레이어(총 8명)가 8개 의자에 앉았다가, "시작"이면 "추리 시작" 뒤 3초 가만히 있다가 모두 일어나 처음 자리로 돌아간다.
//   명령: "앉아"  → 8명 모두 원탁 의자로 가서 앉는다
//         "시작"  → (전원 착석 후) 화면에 "추리 시작", 3초간 정지 → 자동으로 모두 일어나 처음 위치로 복귀
//         "일어서" → 언제든 바로 일어나 복귀
// 길 찾기는 원탁을 둘러싼 고리(반지름 4.4m)를 돌다가, 의자 사이 빈틈으로 들어가 옆에서 의자에 앉는 방식이다(의자·탁자를 뚫지 않는다).
import * as THREE from 'three';
import { buildModel, poseModel, advancePhase } from './character.js';
import { resolveCircle } from './collide.js';

const TC = { x: 10, z: 14 };                       // 원탁 중심 (hall.js 와 같음)
const R_SEAT = 3.23, R_GAP = 3.25, R_RING = 4.4;   // 앉는 위치 / 의자 사이 통과 반지름 / 돌아가는 고리 반지름
const NPC_SPEED = 3.0, HERO_SPEED = 3.6;
const SIT_RAMP = 0.9;                              // 의자까지 남은 거리(m) 안에서 천천히 앉는다
const READ_SECONDS = 3;                            // "추리 시작" 후 가만히 있는 시간

const ring = (a, r) => ({ x: TC.x + Math.cos(a) * r, z: TC.z + Math.sin(a) * r });
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// 의자 8개: hall.js 와 같은 배치 (각도 i/8·2π, 반지름 3.25, 탁자 중심을 바라봄)
export const SEATS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2, p = ring(a, R_SEAT);
  return { i, a, x: p.x, z: p.z, face: Math.atan2(TC.x - p.x, TC.z - p.z) };
});

// AI 7명의 처음 위치(탁자 고리 바깥). 아무도 의자나 벽, 받침대와 겹치지 않는 곳
const HOMES = [
  { x: 5.0, z: 11.0 }, { x: 15.0, z: 11.0 }, { x: 3.5, z: 16.5 }, { x: 16.5, z: 16.5 },
  { x: 6.5, z: 20.0 }, { x: 13.5, z: 20.0 }, { x: 10.0, z: 9.0 },
  { x: 3.0, z: 13.0 }, { x: 17.0, z: 13.5 }, { x: 10.0, z: 22.0 }, { x: 4.0, z: 19.0 },
];
// AI 11명의 겉모습(옷·머리·피부 색). 몸은 같은 뼈대의 기본 인물이고 색만 다르다.
export const LOOKS = [
  { jacket: 0xb04a4a, pants: 0x2a2a35, hair: 0x2a1a12, skin: 0xe0b89a }, { jacket: 0x4a6fb0, pants: 0x222222, hair: 0x6a4a2a, skin: 0xc49a7c },
  { jacket: 0x4aa06a, pants: 0x3a3226, hair: 0x1a1a1a, skin: 0xf0c8a8 }, { jacket: 0xc9a23a, pants: 0x2a2a2a, hair: 0x8a5a2a, skin: 0xd8a888 },
  { jacket: 0x8a58b0, pants: 0x1f1f2a, hair: 0x2a2a2a, skin: 0xb88a6a }, { jacket: 0xd8d4c8, pants: 0x4a3a2a, hair: 0x3a2a1a, skin: 0xe6bfa0 },
  { jacket: 0x3a8a8a, pants: 0x2e2e38, hair: 0x7a5a3a, skin: 0xcc9a78 }, { jacket: 0xb06a3a, pants: 0x262626, hair: 0x1a1210, skin: 0xe8c0a0 },
  { jacket: 0x6a6a6a, pants: 0x30302a, hair: 0x5a4030, skin: 0xd0a080 }, { jacket: 0xa04a7a, pants: 0x25252f, hair: 0x2a1c14, skin: 0xe2b898 },
  { jacket: 0x4a4a8a, pants: 0x2f2a24, hair: 0x6a3a20, skin: 0xc8967a },
];

// 시작점(sx,sz)에서 seat 로 가는 경로. 반환: 점 배열 [{x,z,collide?}]
function pathToSeat(sx, sz, seat, collideFirst) {
  const a0 = Math.atan2(sz - TC.z, sx - TC.x);
  const gA = seat.a + Math.PI / 12, gB = seat.a - Math.PI / 12;
  const g = Math.abs(angDiff(a0, gA)) <= Math.abs(angDiff(a0, gB)) ? gA : gB;   // 의자 양옆 빈틈 중 가까운 쪽
  const pts = [];
  const first = ring(a0, R_RING); first.collide = collideFirst; pts.push(first);
  const delta = angDiff(a0, g), n = Math.max(1, Math.ceil(Math.abs(delta) / 0.22));
  for (let k = 1; k <= n; k++) pts.push(ring(a0 + delta * (k / n), R_RING));
  pts.push(ring(g, R_GAP));
  pts.push({ x: seat.x, z: seat.z, seat: true });
  return pts;
}

// 의자에서 일어나 home 으로 가는 경로
function pathFromSeat(seat, home, collideLast) {
  const ah = Math.atan2(home.z - TC.z, home.x - TC.x);
  const gA = seat.a + Math.PI / 12, gB = seat.a - Math.PI / 12;
  const g = Math.abs(angDiff(ah, gA)) <= Math.abs(angDiff(ah, gB)) ? gA : gB;
  const pts = [ring(g, R_GAP), ring(g, R_RING)];
  const delta = angDiff(g, ah), n = Math.max(1, Math.ceil(Math.abs(delta) / 0.22));
  for (let k = 1; k <= n; k++) pts.push(ring(g + delta * (k / n), R_RING));
  pts.push({ x: home.x, z: home.z, collide: collideLast });
  return pts;
}

class Actor {
  // t: 위치/방향을 가진 대상(NPC 자신 또는 hero). t.x, t.z, t.heading, t.speed, t.sit
  constructor(t, isHero, home) {
    this.t = t; this.isHero = isHero; this.home = { ...home };
    this.state = 'idle'; this.path = []; this.pi = 0; this.seat = null; this.delay = 0; this.timer = 0; this.stuck = 0;
  }
  get speedMax() { return this.isHero ? HERO_SPEED : NPC_SPEED; }
  go(path, delay = 0) { this.path = path; this.pi = 0; this.delay = delay; this.stuck = 0; }
}

export class Meeting {
  constructor({ scene, hero, col, bounds, onText, onToast, npcCount = HOMES.length }) {
    this.scene = scene; this.hero = hero; this.col = col; this.bounds = bounds;
    this.onText = onText ?? (() => {}); this.onToast = onToast ?? (() => {});
    this.state = 'idle';   // idle | gathering | seated | reasoning | dispersing
    this.timer = 0;
    this.npcs = HOMES.slice(0, npcCount).map((h, i) => {
      const model = buildModel({ colors: LOOKS[i % LOOKS.length] }); scene.add(model);
      const t = { x: h.x, z: h.z, heading: Math.atan2(TC.x - h.x, TC.z - h.z) + (i % 2 ? 0.5 : -0.5), speed: 0, sit: 0, phase: 0, model };
      // 다른 사람(플레이어)이 NPC 를 뚫고 지나가지 않게 충돌 원으로 등록(위치는 매 프레임 갱신)
      t.circle = { x: t.x, z: t.z, r: 0.3, tag: 'npc' }; col.circles.push(t.circle);
      model.position.set(t.x, 0, t.z); model.rotation.y = t.heading;
      return new Actor(t, false, h);
    });
    this.heroActor = new Actor(hero, true, { x: hero.x, z: hero.z });
    this.actors = [...this.npcs, this.heroActor];
  }

  /** 플레이어 조작을 막고 자동 조종 중인가 */
  get heroBusy() { return this.state !== 'idle'; }

  say(text) {
    const s = text.replace(/\s+/g, '');
    if (!s) return;
    if (/(일어|기립|해산|끝)/.test(s)) return this.stand('모두 일어섭니다.');
    if (/(시작)/.test(s)) return this.start();
    if (/(앉)/.test(s)) return this.sit();
    this.onToast(`"${text}" 는 알 수 없는 명령이에요. "앉아" · "시작" · "일어서" 를 써 보세요.`, 3500);
  }

  sit() {
    if (this.state !== 'idle') { this.onToast('이미 모임 중이에요. "시작" 또는 "일어서" 를 말해 보세요.', 3000); return; }
    this.state = 'gathering';
    const hero = this.hero;
    this.heroActor.home = { x: hero.x, z: hero.z };      // 일어난 뒤 돌아올 "처음" 위치
    hero.auto = true; hero.follow = true;
    // 가까운 사람부터 가까운 의자를 하나씩 배정(욕심쟁이 매칭)
    const free = new Set(SEATS.map(s => s.i)), left = new Set(this.actors);
    const pairs = [];
    for (const a of this.actors) for (const s of SEATS) pairs.push({ a, s, d: Math.hypot(a.t.x - s.x, a.t.z - s.z) });
    pairs.sort((p, q) => p.d - q.d);
    for (const { a, s } of pairs) {
      if (!left.has(a) || !free.has(s.i)) continue;
      left.delete(a); free.delete(s.i); a.seat = s;
    }
    this.actors.forEach((a, k) => {
      const r0 = Math.hypot(a.t.x - TC.x, a.t.z - TC.z);
      a.state = 'toSeat';
      a.go(pathToSeat(a.t.x, a.t.z, a.seat, a.isHero && r0 < 4.3), a.isHero ? 0 : (k * 0.17) % 0.9);
    });
    this.onToast('앉아 — 모두 원탁으로 모입니다.', 2500);
  }

  start() {
    if (this.state === 'seated') {
      this.state = 'reasoning'; this.timer = READ_SECONDS;
      this.onText('추리 시작');
      return;
    }
    if (this.state === 'gathering') { this.onToast('아직 다 앉지 않았어요. 모두 앉으면 "시작" 이라고 하세요.', 3000); return; }
    if (this.state === 'idle') { this.onToast('먼저 "앉아" 라고 하세요.', 3000); return; }
  }

  stand(msg) {
    if (this.state === 'idle' || this.state === 'dispersing') return;
    this.state = 'dispersing';
    this.onText('');
    if (msg) this.onToast(msg, 2000);
    this.actors.forEach(a => {
      if (a.state === 'toSeat') { // 아직 걷는 중이면 지금 위치에서 곧장 처음 자리로
        a.state = 'toHome'; a.sitTimer = 0;
        const r0 = Math.hypot(a.t.x - TC.x, a.t.z - TC.z);
        a.go([{ x: a.home.x, z: a.home.z, collide: a.isHero && Math.hypot(a.home.x - TC.x, a.home.z - TC.z) < 4.3 }], 0);
        if (r0 < 4.3 && a.seat) a.path = pathFromSeat(a.seat, a.home, a.isHero);
        return;
      }
      a.state = 'standingUp'; a.sitTimer = 0;
    });
  }

  update(dt) {
    if (this.state === 'idle') { this.syncCircles(); return; }
    for (const a of this.actors) this.stepActor(a, dt);

    if (this.state === 'gathering' && this.actors.every(a => a.state === 'seated')) {
      this.state = 'seated';
      this.onToast('모두 앉았어요. "시작" 이라고 하세요.', 4000);
    }
    if (this.state === 'reasoning') {
      this.timer -= dt;
      if (this.timer <= 0) this.stand('');
    }
    if (this.state === 'dispersing' && this.actors.every(a => a.state === 'idle')) {
      this.state = 'idle';
      this.hero.auto = false; this.hero.sit = 0; this.hero.speed = 0;
    }
    this.syncCircles();
  }

  syncCircles() { for (const n of this.npcs) { n.t.circle.x = n.t.x; n.t.circle.z = n.t.z; } }

  // 한 사람 갱신
  stepActor(a, dt) {
    const t = a.t;
    if (a.state === 'toSeat' || a.state === 'toHome') {
      if (a.delay > 0) { a.delay -= dt; t.speed = 0; }
      else this.walkPath(a, dt);
    } else if (a.state === 'standingUp') {
      a.sitTimer += dt;
      t.sit = 1 - smooth(a.sitTimer / 0.7); t.speed = 0;
      if (a.sitTimer >= 0.7) {
        t.sit = 0; a.state = 'toHome';
        a.go(pathFromSeat(a.seat, a.home, a.isHero && Math.hypot(a.home.x - TC.x, a.home.z - TC.z) < 4.3), 0);
      }
    } else if (a.state === 'seated') {
      t.speed = 0; t.sit = 1;
      t.heading += wrap(a.seat.face - t.heading) * Math.min(1, dt * 8);
    } else if (a.state === 'idle') {
      t.speed = 0;
    }
    // 자세 적용 (hero 는 autoStep 안에서 따로 적용)
    if (a.isHero) { this.hero.autoStep(dt); }
    else {
      t.phase = advancePhase(t.phase, t.speed, dt);
      poseModel(t.model, t.phase, 1, t.sit, t.speed);
      t.model.position.set(t.x, 0, t.z); t.model.rotation.y = t.heading;
    }
  }

  walkPath(a, dt) {
    const t = a.t, sp = a.speedMax;
    const p = a.path[a.pi];
    if (!p) { this.arrive(a); return; }
    const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz);
    const step = sp * dt;
    // 의자에 가까워지면 천천히 앉는다 (마지막 SIT_RAMP m)
    if (a.state === 'toSeat' && p.seat) t.sit = Math.max(t.sit, smooth(1 - d / SIT_RAMP));
    if (a.state === 'toHome' && t.sit > 0) t.sit = Math.max(0, t.sit - dt / 0.5);   // 걷는 중 아직 굽혀 있으면 서서히 편다
    let nx, nz;
    if (d <= step) { nx = p.x; nz = p.z; } else { nx = t.x + (dx / d) * step; nz = t.z + (dz / d) * step; }
    if (p.collide) { // 처음에 탁자 가까이 서 있던 플레이어: 가구에 부딪히면 미끄러진다. 한참 못 가면 그 점으로 옮긴다
      const r = resolveCircle(nx, nz, 0.3, this.col, this.bounds); const moved = Math.hypot(r.x - t.x, r.z - t.z);
      a.stuck = moved < step * 0.3 ? a.stuck + dt : 0;
      if (a.stuck > 1.2) { r.x = p.x; r.z = p.z; a.stuck = 0; }
      nx = r.x; nz = r.z;
    }
    const mv = Math.hypot(nx - t.x, nz - t.z);
    t.speed = mv / Math.max(dt, 1e-4);
    if (mv > 1e-4) t.heading += wrap(Math.atan2(nx - t.x, nz - t.z) - t.heading) * Math.min(1, dt * 10);
    t.x = nx; t.z = nz;
    if (Math.hypot(p.x - t.x, p.z - t.z) < 0.02) a.pi++;
    if (a.state === 'toSeat' && p.seat) t.heading += wrap(a.seat.face - t.heading) * Math.min(1, dt * 6 * smooth(1 - d / SIT_RAMP));
    if (a.pi >= a.path.length) this.arrive(a);
  }

  arrive(a) {
    const t = a.t; t.speed = 0;
    if (a.state === 'toSeat') { a.state = 'seated'; t.sit = 1; t.x = a.seat.x; t.z = a.seat.z; }
    else if (a.state === 'toHome') { a.state = 'idle'; t.sit = 0; }
  }
}
