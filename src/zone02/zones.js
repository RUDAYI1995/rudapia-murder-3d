// ChatGPT 가 만든 layout_prototype_v01.json 을 기준 레이아웃으로 사용한다.
// 좌표: m, X=동, Z=남(북=-Z), 원점=홀 북서쪽 안쪽 모서리.
import layout from '../data/zone02_layout.json';

// ── ChatGPT 레이아웃에 없는 디자인 추가분: 서쪽 별채(서재 2칸) ──
// 서쪽 벽 입면도(문 2개)에 맞춰 홀 서쪽 벽(x=0)에 문 2개(z=5, 13)를 내고, 그 뒤에 8×9m 방 2개를 붙인다.
// (참조 이미지의 양쪽 벽 문 너머에 서재가 보이는 구성)
{
  const wallBox = (id, x0, z0, x1, z1, h) => ({ id, center: { x: (x0 + x1) / 2, y: h / 2, z: (z0 + z1) / 2 }, size: { x: x1 - x0, y: h, z: z1 - z0 }, collision: 'box', source: 'annex' });
  const i = layout.walls.findIndex(w => w.id === 'west_0');
  if (i >= 0) layout.walls.splice(i, 1); // 통짜 서쪽 벽을 문 틈이 있는 3조각으로 교체
  const H = 3.8;
  layout.walls.push(
    wallBox('west_hall_0', -0.15, 0, 0.15, 4.1, 4.5), wallBox('west_hall_1', -0.15, 5.9, 0.15, 12.1, 4.5), wallBox('west_hall_2', -0.15, 13.9, 0.15, 24, 4.5),
    wallBox('annex_n', -9.15, 0.85, -0.15, 1.15, H), wallBox('annex_s', -9.15, 16.85, -0.15, 17.15, H),
    wallBox('annex_w', -9.15, 0.85, -8.85, 17.15, H), wallBox('annex_mid', -8.85, 8.85, -0.15, 9.15, H),
  );
  layout.doors.push(
    { id: 'D13', axis: 'z', center: { x: 0, y: 0, z: 5 }, width: 1.8, height: 3.6, connects: ['hall', 'library_a'], state: 'open' },
    { id: 'D14', axis: 'z', center: { x: 0, y: 0, z: 13 }, width: 1.8, height: 3.6, connects: ['hall', 'library_b'], state: 'open' },
  );
  layout.zones.push(
    { id: 'library_a', name: '서재', bounds: { x: -9, z: 1, w: 9, d: 8 }, floorY: 0 },
    { id: 'library_b', name: '집무실', bounds: { x: -9, z: 9, w: 9, d: 8 }, floorY: 0 },
  );
}

export { layout };

export const INTERIOR_IDS = new Set(['hall', 'corridor', 'dining', 'kitchen', 'security', 'utility', 'foyer', 'library_a', 'library_b']);

// 중앙 홀 천장 높이: ChatGPT 이미지의 2층 높이 홀. (layout JSON 의 4.5m 에서 상향)
export const HALL_H = 7.0;

// 방별 마감 스타일
export const STYLE = {
  hall:     { wall: 'hallStone',      wain: 'woodPanel', wainH: 1.3,  floor: 'marble',   ceilH: HALL_H },
  corridor: { wall: 'wallpaperRed',   wain: 'woodPanel', wainH: 1.15, floor: 'parquet',  ceilH: 3.4 },
  foyer:    { wall: 'wallpaperRed',   wain: 'woodPanel', wainH: 1.15, floor: 'marble',   ceilH: 3.4 },
  dining:   { wall: 'wallpaperGreen', wain: 'woodPanel', wainH: 1.15, floor: 'parquet',  ceilH: 3.4 },
  kitchen:  { wall: 'plaster',        wain: 'subway',    wainH: 1.7,  floor: 'checker',  ceilH: 3.4 },
  security: { wall: 'concrete',       wain: null,        wainH: 0,    floor: 'concrete', ceilH: 3.4 },
  utility:  { wall: 'concrete',       wain: null,        wainH: 0,    floor: 'concrete', ceilH: 3.4 },
  library_a: { wall: 'wallpaperGreen', wain: 'woodPanel', wainH: 1.2, floor: 'parquet',  ceilH: 3.8 },
  library_b: { wall: 'wallpaperRed',   wain: 'woodPanel', wainH: 1.2, floor: 'parquet',  ceilH: 3.8 },
};

export const ZONES = layout.zones.map(z => ({ ...z, ...z.bounds, x1: z.bounds.x + z.bounds.w, z1: z.bounds.z + z.bounds.d }));
export const zoneById = Object.fromEntries(ZONES.map(z => [z.id, z]));

export function zoneIdAt(x, z) {
  for (const zn of ZONES) {
    if (x >= zn.x && x < zn.x1 && z >= zn.z && z < zn.z1) return zn.id;
  }
  return 'outside';
}

// 문으로 연결된 구역 그래프 (조명 선택/컬링용). 바깥 구역은 서로 이어진 것으로 본다.
export const ADJ = (() => {
  const g = {};
  const link = (a, b) => { (g[a] ??= new Set()).add(b); (g[b] ??= new Set()).add(a); };
  for (const d of layout.doors) link(d.connects[0], d.connects[1]);
  link('east_path', 'south_path'); link('south_path', 'courtyard'); link('east_path', 'courtyard');
  return g;
})();

export function nearZones(id) {
  const s = new Set([id]);
  for (const n of ADJ[id] ?? []) s.add(n);
  return s;
}
