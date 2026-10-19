// 레이아웃(JSON) → 벽/문틀/창/바닥/천장/지붕 3D. 충돌 박스도 같이 등록한다.
import * as THREE from 'three';
import { layout, STYLE, ZONES, zoneIdAt, HALL_H } from './zones.js';

const T = 0.3; // 벽 두께 (layout.design.wallThickness)

// 창문 정의 (ChatGPT 레이아웃에는 없는 디자인 추가분): axis 는 벽이 뻗는 방향.
// levels: 같은 위치에 층별로 쌓인 창 [y0, y1]. 홀의 위층은 발코니로 나가는 창(gallery).
const HALL_LEVELS = [[1.0, 3.4], [3.7, 6.4]];
const WINDOWS = [
  // 홀 서쪽 벽 (x=0): 4개 베이, 아래 창 + 위층 발코니 창
  ...[3, 9, 15, 21].map(c => ({ axis: 'z', fixed: 0, c, w: 1.4, levels: HALL_LEVELS })),
  // 홀 동쪽 벽 (x=20): 복도 쪽이라 위층 창만 (복도 천장 위 → 달빛 줄기 없음)
  ...[3, 9, 15, 21].map(c => ({ axis: 'z', fixed: 20, c, w: 1.3, levels: [[3.7, 6.4]], noBeam: true })),
  // 홀 북쪽 (z=0) 계단 양옆
  ...[2.6, 17.4].map(c => ({ axis: 'x', fixed: 0, c, w: 1.3, levels: [[1.2, 3.4], [3.7, 6.4]] })),
  // 식당 북쪽
  { axis: 'x', fixed: 0, c: 27, w: 1.4, levels: [[0.95, 2.65]] },
  { axis: 'x', fixed: 0, c: 35, w: 1.4, levels: [[0.95, 2.65]] },
  // 홀 남쪽 (z=24) 현관 양옆
  ...[3.6, 16.4].map(c => ({ axis: 'x', fixed: 24, c, w: 1.4, levels: HALL_LEVELS })),
  // 보안실/기계실 남쪽 (작고 높은 창)
  { axis: 'x', fixed: 24, c: 27, w: 1.0, levels: [[1.9, 2.8]] },
  { axis: 'x', fixed: 24, c: 35, w: 1.0, levels: [[1.9, 2.8]] },
  // 서쪽 별채(서재 2칸)의 서쪽 외벽 x=-9: 창 하나씩
  { axis: 'z', fixed: -9, c: 5, w: 1.4, levels: [[0.95, 2.9]] },
  { axis: 'z', fixed: -9, c: 13, w: 1.4, levels: [[0.95, 2.9]] },
  // 동쪽 벽 (x=39): 식당, 주방
  { axis: 'z', fixed: 39, c: 4.5, w: 1.4, levels: [[0.95, 2.65]] },
  { axis: 'z', fixed: 39, c: 15.6, w: 1.2, levels: [[1.1, 2.65]] },
];

// 문 높이 (장식용) — 홀과 이어지는 문은 더 높게. 동쪽 벽 이미지의 문틀(높이 3.57m)이 있으면 그 높이에 맞춘다.
let eastSheetOn = false, westSheetOn = false;
const isEastHallDoor = d => d.id === 'D01' || d.id === 'D02';
const isWestHallDoor = d => d.id === 'D13' || d.id === 'D14';
const isSheetDoor = d => (eastSheetOn && isEastHallDoor(d)) || (westSheetOn && isWestHallDoor(d)); // 문틀이 이미지에 그려진 문
const doorHeight = d => (d.connects.includes('hall') ? (isSheetDoor(d) ? 3.6 : 3.2) : d.id === 'D11' ? 2.6 : d.height);

export function createArchitecture(M, ctx) {
  eastSheetOn = !!ctx.assets?.wallEast;
  westSheetOn = !!ctx.assets?.wallWest;
  const group = new THREE.Group();
  const ceilings = [];
  const roofs = [];

  const shadowed = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };

  // 박스 지오메트리 UV 를 면별 월드 크기(tile)로 스케일
  function faceBox(w, h, d, tiles) {
    const g = new THREE.BoxGeometry(w, h, d);
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) {
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, (uv.getX(i) * dims[f][0]) / tiles[f], (uv.getY(i) * dims[f][1]) / tiles[f]);
      }
    }
    return g;
  }
  const tileOf = m => m.userData.tile ?? 1;
  const solidBox = (w, h, d, mat, cast = true) => {
    const t = tileOf(mat);
    return shadowed(new THREE.Mesh(faceBox(w, h, d, [t, t, t, t, t, t]), mat), cast);
  };

  // 홀 북쪽 벽(z=0, x<20)의 실내쪽 면인가
  const isHallNorthFace = (axis, cz, cx) => axis === 'x' && Math.abs(cz) < 0.01 && cx < 20;

  // ── 벽 한 조각 (축 방향 구간 [a0,a1], 높이 [y0,y1]) ──
  function wallPiece(axis, fixed, a0, a1, y0, y1, wallTop) {
    const len = a1 - a0, h = y1 - y0;
    if (len < 0.01 || h < 0.01) return;
    const mid = (a0 + a1) / 2;
    const cx = axis === 'x' ? mid : fixed, cz = axis === 'x' ? fixed : mid;
    const off = T / 2 + 0.35;
    const posZone = axis === 'x' ? zoneIdAt(cx, cz + off) : zoneIdAt(cx + off, cz);
    const negZone = axis === 'x' ? zoneIdAt(cx, cz - off) : zoneIdAt(cx - off, cz);
    const sideMat = id => (STYLE[id] ? M[STYLE[id].wall] : M.ashlar);
    const cap = M.concrete;
    let mats;
    if (axis === 'x') mats = [cap, cap, cap, cap, sideMat(posZone), sideMat(negZone)];
    else mats = [sideMat(posZone), sideMat(negZone), cap, cap, cap, cap];
    const tiles = mats.map(tileOf);
    const W = axis === 'x' ? len : T, D = axis === 'x' ? T : len;
    const mesh = shadowed(new THREE.Mesh(faceBox(W, h, D, tiles), mats));
    mesh.position.set(cx, y0 + h / 2, cz);
    group.add(mesh);

    // 인테리어 장식 (몰딩/웨인스코팅): 해당 면이 실내일 때만
    if (len >= 0.25) {
      if (STYLE[posZone] && !(ctx.assets?.wallNorth && isHallNorthFace(axis, cz, cx)) && !(westSheetOn && axis === 'z' && Math.abs(cx) < 0.01)) trims(axis, cx, cz, len, y0, y1, wallTop, +1, STYLE[posZone]);
      if (STYLE[negZone] && !(ctx.assets?.wallSouth && axis === 'x' && Math.abs(cz - 24) < 0.01 && cx < 20)
        && !(eastSheetOn && axis === 'z' && Math.abs(cx - 20) < 0.01)) trims(axis, cx, cz, len, y0, y1, wallTop, -1, STYLE[negZone]);
    }
  }

  function trims(axis, cx, cz, len, y0, y1, wallTop, sign, st) {
    const push = (d, ox = 0) => T / 2 + d / 2 + ox;
    const place = (mesh, y, d) => {
      const o = push(d);
      if (axis === 'x') mesh.position.set(cx, y, cz + sign * o);
      else mesh.position.set(cx + sign * o, y, cz);
      group.add(mesh);
    };
    const strip = (h, d, mat, y) => {
      const W = axis === 'x' ? len : d, D = axis === 'x' ? d : len;
      const t = tileOf(mat);
      const g = new THREE.BoxGeometry(W, h, D);
      if (mat.userData.tile) {
        // 긴 면(UV)을 월드 크기로
        const uv = g.attributes.uv;
        const faceU = len / t, faceV = h / t;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * faceU, uv.getY(i) * faceV);
      }
      place(shadowed(new THREE.Mesh(g, mat), false), y, d);
    };
    if (y0 <= 0.01) {
      strip(0.2, 0.05, M.trimWood, 0.1); // 걸레받이
      if (st.wain) {
        const wh = Math.min(st.wainH, y1) - 0.2;
        if (wh > 0.05) strip(wh, 0.03, M[st.wain], 0.2 + wh / 2); // 웨인스코팅
        if (st.wainH <= y1 - 0.05) strip(0.07, 0.07, M.trimWood, st.wainH + 0.035); // 체어레일
      }
    }
    if (y1 >= wallTop - 0.01) {
      strip(0.16, 0.1, M.trimWood, wallTop - 0.08); // 크라운 몰딩
      strip(0.07, 0.17, M.trimWood, wallTop - 0.2);
      if (st === STYLE.hall) { strip(0.34, 0.22, M.stoneWarm, wallTop - 0.4); strip(0.1, 0.32, M.stoneCap, wallTop - 0.6); } // 홀: 두꺼운 처마 돌림띠
    }
    // 홀: 1층/2층 경계의 벨트 코스
    if (st === STYLE.hall && y0 <= 3.45 && y1 >= 3.65) strip(0.22, 0.1, M.stoneWarm, 3.55);
  }

  // ── 창문 ──
  function addWindow(wd) {
    const hgt = wd.y1 - wd.y0, cy = (wd.y0 + wd.y1) / 2;
    const g = new THREE.Group();
    const part = (w, h, d, x, y, z, mat = M.trimWood, cast = true) => {
      const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), cast);
      m.position.set(x, y, z);
      g.add(m);
    };
    const D = T + 0.08;
    part(0.08, hgt, D, -wd.w / 2 + 0.04, 0, 0); part(0.08, hgt, D, wd.w / 2 - 0.04, 0, 0);
    part(wd.w, 0.08, D, 0, hgt / 2 - 0.04, 0); part(wd.w, 0.08, D, 0, -hgt / 2 + 0.04, 0);
    part(0.04, hgt, 0.05, 0, 0, 0);
    part(wd.w, 0.04, 0.05, 0, hgt * 0.18, 0); // 가로 창살
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(wd.w - 0.1, hgt - 0.1), M.glass);
    g.add(glass);
    part(wd.w + 0.35, 0.07, T + 0.4, 0, -hgt / 2 - 0.02, 0, M.stoneCap); // 창턱
    part(wd.w + 0.2, 0.1, T + 0.14, 0, hgt / 2 + 0.05, 0, M.stoneCap); // 상인방
    if (wd.axis === 'x') g.position.set(wd.c, cy, wd.fixed);
    else { g.rotation.y = Math.PI / 2; g.position.set(wd.fixed, cy, wd.c); }
    group.add(g);
    ctx.windows.push({ ...wd, y: cy });
  }

  // ── 문틀 + 상인방 ──
  function addDoor(d) {
    const dh = doorHeight(d);
    if (isSheetDoor(d)) return dh; // 문틀·몰딩이 이미지에 그려져 있음
    const w = d.width;
    const g = new THREE.Group();
    const part = (pw, ph, pd, x, y, z) => {
      const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), M.trimWood), false);
      m.position.set(x, y, z);
      g.add(m);
    };
    const D = T + 0.12;
    part(0.1, dh, D, -w / 2 - 0.05, dh / 2, 0); part(0.1, dh, D, w / 2 + 0.05, dh / 2, 0);
    part(w + 0.2, 0.12, D, 0, dh - 0.06, 0);
    part(w + 0.5, 0.1, D + 0.04, 0, dh + 0.05, 0); // 아키트레이브
    part(w + 0.7, 0.06, D + 0.08, 0, dh + 0.13, 0);
    if (d.axis === 'x') g.position.set(d.center.x, 0, d.center.z);
    else { g.rotation.y = Math.PI / 2; g.position.set(d.center.x, 0, d.center.z); }
    group.add(g);
    return dh;
  }

  // ── 벽 높이 규칙: 홀은 HALL_H(2층 높이), 날개/방은 3.4m ──
  function pieceHeight(axis, fixed, mid, jsonH) {
    if (axis === 'x' && (fixed === 0 || fixed === 24)) return mid < 20 ? HALL_H : 3.4;
    if (axis === 'z' && (fixed === 20 || fixed === 0)) return HALL_H; // 홀 동/서쪽 벽
    return jsonH;
  }

  // 홀 북쪽 벽을 ChatGPT 정면 입면도(이미지)로 덮을 때는 3D 창/몰딩을 만들지 않는다 (이미지에 이미 그려져 있음)
  const flatNorth = !!ctx.assets?.wallNorth;
  const flatSouth = !!ctx.assets?.wallSouth;
  const isHallNorth = (axis, fixed, x) => axis === 'x' && Math.abs(fixed) < 0.01 && x < 20;
  const isHallSouth = (axis, fixed, x) => axis === 'x' && Math.abs(fixed - 24) < 0.01 && x < 20;

  const windowsFor = (axis, fixed, a0, a1) =>
    WINDOWS.filter(w => w.axis === axis && Math.abs(w.fixed - fixed) < 0.01 && w.c - w.w / 2 > a0 - 0.01 && w.c + w.w / 2 < a1 + 0.01
      && !(flatNorth && isHallNorth(w.axis, w.fixed, w.c)) && !(flatSouth && isHallSouth(w.axis, w.fixed, w.c))
      && !(eastSheetOn && w.axis === 'z' && Math.abs(w.fixed - 20) < 0.01)
      && !(westSheetOn && w.axis === 'z' && Math.abs(w.fixed) < 0.01))
      .sort((p, q) => p.c - q.c);

  // 창 열 하나(여러 층)를 벽에 뚫는다: 층 사이는 벽으로 막고 층마다 창틀을 단다
  function emitWall(axis, fixed, a0, a1, h) {
    if (a1 - a0 < 0.01) return;
    const wins = windowsFor(axis, fixed, a0, a1);
    let cur = a0;
    for (const w of wins) {
      const a = w.c - w.w / 2, b = w.c + w.w / 2, lv = w.levels;
      wallPiece(axis, fixed, cur, a, 0, h, h);
      wallPiece(axis, fixed, a, b, 0, lv[0][0], h);
      for (let i = 0; i < lv.length - 1; i++) wallPiece(axis, fixed, a, b, lv[i][1], lv[i + 1][0], h);
      wallPiece(axis, fixed, a, b, lv[lv.length - 1][1], h, h);
      lv.forEach(([y0, y1]) => addWindow({ axis: w.axis, fixed: w.fixed, c: w.c, w: w.w, y0, y1, gallery: y0 > 3, noBeam: w.noBeam }));
      cur = b;
    }
    wallPiece(axis, fixed, cur, a1, 0, h, h);
  }

  // ── JSON 벽 → 시각 + 충돌 ──
  for (const w of layout.walls) {
    if (w.id.startsWith('gate_')) continue; // 정문 울타리는 exterior.js
    const axis = w.size.x > w.size.z ? 'x' : 'z';
    const cx = w.center.x, cz = w.center.z;
    const a0 = axis === 'x' ? cx - w.size.x / 2 : cz - w.size.z / 2;
    const a1 = axis === 'x' ? cx + w.size.x / 2 : cz + w.size.z / 2;
    const fixed = axis === 'x' ? cz : cx;
    ctx.col.addBox(cx - w.size.x / 2, cz - w.size.z / 2, cx + w.size.x / 2, cz + w.size.z / 2, 0, 4.5, 'wall');
    // x=20 에서 높이가 바뀌는 벽은 쪼갠다
    if (axis === 'x' && (fixed === 0 || fixed === 24) && a0 < 20 && a1 > 20) {
      emitWall(axis, fixed, a0, 20, HALL_H);
      emitWall(axis, fixed, 20, a1, 3.4);
    } else {
      emitWall(axis, fixed, a0, a1, pieceHeight(axis, fixed, (a0 + a1) / 2, w.size.y));
    }
  }

  // 문: 문틀 + 위쪽 벽(상인방)
  for (const d of layout.doors) {
    if (d.id === 'D12') continue;
    const dh = addDoor(d);
    const axis = d.axis;
    const fixed = axis === 'x' ? d.center.z : d.center.x;
    const c = axis === 'x' ? d.center.x : d.center.z;
    const hh = pieceHeight(axis, fixed, c, 3.4);
    if (d.id === 'D10') {
      // 홀 남쪽 정문 위: 부채꼴 대신 높은 채광창(transom)
      wallPiece(axis, fixed, c - d.width / 2, c + d.width / 2, dh, 3.7, hh);
      wallPiece(axis, fixed, c - d.width / 2, c + d.width / 2, 6.4, hh, hh);
      if (!ctx.assets?.wallSouth) addWindow({ axis, fixed, c, w: d.width, y0: 3.7, y1: 6.4, gallery: true }); // 이미지가 있으면 채광창도 그려져 있음
    } else {
      wallPiece(axis, fixed, c - d.width / 2, c + d.width / 2, dh, hh, hh);
    }
  }

  // ── 바닥 ──
  const planeUV = (w, d, t) => {
    const g = new THREE.PlaneGeometry(w, d);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / t, (uv.getY(i) * d) / t);
    return g;
  };
  const floorMat = {
    courtyard: 'cobble', east_path: 'pavers', south_path: 'pavers',
  };
  for (const z of ZONES) {
    const st = STYLE[z.id];
    const mat = M[st ? st.floor : floorMat[z.id]];
    if (!mat) continue;
    const m = new THREE.Mesh(planeUV(z.w, z.d, tileOf(mat)), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(z.x + z.w / 2, z.id === 'courtyard' ? 0 : 0.01, z.z + z.d / 2);
    m.receiveShadow = true;
    group.add(m);
  }

  // ── 천장 (실내) ──
  const ceilMatFor = id => (id === 'hall' ? M.plaster : M.plaster);
  for (const z of ZONES) {
    const st = STYLE[z.id];
    if (!st) continue;
    const H = st.ceilH;
    const mats = [M.concrete, M.concrete, M.concrete, ceilMatFor(z.id), M.concrete, M.concrete];
    const cm = shadowed(new THREE.Mesh(faceBox(z.w, 0.2, z.d, mats.map(tileOf)), mats));
    cm.position.set(z.x + z.w / 2, H + 0.1, z.z + z.d / 2);
    group.add(cm);
    ceilings.push(cm);
    // 홀: 격자 보 (코퍼 천장)
    if (z.id === 'hall') {
      const beamMat = M.darkWood;
      for (let x = 2.5; x < z.w; x += 5) {
        const b = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, z.d), beamMat), false);
        b.position.set(z.x + x, H - 0.16, z.z + z.d / 2);
        group.add(b); ceilings.push(b);
      }
      for (let zz = 2; zz < z.d; zz += 4) {
        const b = shadowed(new THREE.Mesh(new THREE.BoxGeometry(z.w, 0.3, 0.3), beamMat), false);
        b.position.set(z.x + z.w / 2, H - 0.15, z.z + zz);
        group.add(b); ceilings.push(b);
      }
    }
  }

  // ── 지붕 (겉에서 보임. 단면 피라미드) ──
  const roofMat = M.slate.clone();
  roofMat.map = M.slate.map.clone(); roofMat.normalMap = M.slate.normalMap.clone(); roofMat.roughnessMap = M.slate.roughnessMap.clone();
  [roofMat.map, roofMat.normalMap, roofMat.roughnessMap].forEach(t => { t.repeat.set(7, 7); t.needsUpdate = true; });
  // 직사각형 밑면(처마 0.5m 포함)의 사각뿔 지붕. (원뿔을 가로/세로로 따로 늘리면 정사각형이 아닐 때 밑면이 마름모로 틀어져 벽 밖/안으로 삐져나온다)
  const pyramid = (w, d, h) => {
    const hw = w / 2, hd = d / 2;
    const A = [-hw, 0, -hd], B = [hw, 0, -hd], C = [hw, 0, hd], D = [-hw, 0, hd], P = [0, h, 0];
    const tris = [[A, B, P, 0], [B, C, P, 1], [C, D, P, 0], [D, A, P, 1]];
    const pos = [], uv = [];
    for (const [p, q, r, e] of tris) {
      const len = e === 0 ? w : d;
      pos.push(...p, ...r, ...q); // 바깥쪽(위)이 앞면이 되도록 감는 순서
      uv.push(0, 0, 0.5, 1, 1, 0);
      void len;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    return geo;
  };
  const hip = (x0, z0, x1, z1, y, rh) => {
    const w = x1 - x0 + 1.0, d = z1 - z0 + 1.0;
    const m = new THREE.Mesh(pyramid(w, d, rh), roofMat);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    roofs.push(m);
  };
  hip(0, 0, 20, 24, HALL_H + 0.2, 3.6); // 홀
  // 처마(0.5m)가 홀 안쪽으로 삐져나오지 않게, 홀과 맞닿는 변(x=20, z=24)은 안쪽으로 0.5m 물려 시작한다
  hip(20.5, 0, 39, 24, 3.6, 2.2); // 동쪽 날개
  hip(8, 24.5, 12, 30, 3.6, 1.2); // 현관
  hip(-9, 1, -0.5, 17, 3.8, 1.7); // 서쪽 별채(서재 2칸): 처마가 홀 쪽(x>0)으로 넘지 않게 x1=-0.5

  return { group, ceilings, roofs };
}
