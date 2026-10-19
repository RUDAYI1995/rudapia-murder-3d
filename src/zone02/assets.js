// 외부에서 받은 이미지 에셋 로더 (tools/make-hall-assets.mjs 가 public/assets/zone02/ 에 만든 파일).
// 파일이 없으면 null 을 돌려주고, 호출 쪽은 절차적 재질로 대체한다.
import * as THREE from 'three';

const BASE = '/assets/zone02/';
const loader = new THREE.TextureLoader();

const load = (name, { srgb = true, repeat = false } = {}) =>
  new Promise(resolve => {
    loader.load(BASE + name, t => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 16;
      t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      resolve(t);
    }, undefined, () => resolve(null));
  });

export async function loadAssets(onProgress = () => {}) {
  onProgress('이미지 에셋 불러오는 중…');
  let meta = null;
  try { meta = await fetch(BASE + 'hall_assets.json').then(r => (r.ok ? r.json() : null)); } catch { /* 없음 */ }
  if (!meta) return null;
  let walls = null;
  try { walls = await fetch(BASE + 'wall_sheets.json').then(r => (r.ok ? r.json() : null)); } catch { /* 없음 */ }
  const sheet = async name => (walls?.[name]
    ? { ...walls[name], map: await load(name + '.png'), normalMap: null } // 법선 맵 사용 안 함: 이미지의 미세한 가로 줄 노이즈가 법선으로 증폭돼 가로 줄무늬가 생김
    : null);
  const [wnA, wnN] = walls?.wall_north ? [await load('wall_north.png'), null] : [null, null];
  const northSide = await sheet('wall_north_side');
  let hq = null;
  try { hq = await fetch(BASE + 'hall_floor_hq.json').then(r => (r.ok ? r.json() : null)); } catch { /* 없음 */ }
  const [hqA, hqN] = hq ? await Promise.all([load('hall_floor_hq_albedo.png'), load('hall_floor_hq_normal.png', { srgb: false })]) : [null, null];
  const northSideB = await sheet('wall_north_side_b');
  const northA = await sheet('wall_north_a'); // 북쪽 v2: 초상화 자리가 빈 모듈 2장(각 10m)
  const northB = await sheet('wall_north_b');
  const east = await sheet('wall_east');
  const west = await sheet('wall_west');
  const south = await sheet('wall_south');
  const hasLeaves = south && Object.keys(south.leaves ?? {}).length > 0;
  const leafA = hasLeaves ? await load('door_leaf_a.png') : null;
  const leafB = hasLeaves ? await load('door_leaf_b.png') : null;
  const portraitBig = await load('portrait_big_v2.png'); // 홀 북쪽 벽 가운데 큰 초상화 (새 이미지, 없으면 벽 이미지에 그려진 것을 그대로 둔다)
  const [fa, fr, fn, rn, pa, pb, pd, pe, tap] = await Promise.all([
    load('hall_floor_albedo.png'), load('hall_floor_rough.png', { srgb: false }), load('hall_floor_normal.png', { srgb: false }),
    load('hall_runner_south.png'),
    load('portrait_a.png'), load('portrait_b.png'), load('portrait_d.png'), load('portrait_e.png'),
    load('tapestry_a.png'),
  ]);
  return {
    meta,
    floor: fa ? { map: fa, roughnessMap: fr, normalMap: fn, ...meta.floor } : null,
    runner: rn ? { map: rn, ...meta.runner } : null,
    portraits: [pa, pb, pd, pe].filter(Boolean),
    tapestry: tap,
    portraitBig,
    // 고화질 홀 바닥 메달리온 (탁자/카펫 없는 깨끗한 대리석). 있으면 이전 저해상도 바닥 대신 사용
    floorHQ: hqA ? { map: hqA, normalMap: hqN, ...hq } : null,
    // 벽 정면 입면도 (ChatGPT). 홀 북쪽 벽: 3모듈을 이어 붙인다
    wallNorth: wnA ? { map: wnA, normalMap: wnN, ...walls.wall_north } : null,
    wallNorth2: northA?.map && northB?.map ? { a: northA, b: northB } : null,
    // 홀 남쪽 벽: 가운데(문+채광창+초상화 2) 한 장 + 좌우는 북쪽 시트의 보충용 베이
    wallSouth: south?.map && northSide?.map ? { center: south, side: northSide, leafA, leafB } : null,
    // 홀 서쪽 벽: 문 2개(서재로 통함) 가운데 시트 + 동쪽 벽과 같은 보충 베이
    wallWest: west?.map && northSide?.map && northSideB?.map ? { center: west, side: northSide, sideB: northSideB } : null,
    // 홀 동쪽 벽: 문 2개가 있는 가운데 시트 + 북쪽(큰 초상화 베이 1) / 남쪽(보충 베이 2) 보충
    wallEast: east?.map && northSide?.map && northSideB?.map ? { center: east, side: northSide, sideB: northSideB } : null,
  };
}
