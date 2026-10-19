// 맵 데이터 (순수 데이터 + 생성 함수, three 의존 없음).
// 클라이언트는 이걸로 그리고, 나중에 게임 서버는 같은 파일로 충돌/스폰/구역을 판정한다.
// 좌표: 단위 m, x=동쪽, z=남쪽(북쪽이 -z). 중앙 광장이 (0,0).

export const MAP_HALF = 60; // 맵 한 변 120m
const WALL_H = 3.4;
const WALL_T = 0.5;

const box = (cx, cz, w, d, h, kind) => ({ cx, cz, w, d, h, kind });

// 축 정렬 벽 한 줄. gaps(문 구멍)를 뚫어 여러 조각으로 쪼갠다.
// axis 'x': z=fixed 에서 x방향으로 뻗음 / axis 'z': x=fixed 에서 z방향으로 뻗음
function wallLine(axis, fixed, from, to, gaps = [], kind = 'wall', h = WALL_H, t = WALL_T) {
  const out = [];
  const seg = (a, b) => {
    const len = b - a;
    const mid = (a + b) / 2;
    out.push(axis === 'x' ? box(mid, fixed, len, t, h, kind) : box(fixed, mid, t, len, h, kind));
  };
  let cur = from;
  for (const g of [...gaps].sort((p, q) => p.c - q.c)) {
    const s = g.c - g.w / 2;
    if (s > cur) seg(cur, s);
    cur = g.c + g.w / 2;
  }
  if (cur < to) seg(cur, to);
  return out;
}

// 건물: 바깥벽(문 구멍 포함) + 안쪽 벽. doors 의 at 은 해당 변 중심 기준 오프셋.
function building(id, name, cx, cz, w, d, doors = {}, inner = [], style = 'manor') {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const gaps = (list = [], base) => list.map(o => ({ c: base + o.at, w: o.w ?? 2.4 }));
  const kind = style === 'glass' ? 'glass' : 'wall';
  const walls = [
    ...wallLine('x', z0, x0, x1, gaps(doors.n, cx), kind),
    ...wallLine('x', z1, x0, x1, gaps(doors.s, cx), kind),
    ...wallLine('z', x0, z0, z1, gaps(doors.w, cz), kind),
    ...wallLine('z', x1, z0, z1, gaps(doors.e, cz), kind),
    ...inner.flatMap(i => wallLine(i.axis, i.fixed, i.from, i.to, i.gaps ?? [], 'wall')),
  ];
  return { id, name, style, cx, cz, w, d, x0, x1, z0, z1, walls };
}

export const buildings = [
  building('mansion', '저택 본관', 0, -44, 40, 24,
    { s: [{ at: 0, w: 4.4 }] },
    [
      { axis: 'z', fixed: -6, from: -56, to: -32, gaps: [{ c: -38, w: 2.4 }, { c: -50, w: 2.4 }] },
      { axis: 'z', fixed: 6, from: -56, to: -32, gaps: [{ c: -38, w: 2.4 }, { c: -50, w: 2.4 }] },
      { axis: 'x', fixed: -44, from: -20, to: -6, gaps: [{ c: -13, w: 2.4 }] },
      { axis: 'x', fixed: -44, from: 6, to: 20, gaps: [{ c: 13, w: 2.4 }] },
    ]),
  building('kitchen', '주방동', 46, -10, 20, 14, { w: [{ at: 0 }], s: [{ at: -4 }] }),
  building('library', '서재', -46, -10, 20, 14, { e: [{ at: 0 }], s: [{ at: 4 }] }),
  building('greenhouse', '온실', -40, 36, 18, 12, { e: [{ at: 0 }], n: [{ at: 0 }] }, [], 'glass'),
  building('shed', '창고', 40, 38, 16, 12, { w: [{ at: -2 }], n: [{ at: 0 }] }),
];

// ── 외곽 담장 (남쪽 정문 6m 개방) ──
const F = 58;
export const fence = [
  ...wallLine('x', -F, -F, F, [], 'fence', 2.6, 0.4),
  ...wallLine('x', F, -F, F, [{ c: 0, w: 6 }], 'fence', 2.6, 0.4),
  ...wallLine('z', -F, -F, F, [], 'fence', 2.6, 0.4),
  ...wallLine('z', F, -F, F, [], 'fence', 2.6, 0.4),
];

// ── 정원 울타리 (광장 남쪽, 도로 양옆) ──
export const hedges = [
  ...wallLine('x', 20, 6, 26, [{ c: 16, w: 2.4 }], 'hedge', 1.8, 1.2),
  ...wallLine('x', 20, -26, -6, [{ c: -16, w: 2.4 }], 'hedge', 1.8, 1.2),
  ...wallLine('x', 28, 8, 24, [], 'hedge', 1.8, 1.2),
  ...wallLine('x', 28, -24, -8, [], 'hedge', 1.8, 1.2),
  ...wallLine('z', 12, 20, 28, [], 'hedge', 1.8, 1.2),
  ...wallLine('z', -12, 20, 28, [], 'hedge', 1.8, 1.2),
  ...wallLine('z', 24, 20, 28, [{ c: 24, w: 2.4 }], 'hedge', 1.8, 1.2),
  ...wallLine('z', -24, 20, 28, [{ c: 24, w: 2.4 }], 'hedge', 1.8, 1.2),
];

// ── 광장 / 길 ──
export const plaza = { x: 0, z: 0, r: 14 };
export const paths = [
  { x0: -1.8, z0: -32, x1: 1.8, z1: -13 }, // 본관 정문 ~ 광장
  { x0: 13, z0: -11.8, x1: 36, z1: -8.2 }, // 광장 ~ 주방동
  { x0: -36, z0: -11.8, x1: -13, z1: -8.2 }, // 광장 ~ 서재
  { x0: -1.8, z0: 13, x1: 1.8, z1: 58 }, // 남쪽 큰길 + 정문
  { x0: -31, z0: 34.2, x1: 0, z1: 37.8 }, // 큰길 ~ 온실
  { x0: 0, z0: 34.2, x1: 32, z1: 37.8 }, // 큰길 ~ 창고
];

// ── 소품 (collide=true 면 충돌 박스). 모두 축 정렬 ──
export const props = [
  // 본관 홀 식탁
  { type: 'table', x: 0, z: -44, w: 3, d: 8, h: 0.9, collide: true },
  // 광장 벤치 4개
  { type: 'bench', x: 9, z: 0, w: 0.7, d: 2.2, h: 0.5, collide: true },
  { type: 'bench', x: -9, z: 0, w: 0.7, d: 2.2, h: 0.5, collide: true },
  { type: 'bench', x: 0, z: 9, w: 2.2, d: 0.7, h: 0.5, collide: true },
  { type: 'bench', x: 0, z: -9, w: 2.2, d: 0.7, h: 0.5, collide: true },
  // 주방동
  { type: 'counter', x: 46, z: -10, w: 6, d: 2, h: 1.0, collide: true },
  { type: 'shelf', x: 46, z: -16.2, w: 8, d: 0.8, h: 2.2, collide: true },
  // 서재
  { type: 'shelf', x: -46, z: -16.2, w: 12, d: 0.8, h: 2.4, collide: true },
  { type: 'table', x: -44, z: -8, w: 3, d: 1.4, h: 0.8, collide: true },
  // 창고
  { type: 'crate', x: 35, z: 34, w: 1.6, d: 1.6, h: 1.4, collide: true },
  { type: 'crate', x: 35, z: 36, w: 1.6, d: 1.6, h: 1.0, collide: true },
  { type: 'crate', x: 45, z: 41.5, w: 1.8, d: 1.8, h: 1.6, collide: true },
  { type: 'crate', x: 46.5, z: 35, w: 1.4, d: 1.4, h: 1.2, collide: true },
  // 온실 화단
  { type: 'planter', x: -44, z: 33, w: 8, d: 1.5, h: 0.7, collide: true },
  { type: 'planter', x: -38, z: 40, w: 6, d: 1.5, h: 0.7, collide: true },
];

// ── 가로등 (앞쪽 8개는 실제 조명) ──
export const lamps = [
  { x: 11, z: 11 }, { x: -11, z: 11 }, { x: 11, z: -11 }, { x: -11, z: -11 },
  { x: 3.5, z: -29 }, { x: -3.5, z: -29 }, { x: 3.5, z: 40 }, { x: -3.5, z: 40 },
];

// ── 도구 스폰 후보 (한 판에 이 중 3개 종류를 서버가 선택해 배치) ──
export const toolSpawns = [
  { id: 'knife-kitchen', tool: 'knife', x: 51, z: -14.5 },
  { id: 'knife-hall', tool: 'knife', x: 3.5, z: -47 },
  { id: 'hammer-shed', tool: 'hammer', x: 44, z: 34 },
  { id: 'hammer-library', tool: 'hammer', x: -40, z: -14.5 },
  { id: 'rope-greenhouse', tool: 'rope', x: -44, z: 31 },
  { id: 'rope-eastwing', tool: 'rope', x: 16, z: -52 },
];

// ── 플레이어 시작 위치 (광장 둘레 5곳) ──
export const playerSpawns = Array.from({ length: 5 }, (_, i) => {
  const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(a) * 6.5, z: Math.sin(a) * 6.5 };
});

// ── 알리바이용 구역 ──
export function zoneAt(x, z) {
  for (const b of buildings) {
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return b.name;
  }
  if (Math.hypot(x - plaza.x, z - plaza.z) < plaza.r) return '중앙 광장';
  if (z > 16 && z < 32 && Math.abs(x) < 28) return '정원';
  return '외곽';
}

// ── 나무 (시드 고정이라 서버/클라이언트가 같은 결과) ──
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTrees(count = 70) {
  const rnd = mulberry32(20261012);
  const trees = [];
  const blocked = (x, z) => {
    if (Math.hypot(x, z) < 19) return true;
    for (const b of buildings) {
      if (x > b.x0 - 4 && x < b.x1 + 4 && z > b.z0 - 4 && z < b.z1 + 4) return true;
    }
    for (const p of paths) {
      if (x > p.x0 - 2.5 && x < p.x1 + 2.5 && z > p.z0 - 2.5 && z < p.z1 + 2.5) return true;
    }
    if (z > 16 && z < 32 && Math.abs(x) < 28) return true; // 정원
    return false;
  };
  for (let tries = 0; trees.length < count && tries < 4000; tries++) {
    const x = (rnd() * 2 - 1) * (F - 3);
    const z = (rnd() * 2 - 1) * (F - 3);
    if (blocked(x, z)) continue;
    if (trees.some(t => Math.hypot(t.x - x, t.z - z) < 4)) continue;
    trees.push({ x, z, r: 0.45, s: 0.8 + rnd() * 0.9, kind: rnd() < 0.55 ? 'pine' : 'oak' });
  }
  return trees;
}
export const trees = makeTrees();

// 분수 (충돌 원)
export const fountain = { x: 0, z: 0, r: 3.4 };
