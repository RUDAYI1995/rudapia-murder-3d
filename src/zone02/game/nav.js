// 게임용 길찾기: 방(구역)을 노드, 문을 간선으로 보는 단순 그래프 + 문 앞뒤 경유점. 가구에 걸리면 충돌 미끄러짐으로 풀어낸다.
import { layout, ZONES, zoneById, zoneIdAt } from '../zones.js';
import { resolveCircle } from '../collide.js';

// 게임이 열리는 곳: 저택 안쪽 방들 (앞마당·외곽 길은 제외)
export const PLAY_ZONES = ['hall', 'corridor', 'dining', 'kitchen', 'security', 'utility', 'foyer', 'library_a', 'library_b'];
const PLAY = new Set(PLAY_ZONES);

const edges = {}; // zone -> [{to, door}]
for (const d of layout.doors) {
  const [a, b] = d.connects;
  if (!PLAY.has(a) || !PLAY.has(b)) continue;
  (edges[a] ??= []).push({ to: b, door: d });
  (edges[b] ??= []).push({ to: a, door: d });
}

// 문 양쪽 1.3m 지점 (axis 'x' = 벽이 x 방향 → z 방향으로 통과, 'z' = 벽이 z 방향 → x 방향으로 통과)
function doorSides(d) {
  const o = 1.3, c = d.center;
  return d.axis === 'x' ? [{ x: c.x, z: c.z - o }, { x: c.x, z: c.z + o }] : [{ x: c.x - o, z: c.z }, { x: c.x + o, z: c.z }];
}

// from → to 구역 사이 문 경로 (BFS). [{door, from, to}]
export function routeZones(from, to) {
  if (from === to) return [];
  if (!PLAY.has(from)) from = 'hall';
  const prev = { [from]: null }, q = [from];
  while (q.length) {
    const z = q.shift();
    if (z === to) break;
    for (const e of edges[z] ?? []) if (!(e.to in prev)) { prev[e.to] = { z, door: e.door }; q.push(e.to); }
  }
  if (!(to in prev)) return [];
  const steps = [];
  for (let z = to; prev[z]; z = prev[z].z) steps.unshift({ door: prev[z].door, from: prev[z].z, to: z });
  return steps;
}

export const hops = (a, b) => routeZones(a, b).length;

// ───────── 격자 길찾기 (A*) ─────────
// 가구/계단/벽 충돌 데이터를 0.5m 격자로 굳혀서, 방 안의 장애물(계단·탁자·책장)도 돌아서 간다.
// 사람/AI(tag 'npc')는 장애물로 보지 않는다.
const CELL = 0.5, GX0 = -10, GZ0 = -1, GW = Math.ceil(55 / CELL), GH = Math.ceil(50 / CELL);
let NAV = null, NAV_COL = null;
const AGENT_R = 0.4;

function blockedAt(col, x, z, r) {
  for (const b of col.boxes) {
    if (b.y1 < 0.05 || b.noPlayer) continue;
    const nx = Math.min(Math.max(x, b.minX), b.maxX), nz = Math.min(Math.max(z, b.minZ), b.maxZ);
    if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) return true;
  }
  for (const c of col.circles) {
    if (c.tag === 'npc') continue;
    const m = r + c.r; if ((x - c.x) ** 2 + (z - c.z) ** 2 < m * m) return true;
  }
  return false;
}
export function setNavCollider(col) { NAV_COL = col; NAV = null; }
function buildNav() {
  NAV = new Uint8Array(GW * GH); // 1 = 이동 가능
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = GX0 + (i + 0.5) * CELL, z = GZ0 + (j + 0.5) * CELL;
    NAV[j * GW + i] = zoneIdAt(x, z) !== 'outside' && PLAY.has(zoneIdAt(x, z)) && !blockedAt(NAV_COL, x, z, AGENT_R) ? 1 : 0;
  }
}
const cellI = x => Math.floor((x - GX0) / CELL), cellJ = z => Math.floor((z - GZ0) / CELL);
const inGrid = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH;
function nearestFree(i, j) {
  if (inGrid(i, j) && NAV[j * GW + i]) return [i, j];
  for (let r = 1; r < 30; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    if (inGrid(i + di, j + dj) && NAV[(j + dj) * GW + i + di]) return [i + di, j + dj];
  }
  return null;
}
function los(x0, z0, x1, z1) { // 두 점 사이 직선이 모두 이동 가능한 칸을 지나는가
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 0.2));
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n, z = z0 + ((z1 - z0) * k) / n;
    const i = cellI(x), j = cellJ(z);
    if (!inGrid(i, j) || !NAV[j * GW + i]) return false;
  }
  return true;
}
class Heap { // 최소 힙(f 값 기준)
  constructor() { this.a = []; }
  push(k, f) { const a = this.a; a.push([k, f]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][1] <= a[i][1]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = i * 2 + 1, r = l + 1, s = i; if (l < a.length && a[l][1] < a[s][1]) s = l; if (r < a.length && a[r][1] < a[s][1]) s = r; if (s === i) break; [a[s], a[i]] = [a[i], a[s]]; i = s; } } return top; }
  get size() { return this.a.length; }
}

/** (x,z) → goal 까지의 경유점(마지막 점은 goal). 길이 없으면 goal 하나만 돌려준다. toZone 은 호환용으로 무시한다. */
export function pathPoints(x, z, toZone, goal) {
  if (!NAV) buildNav();
  const s = nearestFree(cellI(x), cellJ(z)), g = nearestFree(cellI(goal.x), cellJ(goal.z));
  if (!s || !g) return [goal];
  if (los(x, z, goal.x, goal.z)) return [goal];
  const N = GW * GH, gs = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const si = s[1] * GW + s[0], gi = g[1] * GW + g[0];
  const h = (i, j) => { const dx = Math.abs(i - g[0]), dz = Math.abs(j - g[1]); return (dx + dz) + (1.414 - 2) * Math.min(dx, dz); };
  const open = new Heap(); gs[si] = 0; open.push(si, h(s[0], s[1]));
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let found = false, guard = 0;
  while (open.size && guard++ < 20000) {
    const [k] = open.pop(); if (closed[k]) continue; closed[k] = 1;
    if (k === gi) { found = true; break; }
    const ci = k % GW, cj = (k / GW) | 0;
    for (const [di, dj, c] of dirs) {
      const ni = ci + di, nj = cj + dj; if (!inGrid(ni, nj)) continue;
      const nk = nj * GW + ni; if (!NAV[nk] || closed[nk]) continue;
      if (di && dj && (!NAV[cj * GW + ni] || !NAV[nj * GW + ci])) continue; // 모서리 파고들기 금지
      const ng = gs[k] + c; if (ng < gs[nk]) { gs[nk] = ng; came[nk] = k; open.push(nk, ng + h(ni, nj)); }
    }
  }
  if (!found) return [goal];
  const cells = []; for (let k = gi; k !== -1; k = came[k]) cells.unshift({ x: GX0 + ((k % GW) + 0.5) * CELL, z: GZ0 + (((k / GW) | 0) + 0.5) * CELL });
  // 줄 당기기: 보이는 가장 먼 점으로 바로 간다
  const out = []; let cur = { x, z }, idx = 0;
  while (idx < cells.length) {
    let far = idx; for (let k = cells.length - 1; k > idx; k--) if (los(cur.x, cur.z, cells[k].x, cells[k].z)) { far = k; break; }
    out.push(cells[far]); cur = cells[far]; idx = far + 1;
  }
  out.push({ x: goal.x, z: goal.z });
  return out;
}

export function isFree(col, x, z, r = AGENT_R) { return !blockedAt(col, x, z, r); }

export function randomPoint(col, zoneId, rnd = Math.random, inset = 0.9) {
  const zn = zoneById[zoneId];
  for (let i = 0; i < 120; i++) {
    const x = zn.x + inset + rnd() * (zn.w - inset * 2), z = zn.z + inset + rnd() * (zn.d - inset * 2);
    if (isFree(col, x, z, 0.6)) return { x, z };
  }
  return { x: zn.x + zn.w / 2, z: zn.z + zn.d / 2 };
}

export const zoneName = id => zoneById[id]?.name ?? '바깥';
export { zoneIdAt };
